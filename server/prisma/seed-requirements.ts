/**
 * Seed script for Requirements Management module (Phase 1 checkpoint).
 *
 * Seeds: 1 org, 1 project, 3 users, 2 categories, 1 template,
 *        3 requirements (Approved / Pending Review / Draft)
 *        with acceptance criteria + version history.
 *
 * Usage: npx tsx prisma/seed-requirements.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Requirements Management data...\n');

  // ── 1. Users ─────────────────────────────────────────────
  const owner = await prisma.user.upsert({
    where: { email: 'admin@devflow.dev' },
    update: {},
    create: {
      email: 'admin@devflow.dev',
      name: 'Admin User',
      username: 'admin',
      role: 'ADMIN',
      onboardingCompleted: true,
    },
  });

  const author = await prisma.user.upsert({
    where: { email: 'alice@devflow.dev' },
    update: {},
    create: {
      email: 'alice@devflow.dev',
      name: 'Alice Engineer',
      username: 'alice',
      role: 'MEMBER',
      onboardingCompleted: true,
    },
  });

  const reviewer = await prisma.user.upsert({
    where: { email: 'bob@devflow.dev' },
    update: {},
    create: {
      email: 'bob@devflow.dev',
      name: 'Bob Reviewer',
      username: 'bob',
      role: 'MEMBER',
      onboardingCompleted: true,
    },
  });

  console.log(`  ✅ Users: ${owner.name}, ${author.name}, ${reviewer.name}`);

  // ── 2. Organization ──────────────────────────────────────
  let org = await prisma.organization.findUnique({ where: { slug: 'devflow-hq' } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'DevFlow HQ',
        slug: 'devflow-hq',
        description: 'Primary development organization',
        createdById: owner.id,
      },
    });
  }

  // Ensure all three users are org members
  for (const u of [owner, author, reviewer]) {
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: u.id } },
      update: {},
      create: {
        organizationId: org.id,
        userId: u.id,
        role: u.id === owner.id ? 'OWNER' : 'MEMBER',
      },
    });
  }

  console.log(`  ✅ Organization: ${org.name} (${org.slug})`);

  // ── 3. Project ───────────────────────────────────────────
  let project = await prisma.project.findFirst({
    where: { title: 'DevFlow Platform', organizationId: org.id },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        title: 'DevFlow Platform',
        description: 'Core platform project for requirements seeding',
        status: 'IN_PROGRESS',
        ownerId: owner.id,
        organizationId: org.id,
      },
    });
  }

  console.log(`  ✅ Project: ${project.title} (id=${project.id})`);

  // ── 4. Requirement Categories ────────────────────────────
  const catFunctional = await prisma.requirementCategory.create({
    data: {
      name: 'Core Features',
      description: 'Core product features and capabilities',
      icon: 'Zap',
      color: '#3B82F6',
      defaultType: 'FUNCTIONAL',
      scope: 'ORG',
      organizationId: org.id,
    },
  });

  const catSecurity = await prisma.requirementCategory.create({
    data: {
      name: 'Security & Compliance',
      description: 'Security requirements and compliance standards',
      icon: 'Shield',
      color: '#EF4444',
      defaultType: 'SECURITY',
      scope: 'ORG',
      organizationId: org.id,
    },
  });

  console.log(`  ✅ Categories: ${catFunctional.name}, ${catSecurity.name}`);

  // ── 5. Requirement Template ──────────────────────────────
  const template = await prisma.requirementTemplate.create({
    data: {
      name: 'User Story',
      description: 'Standard user story with acceptance criteria',
      scope: 'ORG',
      organizationId: org.id,
      structure: JSON.stringify({
        title: 'As a [user], I want [feature] so that [benefit]',
        summary: '',
        type: 'FUNCTIONAL',
        description: '<h3>User Story</h3><p>As a <strong>[role]</strong>, I want <strong>[capability]</strong> so that <strong>[benefit]</strong>.</p>',
        expectedBehavior: '',
        preconditions: '',
        acceptanceCriteria: [
          { description: 'Given [context], when [action], then [result]' },
        ],
      }),
    },
  });

  console.log(`  ✅ Template: ${template.name}`);

  // ── 6. Three Requirements ────────────────────────────────

  // --- REQ-001: APPROVED (with 2 versions) ---
  const now = new Date();
  const req1 = await prisma.requirement.create({
    data: {
      code: 'REQ-001',
      projectId: project.id,
      title: 'User Authentication with OAuth 2.0',
      summary: 'Implement secure user authentication supporting OAuth 2.0 providers',
      type: 'SECURITY',
      categoryId: catSecurity.id,
      description: '<h3>Overview</h3><p>The system shall support user authentication via OAuth 2.0 with Google and GitHub as identity providers. Sessions must use HTTP-only cookies with CSRF protection.</p>',
      businessJustification: 'Secure authentication is a compliance requirement and reduces friction for developer sign-up.',
      expectedBehavior: 'Users can sign in with Google or GitHub. Invalid tokens are rejected with a 401 response.',
      preconditions: 'OAuth client credentials configured in environment variables.',
      constraints: 'Must comply with OWASP authentication guidelines.',
      priority: 'CRITICAL',
      workflowStatus: 'APPROVED',
      implementationStatus: 'IN_PROGRESS',
      riskLevel: 'HIGH',
      complexity: 'HIGH',
      authorId: author.id,
      reviewerId: reviewer.id,
      responsibleMemberId: author.id,
      collaborators: JSON.stringify([reviewer.id]),
      targetDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      currentVersion: 2,
      submittedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      submittedById: author.id,
      approvedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      approvedById: reviewer.id,
    },
  });

  // Acceptance criteria for REQ-001
  await prisma.acceptanceCriterion.createMany({
    data: [
      {
        requirementId: req1.id,
        code: 'AC-001',
        description: 'User can authenticate with Google OAuth 2.0 and receive a valid session token',
        verificationMethod: 'Integration test with mock OAuth provider',
        isComplete: true,
        sortOrder: 1,
      },
      {
        requirementId: req1.id,
        code: 'AC-002',
        description: 'User can authenticate with GitHub OAuth 2.0 and receive a valid session token',
        verificationMethod: 'Integration test with mock OAuth provider',
        isComplete: false,
        sortOrder: 2,
      },
      {
        requirementId: req1.id,
        code: 'AC-003',
        description: 'Invalid or expired tokens return 401 Unauthorized with appropriate error message',
        verificationMethod: 'Unit test',
        isComplete: false,
        sortOrder: 3,
      },
    ],
  });

  // Version history for REQ-001
  await prisma.requirementVersion.createMany({
    data: [
      {
        requirementId: req1.id,
        versionNumber: 1,
        changedById: author.id,
        changeReason: 'Initial creation',
        snapshot: JSON.stringify({
          title: 'User Authentication with OAuth 2.0',
          summary: 'Implement OAuth 2.0 authentication',
          type: 'SECURITY',
          priority: 'HIGH',
          workflowStatus: 'DRAFT',
          description: '<p>Basic OAuth implementation</p>',
        }),
      },
      {
        requirementId: req1.id,
        versionNumber: 2,
        changedById: author.id,
        changeReason: 'Added CSRF protection requirement after security review',
        snapshot: JSON.stringify({
          title: 'User Authentication with OAuth 2.0',
          summary: 'Implement secure user authentication supporting OAuth 2.0 providers',
          type: 'SECURITY',
          priority: 'CRITICAL',
          workflowStatus: 'APPROVED',
          description: '<h3>Overview</h3><p>The system shall support user authentication via OAuth 2.0 with Google and GitHub as identity providers. Sessions must use HTTP-only cookies with CSRF protection.</p>',
        }),
      },
    ],
  });

  // Review for REQ-001
  await prisma.requirementReview.create({
    data: {
      requirementId: req1.id,
      reviewerId: reviewer.id,
      versionNumber: 2,
      decision: 'APPROVED',
      checklist: JSON.stringify({
        descriptionClear: true,
        criteriaMeasurable: true,
        responsibilityAssigned: true,
        dependenciesDocumented: true,
      }),
      comment: 'Well-defined requirements with clear acceptance criteria. Approved.',
    },
  });

  console.log(`  ✅ REQ-001: ${req1.title} [APPROVED, v2]`);

  // --- REQ-002: PENDING_REVIEW ---
  const req2 = await prisma.requirement.create({
    data: {
      code: 'REQ-002',
      projectId: project.id,
      title: 'Real-time Task Board with WebSocket Updates',
      summary: 'Kanban board with real-time sync across clients via WebSocket',
      type: 'FUNCTIONAL',
      categoryId: catFunctional.id,
      description: '<h3>Overview</h3><p>Implement a drag-and-drop Kanban board that syncs task status changes in real-time across all connected clients using WebSocket (Socket.IO).</p>',
      businessJustification: 'Real-time collaboration reduces communication overhead and improves team productivity.',
      expectedBehavior: 'When a user moves a task between columns, all connected users see the update within 500ms.',
      priority: 'HIGH',
      workflowStatus: 'PENDING_REVIEW',
      implementationStatus: 'NOT_STARTED',
      riskLevel: 'MEDIUM',
      complexity: 'MEDIUM',
      authorId: author.id,
      reviewerId: reviewer.id,
      responsibleMemberId: author.id,
      targetDate: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000),
      currentVersion: 1,
      submittedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      submittedById: author.id,
    },
  });

  await prisma.acceptanceCriterion.createMany({
    data: [
      {
        requirementId: req2.id,
        code: 'AC-001',
        description: 'Task status changes are broadcast to all connected clients within 500ms',
        verificationMethod: 'Performance test with multiple browser sessions',
        sortOrder: 1,
      },
      {
        requirementId: req2.id,
        code: 'AC-002',
        description: 'Board displays correct task state after page refresh',
        verificationMethod: 'Integration test',
        sortOrder: 2,
      },
    ],
  });

  await prisma.requirementVersion.create({
    data: {
      requirementId: req2.id,
      versionNumber: 1,
      changedById: author.id,
      changeReason: 'Initial creation',
      snapshot: JSON.stringify({
        title: req2.title,
        summary: req2.summary,
        type: req2.type,
        priority: 'HIGH',
        workflowStatus: 'PENDING_REVIEW',
        description: req2.description,
      }),
    },
  });

  console.log(`  ✅ REQ-002: ${req2.title} [PENDING_REVIEW, v1]`);

  // --- REQ-003: DRAFT ---
  const req3 = await prisma.requirement.create({
    data: {
      code: 'REQ-003',
      projectId: project.id,
      title: 'CSV Data Export for Project Reports',
      summary: 'Export project data (tasks, requirements, activity) as CSV files',
      type: 'FUNCTIONAL',
      categoryId: catFunctional.id,
      description: '<p>Users with appropriate permissions can export project data as CSV for offline analysis and reporting.</p>',
      priority: 'LOW',
      workflowStatus: 'DRAFT',
      implementationStatus: 'NOT_STARTED',
      complexity: 'LOW',
      authorId: author.id,
      currentVersion: 1,
    },
  });

  await prisma.acceptanceCriterion.create({
    data: {
      requirementId: req3.id,
      code: 'AC-001',
      description: 'Exported CSV contains all visible table columns with correct headers',
      verificationMethod: 'Manual verification',
      sortOrder: 1,
    },
  });

  await prisma.requirementVersion.create({
    data: {
      requirementId: req3.id,
      versionNumber: 1,
      changedById: author.id,
      changeReason: 'Initial creation',
      snapshot: JSON.stringify({
        title: req3.title,
        summary: req3.summary,
        type: req3.type,
        priority: 'LOW',
        workflowStatus: 'DRAFT',
        description: req3.description,
      }),
    },
  });

  console.log(`  ✅ REQ-003: ${req3.title} [DRAFT, v1]`);

  // ── 7. Dependency: REQ-002 depends on REQ-001 ───────────
  await prisma.requirementDependency.create({
    data: {
      fromRequirementId: req2.id,
      toRequirementId: req1.id,
      type: 'DEPENDS_ON',
    },
  });

  console.log(`  ✅ Dependency: REQ-002 DEPENDS_ON REQ-001`);

  // ── 8. Activity events ───────────────────────────────────
  const activities = [
    { action: 'requirement.created', resourceType: 'requirement', resourceId: req1.id, details: { code: 'REQ-001', title: req1.title } },
    { action: 'requirement.submitted', resourceType: 'requirement', resourceId: req1.id, details: { code: 'REQ-001' } },
    { action: 'requirement.approved', resourceType: 'requirement', resourceId: req1.id, details: { code: 'REQ-001', approvedBy: reviewer.name } },
    { action: 'requirement.version_created', resourceType: 'requirement', resourceId: req1.id, details: { code: 'REQ-001', version: 2, reason: 'Added CSRF protection requirement' } },
    { action: 'requirement.created', resourceType: 'requirement', resourceId: req2.id, details: { code: 'REQ-002', title: req2.title } },
    { action: 'requirement.submitted', resourceType: 'requirement', resourceId: req2.id, details: { code: 'REQ-002' } },
    { action: 'requirement.created', resourceType: 'requirement', resourceId: req3.id, details: { code: 'REQ-003', title: req3.title } },
  ];

  for (const act of activities) {
    await prisma.organizationActivity.create({
      data: {
        organizationId: org.id,
        actorId: author.id,
        action: act.action,
        resourceType: act.resourceType,
        resourceId: act.resourceId,
        details: JSON.stringify(act.details),
      },
    });
  }

  console.log(`  ✅ Activity events: ${activities.length} logged`);

  // ── Summary ──────────────────────────────────────────────
  console.log('\n────────────────────────────────────────────');
  console.log('🎉 Requirements seed complete!');
  console.log(`   Organization: ${org.name}`);
  console.log(`   Project:      ${project.title}`);
  console.log(`   Requirements: 3 (Approved / Pending Review / Draft)`);
  console.log(`   Criteria:     6 total`);
  console.log(`   Versions:     4 total`);
  console.log(`   Reviews:      1 (Approved)`);
  console.log(`   Dependencies: 1 (REQ-002 → REQ-001)`);
  console.log(`   Activities:   ${activities.length}`);
  console.log('────────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

