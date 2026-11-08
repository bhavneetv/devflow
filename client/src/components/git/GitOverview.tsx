import React, { useState, useEffect } from 'react';
import {
  GitPullRequest,
  CircleDot,
  GitFork,
  Plus,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { gitService } from '../../services/git.service';
import { GitSummaryCard } from './GitSummaryCard';
import { GitActivityFeed } from './GitActivityFeed';
import { GitRecordDetailsDrawer } from './GitRecordDetailsDrawer';
import { GIT_SUMMARY_CARD_DEFINITIONS } from '../../types/git';
import type { GitOverviewStats, GitActivityEvent, GitNormalizedIssue, GitNormalizedMR } from '../../types/git';
import { cn } from '../../lib/utils';

export interface GitOverviewProps {
  projectId: number;
  configuredCards?: string[];
  onNavigateToFeature?: (featureKey: string, initialFilter?: Record<string, any>) => void;
}

export const GitOverview: React.FC<GitOverviewProps> = ({
  projectId,
  configuredCards,
  onNavigateToFeature,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<GitOverviewStats>({
    totalRepositories: 0,
    openIssues: 0,
    closedIssues: 0,
    openMergeRequests: 0,
    mrsAwaitingReview: 0,
    approvedMrs: 0,
    mergedMrs: 0,
    mrsWithConflicts: 0,
    recentCommitsCount: 0,
  });
  const [activity, setActivity] = useState<GitActivityEvent[]>([]);
  const [recentIssues, setRecentIssues] = useState<GitNormalizedIssue[]>([]);
  const [recentMrs, setRecentMrs] = useState<GitNormalizedMR[]>([]);

  // Drawer state for clicked records
  const [selectedRecord, setSelectedRecord] = useState<{
    type: 'issue' | 'mr';
    repoId: number;
    number: number;
  } | null>(null);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await gitService.getOverview(projectId);
      if (res.success && res.data) {
        setStats(res.data.stats);
        setActivity(res.data.activity);
        setRecentIssues(res.data.recentIssues);
        setRecentMrs(res.data.recentMergeRequests);
      }
    } catch (err) {
      console.error('Failed to load git overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [projectId]);

  const handleCardClick = (cardId: string) => {
    if (onNavigateToFeature) {
      switch (cardId) {
        case 'total-repos':
          onNavigateToFeature('git.repositories');
          break;
        case 'open-issues':
          onNavigateToFeature('git.issues', { state: 'open' });
          break;
        case 'closed-issues':
          onNavigateToFeature('git.issues', { state: 'closed' });
          break;
        case 'open-mrs':
          onNavigateToFeature('git.merge_requests', { state: 'open' });
          break;
        case 'mrs-awaiting-review':
          onNavigateToFeature('git.merge_requests', { awaitingReview: true });
          break;
        case 'approved-mrs':
          onNavigateToFeature('git.merge_requests', { approved: true });
          break;
        case 'merged-mrs':
          onNavigateToFeature('git.merge_requests', { state: 'merged' });
          break;
        case 'mrs-with-conflicts':
          onNavigateToFeature('git.merge_requests', { hasConflicts: true });
          break;
        case 'recent-commits':
          onNavigateToFeature('git.repositories');
          break;
        default:
          break;
      }
      return;
    }

    // Default standalone route navigation
    switch (cardId) {
      case 'total-repos':
      case 'recent-commits':
        navigate(`/projects/${projectId}/repositories`);
        break;
      case 'open-issues':
        navigate(`/projects/${projectId}/issues?state=open`);
        break;
      case 'closed-issues':
        navigate(`/projects/${projectId}/issues?state=closed`);
        break;
      case 'open-mrs':
        navigate(`/projects/${projectId}/pulls?state=open`);
        break;
      case 'mrs-awaiting-review':
        navigate(`/projects/${projectId}/pulls?awaitingReview=true`);
        break;
      case 'approved-mrs':
        navigate(`/projects/${projectId}/pulls?approved=true`);
        break;
      case 'merged-mrs':
        navigate(`/projects/${projectId}/pulls?state=merged`);
        break;
      case 'mrs-with-conflicts':
        navigate(`/projects/${projectId}/pulls?hasConflicts=true`);
        break;
    }
  };

  // Determine which cards to show
  const activeCardDefs = configuredCards && configuredCards.length > 0
    ? GIT_SUMMARY_CARD_DEFINITIONS.filter((def) => configuredCards.includes(def.id))
    : GIT_SUMMARY_CARD_DEFINITIONS;

  const getStatCount = (id: string) => {
    switch (id) {
      case 'total-repos':
        return stats.totalRepositories;
      case 'open-issues':
        return stats.openIssues;
      case 'closed-issues':
        return stats.closedIssues;
      case 'open-mrs':
        return stats.openMergeRequests;
      case 'mrs-awaiting-review':
        return stats.mrsAwaitingReview;
      case 'approved-mrs':
        return stats.approvedMrs;
      case 'merged-mrs':
        return stats.mergedMrs;
      case 'mrs-with-conflicts':
        return stats.mrsWithConflicts;
      case 'recent-commits':
        return stats.recentCommitsCount;
      default:
        return 0;
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Action Ribbon */}
      <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-[#27272A] bg-[#0E0F15]">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-indigo-400" />
          <span className="text-xs font-semibold text-white">Git Development Overview</span>
          <span className="text-[11px] text-zinc-500 hidden sm:inline">• Live sync across authorized repositories</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchOverview}
            disabled={loading}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Refresh metrics"
          >
            <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (onNavigateToFeature) onNavigateToFeature('git.repositories');
              else navigate(`/projects/${projectId}/repositories`);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors shadow-xs cursor-pointer"
          >
            <GitFork size={12} />
            <span>Manage Repos</span>
          </button>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {activeCardDefs.map((card) => (
          <GitSummaryCard
            key={card.id}
            id={card.id}
            title={card.title}
            count={getStatCount(card.id)}
            icon={card.icon}
            color={card.color}
            onClick={() => handleCardClick(card.id)}
          />
        ))}
      </div>

      {/* Dual Column Content: Recent MRs/Issues (Left) and Git Activity Feed (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Recent Merge Requests & Open Issues */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Merge Requests Section */}
          <div className="rounded-xl border border-[#27272A] bg-[#0E0F15] overflow-hidden shadow-xs">
            <div className="p-4 border-b border-[#27272A] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitPullRequest size={15} className="text-indigo-400" />
                <h3 className="text-xs font-semibold text-white">Recent Merge Requests</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onNavigateToFeature) onNavigateToFeature('git.merge_requests');
                  else navigate(`/projects/${projectId}/pulls`);
                }}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>View all ({stats.openMergeRequests})</span>
                <ArrowRight size={11} />
              </button>
            </div>

            {recentMrs.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                No active merge requests found in connected repositories.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/60">
                {recentMrs.slice(0, 5).map((mr) => (
                  <button
                    key={mr.id}
                    type="button"
                    onClick={() => {
                      if (mr.repositoryId) {
                        setSelectedRecord({ type: 'mr', repoId: mr.repositoryId, number: mr.number });
                      }
                    }}
                    className="w-full text-left p-3 px-4 flex items-center justify-between gap-3 hover:bg-zinc-900/40 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-indigo-400">#{mr.number}</span>
                          <span className="text-xs font-medium text-zinc-200 group-hover:text-white truncate">
                            {mr.title}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          {mr.sourceBranch} → {mr.targetBranch}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {mr.hasConflicts && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                          Conflict
                        </span>
                      )}
                      <ArrowRight size={13} className="text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recent Open Issues Section */}
          <div className="rounded-xl border border-[#27272A] bg-[#0E0F15] overflow-hidden shadow-xs">
            <div className="p-4 border-b border-[#27272A] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CircleDot size={15} className="text-amber-400" />
                <h3 className="text-xs font-semibold text-white">Recent Git Issues</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onNavigateToFeature) onNavigateToFeature('git.issues');
                  else navigate(`/projects/${projectId}/issues`);
                }}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>View all ({stats.openIssues})</span>
                <ArrowRight size={11} />
              </button>
            </div>

            {recentIssues.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                No open issues found in connected repositories.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/60">
                {recentIssues.slice(0, 5).map((iss) => (
                  <button
                    key={iss.id}
                    type="button"
                    onClick={() => {
                      if (iss.repositoryId) {
                        setSelectedRecord({ type: 'issue', repoId: iss.repositoryId, number: iss.number });
                      }
                    }}
                    className="w-full text-left p-3 px-4 flex items-center justify-between gap-3 hover:bg-zinc-900/40 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-amber-400">#{iss.number}</span>
                          <span className="text-xs font-medium text-zinc-200 group-hover:text-white truncate">
                            {iss.title}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-500">
                          opened by {iss.author.name || iss.author.username}
                        </span>
                      </div>
                    </div>

                    <ArrowRight size={13} className="text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 span): Unified Activity Feed */}
        <div className="rounded-xl border border-[#27272A] bg-[#0E0F15] overflow-hidden shadow-xs flex flex-col">
          <div className="p-4 border-b border-[#27272A] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-indigo-400" />
              <h3 className="text-xs font-semibold text-white">Repository Activity</h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Live Stream</span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px] scrollbar-thin scrollbar-thumb-zinc-700">
            <GitActivityFeed events={activity} loading={loading} />
          </div>
        </div>
      </div>

      {/* Shared Details Drawer */}
      {selectedRecord && (
        <GitRecordDetailsDrawer
          projectId={projectId}
          isOpen={true}
          onClose={() => setSelectedRecord(null)}
          recordType={selectedRecord.type}
          repoId={selectedRecord.repoId}
          recordNumber={selectedRecord.number}
          onRecordUpdated={fetchOverview}
        />
      )}
    </div>
  );
};

