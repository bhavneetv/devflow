import React from 'react';
import { CheckSquare } from 'lucide-react';

interface TaskItem {
  id: number;
  code: string;
  title: string;
  status: string;
  priority?: string;
  assigneeName?: string | null;
}

interface RecentTasksCardProps {
  tasks: TaskItem[];
  isLoading?: boolean;
}

export const RecentTasksCard: React.FC<RecentTasksCardProps> = ({
  tasks,
  isLoading,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DONE':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'IN_PROGRESS':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'IN_REVIEW':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'BLOCKED':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
            Recent tasks
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Active work items and implementation tickets
          </p>
        </div>
        <span className="text-xs text-zinc-500 font-mono">
          {tasks.length} item{tasks.length === 1 ? '' : 's'}
        </span>
      </div>

      {isLoading ? (
        <div className="divide-y divide-zinc-800/60 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-16 h-5 rounded bg-zinc-800" />
                <div className="w-48 h-4 rounded bg-zinc-800/70" />
              </div>
              <div className="w-20 h-5 rounded-full bg-zinc-800/60" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-8 px-4 text-center rounded-xl bg-zinc-950/40 border border-dashed border-zinc-800 space-y-2">
          <CheckSquare size={24} className="mx-auto text-zinc-600" />
          <p className="text-xs text-zinc-400 font-medium">
            No tasks yet — tasks appear here when Task Management is connected.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/70">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-zinc-800/30 px-2 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-2.5 truncate min-w-0">
                <span className="font-mono text-zinc-400 font-medium bg-zinc-800/80 px-1.5 py-0.5 rounded text-[10px] shrink-0 border border-zinc-700/60">
                  {task.code}
                </span>
                <span className="font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                  {task.title}
                </span>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {task.assigneeName && (
                  <span className="text-[11px] text-zinc-400 hidden sm:inline-block">
                    {task.assigneeName}
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(
                    task.status
                  )}`}
                >
                  {task.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

