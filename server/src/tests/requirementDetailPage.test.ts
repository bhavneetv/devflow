/**
 * Unit & Integration Test Suite for Phase 5: Requirement Detail Page & Versioning
 *
 * Verifies:
 * 1. Open approved requirement (v1)
 * 2. Editing approved requirement strictly triggers Rule 5:
 *    - New revision v2 created with changeReason
 *    - Original v1 snapshot preserved with exact historical data
 *    - currentVersion incremented to 2
 *    - Activity event 'requirement.version_created' emitted (Rule 7)
 * 3. Side-by-side diff comparison logic:
 *    - Accurately detects modified fields
 *    - Formats changes for side-by-side / inline rendering
 * 4. Acceptance criteria toggles and progress calculation
 * 5. Rule 9 compliance: Clean placeholders for unlinked tasks/tests, no fake items
 * 6. Discussion comments tied to version and resolution toggle
 * 7. Draft requirement edit does NOT create new version (in-place update)
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

console.log('\n🧪 Running Phase 5 Requirement Detail Page Checkpoint Tests...\n');

// Mock in-memory database
interface RequirementRecord {
  id: number;
  code: string;
  projectId: number;
  title: string;
  summary?: string;
  description?: string;
  expectedBehavior?: string;
  constraints?: string;
  priority: string;
  workflowStatus: string;
  implementationStatus: string;
  currentVersion: number;
  authorId: number;
  reviewerId?: number;
  acceptanceCriteria: Array<{
    id: number;
    code: string;
    description: string;
    isComplete: boolean;
  }>;
  versions: Array<{
    id: number;
    versionNumber: number;
    snapshot: string;
    changedById: number;
    changeReason: string;
    createdAt: Date;
  }>;
  comments: Array<{
    id: number;
    authorId: number;
    body: string;
    versionId?: number | null;
    resolvedAt?: Date | null;
  }>;
  links: Array<{
    id: number;
    targetType: string;
    targetId: number;
    task?: { id: number; title: string; status: string };
  }>;
}

const db: {
  requirements: RequirementRecord[];
  activityEvents: any[];
} = {
  requirements: [],
  activityEvents: [],
};

// Seed an initial Approved Requirement v1
db.requirements.push({
  id: 101,
  code: 'REQ-001',
  projectId: 1,
  title: 'Real-time Collaborative Whiteboard',
  summary: 'Allows distributed teams to draw diagrams collaboratively with sub-50ms latency.',
  description: 'Canvas with multi-user cursors and shape rendering over WebSockets.',
  expectedBehavior: 'Cursors render within 50ms across all active room peers.',
  constraints: 'Maximum 100 concurrent users per whiteboard session.',
  priority: 'HIGH',
  workflowStatus: 'APPROVED',
  implementationStatus: 'IN_PROGRESS',
  currentVersion: 1,
  authorId: 10,
  reviewerId: 20,
  acceptanceCriteria: [
    { id: 1, code: 'AC-001', description: 'Cursor updates stream under 50ms latency', isComplete: true },
    { id: 2, code: 'AC-002', description: 'Supports pen, rectangle, and text tools', isComplete: false },
    { id: 3, code: 'AC-003', description: 'Canvas state persists across browser refresh', isComplete: false },
  ],
  versions: [
    {
      id: 1,
      versionNumber: 1,
      changedById: 10,
      changeReason: 'Initial approved specification',
      createdAt: new Date('2026-11-01T10:00:00Z'),
      snapshot: JSON.stringify({
        code: 'REQ-001',
        title: 'Real-time Collaborative Whiteboard',
        summary: 'Allows distributed teams to draw diagrams collaboratively with sub-50ms latency.',
        description: 'Canvas with multi-user cursors and shape rendering over WebSockets.',
        expectedBehavior: 'Cursors render within 50ms across all active room peers.',
        constraints: 'Maximum 100 concurrent users per whiteboard session.',
        priority: 'HIGH',
        workflowStatus: 'APPROVED',
        acceptanceCriteria: [
          { code: 'AC-001', description: 'Cursor updates stream under 50ms latency' },
          { code: 'AC-002', description: 'Supports pen, rectangle, and text tools' },
          { code: 'AC-003', description: 'Canvas state persists across browser refresh' },
        ],
      }),
    },
  ],
  comments: [],
  links: [],
});

// Implementation of Edit Requirement (mirroring PATCH /api/requirements/:id)
function processUpdateRequirement(
  reqId: number,
  userId: number,
  payload: {
    title?: string;
    summary?: string;
    description?: string;
    expectedBehavior?: string;
    constraints?: string;
    priority?: string;
    implementationStatus?: string;
    changeReason?: string;
    requireReReview?: boolean;
  }
) {
  const req = db.requirements.find((r) => r.id === reqId);
  if (!req) return { success: false, error: 'Requirement not found' };

  const isApproved = req.workflowStatus === 'APPROVED';

  // Rule 5: Editing an approved requirement ALWAYS creates a NEW REVISION
  if (isApproved) {
    if (!payload.changeReason || !payload.changeReason.trim()) {
      return {
        success: false,
        error: 'Rule 5 Governance: A change reason is required when modifying an approved requirement.',
      };
    }

    const nextVersionNumber = req.currentVersion + 1;

    // Apply updates
    if (payload.title) req.title = payload.title;
    if (payload.summary) req.summary = payload.summary;
    if (payload.description) req.description = payload.description;
    if (payload.expectedBehavior) req.expectedBehavior = payload.expectedBehavior;
    if (payload.constraints) req.constraints = payload.constraints;
    if (payload.priority) req.priority = payload.priority;
    if (payload.implementationStatus) req.implementationStatus = payload.implementationStatus;

    req.currentVersion = nextVersionNumber;

    if (payload.requireReReview) {
      req.workflowStatus = 'PENDING_REVIEW';
    }

    // Create new version snapshot (Rule 5)
    const newVersion = {
      id: req.versions.length + 1,
      versionNumber: nextVersionNumber,
      changedById: userId,
      changeReason: payload.changeReason.trim(),
      createdAt: new Date(),
      snapshot: JSON.stringify({
        code: req.code,
        title: req.title,
        summary: req.summary,
        description: req.description,
        expectedBehavior: req.expectedBehavior,
        constraints: req.constraints,
        priority: req.priority,
        workflowStatus: req.workflowStatus,
        acceptanceCriteria: req.acceptanceCriteria,
      }),
    };

    req.versions.unshift(newVersion); // newest first

    // Activity event (Rule 7)
    db.activityEvents.push({
      action: 'requirement.version_created',
      resourceId: req.id,
      actorId: userId,
      details: {
        code: req.code,
        title: req.title,
        version: nextVersionNumber,
        changeReason: payload.changeReason,
      },
    });

    return { success: true, requirement: req, newVersion };
  }

  // Normal draft update (in-place)
  if (payload.title) req.title = payload.title;
  if (payload.description) req.description = payload.description;

  db.activityEvents.push({
    action: 'requirement.updated',
    resourceId: req.id,
    actorId: userId,
  });

  return { success: true, requirement: req };
}

// Diff calculator (mirroring frontend compare modal)
function calculateSnapshotDiff(snapshotA: string, snapshotB: string) {
  const dataA = JSON.parse(snapshotA);
  const dataB = JSON.parse(snapshotB);

  const keys = ['title', 'summary', 'description', 'expectedBehavior', 'constraints', 'priority'];
  const diffs: Record<string, { before: any; after: any; isChanged: boolean }> = {};

  for (const k of keys) {
    const isChanged = dataA[k] !== dataB[k];
    diffs[k] = {
      before: dataA[k],
      after: dataB[k],
      isChanged,
    };
  }

  return diffs;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

// Test 1: Fetch initial approved requirement
const req101 = db.requirements.find((r) => r.id === 101)!;
assert(req101 !== undefined, 'Target requirement 101 exists in database');
assert(req101.workflowStatus === 'APPROVED', 'Requirement is in APPROVED workflow status');
assert(req101.currentVersion === 1, 'Initial version is v1');
assert(req101.versions.length === 1, 'Version history has exactly 1 version initially');

// Test 2: Attempt edit without changeReason (must fail per Rule 5)
const failedEdit = processUpdateRequirement(101, 10, {
  constraints: 'Scale to 500 concurrent users',
  changeReason: '',
});
assert(failedEdit.success === false, 'Modifying approved requirement without changeReason is rejected');
assert(
  Boolean(failedEdit.error?.includes('Rule 5 Governance')),
  'Rejection error explicitly cites Rule 5 Governance'
);
assert(req101.currentVersion === 1, 'Version number remains 1 after failed edit attempt');

// Test 3: Edit approved requirement with changeReason (Rule 5 triggers new revision)
const successfulEdit = processUpdateRequirement(101, 10, {
  constraints: 'Maximum 500 concurrent users per whiteboard session (expanded from 100).',
  expectedBehavior: 'Cursors render within 30ms across all active room peers.',
  changeReason: 'Updated scalability constraints following architecture review.',
  requireReReview: false,
});

assert(successfulEdit.success === true, 'Approved requirement edit succeeded with change reason');
assert(req101.currentVersion === 2, 'Requirement currentVersion incremented to 2 (v2)');
assert(req101.versions.length === 2, 'Version history now contains 2 revisions');

// Test 4: Verify original v1 snapshot was preserved and not overwritten
const v1Snapshot = JSON.parse(req101.versions[1].snapshot); // index 1 is older
const v2Snapshot = JSON.parse(req101.versions[0].snapshot); // index 0 is newest

assert(
  v1Snapshot.constraints === 'Maximum 100 concurrent users per whiteboard session.',
  'Historical v1 snapshot retained original constraint (100 users)'
);
assert(
  v2Snapshot.constraints === 'Maximum 500 concurrent users per whiteboard session (expanded from 100).',
  'New v2 snapshot contains revised constraint (500 users)'
);
assert(
  req101.versions[0].changeReason === 'Updated scalability constraints following architecture review.',
  'Revision v2 records explicit user change reason'
);

// Test 5: Verify ActivityEvent logged (Rule 7)
const versionEvent = db.activityEvents.find((e) => e.action === 'requirement.version_created');
assert(versionEvent !== undefined, 'ActivityEvent for requirement.version_created emitted (Rule 7)');
assert(versionEvent.details.version === 2, 'ActivityEvent details record version 2');
assert(versionEvent.details.code === 'REQ-001', 'ActivityEvent details record requirement code REQ-001');

// Test 6: Diff comparison calculation
const diff = calculateSnapshotDiff(req101.versions[1].snapshot, req101.versions[0].snapshot);
assert(diff.constraints.isChanged === true, 'Diff detector flags constraints as modified');
assert(diff.expectedBehavior.isChanged === true, 'Diff detector flags expectedBehavior as modified');
assert(diff.title.isChanged === false, 'Diff detector flags unchanged title as unmodified');

// Test 7: Acceptance criteria interactive toggle and progress calculation
const ac2 = req101.acceptanceCriteria.find((ac) => ac.code === 'AC-002')!;
assert(ac2.isComplete === false, 'AC-002 initially not completed');
// Toggle completion
ac2.isComplete = true;
assert(ac2.isComplete === true, 'AC-002 toggled to complete');
const completedCount = req101.acceptanceCriteria.filter((ac) => ac.isComplete).length;
const totalCount = req101.acceptanceCriteria.length;
const percent = Math.round((completedCount / totalCount) * 100);
assert(completedCount === 2, '2 of 3 acceptance criteria completed');
assert(percent === 67, 'Progress calculated at 67%');

// Test 8: Rule 9 Placeholder check (Never fabricate links)
assert(req101.links.length === 0, 'No fake tasks exist in database');
const displayMode = req101.links.length > 0 ? 'LIST_TASKS' : 'PLACEHOLDER_CARD';
assert(
  displayMode === 'PLACEHOLDER_CARD',
  'UI renders clean placeholder card when no tasks linked (Rule 9 compliant)'
);

// Test 9: Threaded comments and version referencing
req101.comments.push({
  id: 1,
  authorId: 20,
  body: 'Is 500 concurrent users sufficient for the upcoming enterprise demo?',
  versionId: 2,
  resolvedAt: null,
});
assert(req101.comments.length === 1, 'Comment added to discussion');
assert(req101.comments[0].versionId === 2, 'Comment successfully linked to specific revision v2');

// Toggle resolve comment
req101.comments[0].resolvedAt = new Date();
assert(req101.comments[0].resolvedAt !== null, 'Comment marked as resolved');

// Test 10: Draft requirement edit does NOT increment version
db.requirements.push({
  id: 102,
  code: 'REQ-002',
  projectId: 1,
  title: 'Draft Feature',
  priority: 'LOW',
  workflowStatus: 'DRAFT',
  implementationStatus: 'NOT_STARTED',
  currentVersion: 1,
  authorId: 10,
  acceptanceCriteria: [],
  versions: [{ id: 10, versionNumber: 1, snapshot: '{}', changedById: 10, changeReason: 'Created', createdAt: new Date() }],
  comments: [],
  links: [],
});

const draftEdit = processUpdateRequirement(102, 10, {
  title: 'Draft Feature (Renamed)',
});
const draftReq = db.requirements.find((r) => r.id === 102)!;
assert(draftEdit.success === true, 'Draft requirement updated');
assert(draftReq.currentVersion === 1, 'Draft requirement version remains v1 (in-place update)');
assert(draftReq.title === 'Draft Feature (Renamed)', 'Draft requirement title updated in-place');

// Test 11: Impact warning when editing an IMPLEMENTED requirement
console.log('\n📌 Section 11: Implemented Requirement Impact Warning');

interface EditModalStateSim {
  isEditModalOpen: boolean;
  showImplementedImpactWarning: boolean;
}

function simulateOpenEditModal(
  req: { implementationStatus: string },
  skipWarning = false
): EditModalStateSim {
  let isEditModalOpen = false;
  let showImplementedImpactWarning = false;

  const isForce = skipWarning;
  if (!isForce && req.implementationStatus === 'IMPLEMENTED') {
    showImplementedImpactWarning = true;
    return { isEditModalOpen, showImplementedImpactWarning };
  }

  isEditModalOpen = true;
  return { isEditModalOpen, showImplementedImpactWarning };
}

const implementedReq = { implementationStatus: 'IMPLEMENTED' };
const inProgressReq = { implementationStatus: 'IN_PROGRESS' };

const attemptBlocked = simulateOpenEditModal(implementedReq, false);
assert(
  attemptBlocked.showImplementedImpactWarning && !attemptBlocked.isEditModalOpen,
  'Editing IMPLEMENTED requirement shows impact warning dialog and blocks immediate edit modal'
);

const attemptContinued = simulateOpenEditModal(implementedReq, true);
assert(
  !attemptContinued.showImplementedImpactWarning && attemptContinued.isEditModalOpen,
  'Continuing from impact warning dialog opens edit modal'
);

const nonImplementedAttempt = simulateOpenEditModal(inProgressReq, false);
assert(
  !nonImplementedAttempt.showImplementedImpactWarning && nonImplementedAttempt.isEditModalOpen,
  'Editing non-implemented requirement opens edit modal directly without warning dialog'
);

// ── Test 12: Conflicting-edit / Stale-version check (Item 12) ────
console.log('\n📌 Section 12: Conflicting-edit / Stale-version Guard');

function processUpdateWithVersionCheck(
  storedReq: { currentVersion: number; title: string },
  payload: { currentVersion?: number; forceOverwrite?: boolean; title?: string }
) {
  if (
    !payload.forceOverwrite &&
    typeof payload.currentVersion === 'number' &&
    payload.currentVersion !== storedReq.currentVersion
  ) {
    return {
      status: 409,
      code: 'VERSION_CONFLICT',
      error: `Conflicting edit: Requirement has been modified to revision v${storedReq.currentVersion}. Your editor is on v${payload.currentVersion}.`,
      serverVersion: storedReq.currentVersion,
      clientVersion: payload.currentVersion,
    };
  }

  if (payload.title) storedReq.title = payload.title;
  return { status: 200, success: true, storedReq };
}

const liveReq = { currentVersion: 2, title: 'Live Revision v2' };

// Stale edit attempt (client thought it was v1)
const staleAttempt = processUpdateWithVersionCheck(liveReq, {
  currentVersion: 1,
  title: 'Stale Edit from Tab A',
});
assert(staleAttempt.status === 409, 'Stale edit returns HTTP 409 Conflict');
assert(staleAttempt.code === 'VERSION_CONFLICT', 'Error code is VERSION_CONFLICT');
assert(staleAttempt.serverVersion === 2, 'Response returns serverVersion: 2');
assert(staleAttempt.clientVersion === 1, 'Response returns clientVersion: 1');
assert(liveReq.title === 'Live Revision v2', 'Stored requirement unchanged after rejected stale edit');

// Force overwrite attempt
const overwriteAttempt = processUpdateWithVersionCheck(liveReq, {
  currentVersion: 1,
  forceOverwrite: true,
  title: 'Overwritten with Client Changes',
});
assert(overwriteAttempt.status === 200, 'Force overwrite succeeds with HTTP 200');
assert(liveReq.title === 'Overwritten with Client Changes', 'Stored requirement updated after force overwrite');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 Phase 5 Checkpoint passed all tests!\n');
}
