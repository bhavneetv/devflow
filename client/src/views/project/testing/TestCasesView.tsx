import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Archive,
  CheckSquare,
  Copy,
  Edit3,
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
  Search,
  Tag,
} from 'lucide-react';
import { testingService } from '../../../services/testing.service';
import { useAccentTheme } from '../../../services/accentTheme.service';
import { useToast } from '../../../context/ToastContext';
import { confirmDeleteSwal } from '../../../lib/confirmAlert';
import { AnimatedSelect, type SelectOption } from '../../../components/settings/AnimatedSelect';
import { UserAvatar } from '../../../components/common/UserAvatar';
import { TestingPageHeader } from '../../../components/testing/TestingPageHeader';
import {
  ExecutionStatusBadge,
  TestCaseStatusBadge,
  TestTypeBadge,
  TestingPriorityBadge,
  formatTestingDate,
} from '../../../components/testing/testingBadges';
import { TestCaseModal } from './TestCaseModal';
import { TestCaseDrawer } from './TestCaseDrawer';
import type {
  TestCaseDetail,
  TestCaseItem,
  TestingConfigurationItem,
  TestingMetaData,
  TestingPermissions,
} from '../../../types/testing';

interface TestCasesViewProps {
  projectId?: number;
}

const DEFAULT_META: TestingMetaData = {
  members: [],
  teams: [],
  modules: [],
  devTasks: [],
  requirements: [],
  projectDocuments: [],
  gitRepositories: [],
};

const DEFAULT_PERMS: TestingPermissions = {
  role: 'viewer',
  canViewTesting: true,
  canEditTestCases: false,
  canExecuteTests: false,
  canManageDefects: false,
  canManagePlansSuites: false,
  canManageSettings: false,
  canViewReports: true,
  canArchiveRecords: false,
};

export const TestCasesView: React.FC<TestCasesViewProps> = ({ projectId: propProjectId }) => {
  const { id } = useParams<{ id: string }>();
  const projectId = propProjectId || Number(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();

  const [cases, setCases] = useState<TestCaseItem[]>([]);
  const [meta, setMeta] = useState<TestingMetaData>(DEFAULT_META);
  const [config, setConfig] = useState<TestingConfigurationItem | null>(null);
  const [permissions, setPermissions] = useState<TestingPermissions>(DEFAULT_PERMS);

  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');
  const [search, setSearch] = useState(searchParams.get('q') || searchParams.get('search') || '');
  const [filterType, setFilterType] = useState(searchParams.get('testType') || '');
  const [filterPriority, setFilterPriority] = useState(searchParams.get('priority') || '');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [filterTesterId, setFilterTesterId] = useState(searchParams.get('testerId') || '');
  const [filterReqId, setFilterReqId] = useState(
    searchParams.get('linkedRequirementId') || searchParams.get('requirementId') || ''
  );
  const [filterDevTaskId, setFilterDevTaskId] = useState(searchParams.get('linkedDevTaskId') || '');
  const [includeArchived, setIncludeArchived] = useState(searchParams.get('archived') === '1');
  const [sortValue, setSortValue] = useState('updatedAt:desc');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [modalOpen, setModalOpen] = useState(searchParams.get('create') === '1');
  const [editingCase, setEditingCase] = useState<TestCaseDetail | TestCaseItem | null>(null);
  const [drawerCaseId, setDrawerCaseId] = useState<number | null>(() => {
    const raw = searchParams.get('caseId');
    return raw ? Number(raw) : null;
  });

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const [sortBy, sortDir] = sortValue.split(':');
    const [metaRes, listRes] = await Promise.all([
      testingService.getMeta(projectId),
      testingService.listTestCases(projectId, {
        search: search || undefined,
        testType: filterType || undefined,
        priority: filterPriority || undefined,
        status: filterStatus || undefined,
        testerId: filterTesterId || undefined,
        linkedRequirementId: filterReqId || undefined,
        linkedDevTaskId: filterDevTaskId || undefined,
        includeArchived,
        sortBy,
        sortDir: (sortDir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
      }),
    ]);

    if (metaRes.success && metaRes.data) {
      setMeta(metaRes.data.meta);
      setConfig(metaRes.data.config);
      setPermissions(metaRes.data.permissions);
    }
    if (listRes.success && listRes.data) {
      setCases(listRes.data.items);
      setSelectedIds([]);
    } else {
      toast.error(listRes.error || 'Failed to load test cases');
    }
    setLoading(false);
  }, [
    projectId,
    search,
    filterType,
    filterPriority,
    filterStatus,
    filterTesterId,
    filterReqId,
    filterDevTaskId,
    includeArchived,
    sortValue,
    toast,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleResetFilters = () => {
    setSearch('');
    setFilterType('');
    setFilterPriority('');
    setFilterStatus('');
    setFilterTesterId('');
    setFilterReqId('');
    setFilterDevTaskId('');
    setIncludeArchived(false);
    setSortValue('updatedAt:desc');
    setSearchParams({});
  };

  const handleBulkStatus = async (status: string) => {
    if (selectedIds.length === 0) return;
    const res = await testingService.bulkTestCaseAction(projectId, {
      caseIds: selectedIds,
      action: 'status',
      status,
    });
    if (res.success) {
      toast.success(`Updated ${selectedIds.length} test cases to ${status}`);
      void loadData();
    } else {
      toast.error(res.error || 'Bulk update failed');
    }
  };

  const handleBulkArchive = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirmDeleteSwal({
      title: `Archive ${selectedIds.length} test case(s)?`,
      text: 'Archived test cases remain preserved in historical test runs.',
      confirmText: 'Archive Selected',
    });
    if (!confirmed) return;
    const res = await testingService.bulkTestCaseAction(projectId, {
      caseIds: selectedIds,
      action: 'archive',
    });
    if (res.success) {
      toast.success(`Archived ${selectedIds.length} test case(s)`);
      void loadData();
    } else {
      toast.error(res.error || 'Bulk archive failed');
    }
  };

  const toggleAll = () => {
    if (selectedIds.length === cases.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(cases.map((c) => c.id));
    }
  };

  const toggleOne = (caseId: number) => {
    setSelectedIds((prev) =>
      prev.includes(caseId) ? prev.filter((x) => x !== caseId) : [...prev, caseId]
    );
  };

  const typeOptions: SelectOption[] = [
    { value: '', label: 'All Types' },
    ...(config?.testTypes || [])
      .filter((t) => !t.isArchived)
      .map((t) => ({ value: t.name, label: t.name })),
  ];
  const priorityOptions: SelectOption[] = [
    { value: '', label: 'All Priorities' },
    ...(config?.priorities || [])
      .filter((p) => !p.isArchived)
      .map((p) => ({ value: p.name, label: p.name })),
  ];
  const statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Ready', label: 'Ready' },
    { value: 'Deprecated', label: 'Deprecated' },
  ];
  const testerOptions: SelectOption[] = [
    { value: '', label: 'All Testers' },
    ...meta.members.map((m) => ({ value: String(m.id), label: m.name || m.email || `User #${m.id}` })),
  ];
  const reqOptions: SelectOption[] = [
    { value: '', label: 'All Requirements' },
    ...meta.requirements.map((r) => ({ value: String(r.id), label: r.code ? `${r.code} — ${r.title}` : r.title })),
  ];
  const sortOptions: SelectOption[] = [
    { value: 'updatedAt:desc', label: 'Recently Updated' },
    { value: 'createdAt:desc', label: 'Newest Created' },
    { value: 'createdAt:asc', label: 'Oldest Created' },
    { value: 'title:asc', label: 'Title (A → Z)' },
    { value: 'title:desc', label: 'Title (Z → A)' },
    { value: 'priority:desc', label: 'Priority (Highest First)' },
    { value: 'priority:asc', label: 'Priority (Lowest First)' },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-5">
      <TestingPageHeader
        projectId={projectId}
        activeKey="test-cases"
        title="Test Cases"
        description="Author reusable manual test definitions with ordered steps, preconditions, and requirement traceability."
        icon={CheckSquare}
        badge={`${cases.length} cases`}
        actions={
          permissions.canEditTestCases ? (
            <button
              type="button"
              onClick={() => {
                setEditingCase(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm hover:opacity-90"
              style={{ backgroundColor: accentColor }}
            >
              <Plus className="w-4 h-4" />
              New Test Case
            </button>
          ) : null
        }
      />

      <div className="rounded-2xl bg-[#13161B] border border-white/10 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search TC-001, title, description..."
              className="w-full bg-[#0B0D10] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <AnimatedSelect options={typeOptions} value={filterType} onChange={setFilterType} placeholder="Test Type" />
          <AnimatedSelect options={priorityOptions} value={filterPriority} onChange={setFilterPriority} placeholder="Priority" />
          <AnimatedSelect options={statusOptions} value={filterStatus} onChange={setFilterStatus} placeholder="Status" />
          <AnimatedSelect options={sortOptions} value={sortValue} onChange={setSortValue} placeholder="Sort by" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-48">
              <AnimatedSelect options={testerOptions} value={filterTesterId} onChange={setFilterTesterId} placeholder="Tester" />
            </div>
            <div className="w-56">
              <AnimatedSelect options={reqOptions} value={filterReqId} onChange={setFilterReqId} placeholder="Requirement" />
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="rounded border-white/20 bg-[#0B0D10] text-emerald-500 focus:ring-0"
              />
              Show Archived
            </label>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/[0.06]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-[#0B0D10] border border-white/10 p-1">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'cards' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {selectedIds.length > 0 && permissions.canEditTestCases && (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <span className="text-xs font-medium text-emerald-300">
              {selectedIds.length} test case(s) selected
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => void handleBulkStatus('Ready')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
              >
                Mark Ready
              </button>
              <button
                type="button"
                onClick={() => void handleBulkStatus('Draft')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
              >
                Mark Draft
              </button>
              <button
                type="button"
                onClick={() => void handleBulkStatus('Deprecated')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/10 text-gray-200 hover:bg-white/20"
              >
                Deprecate
              </button>
              {permissions.canArchiveRecords && (
                <button
                  type="button"
                  onClick={() => void handleBulkArchive()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/15 text-red-300 hover:bg-red-500/25"
                >
                  <Archive className="w-3 h-3" />
                  Archive
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-[#13161B] border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-2xl bg-[#13161B] border border-white/10 p-12 text-center space-y-3">
          <CheckSquare className="w-10 h-10 text-gray-600 mx-auto" />
          <h3 className="text-sm font-semibold text-white">No test cases match these criteria</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            Create your first test case with ordered steps or clear active filters to view existing repository tests.
          </p>
          {permissions.canEditTestCases && (
            <button
              type="button"
              onClick={() => {
                setEditingCase(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white"
              style={{ backgroundColor: accentColor }}
            >
              <Plus className="w-3.5 h-3.5" />
              Create Test Case
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <div className="rounded-2xl bg-[#13161B] border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B0D10]/70 text-gray-400 border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={cases.length > 0 && selectedIds.length === cases.length}
                      onChange={toggleAll}
                      className="rounded border-white/20 bg-[#0B0D10] text-emerald-500 focus:ring-0"
                    />
                  </th>
                  <th className="px-4 py-3">Key &amp; Title</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Latest Run</th>
                  <th className="px-4 py-3">Tester</th>
                  <th className="px-4 py-3 text-right">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {cases.map((tc) => (
                  <tr
                    key={tc.id}
                    className={`hover:bg-white/[0.03] transition-colors cursor-pointer ${
                      tc.isArchived ? 'opacity-60' : ''
                    }`}
                    onClick={() => setDrawerCaseId(tc.id)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(tc.id)}
                        onChange={() => toggleOne(tc.id)}
                        className="rounded border-white/20 bg-[#0B0D10] text-emerald-500 focus:ring-0"
                      />
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold text-emerald-400 shrink-0">
                          {tc.caseKey}
                        </span>
                        <span className="font-medium text-white truncate">{tc.title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5 flex-wrap">
                        <span>{tc.stepsCount} steps</span>
                        {tc.module && <span>• {tc.module.name}</span>}
                        {tc.linkedRequirement && (
                          <span className="text-purple-400 truncate max-w-[180px]">
                            • Req: {tc.linkedRequirement.title}
                          </span>
                        )}
                        {tc.linkedDevTask && (
                          <span className="text-cyan-400">• {tc.linkedDevTask.taskKey}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TestTypeBadge testType={tc.testType} />
                    </td>
                    <td className="px-4 py-3">
                      <TestingPriorityBadge priority={tc.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <TestCaseStatusBadge status={tc.status} />
                    </td>
                    <td className="px-4 py-3">
                      {tc.latestExecutionStatus ? (
                        <ExecutionStatusBadge status={tc.latestExecutionStatus} />
                      ) : (
                        <span className="text-gray-500">Not Run</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {tc.assignedTester ? (
                        <div className="flex items-center gap-1.5">
                          <UserAvatar user={tc.assignedTester} size="xs" />
                          <span className="text-gray-300 truncate max-w-[110px]">
                            {tc.assignedTester.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-500">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 whitespace-nowrap">
                      {formatTestingDate(tc.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        {permissions.canEditTestCases && (
                          <>
                            <button
                              type="button"
                              onClick={async () => {
                                const detailRes = await testingService.getTestCaseDetail(projectId, tc.id);
                                if (detailRes.success && detailRes.data) {
                                  setEditingCase(detailRes.data);
                                  setModalOpen(true);
                                }
                              }}
                              title="Edit"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await testingService.duplicateTestCase(projectId, tc.id);
                                if (res.success && res.data) {
                                  toast.success(`Duplicated as ${res.data.caseKey}`);
                                  void loadData();
                                }
                              }}
                              title="Duplicate"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cases.map((tc) => (
            <div
              key={tc.id}
              onClick={() => setDrawerCaseId(tc.id)}
              className="rounded-2xl bg-[#13161B] border border-white/10 hover:border-white/25 p-4 space-y-3 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-semibold text-emerald-400">{tc.caseKey}</span>
                <div className="flex items-center gap-1.5">
                  <TestingPriorityBadge priority={tc.priority} />
                  <TestCaseStatusBadge status={tc.status} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white line-clamp-2">{tc.title}</h3>
                {tc.description && (
                  <p className="text-xs text-gray-400 line-clamp-2 mt-1">{tc.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <TestTypeBadge testType={tc.testType} />
                {tc.labels.slice(0, 3).map((lbl) => (
                  <span
                    key={lbl}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-white/[0.05] text-gray-300 border border-white/10"
                  >
                    <Tag className="w-2.5 h-2.5 text-emerald-400" />
                    {lbl}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[11px] text-gray-400">
                <span>{tc.stepsCount} steps • {tc.executionsCount} runs</span>
                {tc.latestExecutionStatus ? (
                  <ExecutionStatusBadge status={tc.latestExecutionStatus} />
                ) : (
                  <span>Not Run</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {config && (
        <TestCaseModal
          projectId={projectId}
          isOpen={modalOpen}
          editingCase={editingCase}
          meta={meta}
          config={config}
          permissions={permissions}
          onConfigUpdated={setConfig}
          onClose={() => {
            setModalOpen(false);
            setEditingCase(null);
          }}
          onSaved={() => {
            setModalOpen(false);
            setEditingCase(null);
            void loadData();
          }}
        />
      )}

      <TestCaseDrawer
        projectId={projectId}
        caseId={drawerCaseId}
        meta={meta}
        permissions={permissions}
        onClose={() => setDrawerCaseId(null)}
        onEdit={(detail) => {
          setDrawerCaseId(null);
          setEditingCase(detail);
          setModalOpen(true);
        }}
        onDuplicated={(created) => {
          setDrawerCaseId(created.id);
          void loadData();
        }}
        onArchived={() => {
          setDrawerCaseId(null);
          void loadData();
        }}
      />
    </div>
  );
};
