import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Check,
  Edit3,
  ExternalLink,
  Layers,
  PlayCircle,
  Plus,
  Search,
  Trash2,
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
import {
  ExecutionStatusBadge,
  PlanRunStatusBadge,
  TestCaseStatusBadge,
  TestingPriorityBadge,
  TestTypeBadge,
  formatTestingDate,
  formatTestingDateTime,
} from '../../../components/testing/testingBadges';
import { testingService } from '../../../services/testing.service';
import type {
  TestCaseItem,
  TestSuiteDetail,
  TestSuiteItem,
  TestingConfigurationItem,
  TestingMetaData,
  TestingPermissions,
} from '../../../types/testing';

interface TestSuitesViewProps {
  projectId?: number;
}

interface SuiteFormState {
  name: string;
  description: string;
  purpose: string;
  ownerId: string;
  status: string;
  labels: string;
  testCaseIds: number[];
}

const SUITE_STATUS_OPTIONS = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Active', label: 'Active' },
  { value: 'Archived', label: 'Archived' },
];

export const TestSuitesView: React.FC<TestSuitesViewProps> = ({ projectId: propProjectId }) => {
  const { id } = useParams<{ id: string }>();
  const projectId = propProjectId || Number(id);
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();
  const { goToSubmodule } = useTestingNavigation(projectId);

  const [meta, setMeta] = useState<TestingMetaData | null>(null);
  const [config, setConfig] = useState<TestingConfigurationItem | null>(null);
  const [permissions, setPermissions] = useState<TestingPermissions | null>(null);
  const [suites, setSuites] = useState<TestSuiteItem[]>([]);
  const [allCases, setAllCases] = useState<TestCaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [includeArchived, setIncludeArchived] = useState(false);

  const [selectedSuiteId, setSelectedSuiteId] = useState<number | null>(null);
  const [suiteDetail, setSuiteDetail] = useState<TestSuiteDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modal state for Create / Edit Suite
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSuite, setEditingSuite] = useState<TestSuiteDetail | null>(null);
  const [casePickerSearch, setCasePickerSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SuiteFormState>({
    name: '',
    description: '',
    purpose: '',
    ownerId: '',
    status: 'Active',
    labels: '',
    testCaseIds: [],
  });

  // Add case drawer/modal inside detail view
  const [addCasesModalOpen, setAddCasesModalOpen] = useState(false);
  const [addCasesSearch, setAddCasesSearch] = useState('');
  const [addCasesSelection, setAddCasesSelection] = useState<number[]>([]);
  const [startingRun, setStartingRun] = useState(false);

  const canManage = Boolean(permissions?.canManagePlansSuites);
  const canExecute = Boolean(permissions?.canExecuteTests);
  const canArchive = Boolean(permissions?.canArchiveRecords);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [metaRes, suitesRes, casesRes] = await Promise.all([
        testingService.getMeta(projectId),
        testingService.listTestSuites(projectId, {
          search: searchQuery || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          includeArchived,
        }),
        testingService.listTestCases(projectId, {}),
      ]);
      if (metaRes.success && metaRes.data) {
        setMeta(metaRes.data.meta);
        setConfig(metaRes.data.config);
        setPermissions(metaRes.data.permissions);
      }
      if (suitesRes.success && suitesRes.data) setSuites(suitesRes.data.items);
      if (casesRes.success && casesRes.data) setAllCases(casesRes.data.items);
    } catch {
      toast.error('Failed to load test suites');
    } finally {
      setLoading(false);
    }
  }, [projectId, searchQuery, statusFilter, includeArchived, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadSuiteDetail = useCallback(
    async (suiteId: number) => {
      setDetailLoading(true);
      try {
        const res = await testingService.getTestSuiteDetail(projectId, suiteId);
        if (res.success && res.data) {
          setSuiteDetail(res.data);
        }
      } catch {
        toast.error('Failed to load suite details');
      } finally {
        setDetailLoading(false);
      }
    },
    [projectId, toast]
  );

  useEffect(() => {
    if (selectedSuiteId) {
      void loadSuiteDetail(selectedSuiteId);
    } else {
      setSuiteDetail(null);
    }
  }, [selectedSuiteId, loadSuiteDetail]);

  const openCreateModal = () => {
    setEditingSuite(null);
    setCasePickerSearch('');
    setForm({
      name: '',
      description: '',
      purpose: 'Regression',
      ownerId: '',
      status: 'Active',
      labels: '',
      testCaseIds: [],
    });
    setModalOpen(true);
  };

  const openEditModal = async (suite: TestSuiteItem) => {
    try {
      const detailRes = await testingService.getTestSuiteDetail(projectId, suite.id);
      const detail = detailRes.success && detailRes.data ? detailRes.data : null;
      if (!detail) return;
      setEditingSuite(detail);
      setCasePickerSearch('');
      setForm({
        name: detail.name,
        description: detail.description || '',
        purpose: detail.purpose || '',
        ownerId: detail.ownerId ? String(detail.ownerId) : '',
        status: detail.status || 'Active',
        labels: detail.labels.join(', '),
        testCaseIds: detail.cases.map((c) => c.testCase.id),
      });
      setModalOpen(true);
    } catch {
      toast.error('Could not load suite for editing');
    }
  };

  const handleSaveSuite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Suite name is required');
      return;
    }
    setSaving(true);
    try {
      const labels = form.labels
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        purpose: form.purpose.trim() || undefined,
        ownerId: form.ownerId ? Number(form.ownerId) : null,
        status: form.status,
        labels,
        testCaseIds: form.testCaseIds,
      };
      if (editingSuite) {
        const res = await testingService.updateTestSuite(projectId, editingSuite.id, {
          name: payload.name,
          description: payload.description ?? null,
          purpose: payload.purpose ?? null,
          ownerId: payload.ownerId,
          status: payload.status,
          labels: payload.labels,
        });
        if (res.success) {
          await testingService.setSuiteCases(projectId, editingSuite.id, form.testCaseIds);
          toast.success('Test suite updated');
          setModalOpen(false);
          await loadData();
          if (selectedSuiteId === editingSuite.id) await loadSuiteDetail(editingSuite.id);
        } else {
          toast.error(res.error || 'Failed to update suite');
        }
      } else {
        const res = await testingService.createTestSuite(projectId, payload);
        if (res.success && res.data) {
          toast.success(`Suite ${res.data.suiteKey} created`);
          setModalOpen(false);
          await loadData();
          setSelectedSuiteId(res.data.id);
        } else {
          toast.error(res.error || 'Failed to create suite');
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not save suite');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveCaseOrder = async (index: number, direction: -1 | 1) => {
    if (!suiteDetail || !canManage) return;
    const ids = suiteDetail.cases.map((c) => c.testCase.id);
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= ids.length) return;
    const copy = [...ids];
    [copy[index], copy[targetIdx]] = [copy[targetIdx], copy[index]];
    try {
      const res = await testingService.setSuiteCases(projectId, suiteDetail.id, copy);
      if (res.success) {
        await loadSuiteDetail(suiteDetail.id);
        await loadData();
      } else {
        toast.error(res.error || 'Could not reorder cases');
      }
    } catch {
      toast.error('Could not reorder cases');
    }
  };

  const handleRemoveCaseFromSuite = async (testCaseId: number, caseKey: string) => {
    if (!suiteDetail || !canManage) return;
    const confirmed = await confirmDeleteSwal({
      title: `Remove ${caseKey} from suite?`,
      text: 'This removes the reference from this suite. The original Test Case and its execution history are preserved.',
      confirmText: 'Remove Reference',
    });
    if (!confirmed) return;
    const nextIds = suiteDetail.cases
      .map((c) => c.testCase.id)
      .filter((id) => id !== testCaseId);
    try {
      const res = await testingService.setSuiteCases(projectId, suiteDetail.id, nextIds);
      if (res.success) {
        toast.success(`${caseKey} removed from suite`);
        await loadSuiteDetail(suiteDetail.id);
        await loadData();
      }
    } catch {
      toast.error('Failed to remove test case from suite');
    }
  };

  const handleOpenAddCasesModal = () => {
    if (!suiteDetail) return;
    const existingIds = new Set(suiteDetail.cases.map((c) => c.testCase.id));
    setAddCasesSelection(Array.from(existingIds));
    setAddCasesSearch('');
    setAddCasesModalOpen(true);
  };

  const handleConfirmAddCases = async () => {
    if (!suiteDetail) return;
    try {
      const res = await testingService.setSuiteCases(projectId, suiteDetail.id, addCasesSelection);
      if (res.success) {
        toast.success('Suite cases updated');
        setAddCasesModalOpen(false);
        await loadSuiteDetail(suiteDetail.id);
        await loadData();
      } else {
        toast.error(res.error || 'Failed to update suite cases');
      }
    } catch {
      toast.error('Failed to update suite cases');
    }
  };

  const handleArchiveSuite = async (suite: TestSuiteItem) => {
    const confirmed = await confirmDeleteSwal({
      title: suite.isArchived ? `Restore ${suite.suiteKey}?` : `Archive ${suite.suiteKey}?`,
      text: suite.isArchived
        ? 'The suite will reappear in active views.'
        : 'Archiving hides the suite without deleting referenced test cases or run history.',
      confirmText: suite.isArchived ? 'Restore Suite' : 'Archive Suite',
    });
    if (!confirmed) return;
    try {
      const res = await testingService.archiveTestSuite(projectId, suite.id, !suite.isArchived);
      if (res.success) {
        toast.success(suite.isArchived ? 'Suite restored' : 'Suite archived');
        await loadData();
        if (selectedSuiteId === suite.id) await loadSuiteDetail(suite.id);
      }
    } catch {
      toast.error('Failed to update suite archive state');
    }
  };

  const handleStartRunFromSuite = async (suite: TestSuiteDetail) => {
    if (!canExecute) return;
    if (suite.cases.length === 0) {
      toast.error('Add at least one test case before starting a test run');
      return;
    }
    setStartingRun(true);
    try {
      const res = await testingService.createTestRun(projectId, {
        name: `${suite.suiteKey} Execution Run`,
        description: `Started directly from suite ${suite.suiteKey} (${suite.name})`,
        testSuiteId: suite.id,
        testCaseIds: suite.cases.map((c) => c.testCase.id),
        environment: config?.defaultEnvironment || 'Staging',
      });
      if (res.success && res.data) {
        toast.success(`Test Run ${res.data.runKey} started`);
        goToSubmodule('test-runs', { runId: res.data.id });
      } else {
        toast.error(res.error || 'Failed to start test run');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not start test run');
    } finally {
      setStartingRun(false);
    }
  };

  const ownerOptions = useMemo(
    () => [
      { value: '', label: 'Unassigned Owner' },
      ...(meta?.members || []).map((m) => ({
        value: String(m.id),
        label: m.name,
      })),
    ],
    [meta?.members]
  );

  const filteredModalCases = useMemo(() => {
    const q = casePickerSearch.trim().toLowerCase();
    return allCases.filter(
      (tc) =>
        !tc.isArchived &&
        (!q ||
          tc.caseKey.toLowerCase().includes(q) ||
          tc.title.toLowerCase().includes(q) ||
          tc.testType.toLowerCase().includes(q))
    );
  }, [allCases, casePickerSearch]);

  const filteredAddModalCases = useMemo(() => {
    const q = addCasesSearch.trim().toLowerCase();
    return allCases.filter(
      (tc) =>
        !tc.isArchived &&
        (!q ||
          tc.caseKey.toLowerCase().includes(q) ||
          tc.title.toLowerCase().includes(q) ||
          tc.testType.toLowerCase().includes(q))
    );
  }, [allCases, addCasesSearch]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <TestingPageHeader
        projectId={projectId}
        activeKey="test-suites"
        icon={Layers}
        title="Test Suites"
        description="Group reusable test cases into regression, smoke, or feature suites without duplicating test case definitions."
        badge={suites.length}
        actions={
          canManage ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition-all"
              style={{ backgroundColor: accentColor }}
            >
              <Plus className="w-4 h-4" />
              New Test Suite
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
            placeholder="Search suite key, name, purpose..."
            className="w-full bg-[#0B0D10] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <div className="w-44">
          <AnimatedSelect
            options={[{ value: 'ALL', label: 'All Statuses' }, ...SUITE_STATUS_OPTIONS]}
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

      {/* Suites Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="h-44 rounded-2xl bg-[#12151B] border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : suites.length === 0 ? (
        <div className="bg-[#12151B] border border-white/10 rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6 text-gray-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">No test suites yet</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
              Create suites such as Smoke Suite, Auth Regression, or Release Checklist and reference existing test cases.
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
              Create First Suite
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suites.map((suite) => {
            const isSelected = selectedSuiteId === suite.id;
            return (
              <div
                key={suite.id}
                onClick={() => setSelectedSuiteId(suite.id)}
                className={`bg-[#12151B] rounded-2xl p-5 border cursor-pointer transition-all hover:border-white/25 space-y-4 ${
                  isSelected ? 'border-emerald-500/60 ring-1 ring-emerald-500/30' : 'border-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                        {suite.suiteKey}
                      </span>
                      <PlanRunStatusBadge status={suite.isArchived ? 'Archived' : suite.status} />
                    </div>
                    <h3 className="text-sm font-semibold text-white truncate">{suite.name}</h3>
                    {suite.purpose && (
                      <p className="text-[11px] text-emerald-300/90 font-medium">{suite.purpose}</p>
                    )}
                  </div>
                  {canManage && (
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => void openEditModal(suite)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
                        title="Edit Suite"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {canArchive && (
                        <button
                          type="button"
                          onClick={() => void handleArchiveSuite(suite)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-300 hover:bg-white/5"
                          title={suite.isArchived ? 'Restore Suite' : 'Archive Suite'}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {suite.description && (
                  <p className="text-xs text-gray-400 line-clamp-2">{suite.description}</p>
                )}

                {suite.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {suite.labels.slice(0, 4).map((lbl) => (
                      <span
                        key={lbl}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10"
                      >
                        #{lbl}
                      </span>
                    ))}
                  </div>
                )}

                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{suite.totalCases}</span>
                    <span>test cases</span>
                  </div>
                  {suite.owner ? (
                    <div className="flex items-center gap-1.5">
                      <UserAvatar user={suite.owner} size="xs" />
                      <span className="text-[11px] text-gray-300 truncate max-w-[110px]">
                        {suite.owner.name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-gray-500">No owner</span>
                  )}
                </div>

                {suite.latestRun && (
                  <div className="bg-[#0B0D10] border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between text-[11px]">
                    <span className="text-gray-400 truncate">
                      Last Run: <span className="text-gray-200 font-medium">{suite.latestRun.runKey}</span>
                    </span>
                    <span className="text-emerald-400 font-semibold shrink-0">
                      {suite.latestRun.passRate}% pass ({suite.latestRun.passed}/{suite.latestRun.total})
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Suite Detail Drawer / Panel */}
      {selectedSuiteId && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-3xl bg-[#101319] border-l border-white/10 h-full flex flex-col">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-200">
                  {suiteDetail?.suiteKey || '...'}
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-white truncate">
                    {suiteDetail?.name || 'Loading suite...'}
                  </h2>
                  {suiteDetail?.purpose && (
                    <p className="text-xs text-gray-400">{suiteDetail.purpose}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canExecute && suiteDetail && (
                  <button
                    type="button"
                    disabled={startingRun}
                    onClick={() => void handleStartRunFromSuite(suiteDetail)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all"
                    style={{ backgroundColor: accentColor }}
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    {startingRun ? 'Starting...' : 'Run Suite'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedSuiteId(null)}
                  className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {detailLoading || !suiteDetail ? (
                <div className="space-y-3">
                  <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
                  <div className="h-48 rounded-xl bg-white/5 animate-pulse" />
                </div>
              ) : (
                <>
                  <div className="bg-[#161B24] border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <PlanRunStatusBadge status={suiteDetail.isArchived ? 'Archived' : suiteDetail.status} size="sm" />
                      <span className="text-xs text-gray-400">
                        Updated {formatTestingDateTime(suiteDetail.updatedAt)}
                      </span>
                      {suiteDetail.owner && (
                        <div className="inline-flex items-center gap-1.5 text-xs text-gray-300 ml-auto">
                          <UserAvatar user={suiteDetail.owner} size="xs" />
                          <span>{suiteDetail.owner.name}</span>
                        </div>
                      )}
                    </div>
                    {suiteDetail.description && (
                      <p className="text-xs text-gray-300 leading-relaxed">{suiteDetail.description}</p>
                    )}
                  </div>

                  {/* Referenced Test Cases */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">
                        Included Test Cases ({suiteDetail.cases.length})
                      </h3>
                      {canManage && (
                        <button
                          type="button"
                          onClick={handleOpenAddCasesModal}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-emerald-300 border border-emerald-500/30"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Manage Referenced Cases
                        </button>
                      )}
                    </div>

                    {suiteDetail.cases.length === 0 ? (
                      <div className="bg-[#161B24] border border-dashed border-white/15 rounded-2xl p-6 text-center text-xs text-gray-400">
                        No test cases linked to this suite yet.
                      </div>
                    ) : (
                      <div className="bg-[#161B24] border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5">
                        {suiteDetail.cases.map((entry, idx) => {
                          const tc = entry.testCase;
                          return (
                            <div
                              key={entry.linkId}
                              className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.02]"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-[11px] font-mono text-gray-500 w-6 text-right shrink-0">
                                  #{idx + 1}
                                </span>
                                <span className="text-xs font-mono text-emerald-300 shrink-0">
                                  {tc.caseKey}
                                </span>
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => goToSubmodule('test-cases', { caseId: tc.id })}
                                    className="text-xs font-medium text-white hover:text-emerald-300 text-left truncate block max-w-[300px]"
                                  >
                                    {tc.title}
                                  </button>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <TestTypeBadge testType={tc.testType} />
                                    <TestingPriorityBadge priority={tc.priority} />
                                    <TestCaseStatusBadge status={tc.status} />
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => goToSubmodule('test-cases', { caseId: tc.id })}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
                                  title="Open Test Case"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                                {canManage && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => void handleMoveCaseOrder(idx, -1)}
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30"
                                      title="Move Up"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === suiteDetail.cases.length - 1}
                                      onClick={() => void handleMoveCaseOrder(idx, 1)}
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30"
                                      title="Move Down"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleRemoveCaseFromSuite(tc.id, tc.caseKey)}
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/5"
                                      title="Remove from suite"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Suite Execution History */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-white">
                      Recent Suite Runs ({suiteDetail.runs.length})
                    </h3>
                    {suiteDetail.runs.length === 0 ? (
                      <p className="text-xs text-gray-500">No runs recorded for this suite yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {suiteDetail.runs.map((run) => (
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
                                {run.environment || 'Default'} · {formatTestingDate(run.createdAt)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <ExecutionStatusBadge
                                status={run.stats.failed > 0 ? 'Failed' : run.stats.passed > 0 ? 'Passed' : 'Not Run'}
                              />
                              <span className="text-xs font-semibold text-white">
                                {run.stats.passRate}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Suite Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#12151B] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {editingSuite ? `Edit ${editingSuite.suiteKey}` : 'Create Test Suite'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSuite} className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Suite Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Authentication Regression Suite"
                    className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Purpose / Category</label>
                  <input
                    type="text"
                    value={form.purpose}
                    onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
                    placeholder="Regression, Smoke, API Sanity..."
                    className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Owner</label>
                  <AnimatedSelect
                    options={ownerOptions}
                    value={form.ownerId}
                    onChange={(val) => setForm((p) => ({ ...p, ownerId: val }))}
                    placeholder="Select owner..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Status</label>
                  <AnimatedSelect
                    options={SUITE_STATUS_OPTIONS}
                    value={form.status}
                    onChange={(val) => setForm((p) => ({ ...p, status: val }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Describe coverage boundaries of this suite..."
                  className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Labels (comma-separated)
                </label>
                <input
                  type="text"
                  value={form.labels}
                  onChange={(e) => setForm((p) => ({ ...p, labels: e.target.value }))}
                  placeholder="regression, auth, v2.1"
                  className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-300">
                    Reference Test Cases ({form.testCaseIds.length} selected)
                  </label>
                  <input
                    type="text"
                    value={casePickerSearch}
                    onChange={(e) => setCasePickerSearch(e.target.value)}
                    placeholder="Filter cases..."
                    className="w-48 bg-[#0B0D10] border border-white/15 rounded-lg px-2.5 py-1 text-[11px] text-white"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto bg-[#0B0D10] border border-white/10 rounded-xl divide-y divide-white/5">
                  {filteredModalCases.length === 0 ? (
                    <p className="p-3 text-xs text-gray-500 text-center">No active test cases match filter.</p>
                  ) : (
                    filteredModalCases.map((tc) => {
                      const checked = form.testCaseIds.includes(tc.id);
                      return (
                        <label
                          key={tc.id}
                          className="flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-white/[0.03]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setForm((p) => ({
                                  ...p,
                                  testCaseIds: checked
                                    ? p.testCaseIds.filter((id) => id !== tc.id)
                                    : [...p.testCaseIds, tc.id],
                                }))
                              }
                              className="rounded border-white/20"
                            />
                            <span className="font-mono text-emerald-300">{tc.caseKey}</span>
                            <span className="text-white truncate">{tc.title}</span>
                          </div>
                          <TestTypeBadge testType={tc.testType} />
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-gray-300 bg-white/5 hover:bg-white/10"
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
                  {saving ? 'Saving...' : editingSuite ? 'Save Changes' : 'Create Suite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Referenced Cases Modal inside Detail Drawer */}
      {addCasesModalOpen && suiteDetail && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#12151B] border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Referenced Test Cases — {suiteDetail.suiteKey}
              </h3>
              <button
                type="button"
                onClick={() => setAddCasesModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <input
                type="text"
                value={addCasesSearch}
                onChange={(e) => setAddCasesSearch(e.target.value)}
                placeholder="Search test cases..."
                className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
              />
              <div className="max-h-72 overflow-y-auto bg-[#0B0D10] border border-white/10 rounded-xl divide-y divide-white/5">
                {filteredAddModalCases.map((tc) => {
                  const checked = addCasesSelection.includes(tc.id);
                  return (
                    <label
                      key={tc.id}
                      className="flex items-center justify-between px-3 py-2.5 text-xs cursor-pointer hover:bg-white/[0.03]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setAddCasesSelection((prev) =>
                              checked ? prev.filter((id) => id !== tc.id) : [...prev, tc.id]
                            )
                          }
                        />
                        <span className="font-mono text-emerald-300">{tc.caseKey}</span>
                        <span className="text-white truncate">{tc.title}</span>
                      </div>
                      <TestingPriorityBadge priority={tc.priority} />
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddCasesModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs bg-white/5 text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmAddCases()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  Save Case References ({addCasesSelection.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestSuitesView;
