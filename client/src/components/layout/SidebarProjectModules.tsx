import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, CircleDot, Pin, Folder } from 'lucide-react';
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

  // Filter visible modules
  const visibleModules = projectModules.filter((mod) => mod.isVisible);

  // Collect individually pinned submodules across all visible modules
  const pinnedSubmodules: Array<{ sub: ProjectSubmodule; parentModule: ProjectModule }> = [];
  visibleModules.forEach((mod) => {
    (mod.submodules || []).forEach((sub) => {
      if (sub.isVisible && sub.isPinned) {
        pinnedSubmodules.push({ sub, parentModule: mod });
      }
    });
  });

  // Sort pinned modules to the top
  const pinnedModules = visibleModules.filter((mod) => mod.isPinned);
  const regularModules = visibleModules.filter((mod) => !mod.isPinned);
  const sortedModules = [...pinnedModules, ...regularModules];

  const getSubmodulePath = (sub: ProjectSubmodule) => {
    if (sub.type === 'built_in' && sub.builtInKey) {
      if (sub.builtInKey === 'overview') {
        return `/projects/${projectId}`;
      }
      return `/projects/${projectId}/${sub.builtInKey}`;
    }
    return `/projects/${projectId}/submodules/${sub.id}`;
  };

  const isPathActive = (targetPath: string) => {
    if (targetPath === `/projects/${projectId}`) {
      return location.pathname === `/projects/${projectId}` || location.pathname === `/projects/${projectId}/`;
    }
    return location.pathname === targetPath || location.pathname.startsWith(`${targetPath}/`);
  };

  return (
    <div className="space-y-2.5 select-none">
      {/* ─── Individually Pinned Submodules Quick Access ─────────────────────────── */}
      {pinnedSubmodules.length > 0 && (
        <div className="space-y-0.5 pb-2 border-b border-sidebar-border/50">
          {!isCollapsed && (
            <div className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-amber-400/90 tracking-wider uppercase">
              <Pin size={10} className="fill-amber-400/30" />
              <span>Pinned Items</span>
            </div>
          )}
          {pinnedSubmodules.map(({ sub, parentModule }) => {
            const SubIcon = resolveModuleIcon(sub.icon, CircleDot);
            const targetPath = getSubmodulePath(sub);
            const isActive = isPathActive(targetPath);

            if (isCollapsed) {
              return (
                <NavLink
                  key={`psub-c-${sub.id}`}
                  to={targetPath}
                  className={cn(
                    'group relative flex items-center justify-center w-10 h-8 mx-auto rounded-md transition-colors',
                    isActive
                      ? 'bg-sidebar-active text-sidebar-text-active'
                      : 'text-zinc-400 hover:text-white hover:bg-sidebar-hover'
                  )}
                >
                  <SubIcon size={16} />
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <div className="absolute left-full ml-2 px-2 py-1 bg-[#1C1C1F] border border-sidebar-border text-white text-xs font-medium rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
                    {sub.name} (Pinned)
                  </div>
                </NavLink>
              );
            }

            return (
              <NavLink
                key={`psub-${sub.id}`}
                to={targetPath}
                className={cn(
                  'flex items-center justify-between h-[30px] px-2 rounded-md transition-colors text-[13px] tracking-[-0.01em]',
                  isActive
                    ? 'bg-sidebar-active text-sidebar-text-active font-medium'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-sidebar-hover'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <SubIcon
                    size={15}
                    className={cn(
                      'shrink-0',
                      isActive ? 'text-indigo-400' : 'text-zinc-400 group-hover:text-zinc-200'
                    )}
                  />
                  <span className="truncate">{sub.name}</span>
                </div>
                <Pin size={10} className="text-amber-400/80 shrink-0 fill-amber-400/30" />
              </NavLink>
            );
          })}
        </div>
      )}

      {/* ─── Modules & Submodules List ────────────────────────────────────────── */}
      {sortedModules.map((mod) => {
        const isExpanded = isGroupExpanded(`mod-${mod.id}`, true);
        const allSubmodules = mod.submodules || [];
        const visibleSubmodules = allSubmodules.filter((sub) => {
          if (!sub.isVisible) return false;
          if (sub.type === 'built_in' && sub.builtInKey) {
            if (seenBuiltInKeys.has(sub.builtInKey)) return false;
            seenBuiltInKeys.add(sub.builtInKey);
          }
          return true;
        });

        // If module has no submodules defined, treat it as an Independent / Standalone Module
        const isIndependentModule = allSubmodules.length === 0;

        if (isIndependentModule) {
          const ModIcon = resolveModuleIcon(mod.icon, Folder);
          const targetPath = `/projects/${projectId}/modules/${mod.id}`;
          const isActive = isPathActive(targetPath);

          if (isCollapsed) {
            return (
              <NavLink
                key={`mod-ind-c-${mod.id}`}
                to={targetPath}
                className={cn(
                  'group relative flex items-center justify-center w-10 h-8 mx-auto rounded-md transition-colors',
                  isActive
                    ? 'bg-sidebar-active text-sidebar-text-active'
                    : 'text-zinc-400 hover:text-white hover:bg-sidebar-hover'
                )}
              >
                <ModIcon size={16} />
                {mod.isPinned && (
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
                <div className="absolute left-full ml-2 px-2 py-1 bg-[#1C1C1F] border border-sidebar-border text-white text-xs font-medium rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
                  {mod.name}
                </div>
              </NavLink>
            );
          }

          return (
            <NavLink
              key={`mod-ind-${mod.id}`}
              to={targetPath}
              className={cn(
                'flex items-center justify-between h-[30px] px-2 rounded-md transition-colors text-[13px] tracking-[-0.01em]',
                isActive
                  ? 'bg-sidebar-active text-sidebar-text-active font-medium'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-sidebar-hover'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <ModIcon
                  size={15}
                  className={cn(
                    'shrink-0',
                    isActive ? 'text-indigo-400' : 'text-zinc-400 group-hover:text-zinc-200'
                  )}
                />
                <span className="truncate">{mod.name}</span>
              </div>
              {mod.isPinned && (
                <Pin size={10} className="text-amber-400/90 shrink-0 fill-amber-400/20" />
              )}
            </NavLink>
          );
        }

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
                  {mod.isPinned && (
                    <Pin size={10} className="text-amber-400/90 shrink-0 fill-amber-400/20" />
                  )}
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
                  const targetPath = getSubmodulePath(sub);
                  const isActive = isPathActive(targetPath);

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
                        {sub.isPinned && (
                          <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                        )}
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
                        'flex items-center justify-between h-[30px] px-2 rounded-md transition-colors text-[13px] tracking-[-0.01em]',
                        isActive
                          ? 'bg-sidebar-active text-sidebar-text-active font-medium'
                          : 'text-zinc-400 hover:text-zinc-100 hover:bg-sidebar-hover'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <SubIcon
                          size={15}
                          className={cn(
                            'shrink-0',
                            isActive ? 'text-indigo-400' : 'text-zinc-400 group-hover:text-zinc-200'
                          )}
                        />
                        <span className="truncate">{sub.name}</span>
                      </div>
                      {sub.isPinned && (
                        <Pin size={10} className="text-amber-400/80 shrink-0 fill-amber-400/30" />
                      )}
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
