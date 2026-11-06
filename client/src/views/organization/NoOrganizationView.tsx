import React from 'react';
import { Building2, Plus, LogIn } from 'lucide-react';
import { useOrganization } from '../../context/OrganizationContext';
import { useAccentTheme } from '../../services/accentTheme.service';

export const NoOrganizationView: React.FC = () => {
  const { setIsCreateModalOpen, setIsJoinModalOpen } = useOrganization();
  const { accentColor } = useAccentTheme();

  return (
    <div className="w-full min-h-[calc(100vh-80px)] flex flex-col animate-in fade-in duration-200">
      {/* Page Header (Consistent with Teams and DevFlow views) */}
      <div className="w-full max-w-7xl pl-4 sm:pl-8 lg:pl-10 pr-4 sm:pr-8 pt-4 mr-auto shrink-0">
        <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-6 sm:pb-8 border-b border-[#27272A]/70 bg-transparent">
          <h1 className="text-2xl sm:text-3xl md:text-[32px] font-extrabold text-[#FFFFFF] tracking-tight leading-tight">
            Organizations
          </h1>
          <p className="text-sm sm:text-[14.5px] text-[#A1A1AA] mt-1.5 leading-relaxed">
            Collaborate across your company workspaces, manage members, and organize projects
          </p>
        </div>
      </div>

      {/* Centered Empty State (Simple text like Teams, with 2 action buttons) */}
      <div className="flex-1 w-full flex flex-col items-center justify-center my-auto px-4 py-16 text-center">
        <div className="flex flex-col items-center justify-center text-center mx-auto w-full max-w-lg py-8">
          <div className="w-16 h-16 rounded-2xl mb-5 bg-transparent border border-[#27272A] flex items-center justify-center text-zinc-400 mx-auto">
            <Building2 size={30} style={{ color: accentColor }} />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight text-center">
            No organizations yet
          </h2>

          <p className="text-sm sm:text-[15px] text-zinc-400 mt-2.5 max-w-md leading-relaxed text-center mx-auto">
            Create your first organization to start managing teams, projects, and members, or join an existing organization.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8 w-full">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl hover:brightness-110 active:scale-[0.98] text-[#0A0B10] text-sm font-semibold transition-all shadow-md cursor-pointer"
              style={{ backgroundColor: accentColor, boxShadow: `0 4px 18px ${accentColor}35` }}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Create new organization</span>
            </button>

            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl border border-[#27272A] bg-[#111216] hover:bg-white/[0.06] hover:border-zinc-500 text-white text-sm font-semibold transition-all shadow-sm active:scale-[0.98] cursor-pointer"
            >
              <LogIn size={15} />
              <span>Join an organization</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
