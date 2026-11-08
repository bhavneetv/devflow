import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { apiUrl } from '../config/api';
import { ProjectOverviewSkeleton } from '../components/project/overview/ProjectOverviewSkeleton';
import { ProjectOverviewHeader, OverviewTab } from '../components/project/overview/ProjectOverviewHeader';
import { ProjectStatCard } from '../components/project/overview/ProjectStatCard';
import { ProjectProgressCard } from '../components/project/overview/ProjectProgressCard';
import { SprintBurndownChart } from '../components/project/overview/SprintBurndownChart';
import { TeamVelocityChart } from '../components/project/overview/TeamVelocityChart';
import { TestResultsDonut } from '../components/project/overview/TestResultsDonut';
import { DefectTrendChart } from '../components/project/overview/DefectTrendChart';
import { TeamLeaderboardCard } from '../components/project/overview/TeamLeaderboardCard';
import { RecentTasksCard } from '../components/project/overview/RecentTasksCard';
import { ProjectActivityFeed } from '../components/project/overview/ProjectActivityFeed';
import { UpcomingDeadlinesCard } from '../components/project/overview/UpcomingDeadlinesCard';
import { ProjectRoadmapView } from '../components/project/overview/ProjectRoadmapView';
import { ProjectHealthPanel } from '../components/project/overview/ProjectHealthPanel';
import { TeamWorkloadView } from '../components/project/overview/TeamWorkloadView';
import { RequirementTraceabilityView } from '../components/project/overview/RequirementTraceabilityView';
import { ReleaseReadinessPanel } from '../components/project/overview/ReleaseReadinessPanel';

export const ProjectDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectProject, exitProjectMode, isProjectLoading } = useNavigation();
  const shouldReduceMotion = useReducedMotion();

  const [overviewData, setOverviewData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [illustrativeOverride, setIllustrativeOverride] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<OverviewTab>('overview');
  const [dateRange, setDateRange] = useState<string>('30d');

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const targetId = id || '1';
      const url = apiUrl(
        `/projects/${targetId}/overview?illustrative=${illustrativeOverride}`
      );
      const res = await fetch(url);
      const json = await res.json();

      if (json.success && json.data) {
        setOverviewData(json.data);
        // Keep NavigationContext in sync
        selectProject({
          id: json.data.project.id,
          title: json.data.project.title,
          status: json.data.project.status,
        });
      } else {
        setError(json.error || 'Failed to load project command center');
      }
    } catch (err: any) {
      console.error('Project Overview fetch error:', err);
      setError(err.message || 'Network error while loading project overview');
    } finally {
      setLoading(false);
    }
  }, [id, illustrativeOverride, selectProject]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  if ((loading || isProjectLoading) && !overviewData) {
    return <ProjectOverviewSkeleton />;
  }

  if (error && !overviewData) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 text-center rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
          <AlertCircle size={22} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Project Overview Unavailable</h2>
          <p className="text-xs text-zinc-400 mt-1">{error}</p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={fetchOverview}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Retry</span>
          </button>
          <button
            onClick={() => exitProjectMode()}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 border border-zinc-700 transition-colors cursor-pointer"
          >
            Back to Workspace
          </button>
        </div>
      </div>
    );
  }

  if (!overviewData) {
    return (
      <div className="p-8 text-center text-zinc-500 text-xs">
        <p>Project not found.</p>
        <button
          onClick={() => exitProjectMode()}
          className="mt-3 px-3 py-1.5 rounded bg-zinc-800 text-white cursor-pointer"
        >
          Back to Workspace
        </button>
      </div>
    );
  }

  const {
    project,
    stats,
    progressBars,
    burndown,
    velocity,
    testResults,
    recentTasks,
    activity,
    deadlines,
    healthIntelligence,
    roadmap,
    teamWorkload,
    traceability,
    releaseReadiness,
    analyticsTrends,
  } = overviewData;

  // Health display config
  const getHealthConfig = () => {
    switch (stats.health) {
      case 'CRITICAL':
        return {
          title: 'Critical',
          color: 'text-red-400',
          badgeColor: 'bg-red-500/10 text-red-400 border-red-500/30',
        };
      case 'AT_RISK':
        return {
          title: 'At Risk',
          color: 'text-amber-400',
          badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        };
      case 'HEALTHY':
      default:
        return {
          title: 'Healthy',
          color: 'text-emerald-400',
          badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        };
    }
  };

  const healthConfig = getHealthConfig();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. Header Card with integrated Tab Navigation & Date Filter */}
      <ProjectOverviewHeader
        project={project}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        isIllustrativeActive={illustrativeOverride}
        onToggleIllustrative={() => setIllustrativeOverride((prev) => !prev)}
        onExitProject={() => exitProjectMode()}
        onOpenInviteModal={() => {
          navigate(`/projects/${project.id}/settings`);
        }}
        blockerCount={stats.blockers}
        riskCount={healthIntelligence?.risks?.length || 0}
        unlinkedReqCount={traceability?.unlinkedCount || 0}
      />

      {/* 2. Dynamic Content Based on Active Tab */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="tab-overview"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* 6 Top Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Card 1: Progress */}
              <ProjectStatCard
                title="Progress"
                value={`${stats.progressPct}%`}
                subText={`${stats.doneUnits} of ${stats.totalUnits} units`}
                progressPct={stats.progressPct}
                progressColor="bg-blue-500"
                delayMs={0}
              />

              {/* Card 2: Requirements */}
              <ProjectStatCard
                title="Requirements"
                value={stats.requirementCount}
                subText={`${stats.approvedRequirements} approved`}
                subTextColor="text-purple-400"
                progressPct={
                  stats.requirementCount > 0
                    ? Math.round((stats.approvedRequirements / stats.requirementCount) * 100)
                    : 0
                }
                progressColor="bg-purple-500"
                delayMs={80}
              />

              {/* Card 3: Tasks */}
              <ProjectStatCard
                title="Tasks"
                value={stats.taskCount}
                subText={stats.blockedTasks > 0 ? `${stats.blockedTasks} blocked` : '0 blocked'}
                subTextColor={
                  stats.blockedTasks > 0 ? 'text-amber-400 font-semibold' : 'text-zinc-400'
                }
                delayMs={160}
              />

              {/* Card 4: Sprint */}
              {stats.activeSprint ? (
                <ProjectStatCard
                  title={stats.activeSprint.name}
                  value={`${stats.activeSprint.pct}%`}
                  subText={`${stats.activeSprint.daysLeft} days left`}
                  progressPct={stats.activeSprint.pct}
                  progressColor="bg-cyan-500"
                  delayMs={240}
                />
              ) : (
                <ProjectStatCard
                  title="Sprint"
                  value="Backlog"
                  subText="No active sprint"
                  subTextColor="text-zinc-500"
                  delayMs={240}
                />
              )}

              {/* Card 5: Team */}
              <ProjectStatCard
                title="Team"
                value={stats.teamCount}
                subText={`${stats.availableMembers} available`}
                subTextColor="text-zinc-300"
                delayMs={320}
              />

              {/* Card 6: Health */}
              <ProjectStatCard
                title="Health"
                value={healthConfig.title}
                subText={
                  stats.blockers > 0
                    ? `${stats.blockers} blocker${stats.blockers > 1 ? 's' : ''}`
                    : stats.healthReasons?.[0] || 'On track'
                }
                subTextColor={healthConfig.color}
                badge={stats.health}
                badgeColor={healthConfig.badgeColor}
                delayMs={400}
              />
            </div>

            {/* Two-Column Command Center Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* LEFT COLUMN (2/3 width) */}
              <div className="lg:col-span-2 space-y-6">
                {/* A. Project Progress Card */}
                <ProjectProgressCard
                  progressBars={progressBars}
                  showIllustrativeTag={illustrativeOverride}
                />

                {/* B. Live Project Analytics Section (4 cards in responsive grid) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Live Project Analytics & Velocity
                    </h2>
                    <span className="text-[11px] text-zinc-500">Real-time metrics & trends</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SprintBurndownChart
                      data={burndown}
                      isIllustrative={illustrativeOverride}
                    />
                    <TeamVelocityChart
                      data={velocity}
                      isIllustrative={illustrativeOverride}
                    />
                    <TestResultsDonut
                      data={testResults}
                      isIllustrative={illustrativeOverride}
                    />
                    <DefectTrendChart
                      data={analyticsTrends?.defectTrend}
                      isIllustrative={illustrativeOverride}
                    />
                  </div>
                </div>

                {/* C. Recent Tasks Card */}
                <RecentTasksCard tasks={recentTasks} />
              </div>

              {/* RIGHT COLUMN (1/3 width) */}
              <div className="space-y-6">
                {/* D. Team Leaderboard Card (Inspired by Image 4) */}
                <TeamLeaderboardCard
                  members={teamWorkload?.members || []}
                  onViewAll={() => setActiveTab('workload')}
                />

                {/* E. Development Activity Feed */}
                <ProjectActivityFeed activities={activity} />

                {/* F. Upcoming Deadlines */}
                <UpcomingDeadlinesCard deadlines={deadlines} />
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab 2: Roadmap & Gantt */}
        {activeTab === 'roadmap' && (
          <motion.div
            key="tab-roadmap"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <ProjectRoadmapView roadmap={roadmap} />
          </motion.div>
        )}

        {/* Tab 3: Health & Risks */}
        {activeTab === 'health' && (
          <motion.div
            key="tab-health"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <ProjectHealthPanel
              health={healthIntelligence}
              projectId={project.id}
            />
          </motion.div>
        )}

        {/* Tab 4: Team Workload */}
        {activeTab === 'workload' && (
          <motion.div
            key="tab-workload"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <TeamWorkloadView workload={teamWorkload} />
          </motion.div>
        )}

        {/* Tab 5: Traceability & QA */}
        {activeTab === 'traceability' && (
          <motion.div
            key="tab-traceability"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <RequirementTraceabilityView
              traceability={traceability}
              projectId={project.id}
            />
          </motion.div>
        )}

        {/* Tab 6: Release Readiness */}
        {activeTab === 'release' && (
          <motion.div
            key="tab-release"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <ReleaseReadinessPanel
              readiness={releaseReadiness}
              projectId={project.id}
              stats={stats}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
