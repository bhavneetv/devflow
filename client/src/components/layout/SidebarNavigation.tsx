import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  LayoutGrid,
  FolderKanban,
  CircleDot,
  ArrowLeft,
  Settings,
  Star,
  Plus,
  ChevronRight,
  Inbox,
  LayoutDashboard,
  CheckSquare,
  Activity as ActivityIcon,
  HelpCircle,
  Users as UsersIcon,
  Users,
  FileText,
  MessageSquare,
  Kanban,
  RotateCcw,
  GanttChartSquare,
  GitFork,
  Rocket,
  AlertCircle,
  PenTool,
} from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useChat } from '../../context/ChatContext';
import { useOrganization } from '../../context/OrganizationContext';
import { organizationService } from '../../services/organization.service';
import { teamService } from '../../services/team.service';
import {
  mainWorkspaceNavItems,
  bottomWorkspaceNavItems,
  getProjectNavGroups,
} from '../../config/navigation';
import {
  useProjectSidebarItems,
  SidebarItemId,
} from '../../services/projectLayout.service';
import { NavigationItem } from './NavigationItem';
import { NavigationGroup } from './NavigationGroup';
import { SidebarProjectModules } from './SidebarProjectModules';
import { resolveModuleIcon } from '../project/ModuleIconPicker';
import { AVATAR_ICON_COMPONENTS } from '../onboarding/StepProfile';
import { cn } from '../../lib/utils';

// Helper to parse key and icon metadata encoded in team description
function parseTeamMetadata(description?: string | null, teamName?: string) {
  let key = '';
  let icon = 'initials';
  let cleanDesc = description || '';

  if (cleanDesc) {
    const keyMatch = cleanDesc.match(/\[key:([^\]]+)\]/);
    if (keyMatch) {
      key = keyMatch[1];
      cleanDesc = cleanDesc.replace(keyMatch[0], '').trim();
    }
    const iconMatch = cleanDesc.match(/\[icon:([^\]]+)\]/);
    if (iconMatch) {
      icon = iconMatch[1];
      cleanDesc = cleanDesc.replace(iconMatch[0], '').trim();
    }
  }

  if (!key && teamName) {
    const words = teamName.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      key = words.slice(0, 4).map((w) => w[0]?.toUpperCase()).join('').slice(0, 5);
    } else {
      key = teamName.slice(0, 3).toUpperCase();
    }
  }

  return { key: key || 'TEAM', icon, cleanDesc };
}

// Render project saved avatar or fallback
const renderProjectSidebarAvatar = (proj: any) => {
  const pColor = proj.avatarColor || proj.color || '#8B5CF6';
  const IconComp =
    proj.avatarIcon && AVATAR_ICON_COMPONENTS[proj.avatarIcon]
      ? AVATAR_ICON_COMPONENTS[proj.avatarIcon]
      : FolderKanban;

  return (
    <div
      className="w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm"
      style={{ backgroundColor: pColor }}
    >
      <IconComp size={10} className="text-white" />
    </div>
  );
};

// Render team saved avatar or fallback
const renderTeamSidebarAvatar = (team: any) => {
  const { key, icon } = parseTeamMetadata(team.description, team.name);
  const tColor = team.color || '#3B82F6';
  const hasCustomIcon = icon && icon !== 'initials' && AVATAR_ICON_COMPONENTS[icon];
  const IconComp = hasCustomIcon ? AVATAR_ICON_COMPONENTS[icon] : null;
  const initials = key?.slice(0, 2) || team.name?.slice(0, 2).toUpperCase() || 'TM';

  return (
    <div
      className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0 shadow-sm overflow-hidden"
      style={{ backgroundColor: tColor }}
    >
      {IconComp ? (
        <IconComp size={10} className="text-white" />
      ) : (
        <span className="leading-none text-[8px] font-mono tracking-tighter uppercase font-semibold">
          {initials}
        </span>
      )}
    </div>
  );
};

const PROJECT_SIDEBAR_ICONS: Record<SidebarItemId, any> = {
  overview: LayoutDashboard,
  board: Kanban,
  backlog: Layers,
  sprints: RotateCcw,
  timeline: GanttChartSquare,
  whiteboard: PenTool,
  requirements: FileText,
  issues: CircleDot,
  defects: AlertCircle,
  repository: GitFork,
  releases: Rocket,
  team: Users,
  settings: Settings,
};

const PROJECT_SIDEBAR_BADGES: Partial<Record<SidebarItemId, number | string>> = {
  issues: 8,
};

export const SidebarNavigation: React.FC = () => {
  const {
    mode,
    activeProject,
    exitProjectMode,
    isProjectLoading,
    setIsProjectLoading,
    projectModules,
    isLoadingModules,
    isCollapsed,
    favoriteProjects,
    favoriteTeams,
    isResourceFavorite,
    toggleFavoriteResource,
    refreshFavorites,
    setIsCreateProjectOpen,
    setIsCreateTeamOpen,
  } = useNavigation();
  const { currentOrganization } = useOrganization();
  const { toggleChat, unreadTotal } = useChat();
  const navigate = useNavigate();

  const projectSidebarItems = useProjectSidebarItems(activeProject?.id || 0);

  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const orgSlug = currentOrganization?.slug;

  const [orgProjects, setOrgProjects] = useState<any[]>([]);
  const [orgTeams, setOrgTeams] = useState<any[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Fetch projects and teams for current organization
  const fetchOrgResources = useCallback(async () => {
    if (!orgSlug) return;
    try {
      setIsLoadingItems(true);
      const [projRes, teamRes] = await Promise.all([
        organizationService.listProjects(orgSlug),
        teamService.listTeams({ organizationSlug: orgSlug }),
      ]);
      if (projRes.success && Array.isArray(projRes.data)) {
        setOrgProjects(projRes.data);
      }
      if (teamRes.success && Array.isArray(teamRes.data)) {
        setOrgTeams(teamRes.data);
      }
    } catch (err) {
      console.warn('Failed to fetch org sidebar items:', err);
    } finally {
      setIsLoadingItems(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    fetchOrgResources();
  }, [fetchOrgResources]);

  // Listen for created resources or sidebar config change
  useEffect(() => {
    const onCreated = () => {
      fetchOrgResources();
      refreshFavorites();
    };
    window.addEventListener('devflow:project-created', onCreated);
    window.addEventListener('devflow:team-created', onCreated);
    return () => {
      window.removeEventListener('devflow:project-created', onCreated);
      window.removeEventListener('devflow:team-created', onCreated);
    };
  }, [fetchOrgResources, refreshFavorites]);

  const hasAnyFavorites = favoriteProjects.length > 0 || favoriteTeams.length > 0;

  const [, setSidebarConfigTick] = useState(0);

  useEffect(() => {
    const onConfigChange = () => setSidebarConfigTick((t) => t + 1);
    window.addEventListener('devflow-sidebar-config-changed', onConfigChange);
    return () => window.removeEventListener('devflow-sidebar-config-changed', onConfigChange);
  }, []);

  const isOverviewVisible = activeProject
    ? localStorage.getItem(`devflow_proj_${activeProject.id}_overview_visible`) !== 'false'
    : true;

  const hasOverviewSubmodule = projectModules?.some((m) =>
    m.submodules?.some((s) => s.builtInKey === 'overview' && s.isVisible)
  );

  return (
    <div className="flex-1 overflow-y-auto px-2 space-y-2 py-1.5 text-sidebar-text">
      {mode === 'workspace' ? (
        <>
          {/* Main Organization Shortcuts */}
          {orgSlug ? (
            <div className="space-y-0.5">
              <NavigationItem
                title="Overview"
                path={`/organizations/${orgSlug}/overview`}
                icon={LayoutDashboard}
              />
              <NavigationItem
                title="Inbox"
                path="/inbox"
                icon={Inbox}
                shortcut={`${modKey}+⇧I`}
              />
              <NavigationItem
                title="Requirements"
                path="/requirements"
                icon={FileText}
                onClick={(e: React.MouseEvent) => {
                  // Dispatch drawer toggle event; fallback to routing only if drawer failed to mount
                  const isDrawerMounted = (window as any).__devflow_requirements_drawer_mounted !== false;
                  if (isDrawerMounted) {
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('devflow:toggle-requirements-drawer'));
                  }
                }}
              />
              <NavigationItem
                title="Chat"
                path="#"
                icon={MessageSquare}
                badge={unreadTotal > 0 ? unreadTotal : undefined}
                badgeVariant="accent"
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  toggleChat();
                }}
              />
              <NavigationItem
                title="My Tasks"
                path="/my-tasks"
                icon={CheckSquare}
              />
              <NavigationItem
                title="Members"
                path={`/organizations/${orgSlug}/members`}
                icon={UsersIcon}
              />
              <NavigationItem
                title="Activity"
                path={`/organizations/${orgSlug}/activity`}
                icon={ActivityIcon}
              />
            </div>
          ) : (
            <div className="space-y-0.5">
              {mainWorkspaceNavItems.map((item) => (
                <NavigationItem
                  key={item.id}
                  title={item.title}
                  path={item.path}
                  icon={item.icon}
                  badge={item.badge}
                  badgeVariant={item.badgeVariant}
                  onClick={
                    item.id === 'requirements'
                      ? (e: React.MouseEvent) => {
                          const isDrawerMounted = (window as any).__devflow_requirements_drawer_mounted !== false;
                          if (isDrawerMounted) {
                            e.preventDefault();
                            window.dispatchEvent(new CustomEvent('devflow:toggle-requirements-drawer'));
                          }
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {/* ─── 1. FAVORITES SECTION ─────────────────────────────────── */}
          <NavigationGroup
            id="favorites"
            title="Favorites"
            collapsible={true}
            defaultExpanded={true}
          >
            <AnimatePresence initial={false}>
              {!hasAnyFavorites ? (
                <motion.div
                  key="empty-favorites"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-2.5 py-2 my-1 rounded-lg bg-white/[0.02] border border-white/[0.04] text-center"
                >
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 font-medium">
                    <Star size={12} className="text-zinc-500" />
                    <span>No favorites yet</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    Star projects or teams to access them quickly
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="favorites-list"
                  className="space-y-0.5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {/* Starred Projects */}
                  {favoriteProjects.map((proj) => {
                    const title = proj.title || proj.name || 'Untitled Project';
                    return (
                      <motion.div
                        key={`fav-p-${proj.id}`}
                        layout
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <NavigationItem
                          title={title}
                          path={`/projects/${proj.id}`}
                          onClick={() => {
                            setIsProjectLoading(true);
                            setTimeout(() => setIsProjectLoading(false), 1200);
                          }}
                          customIcon={renderProjectSidebarAvatar(proj)}
                          isFavorite={true}
                          starPosition="left"
                          onToggleFavorite={() =>
                            toggleFavoriteResource('PROJECT', proj.id, currentOrganization?.id, {
                              name: title,
                              title: title,
                              avatarColor: proj.avatarColor,
                              avatarIcon: proj.avatarIcon,
                            })
                          }
                          badge="Project"
                          badgeVariant="subtle"
                        />
                      </motion.div>
                    );
                  })}

                  {/* Starred Teams */}
                  {favoriteTeams.map((team) => {
                    const title = team.name || team.title || 'Untitled Team';
                    return (
                      <motion.div
                        key={`fav-t-${team.id}`}
                        layout
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <NavigationItem
                          title={title}
                          path={
                            orgSlug
                              ? `/organizations/${orgSlug}/teams/${team.id}`
                              : `/teams/${team.id}`
                          }
                          customIcon={renderTeamSidebarAvatar(team)}
                          isFavorite={true}
                          starPosition="left"
                          onToggleFavorite={() =>
                            toggleFavoriteResource('TEAM', team.id, currentOrganization?.id, {
                              name: title,
                              title: title,
                              color: team.color,
                              description: team.description,
                            })
                          }
                          badge="Team"
                          badgeVariant="accent"
                        />
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </NavigationGroup>

          {/* ─── 2. PROJECTS SECTION ──────────────────────────────────── */}
          {orgSlug && (
            <NavigationGroup
              id="projects"
              title="Projects"
              collapsible={true}
              defaultExpanded={true}
              actionTitle="Create Project"
              actionShortcut={`${modKey}+⇧P`}
              onAction={() => setIsCreateProjectOpen(true)}
            >
              <div className="space-y-0.5">
                {orgProjects.slice(0, 6).map((proj) => {
                  const title = proj.title || proj.name || 'Untitled';
                  const isFav = isResourceFavorite('PROJECT', proj.id);
                  return (
                    <NavigationItem
                      key={`proj-${proj.id}`}
                      title={title}
                      path={`/projects/${proj.id}`}
                      onClick={() => {
                        setIsProjectLoading(true);
                        setTimeout(() => setIsProjectLoading(false), 1200);
                      }}
                      customIcon={renderProjectSidebarAvatar(proj)}
                      isFavorite={isFav}
                      starPosition="left"
                      onToggleFavorite={() =>
                        toggleFavoriteResource('PROJECT', proj.id, currentOrganization?.id, {
                          name: title,
                          title: title,
                          avatarColor: proj.avatarColor,
                          avatarIcon: proj.avatarIcon,
                        })
                      }
                    />
                  );
                })}

                <Link
                  to={`/organizations/${orgSlug}/projects`}
                  className="w-full flex items-center justify-between px-2 h-7 rounded text-[12px] text-zinc-400 hover:text-white hover:bg-sidebar-hover transition-colors font-medium mt-0.5"
                >
                  <span className="flex items-center gap-1.5">
                    <FolderKanban size={13} className="text-zinc-500" />
                    <span>All Projects</span>
                  </span>
                  <ChevronRight size={12} className="text-zinc-500" />
                </Link>
              </div>
            </NavigationGroup>
          )}

          {/* ─── 3. TEAMS SECTION ─────────────────────────────────────── */}
          {orgSlug && (
            <NavigationGroup
              id="teams"
              title="Teams"
              collapsible={true}
              defaultExpanded={true}
              actionTitle="Create Team"
              actionShortcut={`${modKey}+⇧T`}
              onAction={() => setIsCreateTeamOpen(true)}
            >
              <div className="space-y-0.5">
                {orgTeams.slice(0, 6).map((team) => {
                  const title = team.name || team.title || 'Untitled';
                  const isFav = isResourceFavorite('TEAM', team.id);
                  return (
                    <NavigationItem
                      key={`team-${team.id}`}
                      title={title}
                      path={`/organizations/${orgSlug}/teams/${team.id}`}
                      customIcon={renderTeamSidebarAvatar(team)}
                      isFavorite={isFav}
                      starPosition="left"
                      onToggleFavorite={() =>
                        toggleFavoriteResource('TEAM', team.id, currentOrganization?.id, {
                          name: title,
                          title: title,
                          color: team.color,
                          description: team.description,
                        })
                      }
                    />
                  );
                })}

                <Link
                  to={`/organizations/${orgSlug}/teams`}
                  className="w-full flex items-center justify-between px-2 h-7 rounded text-[12px] text-zinc-400 hover:text-white hover:bg-sidebar-hover transition-colors font-medium mt-0.5"
                >
                  <span className="flex items-center gap-1.5">
                    <Layers size={13} className="text-zinc-500" />
                    <span>All Teams</span>
                  </span>
                  <ChevronRight size={12} className="text-zinc-500" />
                </Link>
              </div>
            </NavigationGroup>
          )}

          {/* ─── 4. BOTTOM SETTINGS & HELP ────────────────────────────── */}
          <div className="pt-2 border-t border-sidebar-border/60 space-y-0.5">
            {orgSlug && (
              <NavigationItem
                title="Organization Settings"
                path={`/organizations/${orgSlug}/settings`}
                icon={Settings}
              />
            )}
            <NavigationItem
              title="Help & Support"
              path="/help"
              icon={HelpCircle}
            />
          </div>
        </>
      ) : isProjectLoading || (isLoadingModules && projectModules.length === 0) ? (
        /* Skeleton Effect in Project Sidebar */
        <div className="space-y-5 px-1 py-1 animate-in fade-in duration-200 select-none">
          {/* Skeleton Group 1 */}
          <div className="space-y-1.5">
            {!isCollapsed && (
              <div className="h-2 w-14 bg-zinc-800/80 rounded animate-pulse px-1 mb-2" />
            )}
            {['w-28', 'w-20', 'w-32', 'w-24'].map((widthClass, idx) => (
              <div
                key={`sk-1-${idx}`}
                className="flex items-center gap-2.5 h-[32px] px-2 rounded-md bg-zinc-900/40 border border-transparent"
              >
                <div className="w-4 h-4 rounded bg-zinc-800/80 animate-pulse shrink-0" />
                {!isCollapsed && (
                  <div className={`h-3 ${widthClass} bg-zinc-800/60 rounded animate-pulse`} />
                )}
              </div>
            ))}
          </div>

          {/* Skeleton Group 2 */}
          <div className="space-y-1.5">
            {!isCollapsed && (
              <div className="h-2 w-16 bg-zinc-800/80 rounded animate-pulse px-1 mb-2" />
            )}
            {['w-24', 'w-28', 'w-16'].map((widthClass, idx) => (
              <div
                key={`sk-2-${idx}`}
                className="flex items-center gap-2.5 h-[32px] px-2 rounded-md bg-zinc-900/40 border border-transparent"
              >
                <div className="w-4 h-4 rounded bg-zinc-800/80 animate-pulse shrink-0" />
                {!isCollapsed && (
                  <div className={`h-3 ${widthClass} bg-zinc-800/60 rounded animate-pulse`} />
                )}
              </div>
            ))}
          </div>

          {/* Skeleton Quick Links */}
          <div className="pt-2 border-t border-sidebar-border/40 space-y-1">
            <div className="flex items-center gap-2.5 h-[32px] px-2 rounded-md">
              <div className="w-4 h-4 rounded bg-zinc-800/80 animate-pulse shrink-0" />
              {!isCollapsed && <div className="h-3 w-24 bg-zinc-800/60 rounded animate-pulse" />}
            </div>
            <div className="flex items-center gap-2.5 h-[32px] px-2 rounded-md">
              <div className="w-4 h-4 rounded bg-zinc-800/80 animate-pulse shrink-0" />
              {!isCollapsed && <div className="h-3 w-32 bg-zinc-800/60 rounded animate-pulse" />}
            </div>
          </div>
        </div>
      ) : (
        /* Project Context Navigation Mode */
        <>
          {activeProject && (
            <>
              {/* Dynamic Project Modules & Submodules OR Custom Reordered Sidebar Items */}
              {projectModules && projectModules.length > 0 ? (
                <>
                  {/* Preserved Project Overview at Top if not hidden and not placed inside custom modules */}
                  {isOverviewVisible && !hasOverviewSubmodule && (
                    <div className="space-y-0.5 mb-2.5">
                      <NavigationItem
                        title="Overview"
                        path={`/projects/${activeProject.id}`}
                        icon={LayoutDashboard}
                      />
                    </div>
                  )}
                  <SidebarProjectModules projectId={activeProject.id} />
                </>
              ) : (
                /* Custom Reordered Navigation Items from Project Layout */
                <div className="space-y-0.5">
                  {projectSidebarItems
                    .filter((item) => item.id !== 'settings')
                    .map((item) => {
                      const IconComp = PROJECT_SIDEBAR_ICONS[item.id as SidebarItemId] || CircleDot;
                      const badge = PROJECT_SIDEBAR_BADGES[item.id as SidebarItemId];
                      return (
                        <NavigationItem
                          key={item.id}
                          title={item.label}
                          path={item.to}
                          icon={IconComp}
                          badge={badge}
                          badgeVariant={item.id === 'issues' ? 'accent' : 'subtle'}
                        />
                      );
                    })}
                </div>
              )}
            </>
          )}

          {/* Project Bottom Quick Links */}
          <div className="mt-3 pt-2.5 border-t border-sidebar-border/60 space-y-0.5">
            <NavigationItem
              title="Chat"
              path="#"
              icon={MessageSquare}
              badge={unreadTotal > 0 ? unreadTotal : undefined}
              badgeVariant="accent"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                toggleChat();
              }}
            />
            <NavigationItem
              title="Project Settings"
              path={`/projects/${activeProject?.id || 1}/settings`}
              icon={Settings}
            />
            <button
              onClick={() => exitProjectMode()}
              className={cn(
                'group flex items-center h-[34px] rounded-md text-[13.5px] text-zinc-400 hover:text-white hover:bg-sidebar-hover transition-colors cursor-pointer relative',
                isCollapsed ? 'justify-center px-0 w-10 mx-auto' : 'w-full px-2 gap-2.5'
              )}
              title={isCollapsed ? 'Back to Workspace' : undefined}
            >
              <ArrowLeft size={16} className="text-zinc-500 group-hover:text-white shrink-0" />
              {!isCollapsed && <span>Back to Workspace</span>}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-[#1C1C1F] border border-sidebar-border text-white text-xs font-medium rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
                  Back to Workspace
                </div>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
