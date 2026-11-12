import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Archive,
  Bug,
  Check,
  Edit3,
  ExternalLink,
  GitBranch,
  Link2,
  Plus,
  RotateCcw,
  Search,
  Unlink,
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
  TestingPriorityBadge,
  TestingSeverityBadge,
  formatTestingDate,
  formatTestingDateTime,
} from '../../../components/testing/testingBadges';
import { testingService } from '../../../services/testing.service';
import { gitService } from '../../../services/git.service';
import type {
  QaDefectDetail,
  QaDefectItem,
  TestingConfigurationItem,
  TestingMetaData,
  TestingPermissions,
} from '../../../types/testing';

interface DefectsViewProps {
  projectId?: number;
}

const DEFECT_STATUS_OPTIONS = [
  { value: 'Open', label: 'Open' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Fixed', label: 'Fixed (Pending Retest)' },
  { value: 'Ready for Retest', label: 'Ready for Retest' },
  { value: 'Verified', label: 'Verified (QA)' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Reopened', label: 'Reopened' },
];

export const DefectsView: React.FC<DefectsViewProps> = ({ projectId: propProjectId }) => {
  const { id } = useParams<{ id: string }>();
  const projectId = propProjectId || Number(id);
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();
  const { goToSubmodule } = useTestingNavigation(projectId);
  const [searchParams] = useSearchParams();

  const [meta, setMeta] = useState<TestingMetaData | null>(null);
  const [config, setConfig] = useState<TestingConfigurationItem | null>(null);
  const [permissions, setPermissions] = useState<TestingPermissions | null>(null);
  const [defects, setDefects] = useState<QaDefectItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [severityFilter, setSeverityFilter] = useState(searchParams.get('severity') || 'ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [includeArchived, setIncludeArchived] = useState(false);

  const [selectedDefectId, setSelectedDefectId] = useState<number | null>(
    searchParams.get('defectId') ? Number(searchParams.get('defectId')) : null
  );
  const [defectDetail, setDefectDetail] = useState<QaDefectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDefect, setEditingDefect] = useState<QaDefectDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'Major',
    priority: 'High',
    status: 'Open',
    assigneeId: '',
    environment: 'Staging',
    buildVersion: '',
    stepsToReproduce: '',
    expectedResult: '',
    actualResult: '',
    linkedTestCaseId: '',
    linkedDevTaskId: '',
    linkedRequirementId: '',
  });

  // Git Issue / MR Linking Modal
  const [gitLinkOpen, setGitLinkOpen] = useState(false);
  const [gitOptionsLoading, setGitOptionsLoading] = useState(false);
  const [gitIssues, setGitIssues] = useState<any[]>([]);
  const [gitMrs, setGitMrs] = useState<any[]>([]);
  const [gitLinkType, setGitLinkType] = useState<'issue' | 'merge_request'>('issue');
  const [gitRecordId, setGitRecordId] = useState('');

  const canManage = Boolean(permissions?.canManageDefects);
  const canArchive = Boolean(permissions?.canArchiveRecords);

  useEffect(() => {
    const qId = searchParams.get('defectId');
    const qStatus = searchParams.get('status');
    const qSeverity = searchParams.get('severity');
    if (qId && Number(qId) > 0) setSelectedDefectId(Number(qId));
    if (qStatus) setStatusFilter(qStatus);
    if (qSeverity) setSeverityFilter(qSeverity);
  }, [searchParams]);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [metaRes, defectsRes] = await Promise.all([
        testingService.getMeta(projectId),
        testingService.listDefects(projectId, {
          search: searchQuery || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          severity: severityFilter !== 'ALL' ? severityFilter : undefined,
          assigneeId: assigneeFilter !== 'ALL' ? Number(assigneeFilter) : undefined,
          includeArchived,
        }),
      ]);
      if (metaRes.success && metaRes.data) {
        setMeta(metaRes.data.meta);
        setConfig(metaRes.data.config);
        setPermissions(metaRes.data.permissions);
      }
      if (defectsRes.success && defectsRes.data) setDefects(defectsRes.data.items);
    } catch {
      toast.error('Failed to load defects');
    } finally {
      setLoading(false);
    }
  }, [projectId, searchQuery, statusFilter, severityFilter, assigneeFilter, includeArchived, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadDefectDetail = useCallback(
    async (defectId: number) => {
      setDetailLoading(true);
      try {
        const res = await testingService.getDefectDetail(projectId, defectId);
        if (res.success && res.data) setDefectDetail(res.data);
      } catch {
        toast.error('Failed to load defect details');
      } finally {
        setDetailLoading(false);
      }
    },
    [projectId, toast]
  );

  useEffect(() => {
    if (selectedDefectId) {
      void loadDefectDetail(selectedDefectId);
    } else {
      setDefectDetail(null);
    }
  }, [selectedDefectId, loadDefectDetail]);

  const openCreateModal = () => {
    setEditingDefect(null);
    setForm({
      title: '',
      description: '',
      severity: 'Major',
      priority: 'High',
      status: 'Open',
      assigneeId: '',
      environment: config?.defaultEnvironment || 'Staging',
      buildVersion: '',
      stepsToReproduce: '',
      expectedResult: '',
      actualResult: '',
      linkedTestCaseId: '',
      linkedDevTaskId: '',
      linkedRequirementId: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (d: QaDefectDetail) => {
    setEditingDefect(d);
    setForm({
      title: d.title,
      description: d.description || '',
      severity: d.severity,
      priority: d.priority,
      status: d.status,
      assigneeId: d.assigneeId ? String(d.assigneeId) : '',
      environment: d.environment || config?.defaultEnvironment || 'Staging',
      buildVersion: d.buildVersion || '',
      stepsToReproduce: d.stepsToReproduce || '',
      expectedResult: d.expectedResult || '',
      actualResult: d.actualResult || '',
      linkedTestCaseId: d.linkedTestCaseId ? String(d.linkedTestCaseId) : '',
      linkedDevTaskId: d.linkedDevTaskId ? String(d.linkedDevTaskId) : '',
      linkedRequirementId: d.linkedRequirementId ? String(d.linkedRequirementId) : '',
    });
    setModalOpen(true);
  };

  const handleSaveDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Defect title is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        severity: form.severity,
        priority: form.priority,
        status: form.status,
        assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
        environment: form.environment || undefined,
        buildVersion: form.buildVersion.trim() || undefined,
        stepsToReproduce: form.stepsToReproduce.trim() || undefined,
        expectedResult: form.expectedResult.trim() || undefined,
        actualResult: form.actualResult.trim() || undefined,
        linkedTestCaseId: form.linkedTestCaseId ? Number(form.linkedTestCaseId) : null,
        linkedDevTaskId: form.linkedDevTaskId ? Number(form.linkedDevTaskId) : null,
        linkedRequirementId: form.linkedRequirementId ? Number(form.linkedRequirementId) : null,
      };
      if (editingDefect) {
        const res = await testingService.updateDefect(projectId, editingDefect.id, payload);
        if (res.success) {
          toast.success(`Defect ${editingDefect.defectKey} updated`);
          setModalOpen(false);
          await loadData();
          await loadDefectDetail(editingDefect.id);
        } else {
          toast.error(res.error || 'Could not update defect');
        }
      } else {
        const res = await testingService.createDefect(projectId, payload);
        if (res.success && res.data) {
          toast.success(`Defect ${res.data.defectKey} created`);
          setModalOpen(false);
          await loadData();
          setSelectedDefectId(res.data.id);
        } else {
          toast.error(res.error || 'Could not create defect');
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not save defect');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusTransition = async (defectId: number, nextStatus: string) => {
    try {
      const res = await testingService.updateDefect(projectId, defectId, { status: nextStatus });
      if (res.success) {
        toast.success(
          nextStatus === 'Fixed'
            ? 'Marked Fixed — awaiting QA retest verification'
            : nextStatus === 'Reopened'
              ? 'Defect reopened'
              : `Status changed to ${nextStatus}`
        );
        await loadData();
        await loadDefectDetail(defectId);
      } else {
        toast.error(res.error || 'Could not change status');
      }
    } catch {
      toast.error('Failed to transition defect status');
    }
  };

  const handleArchiveDefect = async (defect: QaDefectItem) => {
    const confirmed = await confirmDeleteSwal({
      title: defect.isArchived ? `Restore ${defect.defectKey}?` : `Archive ${defect.defectKey}?`,
      text: defect.isArchived
        ? 'Restoring returns this defect to active triage.'
        : 'Archiving hides the defect without erasing run or commit links.',
      confirmText: defect.isArchived ? 'Restore Defect' : 'Archive Defect',
    });
    if (!confirmed) return;
    try {
      const res = await testingService.updateDefect(projectId, defect.id, {
        isArchived: !defect.isArchived,
      });
      if (res.success) {
        toast.success(defect.isArchived ? 'Defect restored' : 'Defect archived');
        await loadData();
        if (selectedDefectId === defect.id) await loadDefectDetail(defect.id);
      }
    } catch {
      toast.error('Failed to archive defect');
    }
  };

  const openGitLinkModal = async () => {
    setGitLinkOpen(true);
    setGitRecordId('');
    setGitOptionsLoading(true);
    try {
      const [issuesRes, mrsRes] = await Promise.all([
        gitService.getIssues(projectId, { state: 'all' }).catch(() => null),
        gitService.getMergeRequests(projectId, { state: 'all' }).catch(() => null),
      ]);
      setGitIssues(Array.isArray(issuesRes) ? issuesRes : (issuesRes as any)?.data || []);
      setGitMrs(Array.isArray(mrsRes) ? mrsRes : (mrsRes as any)?.data || []);
    } finally {
      setGitOptionsLoading(false);
    }
  };

  const handleLinkGitRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!defectDetail || !gitRecordId) return;
    const pool = gitLinkType === 'issue' ? gitIssues : gitMrs;
    const picked = pool.find((item) => String(item.iid || item.id) === gitRecordId);
    const defaultRepo = meta?.gitRepositories?.[0];
    if (!defaultRepo) {
      toast.error('No Git repository connected to this project');
      return;
    }
    try {
      const res = await testingService.linkDefectGitRecord(projectId, defectDetail.id, {
        repositoryId: picked?.repositoryId || defaultRepo.id,
        provider: defaultRepo.provider || 'github',
        recordType: gitLinkType,
        recordId: gitRecordId,
        recordNumber: picked?.iid || picked?.number || undefined,
        recordTitle: picked?.title || undefined,
        recordUrl: picked?.webUrl || picked?.htmlUrl || picked?.url || undefined,
      });
      if (res.success) {
        toast.success('Git record linked to defect');
        setGitLinkOpen(false);
        await loadDefectDetail(defectDetail.id);
      } else {
        toast.error(res.error || 'Could not link Git record');
      }
    } catch {
      toast.error('Could not link Git record');
    }
  };

  const handleUnlinkGitRecord = async (linkId: number) => {
    if (!defectDetail) return;
    try {
      const res = await testingService.unlinkDefectGitRecord(projectId, defectDetail.id, linkId);
      if (res.success) {
        toast.success('Git link removed');
        await loadDefectDetail(defectDetail.id);
      }
    } catch {
      toast.error('Could not unlink Git record');
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

  const devTaskOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...(meta?.devTasks || []).map((d) => ({ value: String(d.id), label: `${d.taskKey} — ${d.title}` })),
    ],
    [meta?.devTasks]
  );

  const requirementOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...(meta?.requirements || []).map((r) => ({ value: String(r.id), label: `${r.code} — ${r.title}` })),
    ],
    [meta?.requirements]
  );

  const severityFilterOptions = useMemo(
    () => [
      { value: 'ALL', label: 'All Severities' },
      ...(config?.defectSeverities || []).map((s) => ({ value: s.name, label: s.name })),
    ],
    [config?.defectSeverities]
  );

  return (
    <div className="p-6 max-w-[1680px] mx-auto space-y-6">
      <TestingPageHeader
        projectId={projectId}
        activeKey="defects"
        icon={Bug}
        title="Defects"
        description="Track software bugs with strict QA verification: developer fixes await retest before closure, and reopens increment traceability counters."
        badge={defects.length}
        actions={
          canManage ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-lg"
              style={{ backgroundColor: accentColor }}
            >
              <Plus className="w-4 h-4" />
              Log Defect
            </button>
          ) : null
        }
      />

      {/* Filter Toolbar */}
      <div className="bg-[#12151B] border border-white/10 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search defect key, title, build version..."
            className="w-full bg-[#0B0D10] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500"
          />
        </div>
        <div className="w-44">
          <AnimatedSelect
            options={[{ value: 'ALL', label: 'All Statuses' }, ...DEFECT_STATUS_OPTIONS]}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
        <div className="w-44">
          <AnimatedSelect
            options={severityFilterOptions}
            value={severityFilter}
            onChange={setSeverityFilter}
          />
        </div>
        <div className="w-44">
          <AnimatedSelect
            options={[{ value: 'ALL', label: 'All Assignees' }, ...memberOptions.slice(1)]}
            value={assigneeFilter}
            onChange={setAssigneeFilter}
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

      {/* Defects Table */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-[#12151B] border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : defects.length === 0 ? (
        <div className="bg-[#12151B] border border-white/10 rounded-2xl p-12 text-center space-y-4">
          <Bug className="w-10 h-10 text-gray-500 mx-auto" />
          <div>
            <h3 className="text-sm font-semibold text-white">No defects match current filters</h3>
            <p className="text-xs text-gray-400 mt-1">
              Log defects directly or trigger them from failed steps inside Test Runs.
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
              Log First Defect
            </button>
          )}
        </div>
      ) : (
        <div className="bg-[#12151B] border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-[#0B0D10] text-[11px] uppercase tracking-wider text-gray-400">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Defect Title</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Links</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {defects.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setSelectedDefectId(d.id)}
                    className={`cursor-pointer transition-colors hover:bg-white/[0.03] ${
                      selectedDefectId === d.id ? 'bg-emerald-500/10' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono text-rose-300 whitespace-nowrap">
                      {d.defectKey}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-white line-clamp-1">{d.title}</div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                        {d.environment && <span>{d.environment}</span>}
                        {d.buildVersion && <span>· {d.buildVersion}</span>}
                        {d.reopenCount > 0 && (
                          <span className="text-rose-400 font-semibold">
                            · Reopened {d.reopenCount}x
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <TestingSeverityBadge severity={d.severity} />
                    </td>
                    <td className="py-3 px-4">
                      <TestingPriorityBadge priority={d.priority} />
                    </td>
                    <td className="py-3 px-4">
                      <DefectStatusBadge status={d.status} />
                    </td>
                    <td className="py-3 px-4">
                      {d.assignee ? (
                        <div className="flex items-center gap-2">
                          <UserAvatar user={d.assignee} size="xs" />
                          <span className="text-gray-200 truncate max-w-[120px]">{d.assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-gray-400 whitespace-nowrap">
                      {d.linkedTestCase && (
                        <span className="mr-2 font-mono text-emerald-300">{d.linkedTestCase.caseKey}</span>
                      )}
                      {d.linkedDevTask && (
                        <span className="font-mono text-sky-300">{d.linkedDevTask.taskKey}</span>
                      )}
                      {!d.linkedTestCase && !d.linkedDevTask && '—'}
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {canArchive && (
                        <button
                          type="button"
                          onClick={() => void handleArchiveDefect(d)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-300 hover:bg-white/5"
                          title={d.isArchived ? 'Restore' : 'Archive'}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Defect Detail Drawer */}
      {selectedDefectId && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-3xl bg-[#101319] border-l border-white/10 h-full flex flex-col">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/35 text-rose-300">
                  {defectDetail?.defectKey || '...'}
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-white truncate">
                    {defectDetail?.title || 'Loading defect...'}
                  </h2>
                  {defectDetail && defectDetail.reopenCount > 0 && (
                    <p className="text-[11px] text-rose-400 font-medium">
                      Reopened {defectDetail.reopenCount} time(s)
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canManage && defectDetail && (
                  <button
                    type="button"
                    onClick={() => openEditModal(defectDetail)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDefectId(null)}
                  className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {detailLoading || !defectDetail ? (
                <div className="h-64 rounded-xl bg-white/5 animate-pulse" />
              ) : (
                <>
                  {/* Lifecycle Status Controls */}
                  <div className="bg-[#161B24] border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <TestingSeverityBadge severity={defectDetail.severity} size="sm" />
                        <TestingPriorityBadge priority={defectDetail.priority} size="sm" />
                        <DefectStatusBadge status={defectDetail.status} size="sm" />
                      </div>
                      {canManage && (
                        <div className="w-52">
                          <AnimatedSelect
                            options={DEFECT_STATUS_OPTIONS}
                            value={defectDetail.status}
                            onChange={(val) => void handleStatusTransition(defectDetail.id, val)}
                          />
                        </div>
                      )}
                    </div>

                    {defectDetail.status === 'Fixed' && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200">
                        <span>
                          Developer marked this defect <strong>Fixed</strong>. QA verification is required before Verified/Closed.
                        </span>
                        {canManage && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleStatusTransition(defectDetail.id, 'Verified')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold"
                            >
                              Verify Fix
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleStatusTransition(defectDetail.id, 'Reopened')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Reopen
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {defectDetail.verifiedBy && (
                      <p className="text-[11px] text-emerald-300">
                        Verified by {defectDetail.verifiedBy.name} on{' '}
                        {formatTestingDateTime(defectDetail.verifiedAt)}
                      </p>
                    )}

                    {defectDetail.description && (
                      <p className="text-xs text-gray-300 whitespace-pre-wrap">{defectDetail.description}</p>
                    )}
                  </div>

                  {/* Repro Details */}
                  {(defectDetail.stepsToReproduce ||
                    defectDetail.expectedResult ||
                    defectDetail.actualResult) && (
                    <div className="bg-[#161B24] border border-white/10 rounded-2xl p-4 space-y-3 text-xs">
                      {defectDetail.stepsToReproduce && (
                        <div>
                          <span className="text-[11px] font-semibold text-gray-400 uppercase block mb-1">
                            Steps to Reproduce
                          </span>
                          <pre className="whitespace-pre-wrap font-mono text-[11px] text-gray-200 bg-[#0B0D10] p-3 rounded-xl border border-white/10">
                            {defectDetail.stepsToReproduce}
                          </pre>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {defectDetail.expectedResult && (
                          <div className="bg-[#0B0D10] p-3 rounded-xl border border-white/10">
                            <span className="text-[11px] font-semibold text-emerald-400 block mb-1">
                              Expected
                            </span>
                            <p className="text-gray-300">{defectDetail.expectedResult}</p>
                          </div>
                        )}
                        {defectDetail.actualResult && (
                          <div className="bg-[#0B0D10] p-3 rounded-xl border border-white/10">
                            <span className="text-[11px] font-semibold text-rose-400 block mb-1">
                              Actual
                            </span>
                            <p className="text-gray-300">{defectDetail.actualResult}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Linked Artifacts */}
                  <div className="bg-[#161B24] border border-white/10 rounded-2xl p-4 space-y-3 text-xs">
                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Traceability Links
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {defectDetail.linkedTestCase && (
                        <button
                          type="button"
                          onClick={() =>
                            goToSubmodule('test-cases', { caseId: defectDetail.linkedTestCase!.id })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300"
                        >
                          <span>
                            {defectDetail.linkedTestCase.caseKey}: {defectDetail.linkedTestCase.title}
                          </span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                      {defectDetail.linkedDevTask && (
                        <span className="px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-300">
                          Dev Task: {defectDetail.linkedDevTask.taskKey} — {defectDetail.linkedDevTask.title}
                        </span>
                      )}
                      {defectDetail.linkedRequirement && (
                        <span className="px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-300">
                          Req: {defectDetail.linkedRequirement.code} — {defectDetail.linkedRequirement.title}
                        </span>
                      )}
                    </div>

                    {defectDetail.linkedExecutions.length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        <span className="text-[11px] text-gray-400">Linked Test Executions</span>
                        {defectDetail.linkedExecutions.map((ex) => (
                          <div
                            key={ex.id}
                            onClick={() => goToSubmodule('test-runs', { runId: ex.testRunId })}
                            className="bg-[#0B0D10] border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between cursor-pointer hover:border-white/25"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-emerald-300">{ex.runKey}</span>
                              <span className="text-white truncate">{ex.caseTitleSnapshot}</span>
                              <span className="text-[10px] text-gray-500">#{ex.attemptNumber}</span>
                            </div>
                            <ExecutionStatusBadge status={ex.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Git Issues & MRs */}
                  <div className="bg-[#161B24] border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                        Linked Git Issues & MRs ({defectDetail.gitLinks.length})
                      </h3>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => void openGitLinkModal()}
                          className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          Link Issue / MR
                        </button>
                      )}
                    </div>
                    {defectDetail.gitLinks.length === 0 ? (
                      <p className="text-xs text-gray-500">No Git issues or merge requests linked.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {defectDetail.gitLinks.map((gl) => (
                          <div
                            key={gl.id}
                            className="bg-[#0B0D10] border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 font-mono">
                                {gl.recordType}
                              </span>
                              <span className="text-white truncate">
                                #{gl.recordId} {gl.recordTitle || ''}
                              </span>
                            </div>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => void handleUnlinkGitRecord(gl.id)}
                                className="p-1 text-gray-400 hover:text-red-400"
                                title="Unlink"
                              >
                                <Unlink className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Attachments */}
                  <TestingAttachmentsPanel
                    projectId={projectId}
                    entityType="defect"
                    entityId={defectDetail.id}
                    attachments={defectDetail.attachments}
                    availableDocuments={meta?.projectDocuments || []}
                    canEdit={canManage}
                    title="Screenshots & Crash Logs"
                    onUpdated={() => void loadDefectDetail(defectDetail.id)}
                  />

                  {/* Activity Log */}
                  <div className="bg-[#161B24] border border-white/10 rounded-2xl p-4 space-y-2.5">
                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Activity Timeline
                    </h3>
                    {defectDetail.activities.length === 0 ? (
                      <p className="text-xs text-gray-500">No activity recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {defectDetail.activities.map((act) => (
                          <div
                            key={act.id}
                            className="flex items-center justify-between text-[11px] bg-[#0B0D10] border border-white/10 rounded-xl px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <UserAvatar user={act.actor} size="xs" />
                              <span className="text-gray-200 font-medium">{act.actor?.name || 'System'}</span>
                              <span className="text-gray-400">
                                {act.action.replace(/_/g, ' ')}
                                {act.field ? ` (${act.field}: ${act.previousValue || '—'} → ${act.newValue || '—'})` : ''}
                              </span>
                            </div>
                            <span className="text-gray-500">{formatTestingDate(act.createdAt)}</span>
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

      {/* Create / Edit Defect Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#12151B] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {editingDefect ? `Edit ${editingDefect.defectKey}` : 'Log Defect'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveDefect} className="p-5 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Title *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MasterOptionSelect
                  projectId={projectId}
                  category="defectSeverities"
                  label="Severity"
                  options={config?.defectSeverities || []}
                  value={form.severity}
                  onChange={(val) => setForm((p) => ({ ...p, severity: val }))}
                />
                <MasterOptionSelect
                  projectId={projectId}
                  category="priorities"
                  label="Priority"
                  options={config?.priorities || []}
                  value={form.priority}
                  onChange={(val) => setForm((p) => ({ ...p, priority: val }))}
                />
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Status</label>
                  <AnimatedSelect
                    options={DEFECT_STATUS_OPTIONS}
                    value={form.status}
                    onChange={(val) => setForm((p) => ({ ...p, status: val }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Assignee</label>
                  <AnimatedSelect
                    options={memberOptions}
                    value={form.assigneeId}
                    onChange={(val) => setForm((p) => ({ ...p, assigneeId: val }))}
                  />
                </div>
                <MasterOptionSelect
                  projectId={projectId}
                  category="environments"
                  label="Environment"
                  options={config?.environments || []}
                  value={form.environment}
                  onChange={(val) => setForm((p) => ({ ...p, environment: val }))}
                />
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Build Version</label>
                  <input
                    type="text"
                    value={form.buildVersion}
                    onChange={(e) => setForm((p) => ({ ...p, buildVersion: e.target.value }))}
                    className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Linked Dev Task</label>
                  <AnimatedSelect
                    options={devTaskOptions}
                    value={form.linkedDevTaskId}
                    onChange={(val) => setForm((p) => ({ ...p, linkedDevTaskId: val }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Linked Requirement</label>
                  <AnimatedSelect
                    options={requirementOptions}
                    value={form.linkedRequirementId}
                    onChange={(val) => setForm((p) => ({ ...p, linkedRequirementId: val }))}
                  />
                </div>
              </div>

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
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Steps to Reproduce</label>
                <textarea
                  rows={2}
                  value={form.stepsToReproduce}
                  onChange={(e) => setForm((p) => ({ ...p, stepsToReproduce: e.target.value }))}
                  className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Expected Result</label>
                  <textarea
                    rows={2}
                    value={form.expectedResult}
                    onChange={(e) => setForm((p) => ({ ...p, expectedResult: e.target.value }))}
                    className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Actual Result</label>
                  <textarea
                    rows={2}
                    value={form.actualResult}
                    onChange={(e) => setForm((p) => ({ ...p, actualResult: e.target.value }))}
                    className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
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
                  {saving ? 'Saving...' : editingDefect ? 'Save Changes' : 'Create Defect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Git Link Modal */}
      {gitLinkOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#12151B] border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Link Git Issue or Merge Request</h3>
              <button
                type="button"
                onClick={() => setGitLinkOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleLinkGitRecord} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Record Type</label>
                <AnimatedSelect
                  options={[
                    { value: 'issue', label: 'Git Issue' },
                    { value: 'merge_request', label: 'Merge Request' },
                  ]}
                  value={gitLinkType}
                  onChange={(val) => {
                    setGitLinkType(val as 'issue' | 'merge_request');
                    setGitRecordId('');
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  {gitLinkType === 'issue' ? 'Select Issue' : 'Select Merge Request'}
                </label>
                {gitOptionsLoading ? (
                  <div className="h-9 rounded-xl bg-white/5 animate-pulse" />
                ) : (
                  <AnimatedSelect
                    options={(gitLinkType === 'issue' ? gitIssues : gitMrs).map((item) => ({
                      value: String(item.iid || item.id),
                      label: `#${item.iid || item.id} — ${item.title || 'Untitled'}`,
                      sublabel: item.state,
                    }))}
                    value={gitRecordId}
                    onChange={setGitRecordId}
                    placeholder="Choose record..."
                  />
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setGitLinkOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs bg-white/5 text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!gitRecordId}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  Link Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DefectsView;
