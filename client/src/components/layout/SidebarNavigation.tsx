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
  FileText,
} from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useOrganization } from '../../context/OrganizationContext';
import { organizationService } from '../../services/organization.service';
import { teamService } from '../../services/team.service';
import {
  mainWorkspaceNavItems,
  bottomWorkspaceNavItems,
  getProjectNavGroups,
} from '../../config/navigation';
import { NavigationItem } from './NavigationItem';
import { NavigationGroup } from './NavigationGroup';

export const SidebarNavigation: React.FC = () => {
  const {
    mode,
    activeProject,
    exitProjectMode,
    isCollapsed,
    favoriteProjects,
    favoriteTeams,
    isResourceFavorite,
    toggleFavoriteResource,
  } = useNavigation();
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();

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

  const hasAnyFavorites = favoriteProjects.length > 0 || favoriteTeams.length > 0;

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
                  {favoriteProjects.map((proj) => (
                    <motion.div
                      key={`fav-p-${proj.id}`}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <NavigationItem
                        title={proj.name}
                        path={`/projects/${proj.id}`}
                        customIcon={
                          <div
                            className="w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                            style={{
                              backgroundColor: proj.color || '#8B5CF6',
                            }}
                          >
                            <FolderKanban size={11} className="text-white" />
                          </div>
                        }
                        isFavorite={true}
                        starPosition="left"
                        onToggleFavorite={() =>
                          toggleFavoriteResource('PROJECT', proj.id, currentOrganization?.id, {
                            name: proj.name,
                          })
                        }
                        badge="Project"
                        badgeVariant="subtle"
                      />
                    </motion.div>
                  ))}

                  {/* Starred Teams */}
                  {favoriteTeams.map((team) => (
                    <motion.div
                      key={`fav-t-${team.id}`}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <NavigationItem
                        title={team.name}
                        path={
                          orgSlug
                            ? `/organizations/${orgSlug}/teams/${team.id}`
                            : `/teams/${team.id}`
                        }
                        customIcon={
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm"
                            style={{
                              backgroundColor: team.color || '#3B82F6',
                            }}
                          >
                            <Layers size={10} className="text-white" />
                          </div>
                        }
                        isFavorite={true}
                        starPosition="left"
                        onToggleFavorite={() =>
                          toggleFavoriteResource('TEAM', team.id, currentOrganization?.id, {
                            name: team.name,
                          })
                        }
                        badge="Team"
                        badgeVariant="accent"
                      />
                    </motion.div>
                  ))}
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
              actionTitle="View all projects"
              onAction={() => navigate(`/organizations/${orgSlug}/projects`)}
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
                      customIcon={
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{
                            backgroundColor: proj.avatarColor || '#8B5CF6',
                          }}
                        >
                          <FolderKanban size={11} className="text-white" />
                        </div>
                      }
                      isFavorite={isFav}
                      starPosition="left"
                      onToggleFavorite={() =>
                        toggleFavoriteResource('PROJECT', proj.id, currentOrganization?.id, {
                          name: title,
                          color: proj.avatarColor,
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
              actionTitle="View all teams"
              onAction={() => navigate(`/organizations/${orgSlug}/teams`)}
            >
              <div className="space-y-0.5">
                {orgTeams.slice(0, 6).map((team) => {
                  const isFav = isResourceFavorite('TEAM', team.id);
                  return (
                    <NavigationItem
                      key={`team-${team.id}`}
                      title={team.name}
                      path={`/organizations/${orgSlug}/teams/${team.id}`}
                      customIcon={
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{
                            backgroundColor: team.color || '#3B82F6',
                          }}
                        >
                          <Layers size={10} className="text-white" />
                        </div>
                      }
                      isFavorite={isFav}
                      starPosition="left"
                      onToggleFavorite={() =>
                        toggleFavoriteResource('TEAM', team.id, currentOrganization?.id, {
                          name: team.name,
                          color: team.color,
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
      ) : (
        /* Project Context Navigation Mode */
        <>
          {activeProject &&
            getProjectNavGroups(activeProject.id).map((group) => (
              <NavigationGroup
                key={group.id}
                id={group.id}
                title={group.title}
                collapsible={group.collapsible}
                defaultExpanded={group.defaultExpanded}
              >
                {group.items.map((item) => (
                  <NavigationItem
                    key={item.id}
                    title={item.title}
                    path={item.path}
                    icon={item.icon}
                    badge={item.badge}
                  />
                ))}
              </NavigationGroup>
            ))}

          {/* Project Bottom Quick Links */}
          <div className="pt-2 border-t border-sidebar-border/60 space-y-0.5">
            <NavigationItem
              title="Project Settings"
              path={`/projects/${activeProject?.id || 1}/settings`}
              icon={Settings}
            />
            <button
              onClick={exitProjectMode}
              className="w-full flex items-center gap-2.5 h-[34px] px-2 rounded-md text-[13.5px] text-zinc-400 hover:text-white hover:bg-sidebar-hover transition-colors"
            >
              <ArrowLeft size={16} className="text-zinc-500" />
              <span>Back to Workspace</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
