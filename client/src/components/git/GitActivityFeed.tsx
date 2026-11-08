import React from 'react';
import {
  GitCommit,
  GitPullRequest,
  CircleDot,
  CheckCircle2,
  ExternalLink,
  GitMerge,
  Clock,
} from 'lucide-react';
import type { GitActivityEvent } from '../../types/git';
import { cn } from '../../lib/utils';

export interface GitActivityFeedProps {
  events: GitActivityEvent[];
  loading?: boolean;
  emptyMessage?: string;
  maxItems?: number;
}

export const GitActivityFeed: React.FC<GitActivityFeedProps> = ({
  events,
  loading = false,
  emptyMessage = 'No recent Git activity recorded yet.',
  maxItems = 15,
}) => {
  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="w-7 h-7 rounded-full bg-zinc-800 shrink-0" />
            <div className="flex-1 space-y-1.5 py-1">
              <div className="h-3 w-48 bg-zinc-800 rounded" />
              <div className="h-2.5 w-32 bg-zinc-800/60 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const displayedEvents = events.slice(0, maxItems);

  if (displayedEvents.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
        <Clock size={20} className="text-zinc-600" />
        <span>{emptyMessage}</span>
      </div>
    );
  }

  const getEventBadge = (type: GitActivityEvent['type']) => {
    switch (type) {
      case 'commit':
        return { icon: GitCommit, color: '#06B6D4', label: 'Commit' };
      case 'mr_opened':
        return { icon: GitPullRequest, color: '#3B82F6', label: 'MR Opened' };
      case 'mr_merged':
        return { icon: GitMerge, color: '#8B5CF6', label: 'MR Merged' };
      case 'mr_closed':
        return { icon: GitPullRequest, color: '#71717A', label: 'MR Closed' };
      case 'issue_opened':
        return { icon: CircleDot, color: '#F59E0B', label: 'Issue' };
      case 'issue_closed':
        return { icon: CheckCircle2, color: '#10B981', label: 'Closed' };
      default:
        return { icon: GitCommit, color: '#6366F1', label: 'Git Event' };
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMin < 1) return 'just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="divide-y divide-zinc-800/60">
      {displayedEvents.map((evt) => {
        const badge = getEventBadge(evt.type);
        const IconComponent = badge.icon;

        return (
          <div key={evt.id} className="p-3.5 flex items-start gap-3 hover:bg-zinc-900/30 transition-colors group">
            {/* Actor Avatar / Icon */}
            <div className="relative shrink-0 mt-0.5">
              {evt.actor.avatarUrl ? (
                <img
                  src={evt.actor.avatarUrl}
                  alt={evt.actor.name}
                  className="w-7 h-7 rounded-full object-cover border border-zinc-700"
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white border border-white/10"
                  style={{ backgroundColor: `${badge.color}30`, color: badge.color }}
                >
                  {evt.actor.name ? evt.actor.name.slice(0, 2).toUpperCase() : 'GIT'}
                </div>
              )}
              <div
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border border-[#0E0F15]"
                style={{ backgroundColor: badge.color }}
              >
                <IconComponent size={9} className="text-white" />
              </div>
            </div>

            {/* Event details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <span className="font-semibold text-zinc-200">{evt.actor.name || evt.actor.username}</span>
                  <span className="text-zinc-500 text-[11px] font-mono">in {evt.repoFullName}</span>
                </div>
                <span className="text-[11px] text-zinc-500 shrink-0 font-mono">
                  {formatRelativeTime(evt.timestamp)}
                </span>
              </div>

              <div className="mt-1 flex items-baseline justify-between gap-2">
                <p className="text-xs text-zinc-300 line-clamp-1 group-hover:text-white transition-colors">
                  {evt.sha && (
                    <span className="font-mono text-[11px] text-zinc-400 bg-zinc-800/90 px-1.5 py-0.5 rounded mr-1.5">
                      {evt.sha.slice(0, 7)}
                    </span>
                  )}
                  {evt.referenceNumber && (
                    <span className="font-mono text-[11px] text-indigo-400 font-semibold mr-1.5">
                      #{evt.referenceNumber}
                    </span>
                  )}
                  <span>{evt.title}</span>
                </p>

                {evt.webUrl && (
                  <a
                    href={evt.webUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-500 hover:text-white transition-colors p-0.5 rounded opacity-0 group-hover:opacity-100 shrink-0"
                    title="Open in provider"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

