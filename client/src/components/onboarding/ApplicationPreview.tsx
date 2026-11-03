import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox,
  FolderKanban,
  CheckSquare,
  Users,
  Settings,
  Search,
  GitBranch,
  GitPullRequest,
  CheckCircle2,
  Sparkles,
  Bot,
  Activity,
  ArrowUpRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { OnboardingData } from '../../types/onboarding';

interface ApplicationPreviewProps {
  currentStep: number;
  data: OnboardingData;
}

export const ApplicationPreview: React.FC<ApplicationPreviewProps> = ({
  currentStep,
  data,
}) => {
  const accent = data.accentColor || '#A78BFA';
  const displayName = data.displayName?.trim() || 'Alex Rivers';
  const roleTitle = data.role || 'Full-Stack Developer';
  const projectName = data.projectName?.trim() || 'Core Infrastructure v2';
  const initialLetters = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'DF';

  const hasGithubGoal = data.goals.includes('github');
  const hasTestingGoal = data.goals.includes('testing');
  const hasAiGoal = data.goals.includes('ai');
  const hasSprintsGoal = data.goals.includes('sprints');

  return (
    <div className="w-full h-full flex flex-col bg-[#101116] border-l border-white/[0.06] relative overflow-hidden select-none">
      {/* Subtle background tech grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Subtle top ambient glow responding to accent color */}
      <div
        className="absolute -top-24 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-colors duration-700 opacity-20"
        style={{ backgroundColor: accent }}
      />

      {/* Header Bar of the Miniature Application */}
      <div className="h-12 border-b border-white/[0.06] px-4 flex items-center justify-between bg-[#0C0D10]/80 backdrop-blur-sm z-10">
        {/* Workspace Switcher */}
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white shadow-sm transition-colors duration-300"
            style={{ backgroundColor: accent }}
          >
            DF
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-medium text-white tracking-tight">
              {data.workspaceType ? `${data.workspaceType.charAt(0).toUpperCase() + data.workspaceType.slice(1)} Workspace` : 'DevFlow Studio'}
            </span>
            <span className="text-[9.5px] px-1.5 py-0.2 rounded font-mono bg-white/[0.06] text-zinc-400 border border-white/[0.06]">
              PROD
            </span>
          </div>
        </div>

        {/* Miniature Search Box */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#17181D] border border-white/[0.06] text-zinc-400 text-[11px] w-48">
          <Search size={11} className="text-zinc-500" />
          <span className="truncate">Search tasks, commits...</span>
          <kbd className="ml-auto text-[9px] font-mono px-1 py-0.2 rounded bg-white/[0.06] text-zinc-400">
            ⌘K
          </kbd>
        </div>

        {/* Live User Badge */}
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-[11.5px] font-medium text-white truncate max-w-[120px] leading-tight">
              {displayName}
            </p>
            <p className="text-[9.5px] font-mono text-zinc-400 leading-tight">
              {roleTitle}
            </p>
          </div>

          {/* User Avatar */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white overflow-hidden border transition-all duration-300 relative shadow-sm"
            style={{ borderColor: accent }}
          >
            {data.avatarType === 'upload' && data.avatarUrl ? (
              <img src={data.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : data.avatarType === 'preset' && data.avatarUrl ? (
              <img src={data.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center font-mono text-[10px]"
                style={{ backgroundColor: `${accent}33`, color: accent }}
              >
                {initialLetters}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Preview Body: Left Sidebar + Live Canvas */}
      <div className="flex-1 flex overflow-hidden z-10">
        {/* Left Miniature Navigation Sidebar */}
        <div className="w-12 border-r border-white/[0.06] py-3 flex flex-col items-center gap-3 bg-[#0B0C0E]/50">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-300"
            style={{ backgroundColor: `${accent}25`, color: accent }}
            title="Overview"
          >
            <FolderKanban size={15} />
          </div>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors" title="My Tasks">
            <CheckSquare size={15} />
          </div>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors" title="Inbox">
            <Inbox size={15} />
          </div>
          {hasGithubGoal && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-white/[0.04] transition-colors"
              title="Git Repositories"
            >
              <GitPullRequest size={15} className="text-[#38BDF8]" />
            </motion.div>
          )}
          {hasTestingGoal && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-white/[0.04] transition-colors"
              title="QA Suite"
            >
              <CheckCircle2 size={15} className="text-[#34D399]" />
            </motion.div>
          )}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors" title="Teams">
            <Users size={15} />
          </div>
          <div className="mt-auto w-8 h-8 rounded-lg flex items-center justify-center text-zinc-600 hover:text-zinc-400 transition-colors" title="Settings">
            <Settings size={14} />
          </div>
        </div>

        {/* Live Canvas Area */}
        <div className="flex-1 p-4 flex flex-col gap-3.5 overflow-hidden">
          {/* Step Adaptation Banner */}
          <div className="px-3 py-2 rounded-lg bg-[#17181D]/80 border border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: accent }}
              />
              <span className="text-[11.5px] font-mono text-zinc-300">
                {currentStep === 1 && 'Live Preview · Personalizing Identity'}
                {currentStep === 2 && `Role Adapt · Optimizing for ${roleTitle}`}
                {currentStep === 3 && `Workspace · ${data.goals.length || 0} dev modules selected`}
                {currentStep === 4 && `Project · ${data.startingPreference ? data.startingPreference.replace('_', ' ') : 'Initialization'}`}
                {currentStep === 5 && 'Environment Synthesis · Launching'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
              <Activity size={10} style={{ color: accent }} />
              <span>Realtime</span>
            </div>
          </div>

          {/* Active Project Card */}
          <motion.div
            layout
            className="p-3.5 rounded-xl bg-[#17181D] border border-white/[0.08] relative group"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[9.5px] font-mono px-1.5 py-0.5 rounded font-medium border"
                    style={{
                      backgroundColor: `${accent}15`,
                      color: accent,
                      borderColor: `${accent}30`,
                    }}
                  >
                    ACTIVE INITIATIVE
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                    <GitBranch size={10} />
                    <span>main</span>
                  </span>
                </div>
                <h3 className="text-[14px] font-semibold text-white tracking-tight leading-snug">
                  {projectName}
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {data.projectDescription?.trim() || 'Next-generation software delivery orchestration & sprint tracking.'}
                </p>
              </div>

              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 bg-white/[0.04] border border-white/[0.06]"
              >
                <ArrowUpRight size={13} />
              </div>
            </div>

            {/* Micro Progress Bar */}
            <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[10.5px]">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 font-mono">Sprint 14</span>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-300 font-medium">84% complete</span>
              </div>
              <div className="w-24 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: '84%', backgroundColor: accent }}
                />
              </div>
            </div>
          </motion.div>

          {/* Dynamic Interactive Cards Stack */}
          <div className="flex-1 grid grid-cols-1 gap-2.5 overflow-hidden">
            {/* Task Card 1: Core Assigned Task */}
            <motion.div
              layout
              className="p-2.5 rounded-lg bg-[#14151B] border border-white/[0.06] flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-4 h-4 rounded border flex items-center justify-center transition-colors"
                  style={{ borderColor: accent, backgroundColor: `${accent}20` }}
                >
                  <CheckCircle2 size={11} style={{ color: accent }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11.5px] font-medium text-zinc-200 truncate">
                    Implement zero-downtime container rollout
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    DEV-248 · High Priority
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                  Review
                </span>
                <div
                  className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center text-[9px] font-bold text-white border"
                  style={{ borderColor: accent }}
                >
                  {data.avatarUrl ? (
                    <img src={data.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    initialLetters
                  )}
                </div>
              </div>
            </motion.div>

            {/* Task Card 2: Microservice API */}
            <motion.div
              layout
              className="p-2.5 rounded-lg bg-[#14151B] border border-white/[0.06] flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-4 h-4 rounded border border-zinc-700 bg-transparent flex items-center justify-center" />
                <div className="min-w-0">
                  <p className="text-[11.5px] font-medium text-zinc-200 truncate">
                    Sync GraphQL schema with OpenAPI 3.1 specs
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    DEV-249 · Assigned to {displayName}
                  </p>
                </div>
              </div>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium"
                style={{ backgroundColor: `${accent}15`, color: accent }}
              >
                In Progress
              </span>
            </motion.div>

            {/* Dynamic Goal-Based Feature Cards */}
            <AnimatePresence>
              {hasGithubGoal && (
                <motion.div
                  initial={{ opacity: 0, y: 8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-2.5 rounded-lg bg-[#0F1520] border border-[#38BDF8]/20 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 text-[11px] text-[#38BDF8]">
                    <GitPullRequest size={13} />
                    <span className="font-mono font-medium">PR #142: devflow/core</span>
                    <span className="text-zinc-400">· 3 approvals</span>
                  </div>
                  <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/20">
                    CI Passing
                  </span>
                </motion.div>
              )}

              {hasTestingGoal && (
                <motion.div
                  initial={{ opacity: 0, y: 8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-2.5 rounded-lg bg-[#0C1A14] border border-[#34D399]/20 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 text-[11px] text-[#34D399]">
                    <ShieldCheck size={13} />
                    <span className="font-medium">Automated Test Matrix</span>
                    <span className="text-zinc-400 text-[10px] font-mono">48/48 suites</span>
                  </div>
                  <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-[#34D399]/10 text-[#34D399] border border-[#34D399]/20">
                    100% Coverage
                  </span>
                </motion.div>
              )}

              {hasAiGoal && (
                <motion.div
                  initial={{ opacity: 0, y: 8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-2.5 rounded-lg bg-[#181124] border border-[#A78BFA]/20 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 text-[11px] text-[#A78BFA]">
                    <Bot size={13} />
                    <span className="font-medium">DevFlow Copilot</span>
                    <span className="text-zinc-400 text-[10px]">Analyzing PR diffs</span>
                  </div>
                  <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20 flex items-center gap-1">
                    <Sparkles size={9} />
                    Active
                  </span>
                </motion.div>
              )}

              {hasSprintsGoal && !hasAiGoal && !hasTestingGoal && (
                <motion.div
                  initial={{ opacity: 0, y: 8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-2.5 rounded-lg bg-[#161720] border border-white/[0.06] flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 text-[11px] text-zinc-300">
                    <Zap size={13} style={{ color: accent }} />
                    <span className="font-medium">Sprint Velocity</span>
                    <span className="text-zinc-500 font-mono text-[10px]">34 pts / week</span>
                  </div>
                  <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300">
                    On Track
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer of Preview */}
          <div className="mt-auto pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-zinc-500 font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
              <span>All systems operational</span>
            </div>
            <span>v2.5 · Linear-speed sync</span>
          </div>
        </div>
      </div>
    </div>
  );
};
