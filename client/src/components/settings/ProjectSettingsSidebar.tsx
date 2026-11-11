import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ChevronDown,
  Sliders,
  GitBranch,
  ShieldCheck,
  Tags,
  Activity,
  FolderKanban,
  Boxes,
  PanelLeft,
  UserCheck,
  LucideIcon,
} from 'lucide-react';
import { useAccentTheme } from '../../services/accentTheme.service';
import { useNavigation } from '../../context/NavigationContext';
import { UserMenu } from '../layout/UserMenu';
import { FloatingTooltip } from '../common/FloatingTooltip';
import { cn } from '../../lib/utils';
import { organizationService } from '../../services/organization.service';

export interface ProjectNavSection {
  id: string;
  label: string;
  subpath: string;
  icon: LucideIcon;
  description: string;
}

export const PROJECT_NAV_ITEMS: ProjectNavSection[] = [
  {
    id: 'overview',
    label: 'General',
    subpath: 'overview',
    icon: Sliders,
    description: 'Project identity, team & timeline',
  },
  {
    id: 'structure',
    label: 'Project Structure',
    subpath: 'structure',
    icon: Boxes,
    description: 'Modules, submodules & repository structure',
  },
  {
    id: 'sidebar',
    label: 'Sidebar Order',
    subpath: 'sidebar',
    icon: PanelLeft,
    description: 'Virtual sidebar preview, reorder, hide & pin modules',
  },
  {
    id: 'security',
    label: 'Members & Access',
    subpath: 'security',
    icon: ShieldCheck,
    description: 'Permissions, visibility & access control',
  },
  {
    id: 'connections',
    label: 'Integrations',
    subpath: 'connections',
    icon: GitBranch,
    description: 'GitHub, GitLab & webhooks',
  },
  {
    id: 'git-members',
    label: 'Git Member Mapping',
    subpath: 'git-members',
    icon: UserCheck,
    description: 'Link DevFlow team members to Git commit author identities',
  },
  {
    id: 'labels',
    label: 'Labels & Categories',
    subpath: 'labels',
    icon: Tags,
    description: 'Categories & custom task labels',
  },
  {
    id: 'status',
    label: 'Status & Workflow',
    subpath: 'status',
    icon: Activity,
    description: 'Lifecycle stages & default priority',
  },
];

interface ProjectSettingsSidebarProps {
  projectId: number;
  orgSlug?: string;
  className?: string;
  onNavigate?: () => void;
}

export const ProjectSettingsSidebar: React.FC<ProjectSettingsSidebarProps> = ({
  projectId,
  orgSlug,
  className = '',
  onNavigate,
}) => {
  const { accentColor } = useAccentTheme();
  const { isCollapsed, activeProject } = useNavigation();
  const [isSectionOpen, setIsSectionOpen] = useState(true);
  const [isBouncing, setIsBouncing] = useState(false);
  const [projectTitle, setProjectTitle] = useState<string>(activeProject?.id === projectId ? activeProject.title : '');
  const [projectStatus, setProjectStatus] = useState<string>(activeProject?.id === projectId ? (activeProject.status || '') : '');
  const navigate = useNavigate();
  const location = useLocation();

  // Load project basic header if not cached
  useEffect(() => {
    let isMounted = true;
    if (projectId && (!projectTitle || activeProject?.id !== projectId)) {
      organizationService.getProject(projectId)
        .then((res) => {
          if (isMounted && res.success && res.data) {
            setProjectTitle(res.data.title || 'Project');
            setProjectStatus(res.data.status || 'IN_PROGRESS');
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [projectId, projectTitle, activeProject]);

  const basePath = orgSlug
    ? `/organizations/${orgSlug}/projects/${projectId}/settings`
    : `/projects/${projectId}/settings`;

  const projectUrl = orgSlug
    ? `/organizations/${orgSlug}/projects/${projectId}`
    : `/projects/${projectId}`;

  const handleBackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsBouncing(true);
    setTimeout(() => {
      onNavigate?.();
      navigate(projectUrl);
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
      {/* Top Header / Back navigation to Project */}
      <div className={cn('p-3 border-b border-[var(--sidebar-border)]/80', isCollapsed && 'px-2 text-center')}>
        <FloatingTooltip
          content={`Back to ${projectTitle || 'Project'}`}
          enabled={Boolean(isCollapsed)}
          side="right"
        >
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
            title={!isCollapsed ? 'Back to Project' : undefined}
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
            {!isCollapsed && <span>Back to Project</span>}
          </motion.button>
        </FloatingTooltip>

        {/* Settings Title (Enlarged, prominent header matching Account Settings) */}
        {!isCollapsed && (
          <div className="mt-3 px-2">
            <h1 className="text-[28px] sm:text-[32px] font-black text-sidebar-text-active tracking-tight leading-none">
              Settings
            </h1>
            {projectTitle && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-zinc-400 truncate font-medium">
                <FolderKanban size={13} className="text-zinc-500 shrink-0" />
                <span className="truncate text-zinc-300">{projectTitle}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <div className={cn('flex-1 overflow-y-auto overflow-x-hidden scrollbar-none px-2 py-3 space-y-4', isCollapsed && 'px-1')}>
        <div>
          {/* Section heading: PROJECT SETTINGS ▾ (Interactive Collapsible Trigger) */}
          {!isCollapsed && (
            <button
              type="button"
              onClick={() => setIsSectionOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-2 py-1.5 mb-1.5 text-[11px] font-semibold text-sidebar-text-muted hover:text-sidebar-text-active tracking-wider uppercase rounded hover:bg-sidebar-hover transition-colors group cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <span>Project Settings</span>
                <ChevronDown
                  size={12}
                  className={cn(
                    'text-sidebar-text-muted group-hover:text-sidebar-text-active transition-transform duration-200',
                    !isSectionOpen && '-rotate-90'
                  )}
                />
              </span>
              <span className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-300">
                {isSectionOpen ? `${PROJECT_NAV_ITEMS.length} items` : 'hidden'}
              </span>
            </button>
          )}

          {/* 5 Dedicated Project Navigation Items */}
          {(!isCollapsed ? isSectionOpen : true) && (
            <nav className="space-y-1 animate-in fade-in duration-150">
              {PROJECT_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const targetPath = item.id === 'overview'
                  ? `${basePath}/overview`
                  : `${basePath}/${item.subpath}`;

                // Check active state
                const isOverviewActive =
                  item.id === 'overview' &&
                  (location.pathname === basePath ||
                    location.pathname === `${basePath}/` ||
                    location.pathname === `${basePath}/overview`);

                const isItemActive =
                  isOverviewActive ||
                  location.pathname === targetPath ||
                  location.pathname.startsWith(`${targetPath}/`);

                return (
                  <FloatingTooltip
                    key={item.id}
                    content={item.label}
                    enabled={Boolean(isCollapsed)}
                    side="right"
                  >
                    <NavLink
                      to={targetPath}
                      onClick={onNavigate}
                      title={!isCollapsed ? undefined : undefined}
                      className={cn(
                        'group relative flex items-center h-[36px] rounded-md transition-all duration-150 text-[13.5px] select-none outline-none focus-visible:ring-1 focus-visible:ring-zinc-500',
                        isCollapsed ? 'justify-center px-0 w-10 mx-auto' : 'justify-between px-2.5 w-full',
                        isItemActive
                          ? 'bg-sidebar-active text-sidebar-text-active font-medium shadow-sm'
                          : 'text-sidebar-text hover:text-sidebar-text-active hover:bg-sidebar-hover'
                      )}
                    >
                      {/* Left accent bar on active */}
                      {isItemActive && (
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
                            isItemActive
                              ? 'text-sidebar-icon-active'
                              : 'text-sidebar-icon group-hover:text-sidebar-text-active'
                          )}
                          style={isItemActive ? { color: accentColor } : undefined}
                        />

                        {!isCollapsed && (
                          <span className="truncate tracking-[-0.01em]">{item.label}</span>
                        )}
                      </div>
                    </NavLink>
                  </FloatingTooltip>
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

