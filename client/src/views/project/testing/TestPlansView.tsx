import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Archive,
  Bug,
  Calendar,
  Check,
  ClipboardList,
  Edit3,
  ExternalLink,
  Layers,
  PlayCircle,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useAccentTheme } from '../../../services/accentTheme.service';
import { useToast } from '../../../context/ToastContext';
import { confirmDeleteSwal } from '../../../lib/confirmAlert';
import { AnimatedSelect } from '../../../components/settings/AnimatedSelect';
import { CustomDatePicker } from '../../../components/settings/CustomDatePicker';
import { UserAvatar } from '../../../components/common/UserAvatar';
import {
  TestingPageHeader,
  useTestingNavigation,
} from '../../../components/testing/TestingPageHeader';
import {
  DefectStatusBadge,
  MasterOptionSelect,
  PlanRunStatusBadge,
  TestingPriorityBadge,
  TestingSeverityBadge,
  formatTestingDate,
} from '../../../components/testing/testingBadges';
import { testingService } from '../../../services/testing.service';
import type {
  TestCaseItem,
  TestPlanDetail,
  TestPlanItem,
  TestSuiteItem,
  TestingConfigurationItem,
  TestingMetaData,
  TestingPermissions,
} from '../../../types/testing';

interface TestPlansViewProps {
  projectId?: number;
  submoduleId?: number;
  title?: string;
}

interface PlanFormState {
  title: string;
  description: string;
  testingScope: string;
  targetVersion: string;
  targetEnvironment: string;
  startDate: string;
  dueDate: string;
  responsibleTesterId: string;
  responsibleTeamId: string;
  linkedRequirementId: string;
  linkedDevTaskId: string;
  milestoneLabel: string;
  status: string;
  suiteIds: number[];
  testCaseIds: number[];
}

const PLAN_STATUS_OPTIONS = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Planned', label: 'Planned' },
  { value: 'Active', label: 'Active' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

export const TestPlansView: React.FC<TestPlansViewProps> = ({
  projectId: propProjectId,
  submoduleId: propSubmoduleId,
  title: propTitle,
}) => {
  const { id, submoduleId: routeSubId } = useParams<{ id: string; submoduleId?: string }>();
  const projectId = propProjectId || Number(id);
  const submoduleId = propSubmoduleId || (routeSubId ? Number(routeSubId) : undefined);
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();
  const { goToSubmodule } = useTestingNavigation(projectId);

  const [meta, setMeta] = useState<TestingMetaData | null>(null);
  const [config, setConfig] = useState<TestingConfigurationItem | null>(null);
  const [permissions, setPermissions] = useState<TestingPermissions | null>(null);
  const [plans, setPlans] = useState<TestPlanItem[]>([]);
  const [suites, setSuites] = useState<TestSuiteItem[]>([]);
  const [cases, setCases] = useState<TestCaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [includeArchived, setIncludeArchived] = useState(false);

  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [planDetail, setPlanDetail] = useState<TestPlanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create / Edit Plan Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TestPlanDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PlanFormState>({
    title: '',
    description: '',
    testingScope: '',
    targetVersion: '',
    targetEnvironment: 'Staging',
    startDate: '',
    dueDate: '',
    responsibleTesterId: '',
    responsibleTeamId: '',
    linkedRequirementId: '',
    linkedDevTaskId: '',
    milestoneLabel: '',
    status: 'Planned',
    suiteIds: [],
    testCaseIds: [],
  });

  // Start Run Dialog
  const [startRunModalOpen, setStartRunModalOpen] = useState(false);
  const [runTargetPlan, setRunTargetPlan] = useState<TestPlanItem | null>(null);
  const [runName, setRunName] = useState('');
  const [runEnv, setRunEnv] = useState('');
  const [runBuild, setRunBuild] = useState('');
  const [runExecutorId, setRunExecutorId] = useState('');
  const [startingRun, setStartingRun] = useState(false);

  const canManage = Boolean(permissions?.canManagePlansSuites);
  const canExecute = Boolean(permissions?.canExecuteTests);
  const canArchive = Boolean(permissions?.canArchiveRecords);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [metaRes, plansRes, suitesRes, casesRes] = await Promise.all([
        testingService.getMeta(projectId),
        testingService.listTestPlans(projectId, {
          submoduleId,
          search: searchQuery || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          includeArchived,
        }),
        testingService.listTestSuites(projectId, { submoduleId }),
        testingService.listTestCases(projectId, { submoduleId }),
      ]);
      if (metaRes.success && metaRes.data) {
        setMeta(metaRes.data.meta);
        setConfig(metaRes.data.config);
        setPermissions(metaRes.data.permissions);
      }
      if (plansRes.success && plansRes.data) setPlans(plansRes.data.items);
      if (suitesRes.success && suitesRes.data) setSuites(suitesRes.data.items);
      if (casesRes.success && casesRes.data) setCases(casesRes.data.items);
    } catch {
      toast.error('Failed to load test plans');
    } finally {
      setLoading(false);
    }
  }, [projectId, submoduleId, searchQuery, statusFilter, includeArchived, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadPlanDetail = useCallback(
    async (planId: number) => {
      setDetailLoading(true);
      try {
        const res = await testingService.getTestPlanDetail(projectId, planId);
        if (res.success && res.data) setPlanDetail(res.data);
      } catch {
        toast.error('Failed to load plan details');
      } finally {
        setDetailLoading(false);
      }
    },
    [projectId, toast]
  );

  useEffect(() => {
    if (selectedPlanId) {
      void loadPlanDetail(selectedPlanId);
    } else {
      setPlanDetail(null);
    }
  }, [selectedPlanId, loadPlanDetail]);

  const openCreateModal = () => {
    setEditingPlan(null);
    setForm({
      title: '',
      description: '',
      testingScope: '',
      targetVersion: '',
      targetEnvironment: config?.defaultEnvironment || 'Staging',
      startDate: '',
      dueDate: '',
      responsibleTesterId: '',
      responsibleTeamId: '',
      linkedRequirementId: '',
      linkedDevTaskId: '',
      milestoneLabel: '',
      status: 'Planned',
      suiteIds: [],
      testCaseIds: [],
    });
    setModalOpen(true);
  };

  const openEditModal = async (plan: TestPlanItem) => {
    try {
      const res = await testingService.getTestPlanDetail(projectId, plan.id);
      if (!res.success || !res.data) return;
      const d = res.data;
      setEditingPlan(d);
      setForm({
        title: d.title,
        description: d.description || '',
        testingScope: d.testingScope || '',
        targetVersion: d.targetVersion || '',
        targetEnvironment: d.targetEnvironment || config?.defaultEnvironment || 'Staging',
        startDate: d.startDate ? d.startDate.slice(0, 10) : '',
        dueDate: d.dueDate ? d.dueDate.slice(0, 10) : '',
        responsibleTesterId: d.responsibleTesterId ? String(d.responsibleTesterId) : '',
        responsibleTeamId: d.responsibleTeamId ? String(d.responsibleTeamId) : '',
        linkedRequirementId: d.linkedRequirementId ? String(d.linkedRequirementId) : '',
        linkedDevTaskId: d.linkedDevTaskId ? String(d.linkedDevTaskId) : '',
        milestoneLabel: d.milestoneLabel || '',
        status: d.status || 'Planned',
        suiteIds: d.suites.map((s) => s.id),
        testCaseIds: d.cases.map((c) => c.id),
      });
      setModalOpen(true);
    } catch {
      toast.error('Failed to open plan editor');
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Plan title is required');
      return;
    }
    if (form.startDate && form.dueDate && form.dueDate < form.startDate) {
      toast.error('Due date cannot be earlier than start date');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        testingScope: form.testingScope.trim() || undefined,
        targetVersion: form.targetVersion.trim() || undefined,
        targetEnvironment: form.targetEnvironment || undefined,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        responsibleTesterId: form.responsibleTesterId ? Number(form.responsibleTesterId) : null,
        responsibleTeamId: form.responsibleTeamId ? Number(form.responsibleTeamId) : null,
        linkedRequirementId: form.linkedRequirementId ? Number(form.linkedRequirementId) : null,
        linkedDevTaskId: form.linkedDevTaskId ? Number(form.linkedDevTaskId) : null,
        milestoneLabel: form.milestoneLabel.trim() || undefined,
        status: form.status,
        suiteIds: form.suiteIds,
        testCaseIds: form.testCaseIds,
      };
      if (editingPlan) {
        const res = await testingService.updateTestPlan(projectId, editingPlan.id, payload);
        if (res.success) {
          toast.success(`Plan ${editingPlan.planKey} updated`);
          setModalOpen(false);
          await loadData();
          if (selectedPlanId === editingPlan.id) await loadPlanDetail(editingPlan.id);
        } else {
          toast.error(res.error || 'Could not update test plan');
        }
      } else {
        const res = await testingService.createTestPlan(projectId, {
          ...payload,
          projectSubmoduleId: submoduleId,
        });
        if (res.success && res.data) {
          toast.success(`Test Plan ${res.data.planKey} created`);
          setModalOpen(false);
          await loadData();
          setSelectedPlanId(res.data.id);
        } else {
          toast.error(res.error || 'Could not create test plan');
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not save test plan');
    } finally {
      setSaving(false);
    }
  };

  const openStartRunModal = (plan: TestPlanItem) => {
    setRunTargetPlan(plan);
    setRunName(`${plan.planKey} Execution Run`);
    setRunEnv(plan.targetEnvironment || config?.defaultEnvironment || 'Staging');
    setRunBuild(plan.targetVersion || '');
    setRunExecutorId(plan.responsibleTesterId ? String(plan.responsibleTesterId) : '');
    setStartRunModalOpen(true);
  };

  const handleConfirmStartRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runTargetPlan) return;
    setStartingRun(true);
    try {
      const res = await testingService.startRunFromPlan(projectId, runTargetPlan.id, {
        name: runName.trim() || undefined,
        environment: runEnv || undefined,
        buildVersion: runBuild.trim() || undefined,
        executedById: runExecutorId ? Number(runExecutorId) : null,
      });
      if (res.success && res.data) {
        toast.success(`Started run ${res.data.runKey}`);
        setStartRunModalOpen(false);
        goToSubmodule('test-runs', { runId: res.data.id });
      } else {
        toast.error(res.error || 'Could not start run from plan');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not start test run');
    } finally {
      setStartingRun(false);
    }
  };

  const handleArchivePlan = async (plan: TestPlanItem) => {
    const confirmed = await confirmDeleteSwal({
      title: plan.isArchived ? `Restore ${plan.planKey}?` : `Archive ${plan.planKey}?`,
      text: plan.isArchived
        ? 'Restoring makes this plan visible in active test planning lists.'
        : 'Archiving hides the plan while preserving linked runs and defect history.',
      confirmText: plan.isArchived ? 'Restore Plan' : 'Archive Plan',
    });
    if (!confirmed) return;
    try {
      const res = await testingService.updateTestPlan(projectId, plan.id, {
        isArchived: !plan.isArchived,
      });
      if (res.success) {
        toast.success(plan.isArchived ? 'Test plan restored' : 'Test plan archived');
        await loadData();
        if (selectedPlanId === plan.id) await loadPlanDetail(plan.id);
      }
    } catch {
      toast.error('Failed to update plan archive state');
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

  const teamOptions = useMemo(
    () => [
      { value: '', label: 'No Responsible Team' },
      ...(meta?.teams || []).map((t) => ({
        value: String(t.id),
        label: t.name,
      })),
    ],
    [meta?.teams]
  );

  const requirementOptions = useMemo(
    () => [
      { value: '', label: 'No Linked Requirement' },
      ...(meta?.requirements || []).map((r) => ({
        value: String(r.id),
        label: `${r.code} — ${r.title}`,
      })),
    ],
    [meta?.requirements]
  );

  const devTaskOptions = useMemo(
    () => [
      { value: '', label: 'No Linked Dev Task' },
      ...(meta?.devTasks || []).map((d) => ({
        value: String(d.id),
        label: `${d.taskKey} — ${d.title}`,
      })),
    ],
    [meta?.devTasks]
  );

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <TestingPageHeader
        projectId={projectId}
        activeKey="test-plans"
        icon={ClipboardList}
        title={propTitle || 'Test Plans'}
        description="Coordinate release testing schedules, environments, suites, and one-click execution runs."
        badge={plans.length}
        actions={
          canManage ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-lg"
              style={{ backgroundColor: accentColor }}
            >
              <Plus className="w-4 h-4" />
              New Test Plan
            </button>
          ) : null
        }
      />

      {/* Filter bar */}
      <div className="bg-[#12151B] border border-white/10 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search plan key, title, release build, milestone..."
            className="w-full bg-[#0B0D10] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <div className="w-44">
          <AnimatedSelect
            options={[{ value: 'ALL', label: 'All Statuses' }, ...PLAN_STATUS_OPTIONS]}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-gray-300 cursor-pointer px-2">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="rounded border-white/20 bg-[#0B0D10]"
          />
          Show Archived
        </label>
      </div>

      {/* Plans List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-[#12151B] border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-[#12151B] border border-white/10 rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
            <ClipboardList className="w-6 h-6 text-gray-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">No test plans created</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
              Combine test suites and cases for a milestone or target build, then trigger Test Runs directly.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white"
              style={{ backgroundColor: accentColor }}
            >
              <Plus className="w-4 h-4" />
              Create First Plan
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              onClick={() => setSelectedPlanId(plan.id)}
              className="bg-[#12151B] border border-white/10 hover:border-white/25 rounded-2xl p-5 space-y-4 cursor-pointer transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                      {plan.planKey}
                    </span>
                    <PlanRunStatusBadge status={plan.isArchived ? 'Archived' : plan.status} />
                    {plan.targetVersion && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/25">
                        {plan.targetVersion}
                      </span>
                    )}
                    {plan.targetEnvironment && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10">
                        {plan.targetEnvironment}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-white truncate">{plan.title}</h3>
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {canExecute && (
                    <button
                      type="button"
                      onClick={() => openStartRunModal(plan)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white"
                      style={{ backgroundColor: accentColor }}
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      Start Run
                    </button>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => void openEditModal(plan)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canArchive && (
                    <button
                      type="button"
                      onClick={() => void handleArchivePlan(plan)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-amber-300 hover:bg-white/5"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {plan.description && (
                <p className="text-xs text-gray-400 line-clamp-2">{plan.description}</p>
              )}

              <div className="grid grid-cols-3 gap-2 text-center bg-[#0B0D10] border border-white/10 rounded-xl p-2.5 text-xs">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Unique Cases</p>
                  <p className="font-semibold text-white">{plan.uniqueCaseCount}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Suites</p>
                  <p className="font-semibold text-white">{plan.suitesCount}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Open Defects</p>
                  <p className="font-semibold text-amber-300">{plan.defectsCount}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-400">
                    Execution Pass Rate ({plan.progress.totalRuns} runs)
                  </span>
                  <span className="font-semibold text-emerald-400">{plan.progress.passRate}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden flex">
                  {plan.progress.totalExecutions > 0 && (
                    <>
                      <div
                        className="bg-emerald-500"
                        style={{
                          width: `${(plan.progress.passed / plan.progress.totalExecutions) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-red-500"
                        style={{
                          width: `${(plan.progress.failed / plan.progress.totalExecutions) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-amber-500"
                        style={{
                          width: `${(plan.progress.blocked / plan.progress.totalExecutions) * 100}%`,
                        }}
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-gray-500" />
                  <span>
                    {formatTestingDate(plan.startDate)} → {formatTestingDate(plan.dueDate)}
                  </span>
                </div>
                {plan.responsibleTester ? (
                  <div className="flex items-center gap-1.5 text-gray-300">
                    <UserAvatar user={plan.responsibleTester} size="xs" />
                    <span>{plan.responsibleTester.name}</span>
                  </div>
                ) : plan.responsibleTeam ? (
                  <div className="flex items-center gap-1 text-gray-300">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{plan.responsibleTeam.name}</span>
                  </div>
                ) : (
                  <span>Unassigned</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Drawer */}
      {selectedPlanId && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-3xl bg-[#101319] border-l border-white/10 h-full flex flex-col">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-200">
                  {planDetail?.planKey || '...'}
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-white truncate">
                    {planDetail?.title || 'Loading test plan...'}
                  </h2>
                  {planDetail?.milestoneLabel && (
                    <p className="text-xs text-gray-400">Milestone: {planDetail.milestoneLabel}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canExecute && planDetail && (
                  <button
                    type="button"
                    onClick={() => openStartRunModal(planDetail)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    Start Run
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedPlanId(null)}
                  className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {detailLoading || !planDetail ? (
                <div className="space-y-3">
                  <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
                  <div className="h-44 rounded-xl bg-white/5 animate-pulse" />
                </div>
              ) : (
                <>
                  <div className="bg-[#161B24] border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <PlanRunStatusBadge status={planDetail.isArchived ? 'Archived' : planDetail.status} size="sm" />
                      {planDetail.targetVersion && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                          Build: {planDetail.targetVersion}
                        </span>
                      )}
                      {planDetail.targetEnvironment && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10">
                          Env: {planDetail.targetEnvironment}
                        </span>
                      )}
                    </div>
                    {planDetail.description && (
                      <p className="text-xs text-gray-300">{planDetail.description}</p>
                    )}
                    {planDetail.testingScope && (
                      <div className="text-xs text-gray-400 bg-[#0B0D10] rounded-xl p-3 border border-white/10">
                        <span className="font-semibold text-gray-200 block mb-1">Testing Scope</span>
                        {planDetail.testingScope}
                      </div>
                    )}
                    {(planDetail.linkedRequirement || planDetail.linkedDevTask) && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {planDetail.linkedRequirement && (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
                            Req: {planDetail.linkedRequirement.code} — {planDetail.linkedRequirement.title}
                          </span>
                        )}
                        {planDetail.linkedDevTask && (
                          <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/25 text-sky-300">
                            Task: {planDetail.linkedDevTask.taskKey} — {planDetail.linkedDevTask.title}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Included Suites */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      Included Suites ({planDetail.suites.length})
                    </h3>
                    {planDetail.suites.length === 0 ? (
                      <p className="text-xs text-gray-500">No suites attached to this plan.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {planDetail.suites.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => goToSubmodule('test-suites')}
                            className="bg-[#161B24] border border-white/10 rounded-xl px-3.5 py-2.5 flex items-center justify-between cursor-pointer hover:border-white/25"
                          >
                            <div>
                              <span className="text-[11px] font-mono text-emerald-300">{s.suiteKey}</span>
                              <p className="text-xs font-medium text-white">{s.name}</p>
                            </div>
                            <span className="text-xs text-gray-400">{s.totalCases} cases</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Direct Cases */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-white">
                      Direct Test Cases ({planDetail.cases.length})
                    </h3>
                    {planDetail.cases.length === 0 ? (
                      <p className="text-xs text-gray-500">No direct cases attached outside suites.</p>
                    ) : (
                      <div className="bg-[#161B24] border border-white/10 rounded-xl divide-y divide-white/5">
                        {planDetail.cases.map((tc) => (
                          <div
                            key={tc.id}
                            className="px-3.5 py-2.5 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-emerald-300">{tc.caseKey}</span>
                              <span className="text-white truncate">{tc.title}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <TestingPriorityBadge priority={tc.priority} />
                              <button
                                type="button"
                                onClick={() => goToSubmodule('test-cases', { caseId: tc.id })}
                                className="p-1 text-gray-400 hover:text-white"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Execution Runs */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-white">
                      Execution Runs ({planDetail.runs.length})
                    </h3>
                    {planDetail.runs.length === 0 ? (
                      <p className="text-xs text-gray-500">No runs started from this plan yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {planDetail.runs.map((run) => (
                          <div
                            key={run.id}
                            onClick={() => goToSubmodule('test-runs', { runId: run.id })}
                            className="bg-[#161B24] border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer hover:border-white/25"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-emerald-300">{run.runKey}</span>
                                <span className="text-xs font-medium text-white">{run.name}</span>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {run.environment || 'Default'} · {run.buildVersion || 'No build'} ·{' '}
                                {formatTestingDate(run.createdAt)}
                              </p>
                            </div>
                            <div className="text-right">
                              <PlanRunStatusBadge status={run.status} />
                              <p className="text-[11px] text-emerald-400 font-semibold mt-1">
                                {run.stats.passRate}% pass ({run.stats.passed}/{run.stats.total})
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Linked Defects */}
                  {planDetail.linkedDefects.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Bug className="w-4 h-4 text-rose-400" />
                        Linked Defects ({planDetail.linkedDefects.length})
                      </h3>
                      <div className="space-y-2">
                        {planDetail.linkedDefects.map((def) => (
                          <div
                            key={def.id}
                            onClick={() => goToSubmodule('defects', { defectId: def.id })}
                            className="bg-[#161B24] border border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between cursor-pointer hover:border-white/25"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-mono text-rose-300">{def.defectKey}</span>
                              <span className="text-xs text-white truncate">{def.title}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <TestingSeverityBadge severity={def.severity} />
                              <DefectStatusBadge status={def.status} />
                            </div>
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

      {/* Create / Edit Test Plan Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-[#12151B] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {editingPlan ? `Edit ${editingPlan.planKey}` : 'Create Test Plan'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSavePlan} className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Plan Title *</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. v2.4.0 Release QA Plan"
                    className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Status</label>
                  <AnimatedSelect
                    options={PLAN_STATUS_OPTIONS}
                    value={form.status}
                    onChange={(val) => setForm((p) => ({ ...p, status: val }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Target Version / Build</label>
                  <input
                    type="text"
                    value={form.targetVersion}
                    onChange={(e) => setForm((p) => ({ ...p, targetVersion: e.target.value }))}
                    placeholder="v2.4.0-rc1"
                    className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <MasterOptionSelect
                  projectId={projectId}
                  category="environments"
                  label="Environment"
                  options={config?.environments || []}
                  value={form.targetEnvironment}
                  onChange={(val) => setForm((p) => ({ ...p, targetEnvironment: val }))}
                  canCreate={canManage}
                  onOptionCreated={(updated) =>
                    setConfig((prev) => (prev ? { ...prev, environments: updated } : prev))
                  }
                />
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Milestone</label>
                  <input
                    type="text"
                    value={form.milestoneLabel}
                    onChange={(e) => setForm((p) => ({ ...p, milestoneLabel: e.target.value }))}
                    placeholder="Sprint 18"
                    className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Start Date</label>
                  <CustomDatePicker
                    value={form.startDate}
                    onChange={(val) => setForm((p) => ({ ...p, startDate: val }))}
                    presetMode="start"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Due Date</label>
                  <CustomDatePicker
                    value={form.dueDate}
                    onChange={(val) => setForm((p) => ({ ...p, dueDate: val }))}
                    presetMode="end"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Responsible Tester</label>
                  <AnimatedSelect
                    options={memberOptions}
                    value={form.responsibleTesterId}
                    onChange={(val) => setForm((p) => ({ ...p, responsibleTesterId: val }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Responsible Team</label>
                  <AnimatedSelect
                    options={teamOptions}
                    value={form.responsibleTeamId}
                    onChange={(val) => setForm((p) => ({ ...p, responsibleTeamId: val }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Linked Requirement</label>
                  <AnimatedSelect
                    options={requirementOptions}
                    value={form.linkedRequirementId}
                    onChange={(val) => setForm((p) => ({ ...p, linkedRequirementId: val }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Linked Development Task</label>
                  <AnimatedSelect
                    options={devTaskOptions}
                    value={form.linkedDevTaskId}
                    onChange={(val) => setForm((p) => ({ ...p, linkedDevTaskId: val }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Description</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Testing Scope</label>
                  <textarea
                    rows={2}
                    value={form.testingScope}
                    onChange={(e) => setForm((p) => ({ ...p, testingScope: e.target.value }))}
                    placeholder="In-scope & out-of-scope components..."
                    className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Include Suites ({form.suiteIds.length})
                  </label>
                  <div className="max-h-36 overflow-y-auto bg-[#0B0D10] border border-white/10 rounded-xl divide-y divide-white/5">
                    {suites
                      .filter((s) => !s.isArchived)
                      .map((s) => {
                        const checked = form.suiteIds.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            className="flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-white/[0.03]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setForm((p) => ({
                                    ...p,
                                    suiteIds: checked
                                      ? p.suiteIds.filter((id) => id !== s.id)
                                      : [...p.suiteIds, s.id],
                                  }))
                                }
                              />
                              <span className="font-mono text-emerald-300">{s.suiteKey}</span>
                              <span className="text-white truncate">{s.name}</span>
                            </div>
                            <span className="text-[11px] text-gray-500">{s.totalCases}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Direct Test Cases ({form.testCaseIds.length})
                  </label>
                  <div className="max-h-36 overflow-y-auto bg-[#0B0D10] border border-white/10 rounded-xl divide-y divide-white/5">
                    {cases
                      .filter((c) => !c.isArchived)
                      .map((c) => {
                        const checked = form.testCaseIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className="flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-white/[0.03]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setForm((p) => ({
                                    ...p,
                                    testCaseIds: checked
                                      ? p.testCaseIds.filter((id) => id !== c.id)
                                      : [...p.testCaseIds, c.id],
                                  }))
                                }
                              />
                              <span className="font-mono text-emerald-300">{c.caseKey}</span>
                              <span className="text-white truncate">{c.title}</span>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs bg-white/5 text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  <Check className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : editingPlan ? 'Save Changes' : 'Create Test Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Start Run From Plan Modal */}
      {startRunModalOpen && runTargetPlan && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#12151B] border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Start Run from {runTargetPlan.planKey}
              </h3>
              <button
                type="button"
                onClick={() => setStartRunModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmStartRun} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Run Name</label>
                <input
                  type="text"
                  required
                  value={runName}
                  onChange={(e) => setRunName(e.target.value)}
                  className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Build Version</label>
                  <input
                    type="text"
                    value={runBuild}
                    onChange={(e) => setRunBuild(e.target.value)}
                    placeholder="v2.4.0-rc1"
                    className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <MasterOptionSelect
                  projectId={projectId}
                  category="environments"
                  label="Environment"
                  options={config?.environments || []}
                  value={runEnv}
                  onChange={setRunEnv}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Assigned Executor</label>
                <AnimatedSelect
                  options={memberOptions}
                  value={runExecutorId}
                  onChange={setRunExecutorId}
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStartRunModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs bg-white/5 text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={startingRun}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  {startingRun ? 'Starting...' : 'Create & Launch Run'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestPlansView;
