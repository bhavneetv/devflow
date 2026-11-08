import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight, Activity, Calendar, FileText, CheckSquare, Bug, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HealthIntelligenceProps {
  health: {
    overall: { status: string; score: number; label: string };
    schedule: { status: string; score: number; overdueCount: number; upcomingCount: number };
    requirements: { status: string; score: number; total: number; approved: number; pending: number; draft: number };
    development: { status: string; score: number; totalTasks: number; doneTasks: number; inProgress: number; blocked: number };
    testing: { status: string; score: number; passRate: number; totalTests: number; passed: number; failed: number };
    workload: { status: string; score: number; activeMembers: number; tasksPerMember: number };
    releaseReadiness: { status: string; score: number };
    risks: Array<{
      id: string;
      title: string;
      severity: 'HIGH' | 'MEDIUM' | 'LOW';
      category: string;
      description: string;
      affectedCount: number;
      link: string;
    }>;
  };
  projectId: number;
}

export const ProjectHealthPanel: React.FC<HealthIntelligenceProps> = ({ health, projectId }) => {
  const shouldReduceMotion = useReducedMotion();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CRITICAL':
      case 'HIGH':
      case 'NOT_READY':
        return 'text-red-400 border-red-500/30 bg-red-500/10';
      case 'AT_RISK':
      case 'MEDIUM':
      case 'READY_WITH_WARNINGS':
        return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
      case 'HEALTHY':
      case 'BALANCED':
      case 'RELEASE_READY':
      default:
        return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    }
  };

  const getStrokeColor = (status: string) => {
    switch (status) {
      case 'CRITICAL':
        return '#EF4444';
      case 'AT_RISK':
        return '#F59E0B';
      case 'HEALTHY':
      default:
        return '#10B981';
    }
  };

  // Semi-circle gauge calculation (inspired by reference image 3 & 4)
  const radius = 54;
  const strokeWidth = 10;
  const circumference = Math.PI * radius; // Half-circle
  const strokeDashoffset = circumference - (circumference * Math.min(Math.max(health.overall.score, 0), 100)) / 100;

  return (
    <div className="space-y-5">
      {/* Top Health Intelligence Banner */}
      <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Left: Overall Health Dial Gauge */}
        <div className="flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-zinc-800/80 pb-6 md:pb-0 md:pr-6">
          <div className="relative w-40 h-24 flex items-end justify-center overflow-hidden">
            <svg viewBox="0 0 130 75" className="w-full h-full">
              {/* Background Arc */}
              <path
                d="M 15 65 A 50 50 0 0 1 115 65"
                fill="none"
                stroke="#27272A"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
              {/* Active Health Arc */}
              <motion.path
                d="M 15 65 A 50 50 0 0 1 115 65"
                fill="none"
                stroke={getStrokeColor(health.overall.status)}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                initial={shouldReduceMotion ? { strokeDashoffset } : { strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-x-0 bottom-1 flex flex-col items-center pointer-events-none">
              <span className="text-3xl font-bold text-white tracking-tight leading-none">
                {health.overall.score}
              </span>
              <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mt-1">
                Health Score
              </span>
            </div>
          </div>
          <div className="mt-2 text-center">
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                health.overall.status
              )}`}
            >
              {health.overall.label}
            </span>
          </div>
        </div>

        {/* Center: 4 Health Dimensions Quick Bar */}
        <div className="space-y-3.5 md:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Activity size={14} className="text-blue-400" />
              <span>Project Health Dimensions</span>
            </h3>
            <span className="text-[11px] text-zinc-500 font-mono">Live Multi-Vector Telemetry</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Schedule */}
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Calendar size={12} className="text-cyan-400" />
                  <span>Schedule</span>
                </span>
                <span className="font-bold text-white">{health.schedule.score}%</span>
              </div>
              <p className="text-[10px] text-zinc-500 truncate">
                {health.schedule.overdueCount > 0 ? `${health.schedule.overdueCount} overdue` : 'On schedule'}
              </p>
            </div>

            {/* Requirements */}
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <FileText size={12} className="text-purple-400" />
                  <span>Specs</span>
                </span>
                <span className="font-bold text-white">{health.requirements.score}%</span>
              </div>
              <p className="text-[10px] text-zinc-500 truncate">
                {health.requirements.approved} of {health.requirements.total} approved
              </p>
            </div>

            {/* Development */}
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <CheckSquare size={12} className="text-blue-400" />
                  <span>Dev Velocity</span>
                </span>
                <span className="font-bold text-white">{health.development.score}%</span>
              </div>
              <p className="text-[10px] text-zinc-500 truncate">
                {health.development.doneTasks} done · {health.development.blocked} blocked
              </p>
            </div>

            {/* Testing */}
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Bug size={12} className="text-emerald-400" />
                  <span>QA & Tests</span>
                </span>
                <span className="font-bold text-white">{health.testing.passRate}%</span>
              </div>
              <p className="text-[10px] text-zinc-500 truncate">
                {health.testing.passed}/{health.testing.totalTests} cases passing
              </p>
            </div>

            {/* Workload */}
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Users size={12} className="text-amber-400" />
                  <span>Workload</span>
                </span>
                <span className="font-bold text-white">{health.workload.status}</span>
              </div>
              <p className="text-[10px] text-zinc-500 truncate">
                ~{health.workload.tasksPerMember} tasks/member
              </p>
            </div>

            {/* Release Readiness */}
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  <span>Release</span>
                </span>
                <span className="font-bold text-white">{health.releaseReadiness.score}%</span>
              </div>
              <p className="text-[10px] text-zinc-500 truncate">
                {health.releaseReadiness.status.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actionable Risk Register Panel */}
      <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
              Actionable Risk Register & Bottlenecks
            </h3>
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            {health.risks.length} active risk{health.risks.length === 1 ? '' : 's'}
          </span>
        </div>

        {health.risks.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center gap-2">
            <CheckCircle2 size={16} />
            <span>Zero critical risk factors identified. Project delivery velocity is operating within parameters.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {health.risks.map((risk) => (
              <Link
                key={risk.id}
                to={risk.link}
                className="p-3.5 rounded-xl bg-zinc-950/50 border border-zinc-800/90 hover:border-zinc-700 flex flex-col justify-between gap-2.5 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        risk.severity === 'HIGH'
                          ? 'bg-red-500/15 text-red-400 border-red-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {risk.severity}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono uppercase">
                      {risk.category}
                    </span>
                  </div>
                  <ArrowRight size={13} className="text-zinc-600 group-hover:text-white transition-colors" />
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors">
                    {risk.title}
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    {risk.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

