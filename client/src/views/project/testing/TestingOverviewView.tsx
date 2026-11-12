import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertOctagon,
  ArrowRight,
  Ban,
  BarChart2,
  Bug,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileCheck2,
  Layers,
  PlayCircle,
  Plus,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { testingService } from '../../../services/testing.service';
import { useAccentTheme } from '../../../services/accentTheme.service';
import { useToast } from '../../../context/ToastContext';
import type { TestingOverviewData } from '../../../types/testing';
import { TestingPageHeader, useTestingNavigation } from '../../../components/testing/TestingPageHeader';
import {
  DefectStatusBadge,
  PlanRunStatusBadge,
  TestingSeverityBadge,
  formatTestingDate,
  formatTestingDateTime,
} from '../../../components/testing/testingBadges';
import { UserAvatar } from '../../../components/common/UserAvatar';

interface TestingOverviewViewProps {
  projectId?: number;
}

const STATUS_BAR_COLORS: Record<string, string> = {
  Passed: '#34D399',
  Failed: '#F87171',
  Blocked: '#FB923C',
  Skipped: '#A78BFA',
  'Not Run': '#64748B',
};

const SEVERITY_BAR_COLORS: Record<string, string> = {
  Critical: '#F87171',
  Major: '#FB923C',
  Moderate: '#FBBF24',
  Minor: '#60A5FA',
};

export const TestingOverviewView: React.FC<TestingOverviewViewProps> = ({ projectId: propProjectId }) => {
  const { id } = useParams<{ id: string }>();
  const projectId = propProjectId || Number(id);
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();
  const { goToSubmodule } = useTestingNavigation(projectId);

  const [data, setData] = useState<TestingOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    const res = await testingService.getOverview(projectId);
    if (res.success && res.data) {
      setData(res.data);
    } else {
      const msg = res.error || 'Failed to load Testing Overview';
      setError(msg);
      toast.error(msg);
    }
    setLoading(false);
  }, [projectId, toast]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const isEmpty =
    data &&
    data.summary.totalTestCases === 0 &&
    data.recentRuns.length === 0 &&
    data.recentDefects.length === 0 &&
    data.upcomingPlans.length === 0;

  const totalExecs = data
    ? data.summary.passedTests +
      data.summary.failedTests +
      data.summary.blockedTests +
      data.summary.skippedTests +
      data.summary.notRunTests
    : 0;
  const completedExecs = data ? totalExecs - data.summary.notRunTests : 0;
  const progressPct = totalExecs > 0 ? Math.round((completedExecs / totalExecs) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">
      <TestingPageHeader
        projectId={projectId}
        activeKey="testing-overview"
        title="Testing Overview"
        description="Real-time test coverage, latest execution results, defect pressure, and upcoming QA plans."
        icon={BarChart2}
        badge={data ? `Role: ${data.permissions.role}` : undefined}
        actions={
          <>
            <button
              type="button"
              onClick={() => void loadOverview()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[#13161B] text-gray-300 border border-white/10 hover:bg-white/[0.06]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {data?.permissions.canEditTestCases && (
              <button
                type="button"
                onClick={() => goToSubmodule('test-cases', { create: '1' })}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: accentColor }}
              >
                <Plus className="w-3.5 h-3.5" />
                Create Test Case
              </button>
            )}
          </>
        }
      />

      {loading && !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="h-28 rounded-2xl bg-[#13161B] border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : error && !data ? (
        <div className="rounded-2xl bg-[#13161B] border border-red-500/30 p-8 text-center space-y-3">
          <AlertOctagon className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-sm font-medium text-white">{error}</p>
          <button
            type="button"
            onClick={() => void loadOverview()}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 text-white hover:bg-white/15"
          >
            Try Again
          </button>
        </div>
      ) : data && isEmpty ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-br from-[#13161B] to-[#0F1216] border border-white/10 p-10 text-center max-w-3xl mx-auto space-y-5"
        >
          <div
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center border"
            style={{
              backgroundColor: `${accentColor}18`,
              borderColor: `${accentColor}40`,
              color: accentColor,
            }}
          >
            <FileCheck2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Launch QA for this project</h2>
            <p className="text-sm text-gray-400 max-w-xl mx-auto">
              Define reusable test cases with step-by-step instructions, organize suites, schedule test plans, execute test runs, and trace defects right alongside Requirements and Development tasks.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
            {data.permissions.canEditTestCases && (
              <button
                type="button"
                onClick={() => goToSubmodule('test-cases', { create: '1' })}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: accentColor }}
              >
                <Plus className="w-4 h-4" />
                Create Test Case
              </button>
            )}
            {data.permissions.canManagePlansSuites && (
              <button
                type="button"
                onClick={() => goToSubmodule('test-plans', { create: '1' })}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#181C22] text-gray-200 border border-white/10 hover:bg-white/[0.06]"
              >
                <ClipboardList className="w-4 h-4 text-emerald-400" />
                Create Test Plan
              </button>
            )}
            {data.permissions.canManageDefects && (
              <button
                type="button"
                onClick={() => goToSubmodule('defects', { create: '1' })}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#181C22] text-gray-200 border border-white/10 hover:bg-white/[0.06]"
              >
                <Bug className="w-4 h-4 text-rose-400" />
                Report Defect
              </button>
            )}
          </div>
        </motion.div>
      ) : data ? (
        <>
          {/* 8 Clickable Database-Backed KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Total Test Cases',
                value: data.summary.totalTestCases,
                sub: 'Active reusable definitions',
                icon: FileCheck2,
                color: '#60A5FA',
                onClick: () => goToSubmodule('test-cases'),
              },
              {
                label: 'Passed Tests',
                value: data.summary.passedTests,
                sub: 'Latest execution results',
                icon: CheckCircle2,
                color: '#34D399',
                onClick: () => goToSubmodule('test-runs', { execStatus: 'Passed' }),
              },
              {
                label: 'Failed Tests',
                value: data.summary.failedTests,
                sub: 'Requires defect triage',
                icon: XCircle,
                color: '#F87171',
                onClick: () => goToSubmodule('test-runs', { execStatus: 'Failed' }),
              },
              {
                label: 'Not Run',
                value: data.summary.notRunTests,
                sub: 'Pending in active runs',
                icon: Clock,
                color: '#94A3B8',
                onClick: () => goToSubmodule('test-runs', { execStatus: 'Not Run' }),
              },
              {
                label: 'Blocked Tests',
                value: data.summary.blockedTests,
                sub: 'Environment / dependency block',
                icon: Ban,
                color: '#FB923C',
                onClick: () => goToSubmodule('test-runs', { execStatus: 'Blocked' }),
              },
              {
                label: 'Open Defects',
                value: data.summary.openDefects,
                sub: 'Open / In Progress / Reopened',
                icon: Bug,
                color: '#F43F5E',
                onClick: () => goToSubmodule('defects', { status: 'Open' }),
              },
              {
                label: 'Critical Defects',
                value: data.summary.criticalDefects,
                sub: 'Unclosed critical severity',
                icon: ShieldAlert,
                color: '#EF4444',
                onClick: () => goToSubmodule('defects', { severity: 'Critical' }),
              },
              {
                label: 'Overall Pass Rate',
                value: data.summary.overallPassRate !== null ? `${data.summary.overallPassRate}%` : 'N/A',
                sub: 'Passed / (Passed + Failed)',
                icon: TrendingUp,
                color: '#2DD4BF',
                onClick: () => goToSubmodule('test-reports'),
              },
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.button
                  key={card.label}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={card.onClick}
                  className="group text-left rounded-2xl bg-[#13161B] border border-white/10 hover:border-white/25 p-4 transition-all hover:bg-[#161A20]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400">{card.label}</span>
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${card.color}18`, color: card.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-white tracking-tight">{card.value}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-300 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">{card.sub}</p>
                </motion.button>
              );
            })}
          </div>

          {/* Execution Progress & Groupings */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 rounded-2xl bg-[#13161B] border border-white/10 p-5 space-y-5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h2 className="text-sm font-semibold text-white">Test Execution Progress &amp; Results by Status</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {completedExecs} of {totalExecs} latest run executions completed ({progressPct}%)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => goToSubmodule('test-runs')}
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                >
                  Open Test Runs <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="h-3.5 rounded-full bg-white/[0.06] overflow-hidden flex">
                {data.resultsByStatus.map((row) => {
                  const pct = totalExecs > 0 ? (row.count / totalExecs) * 100 : 0;
                  if (pct <= 0) return null;
                  return (
                    <motion.div
                      key={row.status}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      title={`${row.status}: ${row.count} (${pct.toFixed(1)}%)`}
                      style={{ backgroundColor: row.color || STATUS_BAR_COLORS[row.status] || '#64748B' }}
                    />
                  );
                })}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {data.resultsByStatus.map((row) => {
                  const color = row.color || STATUS_BAR_COLORS[row.status] || '#94A3B8';
                  const pct = totalExecs > 0 ? Math.round((row.count / totalExecs) * 100) : 0;
                  return (
                    <button
                      key={row.status}
                      type="button"
                      onClick={() => goToSubmodule('test-runs', { execStatus: row.status })}
                      className="rounded-xl bg-[#0B0D10]/80 border border-white/[0.07] hover:border-white/20 p-3 text-left transition-colors"
                    >
                      <div className="flex items-center gap-1.5 text-xs text-gray-300">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="truncate">{row.status}</span>
                      </div>
                      <div className="mt-1.5 flex items-baseline justify-between">
                        <span className="text-lg font-bold text-white">{row.count}</span>
                        <span className="text-[11px] text-gray-500">{pct}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-[#13161B] border border-white/10 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Defects by Severity</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Active &amp; reported defect distribution</p>
                </div>
                <button
                  type="button"
                  onClick={() => goToSubmodule('defects')}
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
                >
                  View all
                </button>
              </div>
              <div className="space-y-3">
                {(() => {
                  const maxSev = Math.max(1, ...data.defectsBySeverity.map((d) => d.count));
                  return data.defectsBySeverity.map((row) => {
                    const color = row.color || SEVERITY_BAR_COLORS[row.severity] || '#94A3B8';
                    return (
                      <button
                        key={row.severity}
                        type="button"
                        onClick={() => goToSubmodule('defects', { severity: row.severity })}
                        className="w-full text-left group"
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-300 group-hover:text-white">{row.severity}</span>
                          <span className="font-semibold text-white">{row.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(row.count / maxSev) * 100}%` }}
                            transition={{ duration: 0.5 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        </div>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* Recent Runs, Upcoming Plans, Recent Defects */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="rounded-2xl bg-[#13161B] border border-white/10 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlayCircle className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-white">Recent Test Runs</h2>
                </div>
                <button
                  type="button"
                  onClick={() => goToSubmodule('test-runs')}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  All Runs
                </button>
              </div>
              {data.recentRuns.length === 0 ? (
                <p className="text-xs text-gray-500 py-6 text-center">No test runs started yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.recentRuns.map((run) => (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => goToSubmodule(`test-runs/${run.id}`)}
                      className="w-full text-left rounded-xl bg-[#0B0D10]/70 border border-white/[0.07] hover:border-white/20 p-3 transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-emerald-400">{run.runKey}</span>
                        <PlanRunStatusBadge status={run.status} />
                      </div>
                      <div className="text-xs font-medium text-white truncate">{run.name}</div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span>
                          {run.stats.passed}P / {run.stats.failed}F / {run.stats.total} Total
                        </span>
                        <span>{run.stats.passRate !== null ? `${run.stats.passRate}% Pass` : 'Not Run'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-[#13161B] border border-white/10 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <h2 className="text-sm font-semibold text-white">Upcoming Test Plans</h2>
                </div>
                <button
                  type="button"
                  onClick={() => goToSubmodule('test-plans')}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  All Plans
                </button>
              </div>
              {data.upcomingPlans.length === 0 ? (
                <p className="text-xs text-gray-500 py-6 text-center">No active or upcoming plans.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.upcomingPlans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => goToSubmodule('test-plans', { planId: plan.id })}
                      className="w-full text-left rounded-xl bg-[#0B0D10]/70 border border-white/[0.07] hover:border-white/20 p-3 transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-blue-400">{plan.planKey}</span>
                        <PlanRunStatusBadge status={plan.status} />
                      </div>
                      <div className="text-xs font-medium text-white truncate">{plan.title}</div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span>{plan.targetEnvironment || 'No env'} • {plan.targetVersion || 'Any build'}</span>
                        <span>Due {formatTestingDate(plan.dueDate)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-[#13161B] border border-white/10 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bug className="w-4 h-4 text-rose-400" />
                  <h2 className="text-sm font-semibold text-white">Recent Defects</h2>
                </div>
                <button
                  type="button"
                  onClick={() => goToSubmodule('defects')}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  All Defects
                </button>
              </div>
              {data.recentDefects.length === 0 ? (
                <p className="text-xs text-gray-500 py-6 text-center">No defects reported.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.recentDefects.map((def) => (
                    <button
                      key={def.id}
                      type="button"
                      onClick={() => goToSubmodule('defects', { defectId: def.id })}
                      className="w-full text-left rounded-xl bg-[#0B0D10]/70 border border-white/[0.07] hover:border-white/20 p-3 transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-rose-400">{def.defectKey}</span>
                        <div className="flex items-center gap-1.5">
                          <TestingSeverityBadge severity={def.severity} />
                          <DefectStatusBadge status={def.status} />
                        </div>
                      </div>
                      <div className="text-xs font-medium text-white truncate">{def.title}</div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span className="inline-flex items-center gap-1.5">
                          {def.assignee ? (
                            <>
                              <UserAvatar user={def.assignee} size="xs" />
                              {def.assignee.name}
                            </>
                          ) : (
                            'Unassigned'
                          )}
                        </span>
                        <span>{formatTestingDateTime(def.createdAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Requirement & Dev Task Coverage */}
          {(data.requirementCoverage.items.length > 0 || data.devTaskCoverage.items.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {data.requirementCoverage.items.length > 0 && (
                <div className="rounded-2xl bg-[#13161B] border border-white/10 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-purple-400" />
                      <h2 className="text-sm font-semibold text-white">Test Coverage by Requirement</h2>
                    </div>
                    {data.requirementCoverage.coveragePercent !== null && (
                      <span className="text-xs font-semibold text-purple-300">
                        {data.requirementCoverage.coveragePercent}% requirements covered
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {data.requirementCoverage.items.map((req) => (
                      <button
                        key={req.id}
                        type="button"
                        onClick={() => goToSubmodule('test-cases', { linkedRequirementId: req.id })}
                        className="w-full flex items-center justify-between gap-3 rounded-xl bg-[#0B0D10]/70 border border-white/[0.07] hover:border-white/20 px-3 py-2.5 text-left transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-white truncate">
                            {req.code ? `${req.code} — ` : ''}
                            {req.title}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            {req.testCasesCount} cases • {req.passedCount} passed • {req.failedCount} failed •{' '}
                            {req.openDefectsCount} open defects
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {data.devTaskCoverage.items.length > 0 && (
                <div className="rounded-2xl bg-[#13161B] border border-white/10 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-cyan-400" />
                      <h2 className="text-sm font-semibold text-white">Test Coverage by Development Task</h2>
                    </div>
                    {data.devTaskCoverage.coveragePercent !== null && (
                      <span className="text-xs font-semibold text-cyan-300">
                        {data.devTaskCoverage.coveragePercent}% tasks covered
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {data.devTaskCoverage.items.map((dt) => (
                      <button
                        key={dt.id}
                        type="button"
                        onClick={() => goToSubmodule('test-cases', { linkedDevTaskId: dt.id })}
                        className="w-full flex items-center justify-between gap-3 rounded-xl bg-[#0B0D10]/70 border border-white/[0.07] hover:border-white/20 px-3 py-2.5 text-left transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-cyan-400">{dt.taskKey}</span>
                            <span className="text-xs font-medium text-white truncate">{dt.title}</span>
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            {dt.status} • {dt.testCasesCount} linked test cases
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 border ${
                            dt.defectsCount > 0
                              ? 'bg-red-500/15 text-red-300 border-red-500/35'
                              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                          }`}
                        >
                          {dt.defectsCount} defects
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};
