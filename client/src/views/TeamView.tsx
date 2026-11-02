import React from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { Users, CircleDot, LayoutGrid, Layers, Filter } from 'lucide-react';
import { defaultTeams } from '../config/navigation';

export const TeamView: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const location = useLocation();

  const team = defaultTeams.find((t) => t.id === teamId) || defaultTeams[0];

  const isBacklog = location.pathname.includes('/backlog');
  const isProjects = location.pathname.includes('/projects');
  const isViews = location.pathname.includes('/views');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white shadow-sm"
            style={{ backgroundColor: team.color }}
          >
            {team.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">{team.name} Team</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Team workspace, sprint backlog, and active deliverables
            </p>
          </div>
        </div>
      </div>

      {/* Team Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[#27272A] pb-2 text-xs">
        <Link
          to={`/teams/${team.id}/issues/active`}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
            !isBacklog && !isProjects && !isViews
              ? 'bg-[#1C1C1F] text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Active Issues
        </Link>
        <Link
          to={`/teams/${team.id}/issues/backlog`}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
            isBacklog ? 'bg-[#1C1C1F] text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Backlog
        </Link>
        <Link
          to={`/teams/${team.id}/projects`}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
            isProjects ? 'bg-[#1C1C1F] text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Projects
        </Link>
        <Link
          to={`/teams/${team.id}/views`}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
            isViews ? 'bg-[#1C1C1F] text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Views
        </Link>
      </div>

      {/* Content based on sub-route */}
      <div className="border border-[#27272A] rounded-lg p-5 bg-[#0E0E10] space-y-4">
        {isProjects ? (
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Team Projects</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-lg border border-zinc-800 bg-[#141417]">
                <div className="font-semibold text-zinc-200">API Gateway Integration</div>
                <div className="text-zinc-400 text-[11px] mt-1">High-throughput routing</div>
              </div>
              <div className="p-3.5 rounded-lg border border-zinc-800 bg-[#141417]">
                <div className="font-semibold text-zinc-200">Prisma Client ORM Sync</div>
                <div className="text-zinc-400 text-[11px] mt-1">Database migrations</div>
              </div>
            </div>
          </div>
        ) : isViews ? (
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Saved Views</h3>
            <p className="text-xs text-zinc-400">
              Custom filtered views for {team.name} sprints, blockers, and weekly releases.
            </p>
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">
              {isBacklog ? 'Backlog Issues' : 'Active Issues & Sprints'}
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="p-2.5 rounded border border-zinc-800/80 bg-[#121215] flex items-center justify-between">
                <span className="font-medium text-zinc-200">
                  {isBacklog ? 'Implement Redis cache for sessions' : 'MySQL table migration and seed script'}
                </span>
                <span className="text-zinc-500 font-mono text-[11px]">DEV-204</span>
              </div>
              <div className="p-2.5 rounded border border-zinc-800/80 bg-[#121215] flex items-center justify-between">
                <span className="font-medium text-zinc-200">
                  {isBacklog ? 'Setup automated E2E tests with Playwright' : 'Refactor NavigationContext for project mode'}
                </span>
                <span className="text-zinc-500 font-mono text-[11px]">DEV-205</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
