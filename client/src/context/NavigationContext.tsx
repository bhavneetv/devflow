import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { initialFavorites, FavoriteItem } from '../config/navigation';
import { favoriteService, FavoriteProject, FavoriteTeam } from '../services/favorite.service';
import { projectModuleService } from '../services/projectModule.service';
import type { ProjectModule } from '../types/module';
import { useOrganization } from './OrganizationContext';

export interface ActiveProject {
  id: number;
  title: string;
  status?: string;
}

interface NavigationContextType {
  mode: 'workspace' | 'project';
  setMode: (mode: 'workspace' | 'project') => void;
  activeProject: ActiveProject | null;
  selectProject: (project: ActiveProject) => void;
  openProject: (project: { id: number; title?: string; status?: string }) => Promise<void>;
  exitProjectMode: (targetPath?: string) => void;
  isProjectLoading: boolean;
  setIsProjectLoading: (loading: boolean) => void;
  openingProjectId: number | null;

  projectModules: ProjectModule[];
  setProjectModules: React.Dispatch<React.SetStateAction<ProjectModule[]>>;
  isLoadingModules: boolean;
  refreshProjectModules: (projectId: number) => Promise<void>;

  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  toggleSidebar: () => void;

  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;

  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;

  isCreateOpen: boolean;
  setIsCreateOpen: (open: boolean) => void;

  favorites: FavoriteItem[];
  addFavorite: (item: FavoriteItem) => void;
  removeFavorite: (id: string) => void;

  favoriteProjects: FavoriteProject[];
  favoriteTeams: FavoriteTeam[];
  isResourceFavorite: (type: 'PROJECT' | 'TEAM', id: number) => boolean;
  toggleFavoriteResource: (
    type: 'PROJECT' | 'TEAM',
    id: number,
    orgId?: number,
    meta?: { name: string; color?: string; icon?: string; slug?: string; key?: string }
  ) => Promise<boolean>;
  refreshFavorites: (orgSlugOrId?: string | number) => Promise<void>;

  collapsedGroups: Record<string, boolean>;
  toggleGroup: (groupId: string) => void;
  isGroupExpanded: (groupId: string, defaultExpanded?: boolean) => boolean;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();

  const [mode, setMode] = useState<'workspace' | 'project'>('workspace');
  const [activeProject, setActiveProject] = useState<ActiveProject | null>({
    id: 1,
    title: 'DevFlow Cloud Platform v2',
    status: 'IN_PROGRESS',
  });
  const [openingProjectId, setOpeningProjectId] = useState<number | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState<boolean>(false);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return window.innerWidth >= 768 && window.innerWidth < 1024;
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteItem[]>(initialFavorites);
  const [favoriteProjects, setFavoriteProjects] = useState<FavoriteProject[]>([]);
  const [favoriteTeams, setFavoriteTeams] = useState<FavoriteTeam[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Dynamic Project Modules & Submodules
  const [projectModules, setProjectModules] = useState<ProjectModule[]>([]);
  const [isLoadingModules, setIsLoadingModules] = useState<boolean>(false);

  const refreshProjectModules = useCallback(async (projectId: number) => {
    try {
      setIsLoadingModules(true);
      const res = await projectModuleService.getModules(projectId);
      if (res.success && Array.isArray(res.data)) {
        setProjectModules(res.data);
      }
    } catch (err) {
      console.warn('Failed to load project modules:', err);
    } finally {
      setIsLoadingModules(false);
    }
  }, []);

  // Automatically fetch modules when entering a project or activeProject changes
  useEffect(() => {
    if (activeProject?.id) {
      refreshProjectModules(activeProject.id);
    } else {
      setProjectModules([]);
    }
  }, [activeProject?.id, refreshProjectModules]);

  // Synchronize mode with current URL pathname
  useEffect(() => {
    const isProjectSettings =
      location.pathname.includes('/projects/') && location.pathname.includes('/settings');
    const isProjectWorkspace =
      location.pathname.startsWith('/projects/') && !isProjectSettings;

    if (isProjectWorkspace) {
      const match = location.pathname.match(/\/projects\/(\d+)/);
      if (match) {
        const pId = parseInt(match[1], 10);
        setMode('project');
        setActiveProject((prev) =>
          prev && prev.id === pId
            ? prev
            : { id: pId, title: prev?.id === pId ? prev.title : `Project #${pId}` }
        );
      }
    } else if (!isProjectSettings) {
      // Outside project: automatically update sidebar back to workspace mode!
      setMode('workspace');
    }
  }, [location.pathname]);

  const refreshFavorites = useCallback(async (orgSlugOrId?: string | number) => {
    try {
      const res = await favoriteService.getFavorites(
        orgSlugOrId
          ? typeof orgSlugOrId === 'number'
            ? { organizationId: orgSlugOrId }
            : { organizationSlug: orgSlugOrId }
          : undefined
      );
      if (res.success && res.data) {
        setFavoriteProjects(res.data.projects || []);
        setFavoriteTeams(res.data.teams || []);
      }
    } catch (err) {
      console.error('Failed to load favorites:', err);
    }
  }, []);

  useEffect(() => {
    refreshFavorites();
  }, [refreshFavorites]);

  const isResourceFavorite = useCallback(
    (type: 'PROJECT' | 'TEAM', id: number) => {
      if (type === 'PROJECT') {
        return favoriteProjects.some((p) => p.id === id);
      }
      return favoriteTeams.some((t) => t.id === id);
    },
    [favoriteProjects, favoriteTeams]
  );

  const toggleFavoriteResource = async (
    type: 'PROJECT' | 'TEAM',
    id: number,
    orgId?: number,
    meta?: { name: string; color?: string; icon?: string; slug?: string; key?: string }
  ): Promise<boolean> => {
    const isCurrentlyFav = isResourceFavorite(type, id);

    // Optimistic state update
    if (type === 'PROJECT') {
      if (isCurrentlyFav) {
        setFavoriteProjects((prev) => prev.filter((p) => p.id !== id));
      } else {
        setFavoriteProjects((prev) => [
          ...prev,
          {
            id,
            name: meta?.name || 'Project',
            slug: meta?.slug,
            color: meta?.color,
            icon: meta?.icon,
            organizationId: orgId,
          },
        ]);
      }
    } else {
      if (isCurrentlyFav) {
        setFavoriteTeams((prev) => prev.filter((t) => t.id !== id));
      } else {
        setFavoriteTeams((prev) => [
          ...prev,
          {
            id,
            name: meta?.name || 'Team',
            key: meta?.key,
            color: meta?.color,
            icon: meta?.icon,
            organizationId: orgId,
          },
        ]);
      }
    }

    try {
      const res = await favoriteService.toggleFavorite({
        resourceType: type,
        resourceId: id,
        organizationId: orgId,
      });

      if (!res.success) {
        // Rollback
        await refreshFavorites();
        return false;
      }
      return true;
    } catch {
      await refreshFavorites();
      return false;
    }
  };

  // Global Ctrl+K / Cmd+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === 'c' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        // Quick create with 'c' key shortcut (Linear style)
        e.preventDefault();
        setIsCreateOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectProject = useCallback((project: ActiveProject) => {
    setActiveProject(project);
    setMode('project');
  }, []);

  const openProject = useCallback(
    async (project: { id: number; title?: string; status?: string }) => {
      setOpeningProjectId(project.id);
      setIsProjectLoading(true);
      setActiveProject({
        id: project.id,
        title: project.title || `Project #${project.id}`,
        status: project.status || 'IN_PROGRESS',
      });

      // 2.2 second smooth transition time to open project sidebar and page
      await new Promise((resolve) => setTimeout(resolve, 2200));

      navigate(`/projects/${project.id}`);
      setMode('project');
      setOpeningProjectId(null);

      // Keep skeleton in sidebar briefly for smooth layout transition
      setTimeout(() => {
        setIsProjectLoading(false);
      }, 500);
    },
    [navigate]
  );

  const exitProjectMode = useCallback(
    (targetPath?: string) => {
      setMode('workspace');
      if (typeof targetPath === 'string' && targetPath.trim().length > 0) {
        navigate(targetPath);
      } else if (currentOrganization?.slug) {
        navigate(`/organizations/${currentOrganization.slug}/projects`);
      } else {
        navigate('/projects');
      }
    },
    [currentOrganization, navigate]
  );

  const toggleSidebar = () => {
    setIsCollapsed((prev) => !prev);
  };

  const addFavorite = (item: FavoriteItem) => {
    if (!favorites.some((f) => f.id === item.id)) {
      setFavorites((prev) => [...prev, item]);
    }
  };

  const removeFavorite = (id: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const isGroupExpanded = (groupId: string, defaultExpanded: boolean = true) => {
    if (collapsedGroups[groupId] !== undefined) {
      return !collapsedGroups[groupId];
    }
    return defaultExpanded;
  };

  return (
    <NavigationContext.Provider
      value={{
        mode,
        setMode,
        activeProject,
        selectProject,
        openProject,
        exitProjectMode,
        isProjectLoading,
        setIsProjectLoading,
        openingProjectId,
        projectModules,
        setProjectModules,
        isLoadingModules,
        refreshProjectModules,
        isCollapsed,
        setIsCollapsed,
        toggleSidebar,
        isMobileOpen,
        setIsMobileOpen,
        isSearchOpen,
        setIsSearchOpen,
        isCreateOpen,
        setIsCreateOpen,
        favorites,
        addFavorite,
        removeFavorite,
        favoriteProjects,
        favoriteTeams,
        isResourceFavorite,
        toggleFavoriteResource,
        refreshFavorites,
        collapsedGroups,
        toggleGroup,
        isGroupExpanded,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
