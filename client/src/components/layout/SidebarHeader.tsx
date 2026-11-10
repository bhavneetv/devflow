import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Search,
  SquarePen,
  ArrowLeft,
  FolderKanban,
  Building2,
} from 'lucide-react';
import { useNavigation, ActiveProject } from '../../context/NavigationContext';
import { useOrganization } from '../../context/OrganizationContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { OrgAvatar } from '../organization/OrgAvatar';
import { AVATAR_ICON_COMPONENTS } from '../onboarding/StepProfile';
import { cn } from '../../lib/utils';

interface SidebarHeaderProps {
  isCollapsed?: boolean;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({ isCollapsed }) => {
  const {
    mode,
    activeProject,
    exitProjectMode,
    isProjectLoading,
    setIsSearchOpen,
    setIsCreateOpen,
  } = useNavigation();
  const { currentOrganization } = useOrganization();
  const { accentColor } = useAccentTheme();

  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsWorkspaceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const renderProjectAvatar = () => {
    const pColor = activeProject?.avatarColor || '#8B5CF6';
    const hasIcon = activeProject?.avatarIcon && AVATAR_ICON_COMPONENTS[activeProject.avatarIcon];
    const IconComp = hasIcon ? AVATAR_ICON_COMPONENTS[activeProject.avatarIcon!] : FolderKanban;
    const initials =
      activeProject?.key?.slice(0, 2) ||
      activeProject?.identifier?.slice(0, 2) ||
      activeProject?.title?.slice(0, 2).toUpperCase() ||
      'PR';

    return (
      <div
        className="w-5 h-5 rounded flex items-center justify-center text-white shrink-0 shadow-sm overflow-hidden"
        style={{ backgroundColor: pColor }}
      >
        {activeProject?.avatarIcon && activeProject.avatarIcon !== 'initials' && hasIcon ? (
          <IconComp size={12} className="text-white" />
        ) : activeProject?.avatarIcon === 'initials' ? (
          <span className="text-[8.5px] font-mono font-bold leading-none tracking-tighter uppercase text-white">
            {initials}
          </span>
        ) : (
          <IconComp size={12} className="text-white" />
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative pt-3 pb-2 select-none transition-all duration-200 overflow-visible z-20',
        isCollapsed ? 'px-2 flex items-center justify-center' : 'px-3'
      )}
    >
      {mode === 'workspace' ? (
        <div
          className={cn(
            'flex items-center transition-all duration-200',
            isCollapsed ? 'justify-center w-full' : 'justify-between gap-1'
          )}
        >
          {/* Organization / Workspace Selector trigger */}
          <button
            onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
            className={cn(
              'flex items-center rounded-md hover:bg-sidebar-hover text-sidebar-text-active transition-colors duration-150 group cursor-pointer',
              isCollapsed ? 'p-1.5 justify-center' : 'gap-2 px-2 py-1.5 -ml-1 max-w-[155px]'
            )}
            title={currentOrganization ? `${currentOrganization.name} (${currentOrganization.slug})` : 'DevFlow Workspace'}
          >
            {/* Organization Avatar or DevFlow Logo */}
            {currentOrganization ? (
              <OrgAvatar
                name={currentOrganization.name}
                logoUrl={currentOrganization.logoUrl}
                className="w-5 h-5"
                iconSize={11}
                roundedClassName="rounded"
              />
            ) : (
              <div className="w-5 h-5 rounded flex items-center justify-center text-white flex-shrink-0">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-200">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </div>
            )}

            {!isCollapsed && (
              <>
                <span className="font-semibold text-[13.5px] tracking-tight truncate text-zinc-100">
                  {currentOrganization?.name || 'DevFlow'}
                </span>
                <ChevronDown
                  size={13}
                  className={`text-sidebar-text-muted transition-transform duration-150 flex-shrink-0 ${
                    isWorkspaceMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </>
            )}
          </button>

          {/* Quick actions (Search & Quick Create) */}
          {!isCollapsed && (() => {
            const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
            const modKey = isMac ? '⌘' : 'Ctrl';
            return (
              <div className="flex items-center gap-1 transition-opacity duration-200">
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="w-7 h-7 rounded flex items-center justify-center text-sidebar-icon hover:text-sidebar-text-active hover:bg-sidebar-hover transition-colors duration-150"
                  title={`Search (${modKey}+K)`}
                >
                  <Search size={15} />
                </button>

                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="w-7 h-7 rounded border border-sidebar-border bg-[#141417] flex items-center justify-center text-sidebar-icon hover:text-white hover:bg-sidebar-hover hover:border-zinc-700 transition-all duration-150"
                  title="New Issue (C)"
                >
                  <SquarePen size={14} />
                </button>
              </div>
            );
          })()}
        </div>
      ) : (
        /* Project Context Header */
        <div
          className={cn(
            'flex items-center transition-all duration-200',
            isCollapsed ? 'justify-center w-full' : 'justify-between gap-1'
          )}
        >
          {isCollapsed ? (
            <button
              onClick={() => exitProjectMode()}
              className="p-1 rounded hover:bg-sidebar-hover transition-colors flex items-center justify-center cursor-pointer group"
              title={`Back to Workspace (${activeProject?.title || 'Project'})`}
            >
              {renderProjectAvatar()}
            </button>
          ) : (
            <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
              <button
                onClick={() => exitProjectMode()}
                className="p-1 -ml-1 rounded hover:bg-sidebar-hover text-sidebar-icon hover:text-white transition-colors flex-shrink-0 cursor-pointer"
                title="Back to Workspace"
              >
                <ArrowLeft size={14} />
              </button>
              {isProjectLoading ? (
                <div className="flex items-center gap-2 truncate animate-pulse">
                  <div className="w-5 h-5 rounded bg-zinc-800/80 border border-zinc-700/50 shrink-0" />
                  <div className="space-y-1">
                    <div className="w-8 h-2 bg-zinc-800/60 rounded" />
                    <div className="w-24 h-3 bg-zinc-800/90 rounded" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                  {renderProjectAvatar()}
                  <div className="truncate min-w-0 flex-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-text-muted leading-none truncate">
                      {activeProject?.key || activeProject?.identifier || 'PROJECT'}
                    </div>
                    <div
                      className="text-[13px] font-semibold text-white truncate leading-tight mt-0.5"
                      title={activeProject?.title || 'Active Project'}
                    >
                      {activeProject?.title || `Project #${activeProject?.id}`}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isCollapsed && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="w-7 h-7 rounded border border-sidebar-border bg-[#141417] flex items-center justify-center text-sidebar-icon hover:text-white hover:bg-sidebar-hover transition-all duration-150 flex-shrink-0 cursor-pointer"
              title="Create Task in Project"
            >
              <SquarePen size={14} />
            </button>
          )}
        </div>
      )}

      {/* Dropdown Menu for Workspace Switcher */}
      {isWorkspaceMenuOpen && (
        <WorkspaceSwitcher onClose={() => setIsWorkspaceMenuOpen(false)} />
      )}
    </div>
  );
};
