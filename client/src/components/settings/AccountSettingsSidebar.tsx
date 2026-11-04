import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  UserRound,
  ShieldCheck,
  GitBranch,
  Settings2,
  ArrowLeft,
  ChevronDown,
} from 'lucide-react';
import { useAccentTheme } from '../../services/accentTheme.service';
import { useNavigation } from '../../context/NavigationContext';
import { UserMenu } from '../layout/UserMenu';
import { cn } from '../../lib/utils';

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
  const { accentColor } = useAccentTheme();
  const { isCollapsed } = useNavigation();
  const [isAccountOpen, setIsAccountOpen] = useState(true);
  const [isBouncing, setIsBouncing] = useState(false);
  const navigate = useNavigate();

  const handleBackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsBouncing(true);
    setTimeout(() => {
      onNavigate?.();
      navigate('/');
    }, 240);
  };

  return (
    <aside
      className={cn(
        'flex flex-col bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] select-none h-full overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] will-change-[width]',
        isCollapsed ? 'w-[60px]' : 'w-full md:w-[250px]',
        className
      )}
    >
      {/* Top Header / Back navigation to workspace */}
      <div className={cn('p-3 border-b border-[var(--sidebar-border)]/80', isCollapsed && 'px-2 text-center')}>
        <motion.button
          type="button"
          onClick={handleBackClick}
          whileHover={{ x: -4 }}
          whileTap={{ scale: 0.88, x: -8 }}
          animate={
            isBouncing
              ? {
                  x: [0, -12, 6, -8, 3, 0],
                  scale: [1, 0.88, 1.08, 0.96, 1],
                }
              : {}
          }
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 12,
            mass: 0.8,
          }}
          className={cn(
            'inline-flex items-center text-xs font-semibold text-sidebar-text hover:text-sidebar-text-active transition-colors py-1.5 rounded-md hover:bg-sidebar-hover cursor-pointer select-none group',
            isCollapsed ? 'justify-center w-full px-0' : 'gap-2 px-2'
          )}
          title="Back to DevFlow"
        >
          <motion.span
            animate={
              isBouncing
                ? {
                    x: [0, -8, 4, -4, 0],
                    rotate: [0, -14, 6, -4, 0],
                  }
                : {}
            }
            transition={{
              type: 'spring',
              stiffness: 600,
              damping: 10,
            }}
            className="flex items-center justify-center transition-transform group-hover:-translate-x-1 duration-150"
          >
            <ArrowLeft size={16} strokeWidth={2.4} />
          </motion.span>
          {!isCollapsed && <span>Back to DevFlow</span>}
        </motion.button>

        {/* Settings Title (Enlarged, prominent header) */}
        {!isCollapsed && (
          <div className="mt-3 px-2">
            <h1 className="text-[28px] sm:text-[32px] font-black text-sidebar-text-active tracking-tight leading-none">
              Settings
            </h1>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        <div>
          {/* Section heading: MY ACCOUNT ▾ (Interactive Collapsible Trigger) */}
          {!isCollapsed && (
            <button
              type="button"
              onClick={() => setIsAccountOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-2 py-1.5 mb-1.5 text-[11px] font-semibold text-sidebar-text-muted hover:text-sidebar-text-active tracking-wider uppercase rounded hover:bg-sidebar-hover transition-colors group cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <span>My Account</span>
                <ChevronDown
                  size={12}
                  className={cn(
                    'text-sidebar-text-muted group-hover:text-sidebar-text-active transition-transform duration-200',
                    !isAccountOpen && '-rotate-90'
                  )}
                />
              </span>
              <span className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-300">
                {isAccountOpen ? '4 items' : 'hidden'}
              </span>
            </button>
          )}

          {/* 4 Dedicated Account Navigation Items with white/grey icons and hover/focus effects matching main sidebar */}
          {(!isCollapsed ? isAccountOpen : true) && (
            <nav className="space-y-1 animate-in fade-in duration-150">
              {ACCOUNT_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    onClick={onNavigate}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center h-[36px] rounded-md transition-all duration-150 text-[13.5px] select-none outline-none focus-visible:ring-1 focus-visible:ring-zinc-500',
                        isCollapsed ? 'justify-center px-0 w-10 mx-auto' : 'justify-between px-2.5 w-full',
                        isActive
                          ? 'bg-sidebar-active text-sidebar-text-active font-medium shadow-sm'
                          : 'text-sidebar-text hover:text-sidebar-text-active hover:bg-sidebar-hover'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Left accent bar on active */}
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r"
                            style={{
                              backgroundColor: accentColor,
                              boxShadow: `0 0 8px ${accentColor}80`,
                            }}
                          />
                        )}

                        <div className={cn('flex items-center gap-2.5 min-w-0', isCollapsed && 'justify-center')}>
                          <Icon
                            size={16}
                            className={cn(
                              'flex-shrink-0 transition-colors duration-150',
                              isActive
                                ? 'text-sidebar-icon-active'
                                : 'text-sidebar-icon group-hover:text-sidebar-text-active'
                            )}
                            style={isActive ? { color: accentColor } : undefined}
                          />

                          {!isCollapsed && (
                            <span className="truncate tracking-[-0.01em]">{item.label}</span>
                          )}
                        </div>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          )}
        </div>
      </div>

      {/* User profile footer matching main sidebar */}
      <UserMenu isCollapsed={isCollapsed} />
    </aside>
  );
};
