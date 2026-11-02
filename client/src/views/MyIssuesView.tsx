import React, { useState, useEffect } from 'react';
import { Focus, CheckCircle2, CircleDot, AlertTriangle, ArrowRight, Filter } from 'lucide-react';
import { Task } from '../types';
import { fetchTasks, updateTask } from '../api';

export const MyIssuesView: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'BACKLOG' | 'DONE'>('ACTIVE');

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await fetchTasks();
      setTasks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleCycleStatus = async (task: Task) => {
    const nextMap: Record<string, any> = {
      TODO: 'IN_PROGRESS',
      IN_PROGRESS: 'IN_REVIEW',
      IN_REVIEW: 'DONE',
      DONE: 'TODO',
    };
    try {
      await updateTask(task.id, { status: nextMap[task.status] });
      await loadTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVE') return t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW';
    if (filter === 'BACKLOG') return t.status === 'TODO';
    if (filter === 'DONE') return t.status === 'DONE';
    return true;
  });

  const getPriorityTag = (p: string) => {
    switch (p) {
      case 'URGENT':
        return <span className="text-red-400 font-mono text-[11px] font-semibold">URGENT</span>;
      case 'HIGH':
        return <span className="text-amber-400 font-mono text-[11px] font-semibold">HIGH</span>;
      case 'MEDIUM':
        return <span className="text-cyan-400 font-mono text-[11px] font-semibold">MED</span>;
      default:
        return <span className="text-zinc-500 font-mono text-[11px]">LOW</span>;
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#27272A] flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Focus size={20} className="text-zinc-400" />
            <span>My Issues</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Tasks assigned to you across all projects in DevFlow
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-[#121215] p-1 rounded-lg border border-[#27272A]">
          {(['ACTIVE', 'BACKLOG', 'DONE', 'ALL'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filter === tab
                  ? 'bg-[#1F1F24] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-zinc-500 text-xs">Loading issues...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="py-16 text-center text-zinc-500 text-xs">
          <CircleDot size={28} className="mx-auto mb-2 text-zinc-600" />
          <p className="text-zinc-300 font-medium">No {filter.toLowerCase()} issues found</p>
        </div>
      ) : (
        <div className="border border-[#27272A] rounded-lg divide-y divide-[#27272A] bg-[#0E0E10] overflow-hidden">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-3 hover:bg-[#161619] transition-colors gap-3 text-xs group"
            >
              <div className="flex items-center gap-3 truncate">
                <button
                  onClick={() => handleCycleStatus(task)}
                  className="w-4 h-4 rounded-full border border-zinc-600 hover:border-white flex items-center justify-center flex-shrink-0"
                  title="Cycle status"
                >
                  {task.status === 'DONE' && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                  {task.status === 'IN_PROGRESS' && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                </button>

                <span className="font-mono text-zinc-500 text-[11px] flex-shrink-0">
                  DEV-{100 + task.id}
                </span>

                <span className="font-medium text-zinc-200 truncate group-hover:text-white">
                  {task.title}
                </span>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-[11px] text-zinc-500 hidden sm:inline truncate max-w-[150px]">
                  {task.project?.title || 'DevFlow Cloud'}
                </span>

                {getPriorityTag(task.priority)}

                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                    task.status === 'DONE'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : task.status === 'IN_PROGRESS'
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
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
