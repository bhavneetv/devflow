import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Download,
  Filter,
  Info,
  PieChart,
  RefreshCw,
} from 'lucide-react';
import { useAccentTheme } from '../../../services/accentTheme.service';
import { useToast } from '../../../context/ToastContext';
import { AnimatedSelect } from '../../../components/settings/AnimatedSelect';
import { CustomDatePicker } from '../../../components/settings/CustomDatePicker';
import {
  TestingPageHeader,
  useTestingNavigation,
} from '../../../components/testing/TestingPageHeader';
import {
  TestingPriorityBadge,
  TestingSeverityBadge,
} from '../../../components/testing/testingBadges';
import { testingService } from '../../../services/testing.service';
import type { TestingPermissions, TestingReportsData } from '../../../types/testing';

interface TestReportsViewProps {
  projectId?: number;
}

export const TestReportsView: React.FC<TestReportsViewProps> = ({ projectId: propProjectId }) => {
  const { id } = useParams<{ id: string }>();
  const projectId = propProjectId || Number(id);
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();
  const { goToSubmodule } = useTestingNavigation(projectId);

  const [permissions, setPermissions] = useState<TestingPermissions | null>(null);
  const [report, setReport] = useState<TestingReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [planId, setPlanId] = useState('ALL');
  const [buildVersion, setBuildVersion] = useState('ALL');
  const [environment, setEnvironment] = useState('ALL');
  const [testerId, setTesterId] = useState('ALL');
  const [testType, setTestType] = useState('ALL');

  const queryParams = useMemo(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      planId: planId !== 'ALL' ? Number(planId) : undefined,
      buildVersion: buildVersion !== 'ALL' ? buildVersion : undefined,
      environment: environment !== 'ALL' ? environment : undefined,
      testerId: testerId !== 'ALL' ? Number(testerId) : undefined,
      testType: testType !== 'ALL' ? testType : undefined,
    }),
    [startDate, endDate, planId, buildVersion, environment, testerId, testType]
  );

  const loadReports = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [metaRes, repRes] = await Promise.all([
        testingService.getMeta(projectId),
        testingService.getReports(projectId, queryParams),
      ]);
      if (metaRes.success && metaRes.data) setPermissions(metaRes.data.permissions);
      if (repRes.success && repRes.data) setReport(repRes.data);
    } catch {
      toast.error('Failed to load QA reports');
    } finally {
      setLoading(false);
    }
  }, [projectId, queryParams, toast]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await testingService.downloadReportsCsv(projectId, queryParams);
      toast.success('Report exported as CSV');
    } catch {
      toast.error('Failed to export CSV report');
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setPlanId('ALL');
    setBuildVersion('ALL');
    setEnvironment('ALL');
    setTesterId('ALL');
    setTestType('ALL');
  };

  const canViewReports = permissions?.canViewReports ?? true;

  if (!loading && permissions && !canViewReports) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        <TestingPageHeader
          projectId={projectId}
          activeKey="test-reports"
          icon={PieChart}
          title="Test Reports & Analytics"
          description="Quality metrics, release pass rates, defect trends, and traceability coverage."
        />
        <div className="bg-[#12151B] border border-white/10 rounded-2xl p-10 text-center text-xs text-gray-400">
          Your role does not currently have permission to view Test Reports. Contact a Project Admin in Testing Settings.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1680px] mx-auto space-y-6">
      <TestingPageHeader
        projectId={projectId}
        activeKey="test-reports"
        icon={PieChart}
        title="Test Reports & Analytics"
        description="Real database-backed quality telemetry across test runs, requirements, builds, testers, and defect severity."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadReports()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              type="button"
              disabled={exporting || !report}
              onClick={() => void handleExportCsv()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-lg"
              style={{ backgroundColor: accentColor }}
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="bg-[#12151B] border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            Report Filters
          </span>
          <button
            type="button"
            onClick={resetFilters}
            className="text-[11px] text-gray-400 hover:text-white"
          >
            Reset All
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          <div>
            <label className="block text-[10px] text-gray-400 mb-1">From Date</label>
            <CustomDatePicker value={startDate} onChange={setStartDate} presetMode="start" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 mb-1">To Date</label>
            <CustomDatePicker value={endDate} onChange={setEndDate} presetMode="end" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 mb-1">Test Plan</label>
            <AnimatedSelect
              options={[
                { value: 'ALL', label: 'All Plans' },
                ...(report?.filterChoices.plans || []).map((p) => ({
                  value: String(p.id),
                  label: `${p.planKey} — ${p.title}`,
                })),
              ]}
              value={planId}
              onChange={setPlanId}
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 mb-1">Build Version</label>
            <AnimatedSelect
              options={[
                { value: 'ALL', label: 'All Builds' },
                ...(report?.filterChoices.builds || []).map((b) => ({ value: b, label: b })),
              ]}
              value={buildVersion}
              onChange={setBuildVersion}
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 mb-1">Environment</label>
            <AnimatedSelect
              options={[
                { value: 'ALL', label: 'All Environments' },
                ...(report?.filterChoices.environments || []).map((env) => ({
                  value: env,
                  label: env,
                })),
              ]}
              value={environment}
              onChange={setEnvironment}
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 mb-1">Tester</label>
            <AnimatedSelect
              options={[
                { value: 'ALL', label: 'All Testers' },
                ...(report?.filterChoices.testers || []).map((t) => ({
                  value: String(t.id),
                  label: t.name,
                })),
              ]}
              value={testerId}
              onChange={setTesterId}
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 mb-1">Test Type</label>
            <AnimatedSelect
              options={[
                { value: 'ALL', label: 'All Types' },
                ...(report?.filterChoices.testTypes || []).map((t) => ({ value: t, label: t })),
              ]}
              value={testType}
              onChange={setTestType}
            />
          </div>
        </div>
      </div>

      {loading || !report ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-[#12151B] border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Transparent Metric Formula Note */}
          <div className="bg-indigo-500/10 border border-indigo-500/25 rounded-2xl p-4 flex items-start gap-3 text-xs text-indigo-200">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Rate Calculation Methodology</p>
              <p className="text-indigo-200/85">
                {report.formula.passRateFormula} · {report.formula.failRateFormula}. {report.formula.note}
              </p>
            </div>
          </div>

          {/* Summary KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-[#12151B] border border-white/10 rounded-2xl p-4">
              <p className="text-[11px] text-gray-400">Latest Executions</p>
              <p className="text-2xl font-bold text-white mt-1">{report.summary.totalLatestExecutions}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {report.summary.completedEligibleExecutions} completed
              </p>
            </div>
            <div className="bg-[#12151B] border border-white/10 rounded-2xl p-4">
              <p className="text-[11px] text-emerald-400">Pass Rate</p>
              <p className="text-2xl font-bold text-emerald-300 mt-1">{report.summary.passRate}%</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {report.summary.passedExecutions} passed
              </p>
            </div>
            <div className="bg-[#12151B] border border-white/10 rounded-2xl p-4">
              <p className="text-[11px] text-rose-400">Fail Rate</p>
              <p className="text-2xl font-bold text-rose-300 mt-1">{report.summary.failRate}%</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {report.summary.failedExecutions} failed
              </p>
            </div>
            <div className="bg-[#12151B] border border-white/10 rounded-2xl p-4">
              <p className="text-[11px] text-amber-400">Blocked / Not Run</p>
              <p className="text-2xl font-bold text-amber-300 mt-1">
                {report.summary.blockedExecutions} / {report.summary.notRunExecutions}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {report.summary.skippedExecutions} skipped
              </p>
            </div>
            <div
              onClick={() => goToSubmodule('defects', { status: 'Open' })}
              className="bg-[#12151B] border border-white/10 hover:border-white/25 rounded-2xl p-4 cursor-pointer"
            >
              <p className="text-[11px] text-gray-400">Open Defects</p>
              <p className="text-2xl font-bold text-white mt-1">{report.summary.openDefects}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                of {report.summary.totalDefects} total
              </p>
            </div>
            <div
              onClick={() => goToSubmodule('defects', { severity: 'Critical' })}
              className="bg-[#12151B] border border-white/10 hover:border-white/25 rounded-2xl p-4 cursor-pointer"
            >
              <p className="text-[11px] text-rose-400">Critical Defects</p>
              <p className="text-2xl font-bold text-rose-300 mt-1">{report.summary.criticalDefects}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Click to triage</p>
            </div>
          </div>

          {/* Breakdowns Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Results by Test Type */}
            <div className="bg-[#12151B] border border-white/10 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">Execution Breakdown by Test Type</h3>
              {report.byTestType.length === 0 ? (
                <p className="text-xs text-gray-500">No execution data matching filters.</p>
              ) : (
                <div className="space-y-3">
                  {report.byTestType.map((row) => (
                    <div key={row.testType} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-white">{row.testType}</span>
                        <span className="text-gray-400">
                          {row.passed}P · {row.failed}F · {row.blocked}B · {row.notRun}NR (
                          <span className="text-emerald-400 font-semibold">{row.passRate}%</span>)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden flex">
                        {row.total > 0 && (
                          <>
                            <div
                              className="bg-emerald-500"
                              style={{ width: `${(row.passed / row.total) * 100}%` }}
                            />
                            <div
                              className="bg-rose-500"
                              style={{ width: `${(row.failed / row.total) * 100}%` }}
                            />
                            <div
                              className="bg-amber-500"
                              style={{ width: `${(row.blocked / row.total) * 100}%` }}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Defects by Severity & Status */}
            <div className="bg-[#12151B] border border-white/10 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">Defects Breakdown & Priority Matrix</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase">By Severity</p>
                  {report.defectsBySeverity.length === 0 ? (
                    <p className="text-xs text-gray-500">No defects recorded.</p>
                  ) : (
                    report.defectsBySeverity.map((s) => (
                      <div
                        key={s.severity}
                        className="flex items-center justify-between bg-[#0B0D10] border border-white/10 rounded-xl px-3 py-2"
                      >
                        <TestingSeverityBadge severity={s.severity} />
                        <span className="text-xs font-semibold text-white">{s.count}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase">By Priority</p>
                  {report.byPriority.length === 0 ? (
                    <p className="text-xs text-gray-500">No executions by priority.</p>
                  ) : (
                    report.byPriority.map((p) => (
                      <div
                        key={p.priority}
                        className="flex items-center justify-between bg-[#0B0D10] border border-white/10 rounded-xl px-3 py-2 text-xs"
                      >
                        <TestingPriorityBadge priority={p.priority} />
                        <span className="text-emerald-400 font-semibold">
                          {p.passRate}% ({p.passed}/{p.total})
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Builds & Regression Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="bg-[#12151B] border border-white/10 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Regression Summary</h3>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-[#0B0D10] border border-white/10 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400">Regression Suites</p>
                  <p className="text-lg font-bold text-white">{report.regressionSummary.regressionSuitesCount}</p>
                </div>
                <div className="bg-[#0B0D10] border border-white/10 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400">Regression Cases</p>
                  <p className="text-lg font-bold text-white">{report.regressionSummary.regressionCasesCount}</p>
                </div>
                <div className="bg-[#0B0D10] border border-white/10 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400">Regression Runs</p>
                  <p className="text-lg font-bold text-white">{report.regressionSummary.regressionRunsCount}</p>
                </div>
                <div className="bg-[#0B0D10] border border-white/10 rounded-xl p-3">
                  <p className="text-[10px] text-emerald-400">Pass Rate</p>
                  <p className="text-lg font-bold text-emerald-300">{report.regressionSummary.passRate}%</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-[#12151B] border border-white/10 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Results by Build / Environment</h3>
              {report.byBuildOrRelease.length === 0 ? (
                <p className="text-xs text-gray-500">No release build data yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[11px] text-gray-400">
                        <th className="py-2 pr-3">Build</th>
                        <th className="py-2 px-3">Env</th>
                        <th className="py-2 px-3">Runs</th>
                        <th className="py-2 px-3">Passed / Failed</th>
                        <th className="py-2 pl-3 text-right">Pass Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {report.byBuildOrRelease.map((row, idx) => (
                        <tr key={`${row.buildVersion}-${row.environment}-${idx}`}>
                          <td className="py-2.5 pr-3 font-mono text-white">{row.buildVersion || '—'}</td>
                          <td className="py-2.5 px-3 text-gray-300">{row.environment || 'Default'}</td>
                          <td className="py-2.5 px-3 text-gray-300">{row.runsCount}</td>
                          <td className="py-2.5 px-3 text-gray-300">
                            <span className="text-emerald-400">{row.passed}P</span> /{' '}
                            <span className="text-rose-400">{row.failed}F</span> ({row.total})
                          </td>
                          <td className="py-2.5 pl-3 text-right font-semibold text-emerald-300">
                            {row.passRate}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Execution by Tester & Requirement Coverage */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-[#12151B] border border-white/10 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Tester Execution Summary</h3>
              {report.executionByTester.length === 0 ? (
                <p className="text-xs text-gray-500">No tester execution data recorded.</p>
              ) : (
                <div className="space-y-2">
                  {report.executionByTester.map((t) => (
                    <div
                      key={t.testerId ?? t.testerName}
                      className="bg-[#0B0D10] border border-white/10 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-white">{t.testerName}</span>
                      <span className="text-gray-400">
                        {t.passed}P · {t.failed}F · {t.blocked}B ({t.total}) —{' '}
                        <strong className="text-emerald-400">{t.passRate}%</strong>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#12151B] border border-white/10 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Requirement Test Coverage</h3>
              {report.requirementCoverage.length === 0 ? (
                <p className="text-xs text-gray-500">
                  Link requirements to Test Cases or Plans to populate traceability coverage.
                </p>
              ) : (
                <div className="space-y-2">
                  {report.requirementCoverage.map((req) => (
                    <div
                      key={req.id}
                      className="bg-[#0B0D10] border border-white/10 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs gap-3"
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-emerald-300 mr-2">{req.code}</span>
                        <span className="text-white truncate">{req.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-[11px]">
                        <span className="text-gray-300">{req.linkedCases} cases</span>
                        <span className="text-emerald-400">{req.passed}P</span>
                        <span className="text-rose-400">{req.failed}F</span>
                        {req.defects > 0 && <span className="text-amber-300">{req.defects} bugs</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Plan Progress */}
          {report.planProgress.length > 0 && (
            <div className="bg-[#12151B] border border-white/10 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Test Plan Progress</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {report.planProgress.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => goToSubmodule('test-plans')}
                    className="bg-[#0B0D10] border border-white/10 hover:border-white/25 rounded-xl p-3.5 cursor-pointer space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-emerald-300">{pl.planKey}</span>
                      <span className="text-gray-400">{pl.status}</span>
                    </div>
                    <p className="text-xs font-medium text-white truncate">{pl.title}</p>
                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                      <span>{pl.targetVersion || 'All Builds'}</span>
                      <span className="text-emerald-400 font-semibold">
                        {pl.passRate}% ({pl.passed}/{pl.totalCases})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TestReportsView;
