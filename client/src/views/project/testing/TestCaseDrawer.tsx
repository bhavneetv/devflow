import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  Archive,
  Bug,
  Copy,
  Edit3,
  ExternalLink,
  History,
  Layers,
  ListChecks,
  Tag,
  X,
} from 'lucide-react';
import { testingService } from '../../../services/testing.service';
import { useToast } from '../../../context/ToastContext';
import { confirmDeleteSwal } from '../../../lib/confirmAlert';
import { UserAvatar } from '../../../components/common/UserAvatar';
import { TestingAttachmentsPanel } from '../../../components/testing/TestingAttachmentsPanel';
import { useTestingNavigation } from '../../../components/testing/TestingPageHeader';
import {
  DefectStatusBadge,
  ExecutionStatusBadge,
  TestCaseStatusBadge,
  TestTypeBadge,
  TestingPriorityBadge,
  TestingSeverityBadge,
  formatTestingDateTime,
} from '../../../components/testing/testingBadges';
import type {
  TestCaseDetail,
  TestingMetaData,
  TestingPermissions,
} from '../../../types/testing';

interface TestCaseDrawerProps {
  projectId: number;
  caseId: number | null;
  meta: TestingMetaData;
  permissions: TestingPermissions;
  onClose: () => void;
  onEdit: (detail: TestCaseDetail) => void;
  onDuplicated: (created: TestCaseDetail) => void;
  onArchived: (id: number) => void;
}

export const TestCaseDrawer: React.FC<TestCaseDrawerProps> = ({
  projectId,
  caseId,
  meta,
  permissions,
  onClose,
  onEdit,
  onDuplicated,
  onArchived,
}) => {
  const { toast } = useToast();
  const { goToSubmodule } = useTestingNavigation(projectId);
  const [detail, setDetail] = useState<TestCaseDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    const res = await testingService.getTestCaseDetail(projectId, caseId);
    if (res.success && res.data) {
      setDetail(res.data);
    } else {
      toast.error(res.error || 'Failed to load test case details');
    }
    setLoading(false);
  }, [projectId, caseId, toast]);

  useEffect(() => {
    if (caseId) {
      void loadDetail();
    } else {
      setDetail(null);
    }
  }, [caseId, loadDetail]);

  if (!caseId) return null;

  const handleDuplicate = async () => {
    if (!detail) return;
    const res = await testingService.duplicateTestCase(projectId, detail.id);
    if (res.success && res.data) {
      toast.success(`Duplicated as ${res.data.caseKey}`);
      onDuplicated(res.data);
    } else {
      toast.error(res.error || 'Failed to duplicate test case');
    }
  };

  const handleArchive = async () => {
    if (!detail) return;
    const confirmed = await confirmDeleteSwal({
      title: `${detail.isArchived ? 'Restore' : 'Archive'} ${detail.caseKey}?`,
      text: detail.isArchived
        ? 'Restoring makes this test case active in selectors and reports.'
        : 'Archiving hides this test case from active selectors while preserving all historical run records.',
      confirmText: detail.isArchived ? 'Restore' : 'Archive',
    });
    if (!confirmed) return;
    const res = await testingService.archiveTestCase(projectId, detail.id, !detail.isArchived);
    if (res.success) {
      toast.success(detail.isArchived ? 'Test case restored' : 'Test case archived');
      onArchived(detail.id);
    } else {
      toast.error(res.error || 'Failed to update archive status');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-[#0F1216] border-l border-white/10 h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-white/10 bg-[#13161B]">
          <div className="min-w-0">
            {detail ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-semibold text-emerald-400">{detail.caseKey}</span>
                <TestCaseStatusBadge status={detail.status} />
                <TestingPriorityBadge priority={detail.priority} />
                <TestTypeBadge testType={detail.testType} />
                {detail.isArchived && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-500/20 text-gray-300 border border-gray-500/30">
                    Archived
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-gray-400">Loading Test Case...</span>
            )}
            <h2 className="text-lg font-bold text-white truncate mt-1">
              {detail?.title || 'Test Case Details'}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {detail && permissions.canEditTestCases && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(detail)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] text-gray-200 border border-white/10 hover:bg-white/10"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void handleDuplicate()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] text-gray-200 border border-white/10 hover:bg-white/10"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Duplicate
                </button>
              </>
            )}
            {detail && permissions.canArchiveRecords && (
              <button
                type="button"
                onClick={() => void handleArchive()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20"
              >
                <Archive className="w-3.5 h-3.5" />
                {detail.isArchived ? 'Restore' : 'Archive'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/[0.06]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading || !detail ? (
            <div className="space-y-4">
              <div className="h-24 rounded-xl bg-[#13161B] animate-pulse" />
              <div className="h-44 rounded-xl bg-[#13161B] animate-pulse" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl bg-[#13161B] border border-white/10 p-4 text-xs">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Assigned Tester</div>
                  {detail.assignedTester ? (
                    <div className="flex items-center gap-2 text-white">
                      <UserAvatar user={detail.assignedTester} size="xs" />
                      <span>{detail.assignedTester.name}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400">Unassigned</span>
                  )}
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Module / Submodule</div>
                  <div className="text-gray-200">
                    {detail.module?.name || 'General'}
                    {detail.submodule ? ` / ${detail.submodule.name}` : ''}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Created / Updated</div>
                  <div className="text-gray-300">
                    {formatTestingDateTime(detail.createdAt)} • Updated {formatTestingDateTime(detail.updatedAt)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Linked Requirement</div>
                  {detail.linkedRequirement ? (
                    <span className="text-purple-300 font-medium">
                      {detail.linkedRequirement.code ? `${detail.linkedRequirement.code} — ` : ''}
                      {detail.linkedRequirement.title}
                    </span>
                  ) : (
                    <span className="text-gray-500">None</span>
                  )}
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Linked Dev Task</div>
                  {detail.linkedDevTask ? (
                    <span className="text-cyan-300 font-medium">
                      {detail.linkedDevTask.taskKey} — {detail.linkedDevTask.title}
                    </span>
                  ) : (
                    <span className="text-gray-500">None</span>
                  )}
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Labels</div>
                  {detail.labels.length > 0 ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {detail.labels.map((l) => (
                        <span
                          key={l}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-white/[0.06] text-gray-200 border border-white/10"
                        >
                          <Tag className="w-2.5 h-2.5 text-emerald-400" />
                          {l}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-500">None</span>
                  )}
                </div>
              </div>

              {(detail.description || detail.preconditions) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl bg-[#13161B] border border-white/10 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                      Description
                    </h3>
                    <p className="text-xs text-gray-200 whitespace-pre-wrap leading-relaxed">
                      {detail.description || 'No description provided.'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#13161B] border border-white/10 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                      Preconditions
                    </h3>
                    <p className="text-xs text-gray-200 whitespace-pre-wrap leading-relaxed">
                      {detail.preconditions || 'No preconditions specified.'}
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-[#13161B] border border-white/10 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-white">Test Steps ({detail.steps.length})</h3>
                  </div>
                </div>
                {detail.steps.length === 0 ? (
                  <p className="p-4 text-xs text-gray-500">No steps defined yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0B0D10]/70 text-gray-400 border-b border-white/10">
                        <tr>
                          <th className="px-4 py-2.5 w-14">#</th>
                          <th className="px-4 py-2.5">Action / Instruction</th>
                          <th className="px-4 py-2.5">Test Data / Input</th>
                          <th className="px-4 py-2.5">Expected Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {detail.steps.map((step, i) => (
                          <tr key={step.id || i} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3 font-mono text-emerald-400 align-top">
                              {step.stepNumber}
                            </td>
                            <td className="px-4 py-3 text-gray-100 whitespace-pre-wrap align-top">
                              {step.action}
                            </td>
                            <td className="px-4 py-3 text-gray-300 font-mono text-[11px] whitespace-pre-wrap align-top">
                              {step.testData || '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-200 whitespace-pre-wrap align-top">
                              {step.expectedResult || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl bg-[#13161B] border border-white/10 p-4 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-semibold text-white">
                      Test Suites ({detail.suites.length})
                    </h3>
                  </div>
                  {detail.suites.length === 0 ? (
                    <p className="text-xs text-gray-500">Not added to any test suite yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {detail.suites.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            onClose();
                            goToSubmodule('test-suites', { suiteId: s.id });
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#0B0D10]/70 border border-white/[0.06] hover:border-white/20 text-xs text-left"
                        >
                          <span className="text-white truncate">
                            <span className="font-mono text-blue-400 mr-2">{s.suiteKey}</span>
                            {s.name}
                          </span>
                          <ExternalLink className="w-3 h-3 text-gray-500 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-[#13161B] border border-white/10 p-4 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Bug className="w-4 h-4 text-rose-400" />
                    <h3 className="text-sm font-semibold text-white">
                      Linked Defects ({detail.linkedDefects.length})
                    </h3>
                  </div>
                  {detail.linkedDefects.length === 0 ? (
                    <p className="text-xs text-gray-500">No defects linked to this test case.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {detail.linkedDefects.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            onClose();
                            goToSubmodule('defects', { defectId: d.id });
                          }}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#0B0D10]/70 border border-white/[0.06] hover:border-white/20 text-xs text-left"
                        >
                          <span className="text-white truncate">
                            <span className="font-mono text-rose-400 mr-2">{d.defectKey}</span>
                            {d.title}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <TestingSeverityBadge severity={d.severity} />
                            <DefectStatusBadge status={d.status} />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-[#13161B] border border-white/10 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-semibold text-white">
                      Execution History ({detail.executionHistory.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-gray-500">Immutable point-in-time run snapshots</span>
                </div>
                {detail.executionHistory.length === 0 ? (
                  <p className="p-4 text-xs text-gray-500">This test case has not been executed yet.</p>
                ) : (
                  <div className="divide-y divide-white/[0.06]">
                    {detail.executionHistory.map((ex) => (
                      <div
                        key={ex.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 hover:bg-white/[0.02]"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {ex.run && (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  goToSubmodule(`test-runs/${ex.run!.id}`);
                                }}
                                className="text-xs font-mono font-semibold text-emerald-400 hover:underline"
                              >
                                {ex.run.runKey}
                              </button>
                            )}
                            <span className="text-xs font-medium text-white truncate">
                              {ex.run?.name || ex.caseTitleSnapshot}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px] text-gray-300">
                              Attempt #{ex.attemptNumber}
                            </span>
                            <ExecutionStatusBadge status={ex.status} />
                          </div>
                          <div className="text-[11px] text-gray-400">
                            Build: {ex.run?.buildVersion || '—'} • Env: {ex.run?.environment || '—'}
                            {ex.actualResult ? ` • Actual: ${ex.actualResult}` : ''}
                          </div>
                        </div>
                        <div className="text-[11px] text-gray-500 shrink-0">
                          {ex.executedBy?.name || 'Pending'} • {formatTestingDateTime(ex.completedAt || ex.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <TestingAttachmentsPanel
                projectId={projectId}
                entityType="test_case"
                entityId={detail.id}
                attachments={detail.attachments}
                availableDocuments={meta.projectDocuments}
                canEdit={permissions.canEditTestCases}
                onUpdated={() => void loadDetail()}
              />

              {detail.activities && detail.activities.length > 0 && (
                <div className="rounded-xl bg-[#13161B] border border-white/10 p-4 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-gray-400" />
                    <h3 className="text-sm font-semibold text-white">Activity</h3>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {detail.activities.map((act) => (
                      <div key={act.id} className="flex items-center justify-between gap-2 text-xs text-gray-300">
                        <span>
                          <span className="font-medium text-white">
                            {act.actor?.name || act.actor?.email || 'System'}
                          </span>{' '}
                          <span className="text-gray-400">
                            {act.action}
                            {act.newValue ? `: ${act.newValue}` : ''}
                          </span>
                        </span>
                        <span className="text-[11px] text-gray-500 shrink-0">
                          {formatTestingDateTime(act.createdAt)}
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
    </div>,
    document.body
  );
};
