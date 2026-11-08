import React, { useEffect, useState } from 'react';
import {
  FolderKanban,
  CheckSquare,
  Users,
  Database,
  Server,
  Sparkles,
  ArrowRight,
  Plus,
  RefreshCw,
  Clock,
  Layers,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchHealth, fetchProjects, fetchTasks, fetchUsers, triggerSeed } from '../api';
import { Project, SystemHealth, Task, User } from '../types';
import { useNavigation } from '../context/NavigationContext';

export const OverviewView: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const { openProject, openingProjectId, setIsCreateOpen } = useNavigation();
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const [h, p, t, u] = await Promise.allSettled([
        fetchHealth(),
        fetchProjects(),
        fetchTasks(),
        fetchUsers(),
      ]);
      if (h.status === 'fulfilled') setHealth(h.value);
      if (p.status === 'fulfilled') setProjects(p.value);
      if (t.status === 'fulfilled') setTasks(t.value);
      if (u.status === 'fulfilled') setUsers(u.value);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await triggerSeed();
      await loadData();
    } catch (err: any) {
      alert(`Seed failed: ${err.message}`);
    } finally {
      setSeeding(false);
    }
  };

  const isConnected = health?.database.status === 'connected';

  const [showWelcome, setShowWelcome] = useState(() => {
    return localStorage.getItem('devflow_show_welcome_checklist') === 'true';
  });
  const [completedItems, setCompletedItems] = useState<string[]>(['profile']);

  const toggleChecklistItem = (id: string) => {
    setCompletedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const dismissWelcome = () => {
    localStorage.removeItem('devflow_show_welcome_checklist');
    setShowWelcome(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Onboarding Welcome Checklist Banner */}
      {showWelcome && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-[#17181D] to-[#121319] border border-[#A78BFA]/30 shadow-lg relative animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#A78BFA]/15 border border-[#A78BFA]/30 flex items-center justify-center text-[#A78BFA]">
                <Sparkles size={16} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white tracking-tight">
                  Welcome to DevFlow! Your workspace is configured.
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Complete these quick steps to set up your team's development cycle.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={dismissWelcome}
              className="text-zinc-500 hover:text-white p-1 rounded-md text-xs transition-colors"
              title="Dismiss checklist"
            >
              ✕
            </button>
          </div>

          <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-3 border-t border-white/[0.06]">
            {/* Checklist Item 1 */}
            <div
              onClick={() => toggleChecklistItem('profile')}
              className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center gap-2 cursor-pointer hover:bg-white/[0.05] transition-colors"
            >
              <div className="w-4 h-4 rounded bg-[#4ADE80] text-zinc-950 flex items-center justify-center text-[10px] font-bold">
                ✓
              </div>
              <span className="text-xs text-zinc-300 line-through">
                Personalize workspace
              </span>
            </div>

            {/* Checklist Item 2 */}
            <div
              onClick={() => {
                toggleChecklistItem('project');
                setIsCreateOpen(true);
              }}
              className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center gap-2 cursor-pointer hover:bg-white/[0.05] transition-colors"
            >
              <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${completedItems.includes('project') ? 'bg-[#4ADE80] text-zinc-950' : 'border border-zinc-600 text-transparent'}`}>
                ✓
              </div>
              <span className="text-xs text-zinc-200">
                Create first project
              </span>
            </div>

            {/* Checklist Item 3 */}
            <div
              onClick={() => {
                toggleChecklistItem('team');
                navigate('/teams');
              }}
              className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center gap-2 cursor-pointer hover:bg-white/[0.05] transition-colors"
            >
              <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${completedItems.includes('team') ? 'bg-[#4ADE80] text-zinc-950' : 'border border-zinc-600 text-transparent'}`}>
                ✓
              </div>
              <span className="text-xs text-zinc-200">
                Invite a teammate
              </span>
            </div>

            {/* Checklist Item 4 */}
            <div
              onClick={() => toggleChecklistItem('github')}
              className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center gap-2 cursor-pointer hover:bg-white/[0.05] transition-colors"
            >
              <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${completedItems.includes('github') ? 'bg-[#4ADE80] text-zinc-950' : 'border border-zinc-600 text-transparent'}`}>
                ✓
              </div>
              <span className="text-xs text-zinc-200">
                Connect GitHub repo
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner / Hero */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-[var(--sidebar-border)]">
        <div>
          <h1 className="text-2xl font-bold text-[var(--sidebar-text-active)] tracking-tight">Workspace Overview</h1>
          <p className="text-xs text-[var(--sidebar-text-muted)] mt-1">
            DevFlow project manager • React + TypeScript + Node.js + MySQL (XAMPP) + Prisma
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-[var(--sidebar-text)] bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--sidebar-border)] transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm transition-colors disabled:opacity-50"
          >
            <Sparkles size={13} />
            <span>{seeding ? 'Seeding MySQL...' : 'Seed Sample Data'}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* MySQL Status */}
        <div className="p-3.5 rounded-xl border border-[var(--sidebar-border)] bg-[var(--card-bg)] space-y-2">
          <div className="flex items-center justify-between text-[var(--sidebar-text-muted)] text-xs">
            <span className="font-medium">MySQL (XAMPP)</span>
            <Database size={15} className={isConnected ? 'text-emerald-400' : 'text-red-400'} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-[var(--sidebar-text-active)]">
              {isConnected ? 'Connected' : 'Offline'}
            </span>
            {health?.database.latencyMs && (
              <span className="text-[11px] text-emerald-400 font-mono">
                {health.database.latencyMs}ms
              </span>
            )}
          </div>
          <div className="text-[11px] text-[var(--sidebar-text-muted)] font-mono">Port 3306 • devflow_db</div>
        </div>

        {/* Total Projects */}
        <div className="p-3.5 rounded-xl border border-[var(--sidebar-border)] bg-[var(--card-bg)] space-y-2">
          <div className="flex items-center justify-between text-[var(--sidebar-text-muted)] text-xs">
            <span className="font-medium">Active Projects</span>
            <FolderKanban size={15} className="text-blue-400" />
          </div>
          <div className="text-xl font-bold text-[var(--sidebar-text-active)]">{projects.length}</div>
          <div className="text-[11px] text-[var(--sidebar-text-muted)]">Relational project records</div>
        </div>

        {/* Total Tasks */}
        <div className="p-3.5 rounded-xl border border-[var(--sidebar-border)] bg-[var(--card-bg)] space-y-2">
          <div className="flex items-center justify-between text-[var(--sidebar-text-muted)] text-xs">
            <span className="font-medium">Total Issues</span>
            <CheckSquare size={15} className="text-amber-400" />
          </div>
          <div className="text-xl font-bold text-[var(--sidebar-text-active)]">{tasks.length}</div>
          <div className="text-[11px] text-[var(--sidebar-text-muted)]">Prisma task models</div>
        </div>

        {/* Team Members */}
        <div className="p-3.5 rounded-xl border border-[var(--sidebar-border)] bg-[var(--card-bg)] space-y-2">
          <div className="flex items-center justify-between text-[var(--sidebar-text-muted)] text-xs">
            <span className="font-medium">Team Members</span>
            <Users size={15} className="text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-[var(--sidebar-text-active)]">{users.length}</div>
          <div className="text-[11px] text-[var(--sidebar-text-muted)]">Database user accounts</div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--sidebar-text-active)]">Active Projects</h2>
          <span className="text-xs text-[var(--sidebar-text-muted)]">Click any project to enter Project Context Mode</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {projects.map((p) => {
            const isOpening = openingProjectId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => {
                  if (!isOpening) {
                    openProject({ id: p.id, title: p.title, status: p.status });
                  }
                }}
                className={`p-4 rounded-xl border border-[var(--sidebar-border)] bg-[var(--card-bg)] hover:bg-[var(--card-hover)] hover:border-zinc-500 transition-all cursor-pointer space-y-2.5 group ${
                  isOpening ? 'opacity-70 pointer-events-none' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-6 h-6 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
                      <FolderKanban size={13} />
                    </div>
                    <h3 className="font-semibold text-sm text-[var(--sidebar-text-active)] truncate">
                      {p.title}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-[var(--input-bg)] text-[var(--sidebar-text)] border border-[var(--sidebar-border)]">
                    {p.status.replace('_', ' ')}
                  </span>
                </div>

                {p.description && (
                  <p className="text-xs text-[var(--sidebar-text-muted)] line-clamp-2">{p.description}</p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-[var(--sidebar-border)] text-[11px] text-[var(--sidebar-text-muted)]">
                  <span>Owner: {p.owner?.name || 'Unassigned'}</span>
                  <span className="flex items-center gap-1.5 text-[var(--sidebar-text-muted)] group-hover:text-indigo-400 transition-colors">
                    {isOpening ? (
                      <>
                        <Loader2 size={12} className="animate-spin text-indigo-400" />
                        <span className="text-indigo-400 font-medium">Opening...</span>
                      </>
                    ) : (
                      <>
                        <span>Open Project</span>
                        <ArrowRight size={12} />
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
