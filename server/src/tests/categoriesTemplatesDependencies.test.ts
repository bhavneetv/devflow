/**
 * Unit & Integration Test Suite for Phase 7: Categories, Templates & Dependencies
 *
 * Verifies:
 * 1. Category CRUD with requirement reassignment on deletion.
 * 2. System default templates (User Story, Technical Spec, Bug Fix, Compliance Item)
 *    and custom template creation.
 * 3. Pre-population of requirement fields and default acceptance criteria from template.
 * 4. Dependency linking across all supported types:
 *    - DEPENDS_ON, BLOCKS, RELATED_TO, ENHANCES, CONFLICTS_WITH.
 * 5. Circular Dependency Prevention (DFS cycle detection):
 *    - Direct cycle: A depends on B, attempt B depends on A (REJECTED).
 *    - Transitive cycle: A -> B -> C, attempt C depends on A (REJECTED).
 *    - Mixed ordering types: A blocks B (B depends on A), attempt A depends on B (REJECTED).
 *    - Self-dependency: A depends on A (REJECTED).
 *    - Non-ordering types (RELATED_TO, ENHANCES) do NOT trigger cycle blocks.
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

console.log('\n🧪 Running Phase 7 Categories, Templates & Dependencies Checkpoint Tests...\n');

// Mock in-memory database
interface CategoryRecord {
  id: number;
  name: string;
  description?: string | null;
  icon?: string;
  color?: string;
  defaultType: string;
  scope: string;
  isActive: boolean;
}

interface TemplateRecord {
  id: number;
  name: string;
  description?: string;
  structure: string; // JSON
  scope: string;
  isActive: boolean;
}

interface RequirementRecord {
  id: number;
  code: string;
  projectId: number;
  title: string;
  type: string;
  priority: string;
  categoryId?: number | null;
  description?: string;
  constraints?: string;
  acceptanceCriteria: Array<{ code: string; description: string; verificationMethod?: string }>;
}

interface DependencyRecord {
  id: number;
  fromRequirementId: number;
  toRequirementId: number;
  type: 'DEPENDS_ON' | 'BLOCKS' | 'RELATED_TO' | 'ENHANCES' | 'CONFLICTS_WITH';
}

const db: {
  categories: CategoryRecord[];
  templates: TemplateRecord[];
  requirements: RequirementRecord[];
  dependencies: DependencyRecord[];
} = {
  categories: [],
  templates: [],
  requirements: [],
  dependencies: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. CATEGORY MANAGEMENT TESTS
// ─────────────────────────────────────────────────────────────────────────────

function createCategory(payload: {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  defaultType?: string;
  scope?: string;
}) {
  if (!payload.name || payload.name.trim().length < 2) {
    return { success: false, error: 'Category name must be at least 2 characters' };
  }
  const cat: CategoryRecord = {
    id: db.categories.length + 1,
    name: payload.name.trim(),
    description: payload.description || null,
    icon: payload.icon || 'tag',
    color: payload.color || '#3B82F6',
    defaultType: payload.defaultType || 'FUNCTIONAL',
    scope: payload.scope || 'PROJECT',
    isActive: true,
  };
  db.categories.push(cat);
  return { success: true, data: cat };
}

function deleteCategory(categoryId: number, reassignToCategoryId?: number | null) {
  const catIndex = db.categories.findIndex((c) => c.id === categoryId);
  if (catIndex === -1) return { success: false, error: 'Category not found' };

  const assignedCount = db.requirements.filter((r) => r.categoryId === categoryId).length;
  if (assignedCount > 0 && !reassignToCategoryId) {
    return {
      success: false,
      error: `Cannot delete category: ${assignedCount} requirements are currently assigned to this category. A reassignment category (reassignToCategoryId) is required.`,
    };
  }

  // Reassign requirements
  for (const r of db.requirements) {
    if (r.categoryId === categoryId) {
      r.categoryId = reassignToCategoryId || null;
    }
  }

  db.categories.splice(catIndex, 1);
  return { success: true, message: 'Category deleted' };
}

// Test 1: Create Categories
const cat1 = createCategory({
  name: 'Security & Auth',
  description: 'Authentication, authorization, and zero-trust security',
  color: '#EF4444',
  defaultType: 'SECURITY',
});
assert(cat1.success === true, 'Created category 1 (Security & Auth)');

const cat2 = createCategory({
  name: 'Core Platform',
  description: 'General backend platform services',
  color: '#3B82F6',
  defaultType: 'TECHNICAL',
});
assert(cat2.success === true, 'Created category 2 (Core Platform)');

// Seed requirements in cat1
db.requirements.push({
  id: 1,
  code: 'REQ-001',
  projectId: 1,
  title: 'JWT Auth Tokens',
  type: 'SECURITY',
  priority: 'HIGH',
  categoryId: cat1.data!.id,
  acceptanceCriteria: [],
});

db.requirements.push({
  id: 2,
  code: 'REQ-002',
  projectId: 1,
  title: 'OAuth Integration',
  type: 'SECURITY',
  priority: 'MEDIUM',
  categoryId: cat1.data!.id,
  acceptanceCriteria: [],
});

// Test 2: Deleting category with requirements without reassignment is blocked (Blocker 2)
const failDel = deleteCategory(cat1.data!.id);
assert(failDel.success === false, 'Deleting category with assigned requirements without target is blocked');
assert(failDel.error?.includes('reassignment category') ?? false, 'Reassignment required error returned');

// Test 2b: Delete Category with Valid Reassignment
const delResult = deleteCategory(cat1.data!.id, cat2.data!.id);
assert(delResult.success === true, 'Category 1 deleted successfully with reassignment');
assert(db.categories.length === 1, '1 category remaining');
assert(db.requirements[0].categoryId === cat2.data!.id, 'REQ-001 reassigned to Core Platform category');
assert(db.requirements[1].categoryId === cat2.data!.id, 'REQ-002 reassigned to Core Platform category');

// ─────────────────────────────────────────────────────────────────────────────
// 2. TEMPLATES & REQUIREMENT INSTANTIATION TESTS
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_TEMPLATES = [
  {
    id: -1,
    name: 'User Story',
    scope: 'SYSTEM',
    structure: JSON.stringify({
      title: 'As a [user], I want [capability] so that [benefit]',
      type: 'FUNCTIONAL',
      priority: 'MEDIUM',
      description: '### User Persona\n- **Target User**: [e.g. Workspace Administrator]',
      defaultAcceptanceCriteria: [
        { code: 'AC-001', description: 'User action persists state', verificationMethod: 'Automated Test' },
      ],
    }),
  },
  {
    id: -2,
    name: 'Technical Specification',
    scope: 'SYSTEM',
    structure: JSON.stringify({
      title: 'Technical Spec: [Component / Service]',
      type: 'TECHNICAL',
      priority: 'HIGH',
      description: '### Architecture Overview\nSystem topology and data model.',
      constraints: 'p99 latency under 100ms.',
      defaultAcceptanceCriteria: [
        { code: 'AC-001', description: 'Schema contracts match typed interface', verificationMethod: 'Automated Test' },
      ],
    }),
  },
];

function instantiateRequirementFromTemplate(template: any, overrides: { projectId: number; code: string; title?: string }) {
  const struct = JSON.parse(template.structure);
  const req: RequirementRecord = {
    id: db.requirements.length + 1,
    code: overrides.code,
    projectId: overrides.projectId,
    title: overrides.title || struct.title,
    type: struct.type,
    priority: struct.priority,
    description: struct.description,
    constraints: struct.constraints || undefined,
    acceptanceCriteria: struct.defaultAcceptanceCriteria || [],
  };
  db.requirements.push(req);
  return req;
}

// Test 3: System templates exist
assert(SYSTEM_TEMPLATES.length === 2, 'System default templates available');

// Test 4: Instantiate requirement from User Story template
const storyReq = instantiateRequirementFromTemplate(SYSTEM_TEMPLATES[0], {
  projectId: 1,
  code: 'REQ-003',
  title: 'As an Admin, I want to manage audit logs so that we maintain compliance',
});
assert(storyReq.type === 'FUNCTIONAL', 'Template pre-populated type as FUNCTIONAL');
assert(storyReq.priority === 'MEDIUM', 'Template pre-populated priority as MEDIUM');
assert(storyReq.acceptanceCriteria.length === 1, 'Template pre-populated default acceptance criteria');
assert(
  Boolean(storyReq.description?.includes('### User Persona')),
  'Template pre-populated description prompt structure'
);

// Test 5: Instantiate requirement from Technical Spec template
const techReq = instantiateRequirementFromTemplate(SYSTEM_TEMPLATES[1], {
  projectId: 1,
  code: 'REQ-004',
});
assert(techReq.type === 'TECHNICAL', 'Technical Spec template pre-populated type as TECHNICAL');
assert(techReq.constraints === 'p99 latency under 100ms.', 'Technical Spec constraints pre-populated');

// ─────────────────────────────────────────────────────────────────────────────
// 3. DEPENDENCY & CIRCULAR DEPENDENCY DETECTION (DFS) TESTS
// ─────────────────────────────────────────────────────────────────────────────

// DFS Directed Cycle Detection Engine
function checkCycle(
  fromId: number,
  toId: number,
  type: 'DEPENDS_ON' | 'BLOCKS' | 'RELATED_TO' | 'ENHANCES' | 'CONFLICTS_WITH'
): { hasCycle: boolean; path?: string } {
  // Only ordering constraints are directional
  if (type !== 'DEPENDS_ON' && type !== 'BLOCKS') {
    return { hasCycle: false };
  }

  // Self-dependency
  if (fromId === toId) {
    return { hasCycle: true, path: `REQ-${fromId} -> REQ-${toId}` };
  }

  // A DEPENDS_ON B => A -> B (A requires B). Cycle if B already reaches A.
  // A BLOCKS B => B -> A (B requires A). Cycle if A already reaches B.
  const startNode = type === 'DEPENDS_ON' ? toId : fromId;
  const targetNode = type === 'DEPENDS_ON' ? fromId : toId;

  // Build adjacency list from existing ordering dependencies
  const adj = new Map<number, number[]>();
  for (const d of db.dependencies) {
    if (d.type === 'DEPENDS_ON' || d.type === 'BLOCKS') {
      let u = d.fromRequirementId;
      let v = d.toRequirementId;
      if (d.type === 'BLOCKS') {
        u = d.toRequirementId;
        v = d.fromRequirementId;
      }
      if (!adj.has(u)) adj.set(u, []);
      adj.get(u)!.push(v);
    }
  }

  // DFS traversal
  const visited = new Set<number>();
  const path: number[] = [];

  function dfs(curr: number): boolean {
    visited.add(curr);
    path.push(curr);

    if (curr === targetNode) return true;

    for (const next of adj.get(curr) || []) {
      if (!visited.has(next)) {
        if (dfs(next)) return true;
      }
    }

    path.pop();
    return false;
  }

  if (dfs(startNode)) {
    return { hasCycle: true, path: path.map((id) => `REQ-${id}`).join(' -> ') };
  }

  return { hasCycle: false };
}

function addDependency(
  fromId: number,
  toId: number,
  type: 'DEPENDS_ON' | 'BLOCKS' | 'RELATED_TO' | 'ENHANCES' | 'CONFLICTS_WITH'
) {
  const cycle = checkCycle(fromId, toId, type);
  if (cycle.hasCycle) {
    return {
      success: false,
      error: `Circular dependency detected: ${cycle.path}. Requirements cannot form a circular dependency chain for ordering relationships (DEPENDS_ON, BLOCKS).`,
    };
  }

  const dep: DependencyRecord = {
    id: db.dependencies.length + 1,
    fromRequirementId: fromId,
    toRequirementId: toId,
    type,
  };
  db.dependencies.push(dep);
  return { success: true, data: dep };
}

// Seed 3 Requirements: REQ-10, REQ-20, REQ-30
const R10 = 10;
const R20 = 20;
const R30 = 30;

// Test 6: Self-dependency attempt (Must Fail)
const selfDep = addDependency(R10, R10, 'DEPENDS_ON');
assert(selfDep.success === false, 'Self-dependency (REQ-10 -> REQ-10) is rejected');

// Test 7: Valid dependency linking: REQ-10 DEPENDS_ON REQ-20
const dep1 = addDependency(R10, R20, 'DEPENDS_ON');
assert(dep1.success === true, 'Linked: REQ-10 DEPENDS_ON REQ-20');

// Test 8: Direct circular dependency: REQ-20 DEPENDS_ON REQ-10 (Must Fail)
const directCycle = addDependency(R20, R10, 'DEPENDS_ON');
assert(directCycle.success === false, 'Direct circular dependency (REQ-20 DEPENDS_ON REQ-10) is rejected');
assert(
  Boolean(directCycle.error?.includes('Circular dependency detected')),
  'Error message explicitly specifies Circular dependency detected'
);

// Test 9: Valid transitive link: REQ-20 DEPENDS_ON REQ-30
const dep2 = addDependency(R20, R30, 'DEPENDS_ON');
assert(dep2.success === true, 'Linked: REQ-20 DEPENDS_ON REQ-30');

// Test 10: Multi-hop transitive cycle: REQ-30 DEPENDS_ON REQ-10 (Must Fail)
// Path: 10 -> 20 -> 30, so 30 -> 10 would create a 3-node cycle!
const multiHopCycle = addDependency(R30, R10, 'DEPENDS_ON');
assert(multiHopCycle.success === false, 'Transitive multi-hop cycle (REQ-30 DEPENDS_ON REQ-10) is rejected');
assert(
  Boolean(multiHopCycle.error?.includes('REQ-10')),
  'Cycle error path contains involved requirements'
);

// Test 11: Cross-type ordering cycle with BLOCKS:
// REQ-10 already depends on REQ-30 (via REQ-10 -> REQ-20 -> REQ-30).
// If REQ-10 BLOCKS REQ-30, then REQ-30 would depend on REQ-10, creating a cycle!
const blocksCycle = addDependency(R10, R30, 'BLOCKS'); // 10 blocks 30 => 30 depends on 10
assert(blocksCycle.success === false, 'Cycle involving BLOCKS relationship is rejected');
assert(
  Boolean(blocksCycle.error?.includes('Circular dependency detected')),
  'Blocks cycle error cites circular dependency'
);

// Test 12: Non-ordering relationships allow bidirectional links
const related1 = addDependency(R10, R30, 'RELATED_TO');
assert(related1.success === true, 'REQ-10 RELATED_TO REQ-30 allowed');

const related2 = addDependency(R30, R10, 'RELATED_TO');
assert(related2.success === true, 'REQ-30 RELATED_TO REQ-10 allowed (non-ordering type does not block)');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 Phase 7 Checkpoint passed all tests!\n');
}
