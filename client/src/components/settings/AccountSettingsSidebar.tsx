import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  UserRound,
  ShieldCheck,
  GitBranch,
  Settings2,
  ArrowLeft,
  ChevronDown,
} from 'lucide-react';

export const ACCOUNT_NAV_ITEMS = [
  {
    id: 'profile',
    label: 'Profile',
    path: '/settings/account/profile',
    icon: UserRound,
    description: 'Personal info, public profile & links',
  },
  {
    id: 'security',
    label: 'Security & Access',
    path: '/settings/account/security',
    icon: ShieldCheck,
    description: 'Password, 2FA & active sessions',
  },
  {
    id: 'connections',
    label: 'Connected Accounts',
    path: '/settings/account/connections',
    icon: GitBranch,
    description: 'GitHub, Google & Git providers',
  },
  {
    id: 'management',
    label: 'Account Management',
    path: '/settings/account/management',
    icon: Settings2,
    description: 'Data export, deactivate & delete',
  },
];

interface AccountSettingsSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export const AccountSettingsSidebar: React.FC<AccountSettingsSidebarProps> = ({
  className = '',
  onNavigate,
}) => {
  return (
    <aside
      className={`w-full md:w-[260px] lg:w-[280px] flex-shrink-0 bg-[#0B0B0C] border-r border-[#27272A] flex flex-col h-full select-none ${className}`}
    >
      {/* Top Header / Back navigation to workspace */}
      <div className="p-4 border-b border-[#27272A]/80">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors py-1 px-2 rounded-md hover:bg-zinc-800/50"
        >
          <ArrowLeft size={14} />
          <span>Back to DevFlow</span>
        </Link>

        <div className="mt-3 px-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#71717A]">
            Settings
          </div>
          <div className="text-base font-bold text-[#F4F4F5] tracking-tight mt-0.5">
            Account Center
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          {/* Section heading: MY ACCOUNT ▾ (Matches Reference Screenshot) */}
          <div className="flex items-center justify-between px-2 mb-2 text-[11px] font-semibold text-[#71717A] tracking-wider uppercase">
            <span className="flex items-center gap-1.5">
              <span>My Account</span>
              <ChevronDown size={12} className="text-[#71717A]" />
            </span>
            <span className="text-[10px] font-mono text-zinc-600">4 items</span>
          </div>

          {/* 4 Dedicated Account Navigation Items */}
          <nav className="space-y-1">
            {ACCOUNT_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs sm:text-[13px] font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-[#1A1D24] text-[#F4F4F5] shadow-sm font-semibold'
                        : 'text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#15171C]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Left accent bar on active */}
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-2 bottom-2 w-1 bg-[#A78BFA] rounded-r shadow-[0_0_8px_rgba(167,139,250,0.6)]"
                        />
                      )}

                      <Icon
                        size={17}
                        className={`flex-shrink-0 transition-colors ${
                          isActive
                            ? 'text-[#A78BFA]'
                            : 'text-[#71717A] group-hover:text-[#A1A1AA]'
                        }`}
                      />

                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Sidebar Footer info */}
      <div className="p-3.5 border-t border-[#27272A]/70 text-[11px] text-[#71717A] bg-[#09090A]">
        <div className="flex items-center justify-between">
          <span>DevFlow Account</span>
          <span className="font-mono text-[10px] text-zinc-500">v1.2.0</span>
        </div>
      </div>
    </aside>
  );
};
