import { calculateProjectHealth } from '../services/projectOverview.service.js';

console.log('🧪 Running Project Overview Health Engine Unit Tests...\n');

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${desc}`);
    failed++;
  }
}

// -------------------------------------------------------------
// Scenario 1: CRITICAL Health State
// -------------------------------------------------------------
console.log('--- Test Scenario 1: CRITICAL Health Triggers ---');

// Case 1A: Blockers > 0
const res1A = calculateProjectHealth({
  blockers: 2,
  overdueDeadlines: 0,
  deadlineWithinThreeDays: false,
});
assert(res1A.health === 'CRITICAL', 'Health is CRITICAL when blockers > 0');
assert(res1A.reasons.some((r) => r.includes('2 blocking issues')), 'Includes reason for blockers');

// Case 1B: Overdue deadlines > 0
const res1B = calculateProjectHealth({
  blockers: 0,
  overdueDeadlines: 1,
  deadlineWithinThreeDays: false,
});
assert(res1B.health === 'CRITICAL', 'Health is CRITICAL when overdue deadlines > 0');
assert(res1B.reasons.some((r) => r.includes('1 overdue deadline')), 'Includes reason for overdue deadlines');

// Case 1C: Both blockers and overdue deadlines
const res1C = calculateProjectHealth({
  blockers: 3,
  overdueDeadlines: 2,
  deadlineWithinThreeDays: true,
});
assert(res1C.health === 'CRITICAL', 'Health is CRITICAL when both blockers and overdue deadlines exist');
assert(res1C.reasons.length === 2, 'Lists both critical reasons');

// -------------------------------------------------------------
// Scenario 2: AT_RISK Health State
// -------------------------------------------------------------
console.log('\n--- Test Scenario 2: AT_RISK Health Triggers ---');

// Case 2A: Deadline approaching in <= 3 days with 0 blockers & 0 overdue
const res2A = calculateProjectHealth({
  blockers: 0,
  overdueDeadlines: 0,
  deadlineWithinThreeDays: true,
});
assert(res2A.health === 'AT_RISK', 'Health is AT_RISK when deadline is due in less than 3 days');
assert(res2A.reasons.some((r) => r.includes('Deadline approaching in less than 3 days')), 'Includes approaching deadline reason');

// Case 2B: Sprint > 90% elapsed but burndown < 70%
const res2B = calculateProjectHealth({
  blockers: 0,
  overdueDeadlines: 0,
  deadlineWithinThreeDays: false,
  sprintElapsedPct: 92,
  sprintBurndownPct: 55,
});
assert(res2B.health === 'AT_RISK', 'Health is AT_RISK when sprint is > 90% elapsed with < 70% burndown');
assert(res2B.reasons.some((r) => r.includes('92% elapsed')), 'Mentions sprint elapsed percentage in reason');

// -------------------------------------------------------------
// Scenario 3: HEALTHY State
// -------------------------------------------------------------
console.log('\n--- Test Scenario 3: HEALTHY State ---');

// Case 3A: No blockers, no overdue, deadlines safe, sprint progress normal
const res3A = calculateProjectHealth({
  blockers: 0,
  overdueDeadlines: 0,
  deadlineWithinThreeDays: false,
  sprintElapsedPct: 60,
  sprintBurndownPct: 65,
});
assert(res3A.health === 'HEALTHY', 'Health is HEALTHY when all metrics within normal thresholds');
assert(res3A.reasons.some((r) => r.includes('normal thresholds')), 'Reason indicates normal thresholds');

// Case 3B: Sprint 95% elapsed AND 95% burned down (on track!)
const res3B = calculateProjectHealth({
  blockers: 0,
  overdueDeadlines: 0,
  deadlineWithinThreeDays: false,
  sprintElapsedPct: 95,
  sprintBurndownPct: 95,
});
assert(res3B.health === 'HEALTHY', 'Health is HEALTHY when high sprint elapsed is matched by high burndown');

console.log('\n=============================================================');
console.log(`Health Engine Unit Test Summary: ${passed} passed, ${failed} failed`);
console.log('=============================================================');

if (failed > 0) {
  process.exit(1);
}

