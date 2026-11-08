import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Search,
  SquarePen,
  ArrowLeft,
  FolderKanban,
  Building2,
} from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useOrganization } from '../../context/OrganizationContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { OrgAvatar } from '../organization/OrgAvatar';
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
          {!isCollapsed && (
            <div className="flex items-center gap-1 transition-opacity duration-200">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="w-7 h-7 rounded flex items-center justify-center text-sidebar-icon hover:text-sidebar-text-active hover:bg-sidebar-hover transition-colors duration-150"
                title="Search (Ctrl + K)"
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
          )}
        </div>
      ) : (
        /* Project Context Header */
        <div
          className={cn(
            'flex items-center transition-all duration-200',
            isCollapsed ? 'justify-center w-full' : 'justify-between gap-1'
          )}
        >
          <div className="flex items-center gap-1.5 overflow-hidden">
            <button
              onClick={() => exitProjectMode()}
              className="p-1 -ml-1 rounded hover:bg-sidebar-hover text-sidebar-icon hover:text-white transition-colors flex-shrink-0"
              title="Back to Workspace"
            >
              <ArrowLeft size={14} />
            </button>
            {!isCollapsed && (
              isProjectLoading ? (
                <div className="flex items-center gap-2 truncate animate-pulse">
                  <div className="w-5 h-5 rounded bg-zinc-800/80 border border-zinc-700/50 shrink-0" />
                  <div className="space-y-1">
                    <div className="w-8 h-2 bg-zinc-800/60 rounded" />
                    <div className="w-24 h-3 bg-zinc-800/90 rounded" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 truncate">
                  <div className="w-5 h-5 rounded bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
                    <FolderKanban size={12} />
                  </div>
                  <div className="truncate">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-text-muted leading-none">
                      Project
                    </div>
                    <div className="text-[13px] font-semibold text-white truncate leading-tight mt-0.5">
                      {activeProject?.title || 'Active Project'}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          {!isCollapsed && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="w-7 h-7 rounded border border-sidebar-border bg-[#141417] flex items-center justify-center text-sidebar-icon hover:text-white hover:bg-sidebar-hover transition-all duration-150 flex-shrink-0"
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
