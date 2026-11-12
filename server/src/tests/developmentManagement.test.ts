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

    console.log('ALL DEVELOPMENT MODULE API & DB ASSERTIONS PASSED!');
  } finally {
    server.close();
    if (projectId) {
      await prisma.developmentTask.deleteMany({ where: { projectId } });
      await prisma.developmentModule.deleteMany({ where: { projectId } });
      await prisma.project.deleteMany({ where: { id: projectId } });
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

