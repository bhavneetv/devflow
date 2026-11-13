export interface TestingUserLite {
  id: number;
  name: string;
  username?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  avatarColor?: string | null;
  avatarType?: string | null;
  avatarId?: string | null;
  jobTitle?: string | null;
}

export interface TestingTeamLite {
  id: number;
  name: string;
  color: string;
}

export interface TestingMasterOption {
  name: string;
  color: string;
  icon: string;
  isArchived?: boolean;
}

export interface TestingPermissions {
  role: string;
  canViewTesting: boolean;
  canEditTestCases: boolean;
  canExecuteTests: boolean;
  canManageDefects: boolean;
  canManagePlansSuites: boolean;
  canManageSettings: boolean;
  canViewReports: boolean;
  canArchiveRecords: boolean;
}

export interface TestingRolePermissionRule {
  canViewTesting: boolean;
  canEditTestCases: boolean;
  canExecuteTests: boolean;
  canManageDefects: boolean;
  canManagePlansSuites: boolean;
  canManageSettings: boolean;
  canViewReports: boolean;
  canArchiveRecords: boolean;
}

export interface TestingConfigurationItem {
  id: number;
  projectId: number;
  testCasePrefix: string;
  testCaseNextSeq: number;
  defectPrefix: string;
  defectNextSeq: number;
  defaultEnvironment: string;
  maxAttachmentSizeBytes: number;
  allowedAttachmentTypes: string[];
  retentionDays: number | null;
  notifyOnRunFailure: boolean;
  notifyOnCriticalDefect: boolean;
  notifyOnPlanDueSoon: boolean;
  testTypes: TestingMasterOption[];
  priorities: TestingMasterOption[];
  defectSeverities: TestingMasterOption[];
  environments: TestingMasterOption[];
  executionStatuses: TestingMasterOption[];
  rolePermissions: Record<string, TestingRolePermissionRule>;
  modulesProvisioned: boolean;
  updatedAt?: string;
}

export interface TestingAttachmentDocument {
  linkId: number;
  documentId: number;
  displayName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  repositoryPath: string;
  branch?: string | null;
  uploadedById?: number | null;
  createdAt: string;
}

export interface TestCaseStepItem {
  id?: number;
  stepNumber: number;
  action: string;
  testData?: string | null;
  expectedResult?: string | null;
}

export interface TestCaseLinkedRequirement {
  id: number;
  code: string;
  title: string;
  workflowStatus: string;
  priority: string;
}

export interface TestCaseLinkedDevTask {
  id: number;
  taskKey: string;
  title: string;
  status: string;
  priority: string;
}

export interface TestCaseItem {
  id: number;
  projectId: number;
  caseKey: string;
  sequenceNumber: number;
  title: string;
  description?: string | null;
  preconditions?: string | null;
  moduleId?: number | null;
  module?: { id: number; name: string; color?: string | null; icon?: string | null } | null;
  submoduleId?: number | null;
  submodule?: { id: number; name: string; icon?: string | null } | null;
  testType: string;
  priority: string;
  status: 'Draft' | 'Ready' | 'Deprecated' | string;
  assignedTesterId?: number | null;
  assignedTester?: TestingUserLite | null;
  labels: string[];
  testDataSummary?: string | null;
  linkedRequirementId?: number | null;
  linkedRequirement?: TestCaseLinkedRequirement | null;
  linkedDevTaskId?: number | null;
  linkedDevTask?: TestCaseLinkedDevTask | null;
  isArchived: boolean;
  archivedAt?: string | null;
  createdById?: number | null;
  createdBy?: TestingUserLite | null;
  stepsCount: number;
  executionsCount: number;
  defectsCount: number;
  latestExecutionStatus?: ExecutionStatusValue | null;
  latestExecutionAt?: string | null;
  steps?: TestCaseStepItem[];
  attachments?: TestingAttachmentDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface TestCaseDetail extends TestCaseItem {
  steps: TestCaseStepItem[];
  attachments: TestingAttachmentDocument[];
  suites: Array<{ id: number; suiteKey: string; name: string; status: string }>;
  executionHistory: TestExecutionItem[];
  linkedDefects: QaDefectItem[];
  activities: TestingActivityItem[];
}

export interface TestSuiteItem {
  id: number;
  projectId: number;
  suiteKey: string;
  name: string;
  description?: string | null;
  purpose?: string | null;
  ownerId?: number | null;
  owner?: TestingUserLite | null;
  status: 'Draft' | 'Active' | 'Archived' | string;
  labels: string[];
  isArchived: boolean;
  archivedAt?: string | null;
  createdBy?: TestingUserLite | null;
  totalCases: number;
  latestRun?: {
    id: number;
    runKey: string;
    name: string;
    status: string;
    passRate: number | null;
    passed: number;
    failed: number;
    total: number;
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TestSuiteDetail extends TestSuiteItem {
  cases: Array<{
    linkId: number;
    position: number;
    testCase: TestCaseItem;
  }>;
  runs: TestRunItem[];
  activities: TestingActivityItem[];
}

export interface TestPlanExecutionProgress {
  totalRuns: number;
  totalExecutions: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  notRun: number;
  passRate: number | null;
}

export interface TestPlanItem {
  id: number;
  projectId: number;
  planKey: string;
  title: string;
  description?: string | null;
  testingScope?: string | null;
  targetVersion?: string | null;
  targetEnvironment?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  responsibleTesterId?: number | null;
  responsibleTester?: TestingUserLite | null;
  responsibleTeamId?: number | null;
  responsibleTeam?: TestingTeamLite | null;
  linkedRequirementId?: number | null;
  linkedRequirement?: TestCaseLinkedRequirement | null;
  linkedDevTaskId?: number | null;
  linkedDevTask?: TestCaseLinkedDevTask | null;
  milestoneLabel?: string | null;
  status: 'Draft' | 'Planned' | 'In Progress' | 'Completed' | 'Cancelled' | string;
  isArchived: boolean;
  archivedAt?: string | null;
  suitesCount: number;
  directCasesCount: number;
  uniqueCaseCount: number;
  progress: TestPlanExecutionProgress;
  defectsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestPlanDetail extends TestPlanItem {
  suites: Array<{ id: number; suiteKey: string; name: string; status: string; totalCases: number }>;
  cases: TestCaseItem[];
  runs: TestRunItem[];
  linkedDefects: QaDefectItem[];
  activities: TestingActivityItem[];
}

export type ExecutionStatusValue = 'Not Run' | 'Passed' | 'Failed' | 'Blocked' | 'Skipped';

export interface TestRunStats {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  notRun: number;
  eligibleCompleted: number;
  passRate: number | null;
  failRate: number | null;
}

export interface TestRunItem {
  id: number;
  projectId: number;
  runKey: string;
  name: string;
  description?: string | null;
  testPlanId?: number | null;
  testPlan?: { id: number; planKey: string; title: string } | null;
  testSuiteId?: number | null;
  testSuite?: { id: number; suiteKey: string; name: string } | null;
  buildVersion?: string | null;
  environment?: string | null;
  executedById?: number | null;
  executedBy?: TestingUserLite | null;
  startedAt?: string | null;
  completedAt?: string | null;
  status: 'Planned' | 'In Progress' | 'Completed' | 'Aborted' | string;
  isArchived: boolean;
  stats: TestRunStats;
  defectsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestExecutionStepItem {
  id: number;
  executionId: number;
  stepNumber: number;
  action: string;
  testData?: string | null;
  expectedResult?: string | null;
  actualResult?: string | null;
  status: 'Not Run' | 'Passed' | 'Failed' | 'Blocked' | string;
  notes?: string | null;
}

export interface TestExecutionItem {
  id: number;
  projectId: number;
  testRunId: number;
  run?: {
    id: number;
    runKey: string;
    name: string;
    buildVersion?: string | null;
    environment?: string | null;
  };
  testCaseId?: number | null;
  caseKeySnapshot: string;
  caseTitleSnapshot: string;
  testTypeSnapshot?: string | null;
  prioritySnapshot?: string | null;
  executedById?: number | null;
  executedBy?: TestingUserLite | null;
  attemptNumber: number;
  isLatest: boolean;
  status: ExecutionStatusValue;
  actualResult?: string | null;
  notes?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  steps: TestExecutionStepItem[];
  attachments: TestingAttachmentDocument[];
  linkedDefects: Array<{
    id: number;
    defectKey: string;
    title: string;
    severity: string;
    status: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface TestRunDetail extends TestRunItem {
  executions: TestExecutionItem[];
  allHistoryCount: number;
  defects: QaDefectItem[];
}

export type DefectStatusValue =
  | 'Open'
  | 'In Progress'
  | 'Fixed'
  | 'Ready for Retest'
  | 'Verified'
  | 'Closed'
  | 'Reopened';

export interface DefectGitLink {
  id: number;
  repositoryId: number;
  repositoryName?: string;
  repositoryUrl?: string;
  provider: string;
  recordType: string;
  recordNumber?: number | null;
  recordId: string;
  recordTitle?: string | null;
  recordUrl?: string | null;
  createdAt: string;
}

export interface QaDefectItem {
  id: number;
  projectId: number;
  defectKey: string;
  sequenceNumber: number;
  title: string;
  description?: string | null;
  stepsToReproduce?: string | null;
  expectedResult?: string | null;
  actualResult?: string | null;
  severity: 'Critical' | 'Major' | 'Moderate' | 'Minor' | string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  status: DefectStatusValue | string;
  moduleId?: number | null;
  module?: { id: number; name: string; color?: string | null; icon?: string | null; slug?: string } | null;
  submoduleId?: number | null;
  submodule?: { id: number; name: string; icon?: string | null; slug?: string } | null;
  assigneeId?: number | null;
  assignee?: TestingUserLite | null;
  reporterId?: number | null;
  reporter?: TestingUserLite | null;
  environment?: string | null;
  buildVersion?: string | null;
  linkedTestCaseId?: number | null;
  linkedTestCase?: { id: number; caseKey: string; title: string } | null;
  linkedTestRunId?: number | null;
  linkedTestRun?: { id: number; runKey: string; name: string } | null;
  linkedExecutionId?: number | null;
  linkedDevTaskId?: number | null;
  linkedDevTask?: TestCaseLinkedDevTask | null;
  linkedRequirementId?: number | null;
  linkedRequirement?: TestCaseLinkedRequirement | null;
  verifiedById?: number | null;
  verifiedBy?: TestingUserLite | null;
  verifiedAt?: string | null;
  reopenCount: number;
  isArchived: boolean;
  archivedAt?: string | null;
  attachmentsCount: number;
  gitLinksCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QaDefectDetail extends QaDefectItem {
  attachments: TestingAttachmentDocument[];
  gitLinks: DefectGitLink[];
  linkedExecutions: Array<{
    id: number;
    testRunId: number;
    runKey: string;
    runName: string;
    caseKeySnapshot: string;
    caseTitleSnapshot: string;
    status: ExecutionStatusValue;
    attemptNumber: number;
    createdAt: string;
  }>;
  activities: TestingActivityItem[];
}

export interface TestingActivityItem {
  id: number;
  projectId: number;
  entityType: string;
  entityId: number;
  actorId?: number | null;
  actor?: TestingUserLite | null;
  action: string;
  field?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  metadata?: string | null;
  createdAt: string;
}

export interface TestingOverviewData {
  permissions: TestingPermissions;
  config: TestingConfigurationItem;
  summary: {
    totalTestCases: number;
    passedTests: number;
    failedTests: number;
    notRunTests: number;
    blockedTests: number;
    skippedTests: number;
    openDefects: number;
    criticalDefects: number;
    eligibleCompletedExecutions: number;
    overallPassRate: number | null;
    overallFailRate: number | null;
    totalPlans: number;
    totalRuns: number;
  };
  resultsByStatus: Array<{ status: string; count: number; color: string }>;
  defectsBySeverity: Array<{ severity: string; count: number; color: string }>;
  recentRuns: TestRunItem[];
  upcomingPlans: TestPlanItem[];
  recentDefects: QaDefectItem[];
  requirementCoverage: {
    totalRequirements: number;
    coveredRequirements: number;
    coveragePercent: number | null;
    items: Array<{
      id: number;
      code: string;
      title: string;
      testCasesCount: number;
      passedCount: number;
      failedCount: number;
      openDefectsCount: number;
    }>;
  };
  devTaskCoverage: {
    totalDevTasks: number;
    coveredDevTasks: number;
    coveragePercent: number | null;
    items: Array<{
      id: number;
      taskKey: string;
      title: string;
      status: string;
      testCasesCount: number;
      defectsCount: number;
    }>;
  };
}

export interface TestingReportsData {
  permissions: TestingPermissions;
  formula: {
    passRateFormula: string;
    failRateFormula: string;
    note: string;
  };
  summary: {
    totalLatestExecutions: number;
    passedExecutions: number;
    failedExecutions: number;
    blockedExecutions: number;
    notRunExecutions: number;
    skippedExecutions: number;
    completedEligibleExecutions: number;
    passRate: number | null;
    failRate: number | null;
    totalDefects: number;
    openDefects: number;
    criticalDefects: number;
  };
  byTestType: Array<{
    testType: string;
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    notRun: number;
    passRate: number | null;
  }>;
  byPriority: Array<{
    priority: string;
    total: number;
    passed: number;
    failed: number;
    passRate: number | null;
  }>;
  defectsBySeverity: Array<{ severity: string; count: number; color: string }>;
  defectsByStatus: Array<{ status: string; count: number }>;
  defectTrend: Array<{ date: string; created: number; resolved: number }>;
  executionByTester: Array<{
    testerId: number | null;
    testerName: string;
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    passRate: number | null;
  }>;
  requirementCoverage: Array<{
    id: number;
    code: string;
    title: string;
    linkedCases: number;
    passed: number;
    failed: number;
    defects: number;
  }>;
  byBuildOrRelease: Array<{
    buildVersion: string;
    environment: string;
    runsCount: number;
    total: number;
    passed: number;
    failed: number;
    passRate: number | null;
  }>;
  planProgress: Array<{
    id: number;
    planKey: string;
    title: string;
    status: string;
    targetVersion?: string | null;
    totalCases: number;
    passed: number;
    failed: number;
    passRate: number | null;
  }>;
  regressionSummary: {
    regressionSuitesCount: number;
    regressionCasesCount: number;
    regressionRunsCount: number;
    passed: number;
    failed: number;
    passRate: number | null;
  };
  filterChoices: {
    plans: Array<{ id: number; planKey: string; title: string }>;
    builds: string[];
    environments: string[];
    testers: TestingUserLite[];
    testTypes: string[];
  };
}

export interface TestingMetaData {
  members: TestingUserLite[];
  teams: TestingTeamLite[];
  modules: Array<{
    id: number;
    name: string;
    color?: string | null;
    submodules: Array<{ id: number; name: string }>;
  }>;
  devTasks: TestCaseLinkedDevTask[];
  requirements: TestCaseLinkedRequirement[];
  projectDocuments: Array<{
    id: number;
    displayName: string;
    mimeType: string;
    sizeBytes: number;
    repositoryPath: string;
    createdAt: string;
  }>;
  gitRepositories: Array<{
    id: number;
    name: string;
    fullName: string;
    provider: string;
    defaultBranch: string;
    webUrl: string;
  }>;
}

