import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Archive,
  Bug,
  Check,
  CheckCircle2,
  ExternalLink,
  History,
  Link2,
  PlayCircle,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { useAccentTheme } from '../../../services/accentTheme.service';
import { useToast } from '../../../context/ToastContext';
import { confirmDeleteSwal } from '../../../lib/confirmAlert';
import { AnimatedSelect } from '../../../components/settings/AnimatedSelect';
import { UserAvatar } from '../../../components/common/UserAvatar';
import {
  TestingPageHeader,
  useTestingNavigation,
} from '../../../components/testing/TestingPageHeader';
import { TestingAttachmentsPanel } from '../../../components/testing/TestingAttachmentsPanel';
import {
  DefectStatusBadge,
  ExecutionStatusBadge,
  MasterOptionSelect,
  PlanRunStatusBadge,
  TestingPriorityBadge,
  TestingSeverityBadge,
  TestTypeBadge,
  formatTestingDate,
  formatTestingDateTime,
} from '../../../components/testing/testingBadges';
import { testingService } from '../../../services/testing.service';
import type {
  ExecutionStatusValue,
  QaDefectItem,
  TestCaseItem,
  TestExecutionItem,
  TestPlanItem,
  TestRunDetail,
  TestRunItem,
  TestSuiteItem,
  TestingConfigurationItem,
  TestingMetaData,
  TestingPermissions,
} from '../../../types/testing';

interface TestRunsViewProps {
  projectId?: number;
}

const EXECUTION_STATUS_CHOICES = [
  { value: 'Not Run', label: 'Not Run' },
  { value: 'Passed', label: 'Passed' },
  { value: 'Failed', label: 'Failed' },
  { value: 'Blocked', label: 'Blocked' },
  { value: 'Skipped', label: 'Skipped' },
];

const RUN_STATUS_CHOICES = [
  { value: 'Not Started', label: 'Not Started' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Aborted', label: 'Aborted' },
];

export const TestRunsView: React.FC<TestRunsViewProps> = ({ projectId: propProjectId }) => {
  const { id, runId: routeRunId } = useParams<{ id: string; runId?: string }>();
  const projectId = propProjectId || Number(id);
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();
  const { goToSubmodule } = useTestingNavigation(projectId);
  const [searchParams, setSearchParams] = useSearchParams();

  const [meta, setMeta] = useState<TestingMetaData | null>(null);
  const [config, setConfig] = useState<TestingConfigurationItem | null>(null);
  const [permissions, setPermissions] = useState<TestingPermissions | null>(null);
  const [runs, setRuns] = useState<TestRunItem[]>([]);
  const [plans, setPlans] = useState<TestPlanItem[]>([]);
  const [suites, setSuites] = useState<TestSuiteItem[]>([]);
  const [cases, setCases] = useState<TestCaseItem[]>([]);
  const [projectDefects, setProjectDefects] = useState<QaDefectItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [includeArchived, setIncludeArchived] = useState(false);

  const initialRunId = routeRunId
    ? Number(routeRunId)
    : searchParams.get('runId')
      ? Number(searchParams.get('runId'))
      : null;

  const [selectedRunId, setSelectedRunId] = useState<number | null>(initialRunId);
  const [runDetail, setRunDetail] = useState<TestRunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  // Selected execution inside the run
  const [selectedExecId, setSelectedExecId] = useState<number | null>(null);
  const [execStatus, setExecStatus] = useState('Not Run');
  const [execActualResult, setExecActualResult] = useState('');
  const [execNotes, setExecNotes] = useState('');
  const [stepDrafts, setStepDrafts] = useState<
    Record<number, { status: string; actualResult: string; notes: string }>
  >({});
  const [savingExec, setSavingExec] = useState(false);
  const [retestingExec, setRetestingExec] = useState(false);

  // Create new Run modal
  const [createRunOpen, setCreateRunOpen] = useState(false);
  const [creatingRun, setCreatingRun] = useState(false);
  const [newRunForm, setNewRunForm] = useState({
    name: '',
    description: '',
    testPlanId: '',
    testSuiteId: '',
    testCaseIds: [] as number[],
    buildVersion: '',
    environment: 'Staging',
    executedById: '',
  });

  // Create Defect from failed execution modal
  const [createDefectOpen, setCreateDefectOpen] = useState(false);
  const [creatingDefect, setCreatingDefect] = useState(false);
  const [defectForm, setDefectForm] = useState({
    title: '',
    description: '',
    severity: 'Major',
    priority: 'High',
    stepsToReproduce: '',
    expectedResult: '',
    actualResult: '',
    assigneeId: '',
  });

  // Link existing defect modal
  const [linkDefectOpen, setLinkDefectOpen] = useState(false);
  const [linkDefectId, setLinkDefectId] = useState('');
  const [linkingDefect, setLinkingDefect] = useState(false);

  const canExecute = Boolean(permissions?.canExecuteTests);
  const canManageDefects = Boolean(permissions?.canManageDefects);
  const canArchive = Boolean(permissions?.canArchiveRecords);

  useEffect(() => {
    const queryRun = routeRunId || searchParams.get('runId');
    if (queryRun && Number(queryRun) > 0) {
      setSelectedRunId(Number(queryRun));
    }
  }, [routeRunId, searchParams]);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [metaRes, runsRes, plansRes, suitesRes, casesRes, defectsRes] = await Promise.all([
        testingService.getMeta(projectId),
        testingService.listTestRuns(projectId, {
          search: searchQuery || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          includeArchived,
        }),
        testingService.listTestPlans(projectId, {}),
        testingService.listTestSuites(projectId, {}),
        testingService.listTestCases(projectId, {}),
        testingService.listDefects(projectId, {}),
      ]);
      if (metaRes.success && metaRes.data) {
        setMeta(metaRes.data.meta);
        setConfig(metaRes.data.config);
        setPermissions(metaRes.data.permissions);
      }
      if (runsRes.success && runsRes.data) {
        setRuns(runsRes.data.items);
        if (!selectedRunId && runsRes.data.items.length > 0) {
          setSelectedRunId(runsRes.data.items[0].id);
        }
      }
      if (plansRes.success && plansRes.data) setPlans(plansRes.data.items);
      if (suitesRes.success && suitesRes.data) setSuites(suitesRes.data.items);
      if (casesRes.success && casesRes.data) setCases(casesRes.data.items);
      if (defectsRes.success && defectsRes.data) setProjectDefects(defectsRes.data.items);
    } catch {
      toast.error('Failed to load test runs');
    } finally {
      setLoading(false);
    }
  }, [projectId, searchQuery, statusFilter, includeArchived, selectedRunId, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadRunDetail = useCallback(
    async (runId: number) => {
      setDetailLoading(true);
      try {
        const res = await testingService.getTestRunDetail(projectId, runId, showHistory);
        if (res.success && res.data) {
          setRunDetail(res.data);
          const execList = res.data.executions;
          const keep = execList.find((e) => e.id === selectedExecId);
          if (!keep) {
            const firstLatest = execList.find((e) => e.isLatest) || execList[0] || null;
            setSelectedExecId(firstLatest ? firstLatest.id : null);
          }
        }
      } catch {
        toast.error('Failed to load run details');
      } finally {
        setDetailLoading(false);
      }
    },
    [projectId, showHistory, selectedExecId, toast]
  );

  useEffect(() => {
    if (selectedRunId) {
      void loadRunDetail(selectedRunId);
    } else {
      setRunDetail(null);
    }
  }, [selectedRunId, loadRunDetail]);

  const activeExec: TestExecutionItem | null = useMemo(() => {
    if (!runDetail || !selectedExecId) return null;
    return runDetail.executions.find((e) => e.id === selectedExecId) || null;
  }, [runDetail, selectedExecId]);

  useEffect(() => {
    if (!activeExec) return;
    setExecStatus(activeExec.status);
    setExecActualResult(activeExec.actualResult || '');
    setExecNotes(activeExec.notes || '');
    const map: Record<number, { status: string; actualResult: string; notes: string }> = {};
    activeExec.steps.forEach((s) => {
      map[s.id] = {
        status: s.status || 'Not Run',
        actualResult: s.actualResult || '',
        notes: s.notes || '',
      };
    });
    setStepDrafts(map);
  }, [activeExec]);

  const latestExecutions = useMemo(() => {
    if (!runDetail) return [];
    return runDetail.executions.filter((e) => e.isLatest);
  }, [runDetail]);

  const priorAttemptsForActive = useMemo(() => {
    if (!runDetail || !activeExec) return [];
    return runDetail.executions
      .filter((e) => e.testCaseId === activeExec.testCaseId && e.id !== activeExec.id)
      .sort((a, b) => b.attemptNumber - a.attemptNumber);
  }, [runDetail, activeExec]);

  const handleSaveExecution = async (overrideStatus?: ExecutionStatusValue) => {
    if (!activeExec || !canExecute) return;
    const statusToSave = (overrideStatus || execStatus) as ExecutionStatusValue;
    setSavingExec(true);
    try {
      const stepsPayload = activeExec.steps.map((s) => ({
        id: s.id,
        status: (stepDrafts[s.id]?.status || s.status || 'Not Run') as ExecutionStatusValue,
        actualResult: stepDrafts[s.id]?.actualResult ?? s.actualResult ?? '',
        notes: stepDrafts[s.id]?.notes ?? s.notes ?? '',
      }));
      const res = await testingService.updateExecution(projectId, activeExec.id, {
        status: statusToSave,
        actualResult: execActualResult || undefined,
        notes: execNotes || undefined,
        steps: stepsPayload,
      });
      if (res.success) {
        toast.success(`Saved ${activeExec.caseKeySnapshot} as ${statusToSave}`);
        if (selectedRunId) await loadRunDetail(selectedRunId);
        await loadData();
      } else {
        toast.error(res.error || 'Could not save execution result');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not update execution');
    } finally {
      setSavingExec(false);
    }
  };

  const handleRetestExecution = async () => {
    if (!runDetail || !activeExec || !canExecute) return;
    setRetestingExec(true);
    try {
      const res = await testingService.retestExecution(projectId, runDetail.id, activeExec.id);
      if (res.success && res.data) {
        toast.success(`Created Attempt #${res.data.attemptNumber} preserving previous run history`);
        await loadRunDetail(runDetail.id);
        setSelectedExecId(res.data.id);
        await loadData();
      } else {
        toast.error(res.error || 'Could not start retest attempt');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not start retest');
    } finally {
      setRetestingExec(false);
    }
  };

  const handleUpdateRunStatus = async (status: string) => {
    if (!runDetail || !canExecute) return;
    try {
      const res = await testingService.updateTestRun(projectId, runDetail.id, { status });
      if (res.success) {
        toast.success(`Run marked ${status}`);
        await loadRunDetail(runDetail.id);
        await loadData();
      }
    } catch {
      toast.error('Could not update run status');
    }
  };

  const handleArchiveRun = async (run: TestRunItem) => {
    const confirmed = await confirmDeleteSwal({
      title: run.isArchived ? `Restore ${run.runKey}?` : `Archive ${run.runKey}?`,
      text: run.isArchived
        ? 'Restoring makes this test run visible again.'
        : 'Archiving hides the test run while keeping historical execution logs & defect links intact.',
      confirmText: run.isArchived ? 'Restore Run' : 'Archive Run',
    });
    if (!confirmed) return;
    try {
      const res = await testingService.updateTestRun(projectId, run.id, {
        isArchived: !run.isArchived,
      });
      if (res.success) {
        toast.success(run.isArchived ? 'Test run restored' : 'Test run archived');
        await loadData();
        if (selectedRunId === run.id) await loadRunDetail(run.id);
      }
    } catch {
      toast.error('Failed to archive test run');
    }
  };

  const openCreateDefectFromExecution = () => {
    if (!activeExec || !runDetail) return;
    const stepSummary = activeExec.steps
      .map(
        (s) =>
          `${s.stepNumber}. ${s.action} -> Expected: ${s.expectedResult} | Actual: ${
            stepDrafts[s.id]?.actualResult || s.actualResult || 'Not recorded'
          }`
      )
      .join('\n');
    setDefectForm({
      title: `[${activeExec.caseKeySnapshot}] ${activeExec.caseTitleSnapshot} failed`,
      description: `Observed failure during ${runDetail.runKey} (Attempt #${activeExec.attemptNumber}).\n${
        execNotes || activeExec.notes || ''
      }`.trim(),
      severity: 'Major',
      priority: activeExec.prioritySnapshot || 'High',
      stepsToReproduce: stepSummary,
      expectedResult: activeExec.steps.map((s) => s.expectedResult).filter(Boolean).join('; '),
      actualResult: execActualResult || activeExec.actualResult || '',
      assigneeId: '',
    });
    setCreateDefectOpen(true);
  };

  const handleSubmitCreateDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExec || !runDetail) return;
    setCreatingDefect(true);
    try {
      const res = await testingService.createDefect(projectId, {
        title: defectForm.title.trim(),
        description: defectForm.description.trim() || undefined,
        severity: defectForm.severity,
        priority: defectForm.priority,
        stepsToReproduce: defectForm.stepsToReproduce.trim() || undefined,
        expectedResult: defectForm.expectedResult.trim() || undefined,
        actualResult: defectForm.actualResult.trim() || undefined,
        environment: runDetail.environment || undefined,
        buildVersion: runDetail.buildVersion || undefined,
        assigneeId: defectForm.assigneeId ? Number(defectForm.assigneeId) : null,
        linkedTestCaseId: activeExec.testCaseId,
        linkedTestRunId: runDetail.id,
        linkedExecutionId: activeExec.id,
      });
      if (res.success && res.data) {
        toast.success(`Defect ${res.data.defectKey} logged & linked to execution`);
        setCreateDefectOpen(false);
        await loadRunDetail(runDetail.id);
        await loadData();
      } else {
        toast.error(res.error || 'Could not log defect');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not create defect');
    } finally {
      setCreatingDefect(false);
    }
  };

  const handleLinkExistingDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExec || !linkDefectId) return;
    setLinkingDefect(true);
    try {
      const res = await testingService.linkDefectToExecution(
        projectId,
        activeExec.id,
        Number(linkDefectId)
      );
      if (res.success) {
        toast.success('Existing defect linked to execution');
        setLinkDefectOpen(false);
        setLinkDefectId('');
        if (selectedRunId) await loadRunDetail(selectedRunId);
      } else {
        toast.error(res.error || 'Could not link defect');
      }
    } catch {
      toast.error('Could not link defect');
    } finally {
      setLinkingDefect(false);
    }
  };

  const handleCreateRunSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRunForm.name.trim()) {
      toast.error('Run name is required');
      return;
    }
    setCreatingRun(true);
    try {
      const res = await testingService.createTestRun(projectId, {
        name: newRunForm.name.trim(),
        description: newRunForm.description.trim() || undefined,
        testPlanId: newRunForm.testPlanId ? Number(newRunForm.testPlanId) : null,
        testSuiteId: newRunForm.testSuiteId ? Number(newRunForm.testSuiteId) : null,
        testCaseIds: newRunForm.testCaseIds.length > 0 ? newRunForm.testCaseIds : undefined,
        buildVersion: newRunForm.buildVersion.trim() || undefined,
        environment: newRunForm.environment || undefined,
        executedById: newRunForm.executedById ? Number(newRunForm.executedById) : null,
      });
      if (res.success && res.data) {
        toast.success(`Test Run ${res.data.runKey} created`);
        setCreateRunOpen(false);
        setSearchParams({ runId: String(res.data.id) });
        setSelectedRunId(res.data.id);
        await loadData();
      } else {
        toast.error(res.error || 'Could not create test run');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not create test run');
    } finally {
      setCreatingRun(false);
    }
  };

  const memberOptions = useMemo(
    () => [
      { value: '', label: 'Unassigned' },
      ...(meta?.members || []).map((m) => ({
        value: String(m.id),
        label: m.name,
      })),
    ],
    [meta?.members]
  );

  const planOptions = useMemo(
    () => [
      { value: '', label: 'None (Ad-hoc Run)' },
      ...plans.filter((p) => !p.isArchived).map((p) => ({ value: String(p.id), label: `${p.planKey} — ${p.title}` })),
    ],
    [plans]
  );

  const suiteOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...suites.filter((s) => !s.isArchived).map((s) => ({ value: String(s.id), label: `${s.suiteKey} — ${s.name}` })),
    ],
    [suites]
  );

  return (
    <div className="p-6 max-w-[1680px] mx-auto space-y-6">
      <TestingPageHeader
        projectId={projectId}
        activeKey="test-runs"
        icon={PlayCircle}
        title="Test Runs & Execution"
        description="Execute manual test cases step-by-step, capture actual evidence, retest fixes cleanly, and log defects directly from failures."
        badge={runs.length}
        actions={
          canExecute ? (
            <button
              type="button"
              onClick={() => {
                setNewRunForm({
                  name: '',
                  description: '',
                  testPlanId: '',
                  testSuiteId: '',
                  testCaseIds: [],
                  buildVersion: '',
                  environment: config?.defaultEnvironment || 'Staging',
                  executedById: '',
                });
                setCreateRunOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-lg"
              style={{ backgroundColor: accentColor }}
            >
              <Plus className="w-4 h-4" />
              New Test Run
            </button>
          ) : null
        }
      />

      {/* Filter Bar */}
      <div className="bg-[#12151B] border border-white/10 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search run key, name, build..."
            className="w-full bg-[#0B0D10] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500"
          />
        </div>
        <div className="w-44">
          <AnimatedSelect
            options={[{ value: 'ALL', label: 'All Statuses' }, ...RUN_STATUS_CHOICES]}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-gray-300 cursor-pointer px-2">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="rounded border-white/20"
          />
          Show Archived
        </label>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left Runs List */}
        <div className="xl:col-span-4 space-y-2.5 max-h-[780px] overflow-y-auto pr-1">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-[#12151B] border border-white/10 animate-pulse" />
            ))
          ) : runs.length === 0 ? (
            <div className="bg-[#12151B] border border-white/10 rounded-2xl p-8 text-center space-y-3">
              <PlayCircle className="w-8 h-8 text-gray-500 mx-auto" />
              <p className="text-xs text-gray-400">No test runs yet. Start a run from a plan or create an ad-hoc run.</p>
            </div>
          ) : (
            runs.map((run) => {
              const selected = selectedRunId === run.id;
              return (
                <div
                  key={run.id}
                  onClick={() => {
                    setSelectedRunId(run.id);
                    setSearchParams({ runId: String(run.id) });
                  }}
                  className={`bg-[#12151B] border rounded-2xl p-4 cursor-pointer transition-all space-y-2.5 ${
                    selected
                      ? 'border-emerald-500/60 ring-1 ring-emerald-500/30'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-emerald-300">
                          {run.runKey}
                        </span>
                        <PlanRunStatusBadge status={run.isArchived ? 'Archived' : run.status} />
                      </div>
                      <h3 className="text-xs font-semibold text-white mt-1.5 truncate">{run.name}</h3>
                    </div>
                    {canArchive && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleArchiveRun(run);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-amber-300 hover:bg-white/5"
                        title={run.isArchived ? 'Restore Run' : 'Archive Run'}
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>
                      {run.environment || 'Default'} {run.buildVersion ? `· ${run.buildVersion}` : ''}
                    </span>
                    <span className="font-semibold text-emerald-400">{run.stats.passRate}% pass</span>
                  </div>

                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden flex">
                    {run.stats.total > 0 && (
                      <>
                        <div
                          className="bg-emerald-500"
                          style={{ width: `${(run.stats.passed / run.stats.total) * 100}%` }}
                        />
                        <div
                          className="bg-red-500"
                          style={{ width: `${(run.stats.failed / run.stats.total) * 100}%` }}
                        />
                        <div
                          className="bg-amber-500"
                          style={{ width: `${(run.stats.blocked / run.stats.total) * 100}%` }}
                        />
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span>
                      {run.stats.passed}P · {run.stats.failed}F · {run.stats.blocked}B ·{' '}
                      {run.stats.notRun} NR
                    </span>
                    <span>{formatTestingDate(run.createdAt)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Run Execution Workbench */}
        <div className="xl:col-span-8">
          {!selectedRunId ? (
            <div className="bg-[#12151B] border border-white/10 rounded-2xl p-12 text-center text-xs text-gray-400">
              Select a test run to execute cases and inspect step evidence.
            </div>
          ) : detailLoading || !runDetail ? (
            <div className="h-96 bg-[#12151B] border border-white/10 rounded-2xl animate-pulse" />
          ) : (
            <div className="bg-[#12151B] border border-white/10 rounded-2xl overflow-hidden flex flex-col">
              {/* Run Header Summary */}
              <div className="p-5 border-b border-white/10 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-white/5 border border-white/10 text-emerald-300">
                        {runDetail.runKey}
                      </span>
                      <PlanRunStatusBadge status={runDetail.status} size="sm" />
                      {runDetail.testPlan && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/25">
                          Plan: {runDetail.testPlan.planKey}
                        </span>
                      )}
                      {runDetail.testSuite && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/25">
                          Suite: {runDetail.testSuite.suiteKey}
                        </span>
                      )}
                    </div>
                    <h2 className="text-base font-semibold text-white mt-2">{runDetail.name}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Env: {runDetail.environment || 'Default'} · Build:{' '}
                      {runDetail.buildVersion || 'Unspecified'} · Started{' '}
                      {formatTestingDateTime(runDetail.startedAt || runDetail.createdAt)}
                    </p>
                  </div>

                  {canExecute && (
                    <div className="w-44">
                      <AnimatedSelect
                        options={RUN_STATUS_CHOICES}
                        value={runDetail.status}
                        onChange={(val) => void handleUpdateRunStatus(val)}
                      />
                    </div>
                  )}
                </div>

                {/* Live Run Stats Row */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center bg-[#0B0D10] border border-white/10 rounded-xl p-3 text-xs">
                  <div>
                    <p className="text-[10px] text-gray-500">Total Cases</p>
                    <p className="font-semibold text-white">{runDetail.stats.total}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-emerald-400">Passed</p>
                    <p className="font-semibold text-emerald-300">{runDetail.stats.passed}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-red-400">Failed</p>
                    <p className="font-semibold text-red-300">{runDetail.stats.failed}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-amber-400">Blocked</p>
                    <p className="font-semibold text-amber-300">{runDetail.stats.blocked}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">Not Run</p>
                    <p className="font-semibold text-gray-200">{runDetail.stats.notRun}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-indigo-400">Pass Rate</p>
                    <p className="font-semibold text-white">{runDetail.stats.passRate}%</p>
                  </div>
                </div>
              </div>

              {/* Execution Cases + Step Runner */}
              <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[520px]">
                {/* Execution Queue */}
                <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-white/10 divide-y divide-white/5 max-h-[620px] overflow-y-auto">
                  <div className="px-4 py-2.5 bg-[#0B0D10] flex items-center justify-between text-[11px] text-gray-400">
                    <span>Cases ({latestExecutions.length})</span>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showHistory}
                        onChange={(e) => setShowHistory(e.target.checked)}
                      />
                      History ({runDetail.allHistoryCount})
                    </label>
                  </div>
                  {latestExecutions.map((ex) => {
                    const isActive = activeExec?.id === ex.id;
                    return (
                      <div
                        key={ex.id}
                        onClick={() => setSelectedExecId(ex.id)}
                        className={`p-3.5 cursor-pointer transition-colors space-y-1.5 ${
                          isActive ? 'bg-emerald-500/10' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono text-emerald-300">
                            {ex.caseKeySnapshot}
                          </span>
                          <ExecutionStatusBadge status={ex.status} />
                        </div>
                        <p className="text-xs font-medium text-white line-clamp-2">
                          {ex.caseTitleSnapshot}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                          <span>Attempt #{ex.attemptNumber}</span>
                          {ex.linkedDefects.length > 0 && (
                            <span className="text-rose-400 font-medium">
                              {ex.linkedDefects.length} defect(s)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Execution Runner */}
                <div className="lg:col-span-8 p-5 space-y-5 max-h-[620px] overflow-y-auto">
                  {!activeExec ? (
                    <p className="text-xs text-gray-500">Select a test case execution on the left.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-emerald-300">
                              {activeExec.caseKeySnapshot}
                            </span>
                            <TestTypeBadge testType={activeExec.testTypeSnapshot || 'Functional'} />
                            <TestingPriorityBadge priority={activeExec.prioritySnapshot || 'Medium'} />
                            <span className="text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10">
                              Attempt #{activeExec.attemptNumber}
                              {!activeExec.isLatest ? ' (Historical Snapshot)' : ''}
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-white">
                            {activeExec.caseTitleSnapshot}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2">
                          {canExecute && activeExec.isLatest && (
                            <button
                              type="button"
                              disabled={retestingExec}
                              onClick={() => void handleRetestExecution()}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/35 hover:bg-indigo-500/25"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              {retestingExec ? 'Cloning...' : 'Retest (New Attempt)'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              goToSubmodule('test-cases', { caseId: activeExec.testCaseId })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs text-gray-300 bg-white/5 hover:bg-white/10"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Case
                          </button>
                        </div>
                      </div>

                      {/* Quick Overall Result Bar */}
                      <div className="bg-[#0B0D10] border border-white/10 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-400">Overall Result:</span>
                          <ExecutionStatusBadge status={execStatus} size="sm" />
                        </div>
                        {canExecute && activeExec.isLatest && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {EXECUTION_STATUS_CHOICES.map((st) => (
                              <button
                                key={st.value}
                                type="button"
                                onClick={() => setExecStatus(st.value)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                                  execStatus === st.value
                                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/50'
                                    : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                                }`}
                              >
                                {st.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Steps Checklist */}
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                          Execution Steps ({activeExec.steps.length})
                        </h4>
                        {activeExec.steps.length === 0 ? (
                          <p className="text-xs text-gray-500">
                            No explicit steps defined; record overall actual result below.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {activeExec.steps.map((step) => {
                              const draft = stepDrafts[step.id] || {
                                status: step.status,
                                actualResult: step.actualResult || '',
                                notes: step.notes || '',
                              };
                              return (
                                <div
                                  key={step.id}
                                  className="bg-[#0B0D10] border border-white/10 rounded-xl p-3.5 space-y-2.5"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1 text-xs">
                                      <div className="font-semibold text-white">
                                        Step {step.stepNumber}: {step.action}
                                      </div>
                                      {step.testData && (
                                        <p className="text-[11px] text-sky-300 font-mono">
                                          Input: {step.testData}
                                        </p>
                                      )}
                                      <p className="text-[11px] text-gray-400">
                                        Expected: <span className="text-gray-200">{step.expectedResult}</span>
                                      </p>
                                    </div>
                                    <div className="w-36 shrink-0">
                                      <AnimatedSelect
                                        options={EXECUTION_STATUS_CHOICES}
                                        value={draft.status}
                                        onChange={(val) =>
                                          setStepDrafts((prev) => ({
                                            ...prev,
                                            [step.id]: { ...draft, status: val },
                                          }))
                                        }
                                      />
                                    </div>
                                  </div>
                                  <input
                                    type="text"
                                    disabled={!canExecute || !activeExec.isLatest}
                                    value={draft.actualResult}
                                    onChange={(e) =>
                                      setStepDrafts((prev) => ({
                                        ...prev,
                                        [step.id]: { ...draft, actualResult: e.target.value },
                                      }))
                                    }
                                    placeholder="Actual step output / observation..."
                                    className="w-full bg-[#12151B] border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-gray-500"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Actual Result & Notes */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-300 mb-1">
                            Overall Actual Result
                          </label>
                          <textarea
                            rows={2}
                            disabled={!canExecute || !activeExec.isLatest}
                            value={execActualResult}
                            onChange={(e) => setExecActualResult(e.target.value)}
                            placeholder="Summarize actual behavior observed..."
                            className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-300 mb-1">
                            Tester Notes
                          </label>
                          <textarea
                            rows={2}
                            disabled={!canExecute || !activeExec.isLatest}
                            value={execNotes}
                            onChange={(e) => setExecNotes(e.target.value)}
                            placeholder="Browser, build hash, environment remarks..."
                            className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                          />
                        </div>
                      </div>

                      {canExecute && activeExec.isLatest && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-2">
                            {canManageDefects && (
                              <>
                                <button
                                  type="button"
                                  onClick={openCreateDefectFromExecution}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-500/35 hover:bg-rose-500/25"
                                >
                                  <Bug className="w-3.5 h-3.5" />
                                  Create Defect
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setLinkDefectOpen(true)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10"
                                >
                                  <Link2 className="w-3.5 h-3.5" />
                                  Link Existing Defect
                                </button>
                              </>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={savingExec}
                            onClick={() => void handleSaveExecution()}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-lg"
                            style={{ backgroundColor: accentColor }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {savingExec ? 'Saving...' : 'Save Execution Result'}
                          </button>
                        </div>
                      )}

                      {/* Linked Defects */}
                      {activeExec.linkedDefects.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-white/10">
                          <h4 className="text-xs font-semibold text-gray-300">
                            Linked Defects ({activeExec.linkedDefects.length})
                          </h4>
                          <div className="space-y-1.5">
                            {activeExec.linkedDefects.map((d) => (
                              <div
                                key={d.id}
                                onClick={() => goToSubmodule('defects', { defectId: d.id })}
                                className="bg-[#0B0D10] border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between cursor-pointer hover:border-white/25"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs font-mono text-rose-300">{d.defectKey}</span>
                                  <span className="text-xs text-white truncate">{d.title}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <TestingSeverityBadge severity={d.severity} />
                                  <DefectStatusBadge status={d.status} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Evidence Attachments */}
                      <div className="pt-2 border-t border-white/10">
                        <TestingAttachmentsPanel
                          projectId={projectId}
                          entityType="execution"
                          entityId={activeExec.id}
                          attachments={activeExec.attachments}
                          availableDocuments={meta?.projectDocuments || []}
                          canEdit={canExecute}
                          title="Execution Evidence & Logs"
                          onUpdated={() => {
                            if (selectedRunId) void loadRunDetail(selectedRunId);
                          }}
                        />
                      </div>

                      {/* Prior Attempts History */}
                      {priorAttemptsForActive.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-white/10">
                          <h4 className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                            <History className="w-3.5 h-3.5 text-indigo-400" />
                            Prior Retest Attempts ({priorAttemptsForActive.length})
                          </h4>
                          <div className="space-y-1.5">
                            {priorAttemptsForActive.map((prev) => (
                              <div
                                key={prev.id}
                                onClick={() => setSelectedExecId(prev.id)}
                                className="bg-[#0B0D10] border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between cursor-pointer hover:border-white/25 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-gray-400">Attempt #{prev.attemptNumber}</span>
                                  <ExecutionStatusBadge status={prev.status} />
                                  {prev.executedBy && (
                                    <span className="text-gray-400">by {prev.executedBy.name}</span>
                                  )}
                                </div>
                                <span className="text-[11px] text-gray-500">
                                  {formatTestingDateTime(prev.updatedAt || prev.createdAt)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Run Modal */}
      {createRunOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#12151B] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Create Test Run</h3>
              <button
                type="button"
                onClick={() => setCreateRunOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateRunSubmit} className="p-5 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Run Name *</label>
                <input
                  type="text"
                  required
                  value={newRunForm.name}
                  onChange={(e) => setNewRunForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Auth Hotfix Verification Run"
                  className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">From Test Plan</label>
                  <AnimatedSelect
                    options={planOptions}
                    value={newRunForm.testPlanId}
                    onChange={(val) => setNewRunForm((p) => ({ ...p, testPlanId: val }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">From Test Suite</label>
                  <AnimatedSelect
                    options={suiteOptions}
                    value={newRunForm.testSuiteId}
                    onChange={(val) => setNewRunForm((p) => ({ ...p, testSuiteId: val }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Build Version</label>
                  <input
                    type="text"
                    value={newRunForm.buildVersion}
                    onChange={(e) => setNewRunForm((p) => ({ ...p, buildVersion: e.target.value }))}
                    placeholder="v2.4.1"
                    className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <MasterOptionSelect
                  projectId={projectId}
                  category="environments"
                  label="Environment"
                  options={config?.environments || []}
                  value={newRunForm.environment}
                  onChange={(val) => setNewRunForm((p) => ({ ...p, environment: val }))}
                />
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Executor</label>
                  <AnimatedSelect
                    options={memberOptions}
                    value={newRunForm.executedById}
                    onChange={(val) => setNewRunForm((p) => ({ ...p, executedById: val }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Additional Specific Test Cases ({newRunForm.testCaseIds.length} selected)
                </label>
                <div className="max-h-40 overflow-y-auto bg-[#0B0D10] border border-white/10 rounded-xl divide-y divide-white/5">
                  {cases
                    .filter((c) => !c.isArchived)
                    .map((c) => {
                      const checked = newRunForm.testCaseIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-white/[0.03]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setNewRunForm((p) => ({
                                ...p,
                                testCaseIds: checked
                                  ? p.testCaseIds.filter((id) => id !== c.id)
                                  : [...p.testCaseIds, c.id],
                              }))
                            }
                          />
                          <span className="font-mono text-emerald-300">{c.caseKey}</span>
                          <span className="text-white truncate">{c.title}</span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateRunOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs bg-white/5 text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingRun}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  <Check className="w-3.5 h-3.5" />
                  {creatingRun ? 'Starting...' : 'Start Test Run'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Defect From Execution Modal */}
      {createDefectOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#12151B] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Log Defect from Failed Execution</h3>
              <button
                type="button"
                onClick={() => setCreateDefectOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitCreateDefect} className="p-5 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Defect Title *</label>
                <input
                  type="text"
                  required
                  value={defectForm.title}
                  onChange={(e) => setDefectForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MasterOptionSelect
                  projectId={projectId}
                  category="defectSeverities"
                  label="Severity"
                  options={config?.defectSeverities || []}
                  value={defectForm.severity}
                  onChange={(val) => setDefectForm((p) => ({ ...p, severity: val }))}
                />
                <MasterOptionSelect
                  projectId={projectId}
                  category="priorities"
                  label="Priority"
                  options={config?.priorities || []}
                  value={defectForm.priority}
                  onChange={(val) => setDefectForm((p) => ({ ...p, priority: val }))}
                />
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Assignee</label>
                  <AnimatedSelect
                    options={memberOptions}
                    value={defectForm.assigneeId}
                    onChange={(val) => setDefectForm((p) => ({ ...p, assigneeId: val }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Description</label>
                <textarea
                  rows={2}
                  value={defectForm.description}
                  onChange={(e) => setDefectForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Steps to Reproduce</label>
                <textarea
                  rows={3}
                  value={defectForm.stepsToReproduce}
                  onChange={(e) => setDefectForm((p) => ({ ...p, stepsToReproduce: e.target.value }))}
                  className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Expected Result</label>
                  <textarea
                    rows={2}
                    value={defectForm.expectedResult}
                    onChange={(e) => setDefectForm((p) => ({ ...p, expectedResult: e.target.value }))}
                    className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Actual Result</label>
                  <textarea
                    rows={2}
                    value={defectForm.actualResult}
                    onChange={(e) => setDefectForm((p) => ({ ...p, actualResult: e.target.value }))}
                    className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateDefectOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs bg-white/5 text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingDefect}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500"
                >
                  <Bug className="w-3.5 h-3.5" />
                  {creatingDefect ? 'Creating...' : 'Create & Link Defect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Existing Defect Modal */}
      {linkDefectOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#12151B] border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Link Existing Defect</h3>
              <button
                type="button"
                onClick={() => setLinkDefectOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleLinkExistingDefect} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Select Defect</label>
                <AnimatedSelect
                  options={projectDefects.map((d) => ({
                    value: String(d.id),
                    label: `${d.defectKey} — ${d.title}`,
                    sublabel: `${d.severity} · ${d.status}`,
                  }))}
                  value={linkDefectId}
                  onChange={setLinkDefectId}
                  placeholder="Choose a defect..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLinkDefectOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs bg-white/5 text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linkingDefect || !linkDefectId}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  {linkingDefect ? 'Linking...' : 'Link Defect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestRunsView;
