import React from 'react';
import {
  Layers,
  LayoutGrid,
  FolderKanban,
  CircleDot,
  ArrowLeft,
  Settings,
} from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useOrganization } from '../../context/OrganizationContext';
import {
  mainWorkspaceNavItems,
  bottomWorkspaceNavItems,
  getProjectNavGroups,
} from '../../config/navigation';
import { NavigationItem } from './NavigationItem';
import { NavigationGroup } from './NavigationGroup';
import {
  Inbox,
  LayoutDashboard,
  CheckSquare,
  Activity as ActivityIcon,
  HelpCircle,
  UserCheck,
  Users as UsersIcon,
  FileText,
} from 'lucide-react';

export const SidebarNavigation: React.FC = () => {
  const {
    mode,
    activeProject,
    exitProjectMode,
    favorites,
    removeFavorite,
    isCollapsed,
  } = useNavigation();
  const { currentOrganization } = useOrganization();

  // Helper to map icon types for favorites
  const getFavoriteIcon = (type: string) => {
    switch (type) {
      case 'grid':
        return LayoutGrid;
      case 'folder':
        return FolderKanban;
      case 'circle':
        return CircleDot;
      case 'layers':
      default:
        return Layers;
    }
  };

  const orgSlug = currentOrganization?.slug;

  const dynamicMainItems = orgSlug
    ? [
        {
          id: 'inbox',
          title: 'Inbox',
          path: '/inbox',
          icon: Inbox,
          badge: 7,
          badgeVariant: 'subtle' as const,
        },
        {
          id: 'overview',
          title: 'Overview',
          path: `/organizations/${orgSlug}/overview`,
          icon: LayoutDashboard,
        },
        {
          id: 'projects',
          title: 'Projects',
          path: `/organizations/${orgSlug}/projects`,
          icon: FolderKanban,
        },
        {
          id: 'requirements',
          title: 'Requirements',
          path: '/requirements',
          icon: FileText,
        },
        {
          id: 'my-tasks',
          title: 'My Tasks',
          path: '/my-tasks',
          icon: CheckSquare,
        },
        {
          id: 'teams',
          title: 'Teams',
          path: `/organizations/${orgSlug}/teams`,
          icon: Layers,
        },
        {
          id: 'members',
          title: 'Members',
          path: `/organizations/${orgSlug}/members`,
          icon: UsersIcon,
        },
        {
          id: 'activity',
          title: 'Activity',
          path: `/organizations/${orgSlug}/activity`,
          icon: ActivityIcon,
        },
      ]
    : mainWorkspaceNavItems;

  const dynamicBottomItems = orgSlug
    ? [
        {
          id: 'settings',
          title: 'Settings',
          path: `/organizations/${orgSlug}/settings`,
          icon: Settings,
        },
        {
          id: 'help',
          title: 'Help & Support',
          path: '/help',
          icon: HelpCircle,
        },
      ]
    : bottomWorkspaceNavItems;

  return (
    <div className="flex-1 overflow-y-auto px-2 space-y-2 py-1.5 text-sidebar-text">
      {mode === 'workspace' ? (
        /* Workspace Mode: Organization items in order + Favorites */
        <>
          <div className="space-y-0.5">
            {dynamicMainItems.map((item) => (
              <NavigationItem
                key={item.id}
                title={item.title}
                path={item.path}
                icon={item.icon}
                badge={item.badge}
                badgeVariant={item.badgeVariant}
                onClick={
                  item.id === 'requirements'
                    ? (e) => {
                        // Dispatch drawer toggle event; fallback to routing only if drawer failed to mount
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

          {/* Favorites Group */}
          {favorites.length > 0 && (
            <NavigationGroup
              id="favorites"
              title="Favorites"
              collapsible={true}
              defaultExpanded={true}
            >
              {favorites.map((fav) => (
                <NavigationItem
                  key={fav.id}
                  title={fav.title}
                  path={fav.path}
                  icon={getFavoriteIcon(fav.iconType)}
                  isFavorite={true}
                  onToggleFavorite={() => removeFavorite(fav.id)}
                />
              ))}
            </NavigationGroup>
          )}

          {/* Bottom Settings & Help */}
          <div className="pt-2 border-t border-sidebar-border/60 space-y-0.5">
            {dynamicBottomItems.map((item) => (
              <NavigationItem
                key={item.id}
                title={item.title}
                path={item.path}
                icon={item.icon}
              />
            ))}
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
