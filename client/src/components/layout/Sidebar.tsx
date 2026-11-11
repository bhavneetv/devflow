import React from 'react';
import { useLocation } from 'react-router-dom';
import { Settings, X } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useOrganization } from '../../context/OrganizationContext';
import { SidebarHeader } from './SidebarHeader';
import { SidebarNavigation } from './SidebarNavigation';
import { NavigationItem } from './NavigationItem';
import { UserMenu } from './UserMenu';
import { cn } from '../../lib/utils';

export const Sidebar: React.FC = () => {
  const { isCollapsed, isMobileOpen, setIsMobileOpen, mode, activeProject } = useNavigation();
  const { currentOrganization } = useOrganization();
  const location = useLocation();

  const urlProjectMatch = location.pathname.match(/\/projects\/(\d+)/);
  const currentProjectId = urlProjectMatch ? parseInt(urlProjectMatch[1], 10) : activeProject?.id;
  const isProjectMode = mode === 'project' || Boolean(urlProjectMatch);

  const orgSlug = currentOrganization?.slug;
  const projectSettingsPath = currentProjectId
    ? orgSlug
      ? `/organizations/${orgSlug}/projects/${currentProjectId}/settings`
      : `/projects/${currentProjectId}/settings`
    : '#';

  return (
    <>
      {/* Mobile Drawer Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ease-in-out animate-in fade-in"
        />
      )}

      {/* Main Sidebar Element with Smooth 300ms Animation */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] overflow-x-hidden overflow-y-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] md:static will-change-[width,transform]',
          // Desktop width with smooth expansion / collapse
          isCollapsed ? 'md:w-[60px]' : 'md:w-[250px]',
          // Mobile responsive drawer slide
          isMobileOpen
            ? 'translate-x-0 w-[270px] shadow-2xl'
            : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Mobile close button */}
        <div className="md:hidden flex justify-end p-2 absolute right-1 top-2 z-10">
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 rounded text-[var(--sidebar-icon)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Top Header Section */}
        <SidebarHeader isCollapsed={isCollapsed} />

        {/* Middle Navigation Section */}
        <SidebarNavigation />

        {/* Sticky Project Settings Button directly above settings/account footer */}
        {isProjectMode && currentProjectId && (
          <div
            className={cn(
              'pt-1.5 pb-1 border-t border-[var(--sidebar-border)]/70 shrink-0 bg-[var(--sidebar-bg)] overflow-x-hidden',
              isCollapsed ? 'px-1' : 'px-2'
            )}
          >
            <NavigationItem
              title="Project Settings"
              path={projectSettingsPath}
              icon={Settings}
            />
          </div>
        )}

        {/* Bottom User & Settings Section */}
        <UserMenu isCollapsed={isCollapsed} />
      </aside>
    </>
  );
};
