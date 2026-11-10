import React from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { GlobalSearch } from './GlobalSearch';
import { CreateModal } from './CreateModal';
import { AccountSettingsSidebar } from '../settings/AccountSettingsSidebar';
import { ProjectSettingsSidebar } from '../settings/ProjectSettingsSidebar';
import { useNavigation } from '../../context/NavigationContext';
import { useOrganization } from '../../context/OrganizationContext';
import { CreateOrganizationModal } from '../organization/CreateOrganizationModal';
import { JoinOrganizationModal } from '../organization/JoinOrganizationModal';
import { CreateProjectModal } from '../project/CreateProjectModal';
import { CreateTeamModal } from '../team/CreateTeamModal';
import { RequirementsSlideOver } from '../requirements/RequirementsSlideOver';
import { GlobalChatSlideOver } from '../chat/GlobalChatSlideOver';

interface DashboardLayoutProps {
  children?: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const location = useLocation();
  const isAccountSettingsRoute = location.pathname.startsWith('/settings');
  const projectSettingsMatch = location.pathname.match(
    /^(?:\/organizations\/([^/]+))?\/projects\/(\d+)\/settings(?:\/([^/]+))?/
  );
  const isProjectSettingsRoute = Boolean(projectSettingsMatch);
  const currentProjectId = projectSettingsMatch ? parseInt(projectSettingsMatch[2], 10) : 1;
  const currentOrgSlug = projectSettingsMatch ? projectSettingsMatch[1] : undefined;

  const isSettingsActive = isAccountSettingsRoute || isProjectSettingsRoute;
  const {
    isMobileOpen,
    setIsMobileOpen,
    isCreateProjectOpen,
    setIsCreateProjectOpen,
    isCreateTeamOpen,
    setIsCreateTeamOpen,
  } = useNavigation();
  const {
    isCreateModalOpen,
    setIsCreateModalOpen,
    isJoinModalOpen,
    setIsJoinModalOpen,
    currentOrganization,
  } = useOrganization();

  return (
    <div className="flex h-full w-full overflow-hidden bg-[var(--app-bg)] text-[var(--sidebar-text-active)] font-sans antialiased transition-colors duration-200">
      {/* 1. Main Workspace Sidebar (when not in settings) */}
      {!isSettingsActive && <Sidebar />}

      {/* 2. Account Settings Sidebar (when in account settings) */}
      {isAccountSettingsRoute && (
        <>
          {/* Mobile Backdrop */}
          {isMobileOpen && (
            <div
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
            />
          )}

          {/* Sidebar: Full screen height (Desktop fixed, Mobile drawer) */}
          <div
            className={`fixed inset-y-0 left-0 z-50 transform md:transform-none transition-transform duration-300 ease-in-out md:static md:flex h-full flex-shrink-0 ${
              isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
            }`}
          >
            <AccountSettingsSidebar onNavigate={() => setIsMobileOpen(false)} />
          </div>
        </>
      )}

      {/* 3. Project Settings Sidebar (when in project settings) */}
      {isProjectSettingsRoute && (
        <>
          {/* Mobile Backdrop */}
          {isMobileOpen && (
            <div
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
            />
          )}

          {/* Sidebar: Full screen height (Desktop fixed, Mobile drawer) */}
          <div
            className={`fixed inset-y-0 left-0 z-50 transform md:transform-none transition-transform duration-300 ease-in-out md:static md:flex h-full flex-shrink-0 ${
              isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
            }`}
          >
            <ProjectSettingsSidebar
              projectId={currentProjectId}
              orgSlug={currentOrgSlug}
              onNavigate={() => setIsMobileOpen(false)}
            />
          </div>
        </>
      )}

      {/* Main Viewport: Header starts next to sidebar and spans to the end of screen */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[var(--app-bg)] transition-colors duration-200">
        {/* Header bar from sidebar start to end */}
        <Header />

        {/* View Area */}
        <main
          className={
            location.pathname.includes('/whiteboard')
              ? 'flex-1 overflow-hidden min-w-0 flex flex-col'
              : 'flex-1 overflow-y-auto min-w-0'
          }
        >
          {children}
        </main>
      </div>

      {/* Global Command Palette / Search Modal */}
      <GlobalSearch />

      {/* Quick Issue Creator Modal */}
      <CreateModal />

      {/* Create Project Modal (Trigger: Ctrl+Shift+P) */}
      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        organizationSlug={currentOrgSlug || currentOrganization?.slug}
        onCreated={() => {
          setIsCreateProjectOpen(false);
          window.dispatchEvent(new CustomEvent('devflow:project-created'));
        }}
      />

      {/* Create Team Modal (Trigger: Ctrl+Shift+T) */}
      {isCreateTeamOpen && (
        <CreateTeamModal
          onClose={() => setIsCreateTeamOpen(false)}
          onCreated={() => {
            setIsCreateTeamOpen(false);
            window.dispatchEvent(new CustomEvent('devflow:team-created'));
          }}
        />
      )}

      {/* Create Organization Modal */}
      <CreateOrganizationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Join Organization Modal */}
      <JoinOrganizationModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />

      {/* Global Requirements Slide-Over Drawer (Trigger: 'g r' or Ctrl+Shift+R) */}
      <RequirementsSlideOver />

      {/* Global Floating Team Chat Slide-Over Drawer (Trigger: Ctrl+Shift+C) */}
      <GlobalChatSlideOver />
    </div>
  );
};
