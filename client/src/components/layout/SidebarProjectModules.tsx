import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, CircleDot } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { resolveModuleIcon } from '../project/ModuleIconPicker';
import { cn } from '../../lib/utils';
import type { ProjectModule, ProjectSubmodule } from '../../types/module';

interface SidebarProjectModulesProps {
  projectId: number;
}

export const SidebarProjectModules: React.FC<SidebarProjectModulesProps> = ({ projectId }) => {
  const {
    projectModules,
    isCollapsed,
    isGroupExpanded,
    toggleGroup,
  } = useNavigation();
  const location = useLocation();

  const seenBuiltInKeys = new Set<string>();

  return (
    <div className="space-y-2.5 select-none">
      {projectModules
        .filter((mod) => mod.isVisible)
        .map((mod) => {
          const isExpanded = isGroupExpanded(`mod-${mod.id}`, true);
          const visibleSubmodules = (mod.submodules || []).filter((sub) => {
            if (!sub.isVisible) return false;
            if (sub.type === 'built_in' && sub.builtInKey) {
              if (seenBuiltInKeys.has(sub.builtInKey)) return false;
              seenBuiltInKeys.add(sub.builtInKey);
            }
            return true;
          });

          return (
            <div key={`mod-${mod.id}`} className="relative">
              {/* Module Header / Expand Toggle */}
              {!isCollapsed ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(`mod-${mod.id}`)}
                  className="w-full flex items-center justify-between px-2 h-[28px] rounded-md text-left text-zinc-400 hover:text-zinc-200 hover:bg-sidebar-hover cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <ChevronDown
                      size={12}
                      className={cn(
                        'text-zinc-500 shrink-0 transition-transform duration-150',
                        isExpanded ? '' : '-rotate-90'
                      )}
                    />
                    <span className="text-[11px] font-semibold text-sidebar-text-muted hover:text-zinc-200 uppercase tracking-wider truncate">
                      {mod.name}
                    </span>
                  </div>
                </button>
              ) : (
                /* Minimized Sidebar Module Separator */
                <div className="py-0.5 border-t border-sidebar-border/40 first:border-0" />
              )}

              {/* Submodules List */}
              {isExpanded && (
                <div className={cn('space-y-0.5 mt-0.5', !isCollapsed && 'pl-3')}>
                  {visibleSubmodules.map((sub) => {
                    const SubIcon = resolveModuleIcon(sub.icon, CircleDot);
                    const targetPath =
                      sub.type === 'built_in' && sub.builtInKey
                        ? `/projects/${projectId}/${sub.builtInKey}`
                        : `/projects/${projectId}/submodules/${sub.id}`;

                    const isActive =
                      location.pathname === targetPath ||
                      location.pathname.startsWith(`${targetPath}/`);

                    if (isCollapsed) {
                      /* Minimized Submodule Icon */
                      return (
                        <NavLink
                          key={`sub-c-${sub.id}`}
                          to={targetPath}
                          className={cn(
                            'group relative flex items-center justify-center w-10 h-8 mx-auto rounded-md transition-colors',
                            isActive
                              ? 'bg-sidebar-active text-sidebar-text-active'
                              : 'text-zinc-400 hover:text-white hover:bg-sidebar-hover'
                          )}
                        >
                          <SubIcon size={16} />
                          <div className="absolute left-full ml-2 px-2 py-1 bg-[#1C1C1F] border border-sidebar-border text-white text-xs font-medium rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
                            {sub.name}
                          </div>
                        </NavLink>
                      );
                    }

                    /* Expanded Submodule Link */
                    return (
                      <NavLink
                        key={`sub-${sub.id}`}
                        to={targetPath}
                        className={cn(
                          'flex items-center gap-2 h-[30px] px-2 rounded-md transition-colors text-[13px] tracking-[-0.01em]',
                          isActive
                            ? 'bg-sidebar-active text-sidebar-text-active font-medium'
                            : 'text-zinc-400 hover:text-zinc-100 hover:bg-sidebar-hover'
                        )}
                      >
                        <SubIcon
                          size={15}
                          className={cn(
                            'shrink-0',
                            isActive ? 'text-indigo-400' : 'text-zinc-400 group-hover:text-zinc-200'
                          )}
                        />
                        <span className="truncate">{sub.name}</span>
                      </NavLink>
                    );
                  })}

                  {!isCollapsed && visibleSubmodules.length === 0 && (
                    <div className="px-2 py-0.5 text-[11px] text-zinc-500 italic">
                      No visible submodules
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
};
