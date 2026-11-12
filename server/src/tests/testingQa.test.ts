import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import { prisma } from '../lib/prisma.js';
import { testingRouter } from '../routes/testing.routes.js';
import { developmentRouter } from '../routes/development.routes.js';
import { projectModulesRouter } from '../routes/projectModules.routes.js';

async function main() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/projects/:projectId/testing', testingRouter);
  app.use('/api/projects/:projectId/development', developmentRouter);
  app.use('/api/projects', projectModulesRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api/projects`;

  const ts = Date.now();
  let ownerId = 0;
  let collabId = 0;
  let viewerId = 0;
  let outsiderId = 0;
  let projectId = 0;
  let otherProjectId = 0;

  try {
    const owner = await prisma.user.create({
      data: { email: `qa-owner-${ts}@example.com`, name: 'QA Lead Owner', role: 'MEMBER' },
    });
    ownerId = owner.id;
    const collab = await prisma.user.create({
      data: { email: `qa-collab-${ts}@example.com`, name: 'QA Dev Collaborator', role: 'MEMBER' },
    });
    collabId = collab.id;
    const viewer = await prisma.user.create({
      data: { email: `qa-viewer-${ts}@example.com`, name: 'QA Viewer', role: 'MEMBER' },
    });
    viewerId = viewer.id;
    const outsider = await prisma.user.create({
      data: { email: `qa-outsider-${ts}@example.com`, name: 'QA Outsider', role: 'MEMBER' },
    });
    outsiderId = outsider.id;

    const project = await prisma.project.create({
      data: {
        title: `Testing QA Project ${ts}`,
        ownerId: owner.id,
        members: {
          create: [
            { userId: collab.id, role: 'COLLABORATOR' },
            { userId: viewer.id, role: 'VIEWER' },
          ],
        },
      },
    });
    projectId = project.id;

    const otherProject = await prisma.project.create({
      data: {
        title: `Other Project ${ts}`,
        ownerId: owner.id,
      },
    });
    otherProjectId = otherProject.id;

    // Seed linked requirement, dev task, and project document
    const requirement = await prisma.requirement.create({
      data: {
        projectId,
        code: 'REQ-901',
        title: 'User Authentication & OAuth Refresh',
        authorId: ownerId,
      },
    });

    const devMod = await prisma.developmentModule.create({
      data: { projectId, name: 'Auth Module', slug: 'auth-module' },
    });
    const devSub = await prisma.developmentSubmodule.create({
      data: { projectId, moduleId: devMod.id, name: 'OAuth API', slug: 'oauth-api' },
    });

    const devTask = await prisma.developmentTask.create({
      data: {
        projectId,
        taskKey: 'DEV-901',
        sequenceNumber: 1,
        moduleId: devMod.id,
        submoduleId: devSub.id,
        title: 'Implement OAuth refresh endpoint',
        taskType: 'Feature',
        priority: 'High',
        status: 'In Progress',
        createdById: ownerId,
      },
    });

    const projectDoc = await prisma.projectDocument.create({
      data: {
        projectId,
        displayName: 'oauth-trace.log',
        originalName: 'oauth-trace.log',
        storageKey: `qa-seed-${ts}-oauth-trace`,
        mimeType: 'text/plain',
        extension: 'log',
        sizeBytes: 256,
        repositoryPath: 'qa/seed/oauth-trace.log',
        uploadedById: ownerId,
      },
    });

    const ownerToken = `Bearer devflow_session_${ownerId}_${ts}`;
    const collabToken = `Bearer devflow_session_${collabId}_${ts}`;
    const viewerToken = `Bearer devflow_session_${viewerId}_${ts}`;
    const outsiderToken = `Bearer devflow_session_${outsiderId}_${ts}`;

    const api = async (
      path: string,
      method = 'GET',
      body?: unknown,
      token = ownerToken,
      targetProj = projectId
    ) => {
      const res = await fetch(`${baseUrl}/${targetProj}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: token } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
      return { status: res.status, json, headers: res.headers };
    };

    const assert = (cond: boolean, msg: string) => {
      if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
    };

    // 1. RBAC & Auth Checks
    const unauth = await api('/testing/overview', 'GET', undefined, '');
    assert(unauth.status === 401, `Expected 401 unauthenticated, got ${unauth.status}`);

    const outside = await api('/testing/overview', 'GET', undefined, outsiderToken);
    assert(outside.status === 403, `Expected 403 outsider, got ${outside.status}`);

    const viewerOverview = await api('/testing/overview', 'GET', undefined, viewerToken);
    assert(viewerOverview.status === 200, `Expected 200 viewer overview, got ${viewerOverview.status}`);

    const viewerCreate = await api(
      '/testing/test-cases',
      'POST',
      { title: 'Should fail for viewer' },
      viewerToken
    );
    assert(viewerCreate.status === 403, `Expected 403 viewer create test case, got ${viewerCreate.status}`);

    // 2. Auto-provision Testing & QA built-in submodules safely when existing modules exist
    await prisma.projectModule.create({
      data: { projectId, name: 'Engineering', icon: 'code-2', position: 0 },
    });
    const modList = await api('/modules', 'GET');
    assert(modList.status === 200 && modList.json.data.length >= 2, 'Expected auto-provisioned Testing & QA module');
    const qaMod = modList.json.data.find((m: any) => m.name === 'Testing & QA');
    assert(qaMod && qaMod.submodules.length === 8, `Expected 8 QA submodules, got ${qaMod?.submodules?.length}`);

    // Hiding a submodule must NOT cause re-provisioning and must preserve data
    const hideSub = qaMod.submodules[0];
    const patchSub = await api(`/submodules/${hideSub.id}`, 'PATCH', { isVisible: false });
    assert(patchSub.status === 200, 'Should hide submodule');
    const modListAfterHide = await api('/modules', 'GET');
    const qaModAfterHide = modListAfterHide.json.data.find((m: any) => m.id === qaMod.id);
    assert(
      qaModAfterHide.submodules.find((s: any) => s.id === hideSub.id).isVisible === false,
      'Hidden submodule must remain hidden'
    );

    // 3. Test Cases CRUD, validation & ordered steps
    const tc1Res = await api('/testing/test-cases', 'POST', {
      title: 'Verify OAuth refresh exchanges valid refresh token',
      description: 'Validates JWT rotation and refresh persistence.',
      preconditions: 'Active user session exists.',
      testType: 'API',
      priority: 'Critical',
      status: 'Ready',
      assignedTesterId: collabId,
      linkedRequirementId: requirement.id,
      linkedDevTaskId: devTask.id,
      labels: ['auth', 'oauth'],
      steps: [
        { stepNumber: 1, action: 'Call POST /auth/refresh with valid token', testData: 'grant=refresh', expectedResult: '200 OK with new accessToken' },
        { stepNumber: 2, action: 'Verify old refresh token is revoked', testData: 'old_token', expectedResult: '401 Unauthorized on replay' },
      ],
    });
    assert(tc1Res.status === 201 && tc1Res.json.data.caseKey === 'TC-001', `Expected TC-001 created, got ${JSON.stringify(tc1Res)}`);
    const tc1Id = tc1Res.json.data.id;

    const tc2Res = await api('/testing/test-cases', 'POST', {
      title: 'Verify expired refresh token returns 401',
      testType: 'Security',
      priority: 'High',
      status: 'Ready',
      steps: [{ stepNumber: 1, action: 'Send expired refresh cookie', expectedResult: '401 Invalid token' }],
    });
    assert(tc2Res.status === 201 && tc2Res.json.data.caseKey === 'TC-002', 'Expected TC-002 created');
    const tc2Id = tc2Res.json.data.id;

    const tc3Res = await api('/testing/test-cases', 'POST', {
      title: 'Verify rate limiting on token endpoint',
      testType: 'Performance',
      priority: 'Medium',
      status: 'Ready',
    });
    assert(tc3Res.status === 201, 'Expected TC-003 created');
    const tc3Id = tc3Res.json.data.id;

    // Duplicate Test Case
    const dupRes = await api(`/testing/test-cases/${tc2Id}/duplicate`, 'POST');
    assert(dupRes.status === 201 && dupRes.json.data.caseKey !== 'TC-002', 'Expected duplicated test case key');

    // 4. Test Suites & non-destructive removal
    const suiteRes = await api('/testing/test-suites', 'POST', {
      name: 'Auth Regression',
      purpose: 'Regression',
      testCaseIds: [tc1Id, tc2Id],
    });
    assert(suiteRes.status === 201 && suiteRes.json.data.cases.length === 2, `Expected suite with 2 cases, got ${JSON.stringify(suiteRes)}`);
    const suiteId = suiteRes.json.data.id;

    // Reorder cases in suite
    const reorderRes = await api(`/testing/test-suites/${suiteId}/cases`, 'PUT', {
      testCaseIds: [tc2Id, tc1Id],
    });
    assert(
      reorderRes.status === 200 && reorderRes.json.data.cases[0].testCase.id === tc2Id,
      'Suite case order must match PUT payload'
    );

    // Cross-project suite isolation: create test case in otherProjectId and try adding to suiteId
    const otherTc = await api('/testing/test-cases', 'POST', { title: 'Other Project Case' }, ownerToken, otherProjectId);
    const crossAdd = await api(`/testing/test-suites/${suiteId}/cases`, 'PUT', {
      testCaseIds: [tc2Id, otherTc.json.data.id],
    });
    assert(
      crossAdd.status === 200 && !crossAdd.json.data.cases.some((c: any) => c.testCase.id === otherTc.json.data.id),
      'Cross-project test case must never attach to suite'
    );

    // Remove TC-002 from suite and verify TC-002 still exists
    await api(`/testing/test-suites/${suiteId}/cases`, 'PUT', { testCaseIds: [tc1Id] });
    const tc2Check = await api(`/testing/test-cases/${tc2Id}`, 'GET');
    assert(tc2Check.status === 200 && tc2Check.json.data.isArchived === false, 'Removing from suite must keep original test case');

    // Re-add tc2 to suite for Test Plan
    await api(`/testing/test-suites/${suiteId}/cases`, 'PUT', { testCaseIds: [tc1Id, tc2Id] });

    // 5. Test Plans & Date validation + Transactional Run Start
    const badDatePlan = await api('/testing/test-plans', 'POST', {
      title: 'Bad Dates Plan',
      startDate: '2026-11-20',
      dueDate: '2026-11-10',
    });
    assert(badDatePlan.status === 400, `Expected 400 when dueDate < startDate, got ${badDatePlan.status}`);

    const emptyPlan = await api('/testing/test-plans', 'POST', { title: 'Empty Plan' });
    const startEmpty = await api(`/testing/test-plans/${emptyPlan.json.data.id}/start-run`, 'POST', {});
    assert(startEmpty.status === 400, `Expected 400 starting run from empty plan, got ${startEmpty.status}`);

    const planRes = await api('/testing/test-plans', 'POST', {
      title: 'v2.4 Release QA Plan',
      targetVersion: 'v2.4.0',
      targetEnvironment: 'Staging',
      startDate: '2026-11-10',
      dueDate: '2026-11-25',
      suiteIds: [suiteId],
      testCaseIds: [tc1Id, tc3Id], // tc1 overlaps with suite; must deduplicate
    });
    assert(planRes.status === 201 && planRes.json.data.uniqueCaseCount === 3, 'Expected deduplicated 3 unique cases in plan');
    const planId = planRes.json.data.id;

    // 6. Start Test Run -> Snapshot isolation when TestCase edited -> Step Executions -> Retest
    const runRes = await api(`/testing/test-plans/${planId}/start-run`, 'POST', {
      name: 'Release v2.4 Staging Pass 1',
      buildVersion: 'v2.4.0-rc1',
      environment: 'Staging',
    });
    assert(runRes.status === 201 && runRes.json.data.executions.length === 3, 'Expected 3 executions in test run');
    const runId = runRes.json.data.id;
    const exec1 = runRes.json.data.executions.find((e: any) => e.testCaseId === tc1Id);
    const exec2 = runRes.json.data.executions.find((e: any) => e.testCaseId === tc2Id);
    const exec3 = runRes.json.data.executions.find((e: any) => e.testCaseId === tc3Id);
    assert(exec1 && exec1.steps.length === 2, 'Expected 2 step execution snapshots on exec1');

    // Edit TC-001 definition & step #1 -> prior execution snapshots MUST NOT change!
    await api(`/testing/test-cases/${tc1Id}`, 'PATCH', {
      title: 'Verify OAuth refresh exchanges valid refresh token (EDITED v2)',
      steps: [
        { stepNumber: 1, action: 'COMPLETELY DIFFERENT STEP 1 ACTION', expectedResult: 'New result' },
      ],
    });
    const runAfterEdit = await api(`/testing/test-runs/${runId}`, 'GET');
    const frozenExec1 = runAfterEdit.json.data.executions.find((e: any) => e.id === exec1.id);
    assert(
      frozenExec1.caseTitleSnapshot === 'Verify OAuth refresh exchanges valid refresh token' &&
        frozenExec1.steps[0].action === 'Call POST /auth/refresh with valid token',
      'Editing TestCase MUST NOT overwrite existing execution snapshots'
    );

    // Update exec1 to Failed
    const failExec = await api(`/testing/executions/${exec1.id}`, 'PATCH', {
      status: 'Failed',
      actualResult: 'Returned 500 on replay',
      steps: [
        { id: exec1.steps[0].id, status: 'Passed', actualResult: '200 OK' },
        { id: exec1.steps[1].id, status: 'Failed', actualResult: 'Returned 500' },
      ],
    });
    assert(failExec.status === 200 && failExec.json.data.status === 'Failed', 'Expected exec1 Failed');

    // Update exec2 to Blocked, leave exec3 as Not Run
    await api(`/testing/executions/${exec2.id}`, 'PATCH', { status: 'Blocked', notes: 'Redis down' });

    // Retest exec1 -> creates attempt #2 while keeping attempt #1 history
    const retestRes = await api(`/testing/test-runs/${runId}/executions/${exec1.id}/retest`, 'POST', {});
    assert(retestRes.status === 201 && retestRes.json.data.attemptNumber === 2 && retestRes.json.data.isLatest === true, 'Expected Attempt #2');
    const exec1Attempt2Id = retestRes.json.data.id;
    await api(`/testing/executions/${exec1Attempt2Id}`, 'PATCH', {
      status: 'Passed',
      actualResult: 'Fixed in rc2; replay returns 401',
    });

    // Verify Pass Rate formula excludes Blocked & Not Run from eligible completed denominator:
    // Latest executions in runId: exec1Attempt2 (Passed), exec2 (Blocked), exec3 (Not Run)
    // Eligible = Passed(1) + Failed(0) = 1 -> passRate = 100%, blocked=1, notRun=1!
    const reportCheck = await api('/testing/reports', 'GET');
    assert(
      reportCheck.status === 200 &&
        reportCheck.json.data.summary.passedExecutions === 1 &&
        reportCheck.json.data.summary.failedExecutions === 0 &&
        reportCheck.json.data.summary.blockedExecutions === 1 &&
        reportCheck.json.data.summary.notRunExecutions === 1 &&
        reportCheck.json.data.summary.passRate === 100,
      `Pass rate calculation mismatch: ${JSON.stringify(reportCheck.json.data?.summary)}`
    );

    // Verify Test Case detail retains full execution history (both Attempt #1 Failed and Attempt #2 Passed)
    const tc1History = await api(`/testing/test-cases/${tc1Id}`, 'GET');
    assert(
      tc1History.json.data.executionHistory.length === 2,
      `Expected 2 preserved execution attempts in TC history, got ${tc1History.json.data.executionHistory.length}`
    );

    // 7. Defects Lifecycle, Verification RBAC, Reopen Count, Execution Link, DevTask Coverage
    const defectRes = await api(
      '/testing/defects',
      'POST',
      {
        title: '500 error on OAuth refresh token replay',
        severity: 'Critical',
        priority: 'Critical',
        stepsToReproduce: '1. Refresh token\n2. Replay old refresh token',
        expectedResult: '401 Unauthorized',
        actualResult: '500 Internal Server Error',
        environment: 'Staging',
        buildVersion: 'v2.4.0-rc1',
        linkedTestCaseId: tc1Id,
        linkedTestRunId: runId,
        linkedExecutionId: exec1.id,
        linkedDevTaskId: devTask.id,
        linkedRequirementId: requirement.id,
      },
      collabToken
    );
    assert(defectRes.status === 201 && defectRes.json.data.defectKey === 'BUG-001', 'Expected BUG-001 created');
    const defectId = defectRes.json.data.id;

    // Developer marks Fixed -> remains Fixed, NOT auto-closed
    const markFixed = await api(`/testing/defects/${defectId}`, 'PATCH', { status: 'Fixed' }, collabToken);
    assert(markFixed.status === 200 && markFixed.json.data.status === 'Fixed', 'Fixed must not auto-close');

    // Viewer cannot mutate or verify defect
    const viewerVerify = await api(`/testing/defects/${defectId}`, 'PATCH', { status: 'Verified' }, viewerToken);
    assert(viewerVerify.status === 403, `Viewer should receive 403 trying to verify defect, got ${viewerVerify.status}`);

    // Lead/Owner verifies then QA Reopens -> increments reopenCount
    const leadVerify = await api(`/testing/defects/${defectId}`, 'PATCH', { status: 'Verified' }, ownerToken);
    assert(leadVerify.status === 200 && leadVerify.json.data.status === 'Verified', 'Owner must be able to verify defect');

    const reopenRes = await api(`/testing/defects/${defectId}`, 'PATCH', { status: 'Reopened' }, ownerToken);
    assert(reopenRes.status === 200 && reopenRes.json.data.reopenCount === 1, 'Expected reopenCount === 1');

    // DevTask GET /:taskId returns QA Test Coverage
    const devTaskDetail = await api(`/development/tasks/${devTask.id}`, 'GET');
    assert(
      devTaskDetail.status === 200 &&
        devTaskDetail.json.data.testCoverage?.linkedTestCases?.length === 1 &&
        devTaskDetail.json.data.testCoverage?.linkedDefects?.length === 1,
      'DevelopmentTask detail must expose linked QA test cases & defects'
    );

    // 8. Attachments link & unlink without deleting ProjectDocument
    const attRes = await api('/testing/attachments/link', 'POST', {
      entityType: 'test_case',
      entityId: tc1Id,
      documentId: projectDoc.id,
    });
    assert(attRes.status === 200 && attRes.json.data.linked === true, 'Expected linked attachment on test case');
    const unattRes = await api('/testing/attachments/unlink', 'POST', {
      entityType: 'test_case',
      entityId: tc1Id,
      documentId: projectDoc.id,
    });
    assert(unattRes.status === 200 && unattRes.json.data.unlinked === true, 'Expected attachment link removed cleanly');
    const docStillExists = await prisma.projectDocument.findUnique({ where: { id: projectDoc.id } });
    assert(Boolean(docStillExists), 'Unlinking QA attachment must preserve ProjectDocument');

    // 9. Settings: Master Option Add, Duplicate Reject, Archive Preserves Historical Records
    const addMaster = await api('/testing/settings/master-option', 'POST', {
      category: 'testTypes',
      name: 'Chaos',
    });
    assert(addMaster.status === 201 && addMaster.json.data.created.name === 'Chaos', 'Expected custom testType added');

    const dupMaster = await api('/testing/settings/master-option', 'POST', {
      category: 'testTypes',
      name: 'chaos',
    });
    assert(dupMaster.status === 409, `Expected 409 duplicate master option, got ${dupMaster.status}`);

    const archiveMaster = await api('/testing/settings/master-option/archive', 'PATCH', {
      category: 'testTypes',
      name: 'Chaos',
      isArchived: true,
    });
    assert(archiveMaster.status === 200, 'Expected master option archived');

    // Non-admin cannot change settings
    const collabSettings = await api('/testing/settings', 'PATCH', { testCasePrefix: 'XTC' }, collabToken);
    assert(collabSettings.status === 403, 'Expected 403 on collaborator settings edit');

    // 10. Overview & CSV export
    const overview = await api('/testing/overview', 'GET');
    assert(
      overview.status === 200 &&
        overview.json.data.cards.totalTestCases === 4 &&
        overview.json.data.cards.openDefects === 1 &&
        overview.json.data.cards.criticalDefects === 1,
      `Overview counts mismatch: ${JSON.stringify(overview.json.data?.cards)}`
    );

    const csvRes = await api('/testing/reports/export', 'GET');
    assert(
      csvRes.status === 200 &&
        typeof csvRes.json === 'string' &&
        csvRes.json.includes('TC-001') &&
        csvRes.json.includes('BUG-001'),
      'CSV export should include TC-001 and BUG-001 rows'
    );

    console.log('✅ All Testing & QA integration assertions passed!');
  } finally {
    if (projectId) {
      await prisma.developmentTask.deleteMany({ where: { projectId } }).catch(() => {});
      await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    }
    if (otherProjectId) await prisma.project.delete({ where: { id: otherProjectId } }).catch(() => {});
    for (const uid of [ownerId, collabId, viewerId, outsiderId]) {
      if (uid) await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }
    server.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Testing & QA Integration Test Failed:', err);
  process.exit(1);
});
