import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import { prisma } from '../lib/prisma.js';
import { developmentRouter } from '../routes/development.routes.js';

async function main() {
  const app = express();
  app.use(express.json());
  app.use('/api/projects/:projectId/development', developmentRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api/projects`;

  const ts = Date.now();
  let ownerId = 0;
  let collabId = 0;
  let outsiderId = 0;
  let projectId = 0;
  let teamAId = 0;
  let teamBId = 0;
  let orgId = 0;

  try {
    // 1. Setup isolated test users & project
    const owner = await prisma.user.create({
      data: {
        email: `devtest-owner-${ts}@example.com`,
        name: 'Test Owner',
        role: 'MEMBER',
      },
    });
    const collab = await prisma.user.create({
      data: {
        email: `devtest-collab-${ts}@example.com`,
        name: 'Test Collaborator',
        role: 'MEMBER',
      },
    });
    const outsider = await prisma.user.create({
      data: {
        email: `devtest-outsider-${ts}@example.com`,
        name: 'Test Outsider',
        role: 'MEMBER',
      },
    });
    ownerId = owner.id;
    collabId = collab.id;
    outsiderId = outsider.id;

    const project = await prisma.project.create({
      data: {
        title: `Dev Test Project ${ts}`,
        ownerId: owner.id,
        members: {
          create: [{ userId: collab.id, role: 'COLLABORATOR' }],
        },
      },
    });
    projectId = project.id;

    const ownerToken = `Bearer devflow_session_${owner.id}_${ts}`;
    const collabToken = `Bearer devflow_session_${collab.id}_${ts}`;
    const outsiderToken = `Bearer devflow_session_${outsider.id}_${ts}`;

    const req = async (path: string, method = 'GET', body?: unknown, token = ownerToken) => {
      const res = await fetch(`${baseUrl}/${projectId}/development${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: token } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      return { status: res.status, json: (await res.json()) as any };
    };

    const assert = (cond: boolean, msg: string) => {
      if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
    };

    // 2. Auth & Membership enforcement
    const unauth = await req('/dashboard', 'GET', undefined, '');
    assert(unauth.status === 401, `Expected 401 unauthenticated, got ${unauth.status}`);

    const forbidden = await req('/dashboard', 'GET', undefined, outsiderToken);
    assert(forbidden.status === 403, `Expected 403 for outsider, got ${forbidden.status}`);

    const collabMasterAttempt = await req(
      '/masters/modules',
      'POST',
      { name: 'Unauthorized Mod' },
      collabToken
    );
    assert(
      collabMasterAttempt.status === 403,
      `Expected 403 when non-admin collaborator creates master module, got ${collabMasterAttempt.status}`
    );

    // 3. Initial empty dashboard check
    const emptyDash = await req('/dashboard');
    assert(emptyDash.status === 200 && emptyDash.json.success, 'Dashboard GET failed');
    assert(emptyDash.json.data.metrics.totalWorkItems === 0, 'Initial totalWorkItems should be 0');

    // 4. Master Module & Submodule creation + duplicate prevention
    const mod1 = await req('/masters/modules', 'POST', { name: 'Core API', color: '#6366F1' });
    assert(mod1.status === 201 && mod1.json.success, `Create module failed: ${JSON.stringify(mod1.json)}`);
    const mod1Id = mod1.json.data.id;

    const dupMod = await req('/masters/modules', 'POST', { name: 'core api' });
    assert(dupMod.status === 409, `Expected 409 duplicate module, got ${dupMod.status}`);

    const mod2 = await req('/masters/modules', 'POST', { name: 'Frontend UI', color: '#10B981' });
    assert(mod2.status === 201, 'Create second module failed');
    const mod2Id = mod2.json.data.id;

    const sub1 = await req('/masters/submodules', 'POST', {
      moduleId: mod1Id,
      name: 'Auth Service',
    });
    assert(sub1.status === 201, 'Create submodule failed');
    const sub1Id = sub1.json.data.id;

    const sub2 = await req('/masters/submodules', 'POST', {
      moduleId: mod2Id,
      name: 'Dashboard Grid',
    });
    assert(sub2.status === 201, 'Create submodule 2 failed');
    const sub2Id = sub2.json.data.id;

    // 5. Validation checks: mismatched module/submodule, non-member assignee, dueDate < startDate
    const mismatchRes = await req('/tasks', 'POST', {
      title: 'Bad mismatch',
      moduleId: mod1Id,
      submoduleId: sub2Id,
      taskType: 'Task',
    });
    assert(mismatchRes.status === 400, `Expected 400 mismatch, got ${mismatchRes.status}`);

    const badAssigneeRes = await req('/tasks', 'POST', {
      title: 'Bad outsider assignee',
      moduleId: mod1Id,
      submoduleId: sub1Id,
      assigneeIds: [outsider.id],
    });
    assert(badAssigneeRes.status === 400, `Expected 400 bad assignee, got ${badAssigneeRes.status}`);

    const badDateRes = await req('/tasks', 'POST', {
      title: 'Bad date order',
      moduleId: mod1Id,
      submoduleId: sub1Id,
      startDate: '2026-12-10',
      dueDate: '2026-12-01',
    });
    assert(badDateRes.status === 400, `Expected 400 bad dates, got ${badDateRes.status}`);

    // 6. Create valid tasks (including overdue, due soon, completed) & verify DEV-001 sequence
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const inTwoDays = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

    const t1 = await req(
      '/tasks',
      'POST',
      {
        title: 'Implement OAuth refresh',
        description: 'Token rotation',
        taskType: 'Feature',
        moduleId: mod1Id,
        submoduleId: sub1Id,
        assigneeIds: [collab.id],
        priority: 'Critical',
        status: 'In Progress',
        dueDate: yesterday,
        estimatedEffort: 8,
        effortUnit: 'hours',
        labels: ['auth', 'security'],
      },
      collabToken
    );
    assert(t1.status === 201 && t1.json.data.taskKey === 'DEV-001', `Expected DEV-001, got ${JSON.stringify(t1.json)}`);

    const t2 = await req('/tasks', 'POST', {
      title: 'Build KPI cards',
      taskType: 'Task',
      moduleId: mod2Id,
      submoduleId: sub2Id,
      assigneeIds: [owner.id, collab.id],
      priority: 'High',
      status: 'Not Started',
      dueDate: inTwoDays,
    });
    assert(t2.status === 201 && t2.json.data.taskKey === 'DEV-002', 'Expected DEV-002');

    const t3 = await req('/tasks', 'POST', {
      title: 'Initial setup',
      taskType: 'Improvement',
      moduleId: mod1Id,
      submoduleId: sub1Id,
      assigneeIds: [owner.id],
      priority: 'Low',
      status: 'Completed',
    });
    assert(t3.status === 201 && t3.json.data.taskKey === 'DEV-003', 'Expected DEV-003');

    // 7. Comments + Activity + Status update
    const c1 = await req(`/tasks/${t1.json.data.id}/comments`, 'POST', { body: 'Investigating refresh window' });
    assert(c1.status === 201, 'Comment failed');

    const statusPatch = await req(`/tasks/${t2.json.data.id}/status`, 'PATCH', { status: 'In Progress' });
    assert(statusPatch.status === 200 && statusPatch.json.data.status === 'In Progress', 'Status patch failed');

    const detail = await req(`/tasks/${t1.json.data.id}`);
    assert(detail.json.data.comments.length === 1, 'Expected 1 comment');
    assert(detail.json.data.activities.length >= 2, 'Expected activity history entries');

    // 8. Dashboard metrics verification
    const dashAfter = await req('/dashboard');
    const m = dashAfter.json.data.metrics;
    assert(m.totalWorkItems === 3, `Expected 3 total, got ${m.totalWorkItems}`);
    assert(m.completedCount === 1, `Expected 1 completed, got ${m.completedCount}`);
    assert(m.inProgressCount === 2, `Expected 2 in progress, got ${m.inProgressCount}`);
    assert(m.overdueCount === 1, `Expected 1 overdue, got ${m.overdueCount}`);
    assert(m.dueSoonCount === 1, `Expected 1 dueSoon, got ${m.dueSoonCount}`);
    assert(m.completionRate === 33, `Expected 33% completion rate, got ${m.completionRate}`);

    // 9. Prevent deleting referenced master module/submodule -> require archive/migration
    const delReferencedSub = await req(`/masters/submodules/${sub1Id}`, 'DELETE');
    assert(delReferencedSub.status === 409, `Expected 409 blocking delete of referenced submodule, got ${delReferencedSub.status}`);

    const archiveSub = await req(`/masters/submodules/${sub1Id}`, 'PATCH', { isArchived: true });
    assert(archiveSub.status === 200 && archiveSub.json.data.isArchived === true, 'Archive submodule failed');

    // 10. Date range filter on createdAt (today vs yesterday) with tzOffsetMinutes + dueDate null-last sort
    const now = new Date();
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayStr = fmt(now);
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yestStr = fmt(yest);
    const tzOffset = now.getTimezoneOffset();

    const todayList = await req(
      `/tasks?startDate=${todayStr}&endDate=${todayStr}&tzOffsetMinutes=${tzOffset}&limit=500`
    );
    assert(
      todayList.status === 200 && todayList.json.data.items.length === 3,
      `Expected 3 tasks created today, got ${todayList.json.data?.items?.length}`
    );

    const yesterdayList = await req(
      `/tasks?startDate=${yestStr}&endDate=${yestStr}&tzOffsetMinutes=${tzOffset}&limit=500`
    );
    assert(
      yesterdayList.status === 200 && yesterdayList.json.data.items.length === 0,
      `Expected 0 tasks created yesterday, got ${yesterdayList.json.data?.items?.length}`
    );

    // 11. AssigneeGroups shape + 14-day dailyTrend real DB series + Project Master Data persistence
    assert(
      dashAfter.json.data.assigneeGroups &&
        Array.isArray(dashAfter.json.data.assigneeGroups.teams) &&
        Array.isArray(dashAfter.json.data.assigneeGroups.allTeams) &&
        Array.isArray(dashAfter.json.data.assigneeGroups.projectMembers) &&
        dashAfter.json.data.assigneeGroups.projectMembers.some((u: any) => u.id === ownerId),
      'Expected assigneeGroups with teams, allTeams, and projectMembers including owner'
    );
    const trend = dashAfter.json.data.analytics?.dailyTrend;
    assert(
      Array.isArray(trend) &&
        trend.length === 14 &&
        trend.every(
          (d: any) =>
            typeof d.date === 'string' &&
            typeof d.label === 'string' &&
            typeof d.created === 'number' &&
            typeof d.completed === 'number' &&
            d.created >= 0 &&
            d.completed >= 0
        ) &&
        trend.reduce((s: number, d: any) => s + d.created, 0) >= 2 &&
        trend.reduce((s: number, d: any) => s + d.completed, 0) >= 1,
      `Expected 14-day analytics.dailyTrend array with real created/completed counts, got ${JSON.stringify(trend)}`
    );

    const cfgUpdate = await req('/settings', 'PUT', {
      priorityItems: [
        { name: 'P0 Blocker', icon: 'Flame', color: '#EF4444' },
        { name: 'Medium', icon: 'Minus', color: '#F59E0B' },
      ],
      statusItems: [
        { name: 'Not Started', icon: 'Circle', color: '#71717A' },
        { name: 'QA Testing', icon: 'Eye', color: '#8B5CF6' },
        { name: 'Completed', icon: 'CheckCircle2', color: '#10B981' },
      ],
    });
    assert(
      cfgUpdate.status === 200 &&
        cfgUpdate.json.data.priorityItems.some((p: any) => p.name === 'P0 Blocker') &&
        cfgUpdate.json.data.statusItems.some((s: any) => s.name === 'QA Testing'),
      'Expected custom priorityItems and statusItems to persist'
    );

    await req(`/masters/submodules/${sub1Id}`, 'PATCH', { isArchived: false });
    const dashMods = await req('/masters/modules');
    const firstModId = dashMods.json.data[0].id;
    const customTask = await req('/tasks', 'POST', {
      title: 'Task with custom master priority & status',
      moduleId: firstModId,
      submoduleId: sub1Id,
      priority: 'P0 Blocker',
      status: 'QA Testing',
    });
    assert(
      customTask.status === 201 &&
        customTask.json.data.priority === 'P0 Blocker' &&
        customTask.json.data.status === 'QA Testing',
      `Expected task with custom priority/status, got ${customTask.status}: ${JSON.stringify(customTask.json)}`
    );

    // 12. Attachment upload route validation when module is invalid
    const badUpload = await req('/attachments/upload', 'POST', {
      moduleId: 99999999,
      files: [{ name: 'spec.txt', base64: Buffer.from('hello').toString('base64'), mimeType: 'text/plain' }],
    });
    assert(badUpload.status === 404, `Expected 404 for unknown moduleId on upload, got ${badUpload.status}`);

    // 13. Custom End Status ("Skipped"), explicit teamIds isolation, & Planned vs Actual analytics
    const endCfg = await req('/settings', 'PUT', {
      statusItems: [
        { name: 'Not Started', icon: 'Circle', color: '#71717A', isEnd: false },
        { name: 'QA Testing', icon: 'Eye', color: '#8B5CF6', isEnd: false },
        { name: 'Skipped', icon: 'FastForward', color: '#94A3B8', isEnd: true },
        { name: 'Completed', icon: 'CheckCircle2', color: '#10B981', isEnd: true },
      ],
    });
    assert(
      endCfg.status === 200 &&
        endCfg.json.data.statusItems.some((s: any) => s.name === 'Skipped' && s.isEnd === true),
      'Expected Skipped custom End Status to persist'
    );

    const skippedRes = await req(`/tasks/${customTask.json.data.id}/status`, 'PATCH', {
      status: 'Skipped',
    });
    assert(
      skippedRes.status === 200 &&
        skippedRes.json.data.status === 'Skipped' &&
        skippedRes.json.data.isEndStatus === true &&
        Boolean(skippedRes.json.data.completedAt) &&
        Boolean(skippedRes.json.data.startedAt),
      `Expected custom End status Skipped to set completedAt/startedAt/isEndStatus, got ${JSON.stringify(
        skippedRes.json.data
      )}`
    );

    // Explicit teamIds vs overlapping members: Team A & Team B both contain owner+collab in same org, only Team A linked
    const org = await prisma.organization.create({
      data: {
        name: `Test Org ${ts}`,
        slug: `test-org-${ts}`,
        createdById: owner.id,
      },
    });
    orgId = org.id;
    await prisma.project.update({
      where: { id: projectId },
      data: { organizationId: org.id },
    });

    const teamA = await prisma.team.create({
      data: {
        name: `Explicit Team A ${ts}`,
        createdById: owner.id,
        organizationId: org.id,
        projects: { connect: { id: projectId } },
        members: { create: [{ userId: owner.id }, { userId: collab.id }] },
      },
    });
    const teamB = await prisma.team.create({
      data: {
        name: `Unrelated Team B ${ts}`,
        createdById: owner.id,
        organizationId: org.id,
        members: { create: [{ userId: owner.id }, { userId: collab.id }] },
      },
    });
    teamAId = teamA.id;
    teamBId = teamB.id;

    const teamTaskRes = await req('/tasks', 'POST', {
      title: 'Explicitly Linked Team Task',
      moduleId: firstModId,
      submoduleId: sub1Id,
      assigneeIds: [owner.id, collab.id],
      teamIds: [teamA.id],
      startDate: todayStr,
      dueDate: todayStr,
    });
    assert(
      teamTaskRes.status === 201 &&
        Array.isArray(teamTaskRes.json.data.assignedTeams) &&
        teamTaskRes.json.data.assignedTeams.length === 1 &&
        teamTaskRes.json.data.assignedTeams[0].id === teamA.id,
      `Expected ONLY teamA in assignedTeams (no teamB leak), got ${JSON.stringify(
        teamTaskRes.json.data?.assignedTeams
      )}`
    );

    const dashPva = await req('/dashboard');
    const pva = dashPva.json.data?.analytics?.plannedVsActual;
    assert(
      dashPva.status === 200 &&
        pva &&
        pva.summary &&
        Array.isArray(pva.items) &&
        pva.summary.totalTracked >= 2 &&
        pva.items.some((it: any) => it.id === customTask.json.data.id && it.isEndStatus === true),
      `Expected analytics.plannedVsActual summary & ended items from DB, got ${JSON.stringify(pva)}`
    );

    // 7) Verify Development task type + optional Git commit linking on completion vs Research task
    const devTaskRes = await req('/tasks', 'POST', {
      title: 'Implement OAuth Callback Sync',
      taskType: 'Development',
      moduleId: firstModId,
      submoduleId: sub1Id,
      priority: 'High',
      status: 'In Progress',
      startDate: todayStr,
      dueDate: todayStr,
    });
    assert(
      devTaskRes.status === 201 && devTaskRes.json.data.taskType === 'Development',
      `Expected Development task creation, got ${JSON.stringify(devTaskRes.json)}`
    );
    const devTaskId = devTaskRes.json.data.id;

    const completeWithCommit = await req(`/tasks/${devTaskId}/status`, 'PATCH', {
      status: 'Completed',
      gitCommit: {
        sha: 'a1b2c3d4e5f67890abcdef1234567890abcdef12',
        message: 'feat: implement OAuth callback sync handler',
        repoName: 'devflow-core',
        author: 'Owner Dev',
        date: new Date().toISOString(),
      },
    });
    assert(
      completeWithCommit.status === 200 &&
        completeWithCommit.json.data.status === 'Completed' &&
        completeWithCommit.json.data.gitCommit?.shortSha === 'a1b2c3d' &&
        completeWithCommit.json.data.gitCommit?.repoName === 'devflow-core',
      `Expected Completed Development task with linked gitCommit, got ${JSON.stringify(
        completeWithCommit.json
      )}`
    );

    const unlinkCommitRes = await req(`/tasks/${devTaskId}`, 'PATCH', {
      gitCommit: null,
    });
    assert(
      unlinkCommitRes.status === 200 && unlinkCommitRes.json.data.gitCommit === null,
      `Expected gitCommit to unlink cleanly, got ${JSON.stringify(unlinkCommitRes.json)}`
    );

    const devDetailRes = await req(`/tasks/${devTaskId}`);
    const activityActions = (devDetailRes.json.data?.activities || []).map((a: any) => a.action);
    assert(
      activityActions.includes('git_commit_linked') && activityActions.includes('git_commit_unlinked'),
      `Expected git_commit_linked & git_commit_unlinked activities, got ${JSON.stringify(activityActions)}`
    );

    const researchTaskRes = await req('/tasks', 'POST', {
      title: 'Evaluate WebAuthn SDK Tradeoffs',
      taskType: 'Research',
      moduleId: firstModId,
      submoduleId: sub1Id,
      priority: 'Medium',
      status: 'In Progress',
    });
    assert(
      researchTaskRes.status === 201 && researchTaskRes.json.data.taskType === 'Research',
      `Expected Research task creation, got ${JSON.stringify(researchTaskRes.json)}`
    );
    const completeResearch = await req(`/tasks/${researchTaskRes.json.data.id}/status`, 'PATCH', {
      status: 'Completed',
    });
    assert(
      completeResearch.status === 200 &&
        completeResearch.json.data.status === 'Completed' &&
        completeResearch.json.data.gitCommit === null,
      `Expected Research task to complete without gitCommit, got ${JSON.stringify(completeResearch.json)}`
    );

    console.log('ALL DEVELOPMENT MODULE API & DB ASSERTIONS PASSED!');
  } finally {
    server.close();
    if (projectId) {
      await prisma.developmentTask.deleteMany({ where: { projectId } });
      await prisma.developmentModule.deleteMany({ where: { projectId } });
      await prisma.project.deleteMany({ where: { id: projectId } });
    }
    const teamIds = [teamAId, teamBId].filter(Boolean);
    if (teamIds.length > 0) {
      await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
    }
    if (orgId) {
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    const ids = [ownerId, collabId, outsiderId].filter(Boolean);
    if (ids.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

