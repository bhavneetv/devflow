import React from 'react';
import { GitPullRequest, GitCommit, PlayCircle, FileText, CheckSquare, Activity } from 'lucide-react';

interface ActivityItem {
  id: string | number;
  type: 'PR' | 'COMMIT' | 'TEST' | 'REQUIREMENT' | 'TASK' | 'GENERAL';
  text: string;
  user?: string;
  timeAgo: string;
  createdAt?: string;
}

interface ProjectActivityFeedProps {
  activities: ActivityItem[];
}

export const ProjectActivityFeed: React.FC<ProjectActivityFeedProps> = ({ activities }) => {
  const getEventBadge = (type: string) => {
    switch (type) {
      case 'PR':
        return {
          dot: 'bg-purple-500 ring-purple-500/30',
          icon: <GitPullRequest size={11} className="text-purple-400" />,
        };
      case 'COMMIT':
        return {
          dot: 'bg-blue-500 ring-blue-500/30',
          icon: <GitCommit size={11} className="text-blue-400" />,
        };
      case 'TEST':
        return {
          dot: 'bg-emerald-500 ring-emerald-500/30',
          icon: <PlayCircle size={11} className="text-emerald-400" />,
        };
      case 'REQUIREMENT':
        return {
          dot: 'bg-amber-500 ring-amber-500/30',
          icon: <FileText size={11} className="text-amber-400" />,
        };
      case 'TASK':
        return {
          dot: 'bg-cyan-500 ring-cyan-500/30',
          icon: <CheckSquare size={11} className="text-cyan-400" />,
        };
      default:
        return {
          dot: 'bg-zinc-500 ring-zinc-500/30',
          icon: <Activity size={11} className="text-zinc-400" />,
        };
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
            Development activity
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">Live events & repository audit log</p>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="py-8 text-center text-zinc-500 text-xs">
          <Activity size={24} className="mx-auto text-zinc-600 mb-2" />
          No activity yet.
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((item) => {
            const badge = getEventBadge(item.type);
            return (
              <div
                key={item.id}
                className="p-2 rounded-xl hover:bg-zinc-800/50 transition-colors flex items-start gap-2.5 group cursor-default"
              >
                <div className="mt-1 shrink-0">
                  <div
                    className={`w-2 h-2 rounded-full ring-4 ${badge.dot} transition-transform group-hover:scale-125`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-200 group-hover:text-white transition-colors leading-relaxed line-clamp-2">
                    {item.text}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500">
                    {item.user && <span>{item.user}</span>}
                    {item.user && <span>•</span>}
                    <span>{item.timeAgo}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

