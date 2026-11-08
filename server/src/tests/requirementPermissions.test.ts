/**
 * Unit Test Suite for Requirements Permissions Service (Phase 2 Checkpoint)
 *
 * Checks:
 * 1. Author CANNOT approve own requirement (Governance rule 4)
 * 2. Viewer CANNOT create requirements
 * 3. Developer can propose (create) draft but CANNOT submit for review
 * 4. Reviewer can review & approve when assigned, but cannot approve if author
 * 5. Owner & Manager retain administrative controls
 * 6. Category management is restricted to Org Admin / Owner
 */

import {
  can,
  UserContext,
  RequirementResource,
  resolveEffectiveRole,
} from '../services/requirementPermissions.service.js';

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

console.log('\n🧪 Running Phase 2 Permissions Service Unit Tests...\n');

// ── Test Setup ──────────────────────────────────────────────────
const orgOwner: UserContext = {
  id: 1,
  orgRole: 'OWNER',
  projectRole: 'OWNER',
};

const projectManager: UserContext = {
  id: 2,
  orgRole: 'MEMBER',
  projectRole: 'MANAGER',
};

const authorUser: UserContext = {
  id: 10,
  orgRole: 'MEMBER',
  projectRole: 'MEMBER',
};

const reviewerUser: UserContext = {
  id: 20,
  orgRole: 'MEMBER',
  projectRole: 'MEMBER',
};

const developerUser: UserContext = {
  id: 30,
  orgRole: 'MEMBER',
  projectRole: 'MEMBER',
  teamRole: 'DEVELOPER',
};

const viewerUser: UserContext = {
  id: 40,
  orgRole: 'VIEWER',
  projectRole: 'VIEWER',
};

const sampleRequirement: RequirementResource = {
  id: 101,
  code: 'REQ-001',
  projectId: 5,
  authorId: 10,
  reviewerId: 20,
  workflowStatus: 'PENDING_REVIEW',
};

const draftRequirement: RequirementResource = {
  id: 102,
  code: 'REQ-002',
  projectId: 5,
  authorId: 10,
  reviewerId: 20,
  workflowStatus: 'DRAFT',
};

// ── 1. Checkpoint Test: Author CANNOT approve own requirement ──
console.log('--- Test 1: Author Cannot Approve Own Requirement (Governance Rule 4) ---');
const authorApproveResult = can(authorUser, 'approve', sampleRequirement);
assert(
  authorApproveResult.allowed === false && authorApproveResult.code === 'AUTHOR_CANNOT_APPROVE',
  'Author attempting to approve own requirement is strictly DENIED with AUTHOR_CANNOT_APPROVE',
  `Result: allowed=${authorApproveResult.allowed}, code=${authorApproveResult.code}`
);

const authorRejectResult = can(authorUser, 'reject', sampleRequirement);
assert(
  authorRejectResult.allowed === false && authorRejectResult.code === 'AUTHOR_CANNOT_APPROVE',
  'Author attempting to reject own requirement is strictly DENIED with AUTHOR_CANNOT_APPROVE'
);

// Reviewer CAN approve when assigned and NOT the author
const reviewerApproveResult = can(reviewerUser, 'approve', sampleRequirement);
assert(
  reviewerApproveResult.allowed === true,
  'Designated Reviewer (non-author) CAN approve requirement in PENDING_REVIEW'
);

// Even if the Author is an Org Owner, governance rule 4 forbids self-approval!
const ownerAuthorRequirement: RequirementResource = {
  ...sampleRequirement,
  authorId: orgOwner.id, // Owner is the author
};
const ownerSelfApproveResult = can(orgOwner, 'approve', ownerAuthorRequirement);
assert(
  ownerSelfApproveResult.allowed === false && ownerSelfApproveResult.code === 'AUTHOR_CANNOT_APPROVE',
  'Even Org Owner cannot approve their own authored requirement'
);

// ── 2. Checkpoint Test: Viewer CANNOT create requirements ──────
console.log('\n--- Test 2: Viewer Cannot Create Requirements ---');
const viewerCreateResult = can(viewerUser, 'create', { projectId: 5 });
assert(
  viewerCreateResult.allowed === false && viewerCreateResult.code === 'ROLE_INSUFFICIENT',
  'Viewer attempting to create requirement is DENIED with ROLE_INSUFFICIENT'
);

const viewerViewResult = can(viewerUser, 'view', sampleRequirement);
assert(
  viewerViewResult.allowed === true,
  'Viewer CAN view requirements (Read-only access permitted)'
);

const viewerEditResult = can(viewerUser, 'edit_own_draft', draftRequirement);
assert(
  viewerEditResult.allowed === false && viewerEditResult.code === 'ROLE_INSUFFICIENT',
  'Viewer cannot edit draft requirements'
);

// ── 3. Checkpoint Test: Developer can propose (create) but NOT submit ──
console.log('\n--- Test 3: Developer Can Propose (Create Draft) but Cannot Submit ---');
const devCreateResult = can(developerUser, 'create', { projectId: 5 });
assert(
  devCreateResult.allowed === true,
  'Developer CAN propose/create a draft requirement'
);

const devSubmitResult = can(developerUser, 'submit_for_review', draftRequirement);
assert(
  devSubmitResult.allowed === false && devSubmitResult.code === 'ROLE_INSUFFICIENT',
  'Developer CANNOT submit requirement for review without explicit permission'
);

// Author (with Author rights) CAN submit their own draft
const authorSubmitResult = can(authorUser, 'submit_for_review', draftRequirement);
assert(
  authorSubmitResult.allowed === true,
  'Author CAN submit their own draft requirement for review'
);

// Developer with explicit permission override CAN submit
const devWithSubmitPerm: UserContext = {
  ...developerUser,
  permissions: { canSubmitRequirements: true },
};
const devExplicitSubmitResult = can(devWithSubmitPerm, 'submit_for_review', draftRequirement);
assert(
  devExplicitSubmitResult.allowed === true,
  'Developer with explicit canSubmitRequirements permission CAN submit for review'
);

// ── 4. Additional Matrix Tests ──────────────────────────────────
console.log('\n--- Test 4: Additional RBAC Matrix Enforcement ---');
// Category Management: Org Owner / Admin only
assert(
  can(orgOwner, 'manage_categories').allowed === true,
  'Org Owner CAN manage categories'
);
assert(
  can(projectManager, 'manage_categories').allowed === false,
  'Project Manager without Org Admin CANNOT manage org categories'
);
assert(
  can(developerUser, 'manage_categories').allowed === false,
  'Developer CANNOT manage categories'
);

// Edit Approved Requirement
const approvedRequirement: RequirementResource = {
  ...sampleRequirement,
  workflowStatus: 'APPROVED',
};
assert(
  can(authorUser, 'edit_approved', approvedRequirement).allowed === false,
  'Author CANNOT edit approved requirement directly'
);
assert(
  can(projectManager, 'edit_approved', approvedRequirement).allowed === true,
  'Project Manager CAN initiate revision on approved requirement'
);

// Task Linking
assert(
  can(developerUser, 'create_linked_task', sampleRequirement).allowed === true,
  'Developer CAN link tasks to requirement'
);
assert(
  can(viewerUser, 'create_linked_task', sampleRequirement).allowed === false,
  'Viewer CANNOT link tasks to requirement'
);

// Summary
console.log('\n────────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('────────────────────────────────────────────\n');

if (failed > 0) {
  process.exit(1);
}

