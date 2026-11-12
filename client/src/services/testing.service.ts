import { authService } from './auth.service';
import { apiUrl } from '../config/api';
import type {
  ExecutionStatusValue,
  QaDefectDetail,
  QaDefectItem,
  TestCaseDetail,
  TestCaseItem,
  TestCaseStepItem,
  TestExecutionItem,
  TestingConfigurationItem,
  TestingMetaData,
  TestingOverviewData,
  TestingPermissions,
  TestingReportsData,
  TestPlanDetail,
  TestPlanItem,
  TestRunDetail,
  TestRunItem,
  TestSuiteDetail,
  TestSuiteItem,
} from '../types/testing';

function authHeaders(): Record<string, string> {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<{
  success: boolean;
  data?: T;
  error?: string;
}> {
  try {
    const res = await fetch(apiUrl(path), {
      ...init,
      headers: {
        ...authHeaders(),
        ...(init?.headers || {}),
      },
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network request failed' };
  }
}

export const testingService = {
  getOverview(projectId: number) {
    return apiFetch<TestingOverviewData>(`/projects/${projectId}/testing/overview`);
  },

  getMeta(projectId: number) {
    return apiFetch<{ permissions: TestingPermissions; config: TestingConfigurationItem; meta: TestingMetaData }>(
      `/projects/${projectId}/testing/meta`
    );
  },

  // ── Test Cases ───────────────────────────────────────────────────────────────
  listTestCases(
    projectId: number,
    params?: {
      search?: string;
      testType?: string;
      priority?: string;
      status?: string;
      testerId?: string | number;
      linkedRequirementId?: string | number;
      linkedDevTaskId?: string | number;
      includeArchived?: boolean;
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
    }
  ) {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).trim() !== '' && v !== 'all') {
          qs.set(k, String(v));
        }
      });
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<{ permissions: TestingPermissions; items: TestCaseItem[] }>(
      `/projects/${projectId}/testing/test-cases${suffix}`
    );
  },

  getTestCaseDetail(projectId: number, caseId: number) {
    return apiFetch<TestCaseDetail>(`/projects/${projectId}/testing/test-cases/${caseId}`);
  },

  createTestCase(
    projectId: number,
    payload: {
      title: string;
      description?: string | null;
      preconditions?: string | null;
      moduleId?: number | null;
      submoduleId?: number | null;
      testType?: string;
      priority?: string;
      status?: string;
      assignedTesterId?: number | null;
      labels?: string[];
      testDataSummary?: string | null;
      linkedRequirementId?: number | null;
      linkedDevTaskId?: number | null;
      steps?: TestCaseStepItem[];
      attachmentDocumentIds?: number[];
    }
  ) {
    return apiFetch<TestCaseDetail>(`/projects/${projectId}/testing/test-cases`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateTestCase(
    projectId: number,
    caseId: number,
    payload: {
      title?: string;
      description?: string | null;
      preconditions?: string | null;
      moduleId?: number | null;
      submoduleId?: number | null;
      testType?: string;
      priority?: string;
      status?: string;
      assignedTesterId?: number | null;
      labels?: string[];
      testDataSummary?: string | null;
      linkedRequirementId?: number | null;
      linkedDevTaskId?: number | null;
      steps?: TestCaseStepItem[];
    }
  ) {
    return apiFetch<TestCaseDetail>(`/projects/${projectId}/testing/test-cases/${caseId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  duplicateTestCase(projectId: number, caseId: number) {
    return apiFetch<TestCaseDetail>(`/projects/${projectId}/testing/test-cases/${caseId}/duplicate`, {
      method: 'POST',
    });
  },

  archiveTestCase(projectId: number, caseId: number, isArchived: boolean) {
    return apiFetch<TestCaseItem>(`/projects/${projectId}/testing/test-cases/${caseId}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({ isArchived }),
    });
  },

  bulkTestCaseAction(
    projectId: number,
    payload: { caseIds: number[]; action: 'archive' | 'unarchive' | 'status'; status?: string }
  ) {
    return apiFetch<{ updatedCount: number }>(`/projects/${projectId}/testing/test-cases/bulk`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // ── Test Suites ──────────────────────────────────────────────────────────────
  listTestSuites(projectId: number, params?: { search?: string; status?: string; includeArchived?: boolean }) {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).trim() !== '' && v !== 'all') {
          qs.set(k, String(v));
        }
      });
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<{ permissions: TestingPermissions; items: TestSuiteItem[] }>(
      `/projects/${projectId}/testing/test-suites${suffix}`
    );
  },

  getTestSuiteDetail(projectId: number, suiteId: number) {
    return apiFetch<TestSuiteDetail>(`/projects/${projectId}/testing/test-suites/${suiteId}`);
  },

  createTestSuite(
    projectId: number,
    payload: {
      name: string;
      description?: string | null;
      purpose?: string | null;
      ownerId?: number | null;
      status?: string;
      labels?: string[];
      testCaseIds?: number[];
    }
  ) {
    return apiFetch<TestSuiteDetail>(`/projects/${projectId}/testing/test-suites`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateTestSuite(
    projectId: number,
    suiteId: number,
    payload: {
      name?: string;
      description?: string | null;
      purpose?: string | null;
      ownerId?: number | null;
      status?: string;
      labels?: string[];
    }
  ) {
    return apiFetch<TestSuiteDetail>(`/projects/${projectId}/testing/test-suites/${suiteId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  setSuiteCases(projectId: number, suiteId: number, testCaseIds: number[]) {
    return apiFetch<TestSuiteDetail>(`/projects/${projectId}/testing/test-suites/${suiteId}/cases`, {
      method: 'PUT',
      body: JSON.stringify({ testCaseIds }),
    });
  },

  duplicateTestSuite(projectId: number, suiteId: number) {
    return apiFetch<TestSuiteDetail>(`/projects/${projectId}/testing/test-suites/${suiteId}/duplicate`, {
      method: 'POST',
    });
  },

  archiveTestSuite(projectId: number, suiteId: number, isArchived: boolean) {
    return apiFetch<TestSuiteItem>(`/projects/${projectId}/testing/test-suites/${suiteId}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({ isArchived }),
    });
  },

  // ── Test Plans ───────────────────────────────────────────────────────────────
  listTestPlans(projectId: number, params?: { search?: string; status?: string; includeArchived?: boolean }) {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).trim() !== '' && v !== 'all') {
          qs.set(k, String(v));
        }
      });
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<{ permissions: TestingPermissions; items: TestPlanItem[] }>(
      `/projects/${projectId}/testing/test-plans${suffix}`
    );
  },

  getTestPlanDetail(projectId: number, planId: number) {
    return apiFetch<TestPlanDetail>(`/projects/${projectId}/testing/test-plans/${planId}`);
  },

  createTestPlan(
    projectId: number,
    payload: {
      title: string;
      description?: string | null;
      testingScope?: string | null;
      targetVersion?: string | null;
      targetEnvironment?: string | null;
      startDate?: string | null;
      dueDate?: string | null;
      responsibleTesterId?: number | null;
      responsibleTeamId?: number | null;
      linkedRequirementId?: number | null;
      linkedDevTaskId?: number | null;
      milestoneLabel?: string | null;
      status?: string;
      suiteIds?: number[];
      testCaseIds?: number[];
    }
  ) {
    return apiFetch<TestPlanDetail>(`/projects/${projectId}/testing/test-plans`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateTestPlan(
    projectId: number,
    planId: number,
    payload: Record<string, any>
  ) {
    return apiFetch<TestPlanDetail>(`/projects/${projectId}/testing/test-plans/${planId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  archiveTestPlan(projectId: number, planId: number, isArchived: boolean) {
    return apiFetch<TestPlanItem>(`/projects/${projectId}/testing/test-plans/${planId}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({ isArchived }),
    });
  },

  startRunFromPlan(
    projectId: number,
    planId: number,
    payload?: {
      name?: string;
      buildVersion?: string | null;
      environment?: string | null;
      executedById?: number | null;
    }
  ) {
    return apiFetch<TestRunDetail>(`/projects/${projectId}/testing/test-plans/${planId}/start-run`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  },

  // ── Test Runs & Executions ───────────────────────────────────────────────────
  listTestRuns(
    projectId: number,
    params?: { search?: string; status?: string; environment?: string; planId?: number; includeArchived?: boolean }
  ) {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).trim() !== '' && v !== 'all') {
          qs.set(k, String(v));
        }
      });
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<{ permissions: TestingPermissions; items: TestRunItem[] }>(
      `/projects/${projectId}/testing/test-runs${suffix}`
    );
  },

  getTestRunDetail(projectId: number, runId: number, includeHistory = false) {
    return apiFetch<TestRunDetail>(
      `/projects/${projectId}/testing/test-runs/${runId}${includeHistory ? '?includeHistory=true' : ''}`
    );
  },

  createTestRun(
    projectId: number,
    payload: {
      name: string;
      description?: string | null;
      testPlanId?: number | null;
      testSuiteId?: number | null;
      testCaseIds?: number[];
      buildVersion?: string | null;
      environment?: string | null;
      executedById?: number | null;
    }
  ) {
    return apiFetch<TestRunDetail>(`/projects/${projectId}/testing/test-runs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateTestRun(
    projectId: number,
    runId: number,
    payload: {
      name?: string;
      description?: string | null;
      buildVersion?: string | null;
      environment?: string | null;
      status?: string;
      isArchived?: boolean;
    }
  ) {
    return apiFetch<TestRunDetail>(`/projects/${projectId}/testing/test-runs/${runId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  updateExecution(
    projectId: number,
    executionId: number,
    payload: {
      status?: ExecutionStatusValue;
      actualResult?: string | null;
      notes?: string | null;
      steps?: Array<{
        id: number;
        status: 'Not Run' | 'Passed' | 'Failed' | 'Blocked' | string;
        actualResult?: string | null;
        notes?: string | null;
      }>;
    }
  ) {
    return apiFetch<TestExecutionItem>(`/projects/${projectId}/testing/executions/${executionId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  retestExecution(projectId: number, runId: number, executionId: number) {
    return apiFetch<TestExecutionItem>(
      `/projects/${projectId}/testing/test-runs/${runId}/executions/${executionId}/retest`,
      { method: 'POST' }
    );
  },

  linkDefectToExecution(projectId: number, executionId: number, defectId: number) {
    return apiFetch<TestExecutionItem>(
      `/projects/${projectId}/testing/executions/${executionId}/link-defect`,
      {
        method: 'POST',
        body: JSON.stringify({ defectId }),
      }
    );
  },

  unlinkDefectFromExecution(projectId: number, executionId: number, defectId: number) {
    return apiFetch<TestExecutionItem>(
      `/projects/${projectId}/testing/executions/${executionId}/link-defect/${defectId}`,
      { method: 'DELETE' }
    );
  },

  // ── Defects ──────────────────────────────────────────────────────────────────
  listDefects(
    projectId: number,
    params?: {
      search?: string;
      severity?: string;
      priority?: string;
      status?: string;
      assigneeId?: string | number;
      reporterId?: string | number;
      startDate?: string;
      endDate?: string;
      includeArchived?: boolean;
    }
  ) {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).trim() !== '' && v !== 'all') {
          qs.set(k, String(v));
        }
      });
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<{ permissions: TestingPermissions; items: QaDefectItem[] }>(
      `/projects/${projectId}/testing/defects${suffix}`
    );
  },

  getDefectDetail(projectId: number, defectId: number) {
    return apiFetch<QaDefectDetail>(`/projects/${projectId}/testing/defects/${defectId}`);
  },

  createDefect(
    projectId: number,
    payload: {
      title: string;
      description?: string | null;
      stepsToReproduce?: string | null;
      expectedResult?: string | null;
      actualResult?: string | null;
      severity?: string;
      priority?: string;
      status?: string;
      assigneeId?: number | null;
      environment?: string | null;
      buildVersion?: string | null;
      linkedTestCaseId?: number | null;
      linkedTestRunId?: number | null;
      linkedExecutionId?: number | null;
      linkedDevTaskId?: number | null;
      linkedRequirementId?: number | null;
      attachmentDocumentIds?: number[];
    }
  ) {
    return apiFetch<QaDefectDetail>(`/projects/${projectId}/testing/defects`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateDefect(projectId: number, defectId: number, payload: Record<string, any>) {
    return apiFetch<QaDefectDetail>(`/projects/${projectId}/testing/defects/${defectId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  archiveDefect(projectId: number, defectId: number, isArchived: boolean) {
    return apiFetch<QaDefectItem>(`/projects/${projectId}/testing/defects/${defectId}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({ isArchived }),
    });
  },

  linkDefectGitRecord(
    projectId: number,
    defectId: number,
    payload: {
      repositoryId: number;
      provider: string;
      recordType: 'issue' | 'merge_request';
      recordId: string;
      recordNumber?: number;
      recordTitle?: string;
      recordUrl?: string;
    }
  ) {
    return apiFetch<QaDefectDetail>(`/projects/${projectId}/testing/defects/${defectId}/link-git`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  unlinkDefectGitRecord(projectId: number, defectId: number, linkId: number) {
    return apiFetch<QaDefectDetail>(
      `/projects/${projectId}/testing/defects/${defectId}/link-git/${linkId}`,
      { method: 'DELETE' }
    );
  },

  // ── Attachments (reusing existing storage) ───────────────────────────────────
  uploadAttachments(
    projectId: number,
    payload: {
      entityType: 'test_case' | 'execution' | 'defect';
      entityId: number;
      files: Array<{ name: string; base64: string; mimeType?: string }>;
    }
  ) {
    return apiFetch<{ documents: any[]; errors?: any[] }>(
      `/projects/${projectId}/testing/attachments/upload`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  linkExistingDocument(
    projectId: number,
    payload: { entityType: 'test_case' | 'execution' | 'defect'; entityId: number; documentId: number }
  ) {
    return apiFetch<{ linked: boolean }>(`/projects/${projectId}/testing/attachments/link`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  unlinkAttachment(
    projectId: number,
    payload: { entityType: 'test_case' | 'execution' | 'defect'; entityId: number; documentId: number }
  ) {
    return apiFetch<{ unlinked: boolean }>(`/projects/${projectId}/testing/attachments/unlink`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // ── Reports & Settings ───────────────────────────────────────────────────────
  getReports(
    projectId: number,
    params?: {
      startDate?: string;
      endDate?: string;
      planId?: string | number;
      buildVersion?: string;
      environment?: string;
      testerId?: string | number;
      testType?: string;
    }
  ) {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).trim() !== '' && v !== 'all') {
          qs.set(k, String(v));
        }
      });
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<TestingReportsData>(`/projects/${projectId}/testing/reports${suffix}`);
  },

  async downloadReportsCsv(
    projectId: number,
    params?: Record<string, string | number | undefined>
  ) {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).trim() !== '' && v !== 'all') {
          qs.set(k, String(v));
        }
      });
    }
    const token = authService.getToken();
    const res = await fetch(
      apiUrl(`/projects/${projectId}/testing/reports/export${qs.toString() ? `?${qs.toString()}` : ''}`),
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );
    if (!res.ok) {
      throw new Error('Failed to export QA report CSV');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devflow-qa-report-project-${projectId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  getSettings(projectId: number) {
    return apiFetch<{ permissions: TestingPermissions; config: TestingConfigurationItem }>(
      `/projects/${projectId}/testing/settings`
    );
  },

  updateSettings(projectId: number, payload: Partial<TestingConfigurationItem>) {
    return apiFetch<{ permissions: TestingPermissions; config: TestingConfigurationItem }>(
      `/projects/${projectId}/testing/settings`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
  },

  addMasterOption(
    projectId: number,
    payload: {
      category: 'testTypes' | 'priorities' | 'defectSeverities' | 'environments';
      name: string;
      color?: string;
      icon?: string;
    }
  ) {
    return apiFetch<{ config: TestingConfigurationItem; created: any }>(
      `/projects/${projectId}/testing/settings/master-option`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  archiveMasterOption(
    projectId: number,
    payload: {
      category: 'testTypes' | 'priorities' | 'defectSeverities' | 'environments';
      name: string;
      isArchived: boolean;
    }
  ) {
    return apiFetch<{ config: TestingConfigurationItem }>(
      `/projects/${projectId}/testing/settings/master-option/archive`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
  },
};

