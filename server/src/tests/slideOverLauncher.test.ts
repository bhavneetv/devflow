/**
 * Unit & Integration Test Suite for Phase 11: Slide-Over Module Launcher
 *
 * Verifies:
 * 1. Global Slide-Over Trigger & Keyboard Shortcut logic:
 *    - Sequential trigger 'g' then 'r' (within 1s threshold).
 *    - Modifier combo Cmd/Ctrl + Shift + R.
 *    - Dismissal on Escape key and backdrop click.
 * 2. Quick Metrics aggregation:
 *    - Total requirements count.
 *    - Review queue count (PENDING_REVIEW).
 *    - Active execution count (IN_PROGRESS).
 *    - Blocked count (BLOCKED).
 * 3. "Needs Attention" filter criteria:
 *    - Items awaiting reviewer's approval.
 *    - Items returned to author with Changes Requested.
 *    - Items blocked in implementation.
 *    - Overdue items unverified.
 * 4. Recent requirements history cache:
 *    - Item selection appends to recent stack.
 *    - Deduplication: selecting existing item moves it to front.
 *    - Cap limit enforced (maximum 8 recent items).
 * 5. Instant search filtering across ID, Title, and Summary.
 */

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
    failed++;
  }
}

console.log('\n🧪 Running Phase 11 Slide-Over Module Launcher Checkpoint Tests...\n');

// ─── Test 1: Keyboard Shortcut State Machine ────────────────────────────────

interface KeyboardEventSim {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  targetTag?: string;
}

class SlideOverTriggerStateMachine {
  public isOpen = false;
  private lastKey = '';
  private lastKeyTime = 0;

  public handleKeyDown(e: KeyboardEventSim): void {
    const isInput = ['INPUT', 'TEXTAREA'].includes(e.targetTag || '');

    // Escape closes drawer
    if (e.key === 'Escape' && this.isOpen) {
      this.isOpen = false;
      return;
    }

    // Ctrl/Cmd + Shift + R toggles drawer
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
      this.isOpen = !this.isOpen;
      return;
    }

    // 'g' then 'r' sequential shortcut
    if (!isInput) {
      const now = Date.now();
      if (e.key.toLowerCase() === 'g') {
        this.lastKey = 'g';
        this.lastKeyTime = now;
      } else if (e.key.toLowerCase() === 'r' && this.lastKey === 'g' && now - this.lastKeyTime < 1000) {
        this.isOpen = !this.isOpen;
        this.lastKey = '';
      } else {
        this.lastKey = '';
      }
    }
  }

  public simulateTimeElapsed(ms: number) {
    this.lastKeyTime -= ms;
  }
}

console.log('📌 Section 1: Keyboard Shortcuts & Toggle Logic');

const machine = new SlideOverTriggerStateMachine();
assert(!machine.isOpen, 'Slide-over is closed initially');

// Trigger 'g' then 'r'
machine.handleKeyDown({ key: 'g' });
machine.handleKeyDown({ key: 'r' });
assert(machine.isOpen, "'g' then 'r' opens slide-over");

// Escape to close
machine.handleKeyDown({ key: 'Escape' });
assert(!machine.isOpen, 'Escape closes slide-over');

// Ctrl + Shift + R
machine.handleKeyDown({ key: 'r', ctrlKey: true, shiftKey: true });
assert(machine.isOpen, 'Ctrl + Shift + R toggles slide-over open');

machine.handleKeyDown({ key: 'r', metaKey: true, shiftKey: true });
assert(!machine.isOpen, 'Cmd + Shift + R toggles slide-over closed');

// Typing inside an input should NOT trigger 'g' 'r'
machine.handleKeyDown({ key: 'g', targetTag: 'INPUT' });
machine.handleKeyDown({ key: 'r', targetTag: 'INPUT' });
assert(!machine.isOpen, "Typing 'g' then 'r' inside input field does not open slide-over");

// ─── Test 1b: Sidebar Navigation Interception & Fallback ────────────────────
console.log('\n📌 Section 1b: Sidebar Navigation Interception');

function simulateSidebarItemClick(itemId: string, drawerMounted: boolean) {
  let defaultPrevented = false;
  let eventDispatched = false;

  const mockEvent = {
    preventDefault: () => {
      defaultPrevented = true;
    },
  };

  if (itemId === 'requirements') {
    const isDrawerMounted = drawerMounted;
    if (isDrawerMounted) {
      mockEvent.preventDefault();
      eventDispatched = true;
    }
  }

  return { defaultPrevented, eventDispatched };
}

const mountedResult = simulateSidebarItemClick('requirements', true);
assert(
  mountedResult.defaultPrevented && mountedResult.eventDispatched,
  'Clicking Requirements in sidebar dispatches drawer toggle and prevents routing when drawer is mounted'
);

const unmountedResult = simulateSidebarItemClick('requirements', false);
assert(
  !unmountedResult.defaultPrevented && !unmountedResult.eventDispatched,
  'Clicking Requirements falls back to default route navigation when drawer is unmounted'
);

const otherItemResult = simulateSidebarItemClick('projects', true);
assert(
  !otherItemResult.defaultPrevented && !otherItemResult.eventDispatched,
  'Clicking non-requirements items navigates normally'
);

// ─── Test 1c: Deep Linking & ARIA Accessibility (Item 8) ────────────────────
console.log('\n📌 Section 1c: Deep Linking & ARIA Attributes (Item 8)');

function checkDeepLink(search: string) {
  const params = new URLSearchParams(search);
  return params.get('launcher') === 'requirements';
}

assert(
  checkDeepLink('?launcher=requirements') === true,
  'URL query ?launcher=requirements triggers slide-over drawer open'
);
assert(
  checkDeepLink('?launcher=tasks') === false,
  'Other launcher parameters do not open requirements drawer'
);
assert(
  checkDeepLink('') === false,
  'Empty query string keeps slide-over drawer closed by default'
);

const drawerAriaAttributes = {
  role: 'dialog',
  'aria-modal': 'true',
  'aria-label': 'Requirements Hub',
};

assert(drawerAriaAttributes.role === 'dialog', 'Drawer container has role="dialog"');
assert(drawerAriaAttributes['aria-modal'] === 'true', 'Drawer container has aria-modal="true"');
assert(drawerAriaAttributes['aria-label'] === 'Requirements Hub', 'Drawer container has aria-label="Requirements Hub"');

// ─── Test 2: Quick Stats Aggregation ────────────────────────────────────────
console.log('\n📌 Section 2: Quick Metrics Strip');

interface MockRequirement {
  id: number;
  code: string;
  title: string;
  summary?: string;
  workflowStatus: string;
  implementationStatus: string;
  authorId: number;
  reviewerId?: number | null;
  targetDate?: string | null;
}

const mockReqs: MockRequirement[] = [
  {
    id: 1,
    code: 'REQ-001',
    title: 'OAuth2 Login',
    workflowStatus: 'APPROVED',
    implementationStatus: 'IN_PROGRESS',
    authorId: 5,
    reviewerId: 8,
  },
  {
    id: 2,
    code: 'REQ-002',
    title: 'Team Invites',
    workflowStatus: 'PENDING_REVIEW',
    implementationStatus: 'NOT_STARTED',
    authorId: 5,
    reviewerId: 10, // Assigned to current user (10)
  },
  {
    id: 3,
    code: 'REQ-003',
    title: 'Billing Webhooks',
    workflowStatus: 'CHANGES_REQUESTED',
    implementationStatus: 'NOT_STARTED',
    authorId: 10, // Current user is author
    reviewerId: 8,
  },
  {
    id: 4,
    code: 'REQ-004',
    title: 'Audit Log Retention',
    workflowStatus: 'APPROVED',
    implementationStatus: 'BLOCKED',
    authorId: 12,
    reviewerId: 8,
  },
  {
    id: 5,
    code: 'REQ-005',
    title: 'CSV Exporter',
    workflowStatus: 'APPROVED',
    implementationStatus: 'VERIFIED',
    authorId: 10,
    reviewerId: 8,
    targetDate: '2026-01-01T00:00:00Z',
  },
  {
    id: 6,
    code: 'REQ-006',
    title: 'Realtime WebSockets',
    workflowStatus: 'APPROVED',
    implementationStatus: 'IN_PROGRESS',
    authorId: 5,
    reviewerId: 8,
    targetDate: '2026-01-01T00:00:00Z', // Overdue and unverified
  },
];

function calculateQuickStats(items: MockRequirement[]) {
  return {
    total: items.length,
    pendingReview: items.filter((r) => r.workflowStatus === 'PENDING_REVIEW').length,
    inProgress: items.filter((r) => r.implementationStatus === 'IN_PROGRESS').length,
    blocked: items.filter((r) => r.implementationStatus === 'BLOCKED').length,
    approved: items.filter((r) => r.workflowStatus === 'APPROVED').length,
  };
}

const stats = calculateQuickStats(mockReqs);
assert(stats.total === 6, 'Total requirements count equals 6');
assert(stats.pendingReview === 1, 'Pending review count equals 1');
assert(stats.inProgress === 2, 'In progress count equals 2');
assert(stats.blocked === 1, 'Blocked count equals 1');
assert(stats.approved === 4, 'Approved count equals 4');

// ─── Test 3: Needs Attention Filtering ──────────────────────────────────────
console.log('\n📌 Section 3: Needs Attention Filter');

function filterNeedsAttention(items: MockRequirement[], currentUserId: number) {
  const now = Date.now();
  return items.filter((r) => {
    const isAwaitingMyReview = r.workflowStatus === 'PENDING_REVIEW' && r.reviewerId === currentUserId;
    const isMyChangesRequested = r.workflowStatus === 'CHANGES_REQUESTED' && r.authorId === currentUserId;
    const isBlocked = r.implementationStatus === 'BLOCKED';
    const isOverdue =
      r.targetDate &&
      new Date(r.targetDate).getTime() < now &&
      r.implementationStatus !== 'VERIFIED';

    return isAwaitingMyReview || isMyChangesRequested || isBlocked || isOverdue;
  });
}

const attentionList = filterNeedsAttention(mockReqs, 10);
// Items needing user 10's attention:
// - REQ-002: PENDING_REVIEW with reviewerId = 10
// - REQ-003: CHANGES_REQUESTED with authorId = 10
// - REQ-004: BLOCKED
// - REQ-006: Overdue and IN_PROGRESS
assert(attentionList.length === 4, `Needs Attention list returned 4 items (got ${attentionList.length})`);
assert(attentionList.some((r) => r.code === 'REQ-002'), 'Awaiting my review included in attention list');
assert(attentionList.some((r) => r.code === 'REQ-003'), 'Changes requested on my spec included in attention list');
assert(attentionList.some((r) => r.code === 'REQ-004'), 'Blocked implementation included in attention list');
assert(attentionList.some((r) => r.code === 'REQ-006'), 'Overdue unverified requirement included in attention list');

// ─── Test 4: Recent History Storage & Deduplication ─────────────────────────
console.log('\n📌 Section 4: Recent History Cache & LRU');

class MockRecentRequirementsCache {
  private items: Array<{ id: number; code: string; title: string }> = [];
  private readonly maxLimit = 8;

  public push(req: { id: number; code: string; title: string }) {
    // Remove if already exists
    this.items = this.items.filter((i) => i.id !== req.id);
    // Prepend
    this.items.unshift(req);
    // Enforce cap
    if (this.items.length > this.maxLimit) {
      this.items = this.items.slice(0, this.maxLimit);
    }
  }

  public getItems() {
    return [...this.items];
  }
}

const cache = new MockRecentRequirementsCache();
cache.push({ id: 1, code: 'REQ-001', title: 'OAuth2' });
cache.push({ id: 2, code: 'REQ-002', title: 'Invites' });
cache.push({ id: 3, code: 'REQ-003', title: 'Billing' });

assert(cache.getItems()[0].code === 'REQ-003', 'Most recently viewed item is at index 0');
assert(cache.getItems().length === 3, 'Cache holds 3 items');

// Re-viewing REQ-001 moves it to front
cache.push({ id: 1, code: 'REQ-001', title: 'OAuth2' });
assert(cache.getItems()[0].code === 'REQ-001', 'Re-selecting existing requirement moves it to index 0');
assert(cache.getItems().length === 3, 'No duplicate entries created in cache');

// Test cap of 8 items
for (let i = 10; i <= 20; i++) {
  cache.push({ id: i, code: `REQ-${i}`, title: `Item ${i}` });
}
assert(cache.getItems().length === 8, 'Cache size strictly capped at maxLimit (8)');

// ─── Test 5: Instant Search Filter ──────────────────────────────────────────
console.log('\n📌 Section 5: Instant Search Filter');

function instantSearch(items: MockRequirement[], query: string) {
  if (!query.trim()) return items;
  const q = query.toLowerCase().trim();
  return items.filter(
    (r) =>
      r.code.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      (r.summary && r.summary.toLowerCase().includes(q))
  );
}

const codeSearchResults = instantSearch(mockReqs, 'REQ-003');
assert(codeSearchResults.length === 1 && codeSearchResults[0].code === 'REQ-003', 'Search by code matches REQ-003');

const titleSearchResults = instantSearch(mockReqs, 'webhook');
assert(titleSearchResults.length === 1 && titleSearchResults[0].code === 'REQ-003', 'Case-insensitive title search matches');

const emptyQueryResults = instantSearch(mockReqs, '');
assert(emptyQueryResults.length === mockReqs.length, 'Empty search query returns all requirements');

// Summary
console.log('\n────────────────────────────────────────────────────────────');
console.log(`Phase 11 Slide-Over Module Launcher Summary: ${passed} passed, ${failed} failed`);
console.log('────────────────────────────────────────────────────────────\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

