import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initialFavorites, FavoriteItem } from '../config/navigation';
import { favoriteService, FavoriteProject, FavoriteTeam } from '../services/favorite.service';

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
  exitProjectMode: () => void;

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
  const [mode, setMode] = useState<'workspace' | 'project'>('workspace');
  const [activeProject, setActiveProject] = useState<ActiveProject | null>({
    id: 1,
    title: 'DevFlow Cloud Platform v2',
    status: 'IN_PROGRESS',
  });

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

  const selectProject = (project: ActiveProject) => {
    setActiveProject(project);
    setMode('project');
  };

  const exitProjectMode = () => {
    setMode('workspace');
  };

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
        exitProjectMode,
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
