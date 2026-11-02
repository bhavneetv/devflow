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
    favorites,
    removeFavorite,
    isCollapsed,
  } = useNavigation();

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

  return (
    <div className="flex-1 overflow-y-auto px-2 space-y-2 py-1.5 text-sidebar-text">
      {mode === 'workspace' ? (
        /* Workspace Mode: Exactly the 8 requested items in order + Favorites */
        <>
          {/* Items 1 to 6 */}
          <div className="space-y-0.5">
            {mainWorkspaceNavItems.map((item) => (
              <NavigationItem
                key={item.id}
                title={item.title}
                path={item.path}
                icon={item.icon}
                badge={item.badge}
                badgeVariant={item.badgeVariant}
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

          {/* Items 7 and 8 (Settings, Help & Support) */}
          <div className="pt-2 border-t border-sidebar-border/60 space-y-0.5">
            {bottomWorkspaceNavItems.map((item) => (
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
