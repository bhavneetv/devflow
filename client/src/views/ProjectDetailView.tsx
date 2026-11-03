import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  FolderKanban,
  ArrowLeft,
  GitFork,
} from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { Project, Task } from '../types';
import { apiUrl } from '../config/api';

export const ProjectDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { selectProject, exitProjectMode } = useNavigation();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProject = async () => {
      try {
        setLoading(true);
        const res = await fetch(apiUrl(`/projects/${id || 1}`));
        const data = await res.json();
        if (data.success) {
          setProject(data.data);
          selectProject({
            id: data.data.id,
            title: data.data.title,
            status: data.data.status,
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadProject();
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-zinc-500 text-xs">Loading project details...</div>;
  }

  if (!project) {
    return (
      <div className="p-8 text-center text-zinc-500 text-xs">
        <p>Project not found.</p>
        <button
          onClick={exitProjectMode}
          className="mt-3 px-3 py-1.5 rounded bg-zinc-800 text-white"
        >
          Back to Workspace
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Project Banner Header */}
      <div className="p-5 rounded-xl border border-[#27272A] bg-[#0E0E10] space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <FolderKanban size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">{project.title}</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  {project.status.replace('_', ' ')}
                </span>
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">
                Owner: {project.owner?.name || 'Unassigned'} • Created{' '}
                {new Date(project.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          <button
            onClick={exitProjectMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Return to Workspace</span>
          </button>
        </div>

        {project.description && (
          <p className="text-xs text-zinc-300 leading-relaxed border-t border-zinc-800/80 pt-2">
            {project.description}
          </p>
        )}
      </div>

      {/* Project Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-lg bg-[#0E0E10] border border-[#27272A]">
          <div className="text-[11px] uppercase font-semibold text-zinc-500">Total Tasks</div>
          <div className="text-2xl font-bold text-white mt-1">
            {project.tasks?.length || 0}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">Relational tasks in MySQL</div>
        </div>

        <div className="p-4 rounded-lg bg-[#0E0E10] border border-[#27272A]">
          <div className="text-[11px] uppercase font-semibold text-zinc-500">Repository Branch</div>
          <div className="text-lg font-mono font-semibold text-zinc-200 mt-1 flex items-center gap-1.5">
            <GitFork size={15} className="text-zinc-400" />
            <span>main (v2.4.0)</span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">Latest commit 2h ago</div>
        </div>

        <div className="p-4 rounded-lg bg-[#0E0E10] border border-[#27272A]">
          <div className="text-[11px] uppercase font-semibold text-zinc-500">Current Sprint Cycle</div>
          <div className="text-lg font-semibold text-white mt-1">Sprint #12</div>
          <div className="text-[11px] text-zinc-400 mt-1">Ends in 4 days</div>
        </div>
      </div>

      {/* Project Tasks List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Project Tasks & Issues</h2>
          <span className="text-xs text-zinc-500">{project.tasks?.length || 0} items</span>
        </div>

        <div className="border border-[#27272A] rounded-lg divide-y divide-[#27272A] bg-[#0E0E10] overflow-hidden">
          {project.tasks?.map((task: Task) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-3 hover:bg-[#161619] transition-colors gap-3 text-xs"
            >
              <div className="flex items-center gap-3 truncate">
                <span className="font-mono text-zinc-500 text-[11px]">DEV-{100 + task.id}</span>
                <span className="font-medium text-zinc-200 truncate">{task.title}</span>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-[11px] text-zinc-400">
                  {task.assignee?.name || 'Unassigned'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                    task.status === 'DONE'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {task.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
