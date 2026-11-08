import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Users, Search, Filter, CheckCircle2, AlertCircle, Clock, CheckSquare } from 'lucide-react';

interface TeamMemberWorkload {
  id: number;
  name: string;
  username: string | null;
  email: string;
  role: string;
  avatarColor: string;
  assignedCount: number;
  doneCount: number;
  inProgressCount: number;
  blockedCount: number;
  workloadPct: number;
  status: 'BALANCED' | 'HIGH_LOAD' | 'AVAILABLE';
}

interface TeamWorkloadViewProps {
  workload: {
    members: TeamMemberWorkload[];
    summary: {
      totalMembers: number;
      activeMembers: number;
      averageTasksPerMember: number;
      overloadedMembersCount: number;
    };
  };
}

export const TeamWorkloadView: React.FC<TeamWorkloadViewProps> = ({ workload }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const shouldReduceMotion = useReducedMotion();

  const filteredMembers = workload.members.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.username && m.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'ALL' || m.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getStatusBadge = (status: TeamMemberWorkload['status']) => {
    switch (status) {
      case 'HIGH_LOAD':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'AVAILABLE':
        return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
      case 'BALANCED':
      default:
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
  };

  const getBarColor = (pct: number) => {
    if (pct >= 85) return '#10B981'; // Green
    if (pct >= 60) return '#3B82F6'; // Blue
    if (pct >= 40) return '#F97316'; // Coral / Orange
    return '#A855F7'; // Purple
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Metrics Summary */}
      <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide flex items-center gap-2">
              <Users size={16} className="text-blue-400" />
              <span>Team Workload & Capacity Distribution</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Task distribution, completion rates, and bandwidth allocation per contributor
            </p>
          </div>

          {/* Quick Filters & Search */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search member..."
                className="pl-8 pr-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 w-44"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Roles</option>
              <option value="Project Owner">Project Owner</option>
              <option value="Tech Lead">Tech Lead</option>
              <option value="Fullstack Engineer">Fullstack</option>
              <option value="Backend Architect">Backend</option>
              <option value="QA Automation">QA</option>
            </select>
          </div>
        </div>

        {/* 3 Summary Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 font-medium uppercase">Active Members</span>
            <div className="text-xl font-bold text-white mt-0.5">{workload.summary.activeMembers}</div>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 font-medium uppercase">Avg Tasks / Member</span>
            <div className="text-xl font-bold text-white mt-0.5">{workload.summary.averageTasksPerMember}</div>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 font-medium uppercase">Balanced Workload</span>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">
              {Math.max(0, workload.summary.activeMembers - workload.summary.overloadedMembersCount)} members
            </div>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 font-medium uppercase">High Load Caution</span>
            <div className="text-xl font-bold text-amber-400 mt-0.5">
              {workload.summary.overloadedMembersCount} member{workload.summary.overloadedMembersCount === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      </div>

      {/* Team Leaderboard / Workload Rows (Inspired by Reference Image 4) */}
      <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between text-xs text-zinc-400 px-2 font-medium">
          <span>Contributor</span>
          <span className="hidden sm:inline-block">Task Breakdown</span>
          <span>Velocity & Workload</span>
        </div>

        <div className="divide-y divide-zinc-800/80">
          {filteredMembers.map((member, idx) => {
            const initial = member.name.charAt(0).toUpperCase();
            return (
              <motion.div
                key={member.id}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="py-3.5 px-2 hover:bg-zinc-800/30 rounded-xl transition-colors flex items-center justify-between gap-4"
              >
                {/* Member Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-zinc-600 text-xs font-bold w-5">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0 border border-white/10"
                    style={{ backgroundColor: member.avatarColor }}
                  >
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white truncate">{member.name}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${getStatusBadge(
                          member.status
                        )} hidden md:inline-block`}
                      >
                        {member.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate">{member.role}</div>
                  </div>
                </div>

                {/* Task Breakdown (Hidden on small screens) */}
                <div className="hidden sm:flex items-center gap-4 text-xs shrink-0">
                  <span className="text-emerald-400 font-mono font-medium flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    <span>{member.doneCount} done</span>
                  </span>
                  <span className="text-blue-400 font-mono font-medium flex items-center gap-1">
                    <Clock size={12} />
                    <span>{member.inProgressCount} in progress</span>
                  </span>
                  {member.blockedCount > 0 && (
                    <span className="text-red-400 font-mono font-medium flex items-center gap-1">
                      <AlertCircle size={12} />
                      <span>{member.blockedCount} blocked</span>
                    </span>
                  )}
                </div>

                {/* Progress Bar & Percentage */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-24 md:w-32">
                    <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <motion.div
                        initial={shouldReduceMotion ? { width: `${member.workloadPct}%` } : { width: '0%' }}
                        animate={{ width: `${member.workloadPct}%` }}
                        transition={{ duration: 0.6, delay: 0.1 + idx * 0.05 }}
                        className="h-full rounded-full transition-all"
                        style={{ backgroundColor: getBarColor(member.workloadPct) }}
                      />
                    </div>
                  </div>
                  <span className="font-mono text-sm font-bold text-white w-10 text-right">
                    {member.workloadPct}%
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

