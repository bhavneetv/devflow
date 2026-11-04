import React from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { GlobalSearch } from './GlobalSearch';
import { CreateModal } from './CreateModal';
import { AccountSettingsSidebar } from '../settings/AccountSettingsSidebar';
import { useNavigation } from '../../context/NavigationContext';

interface DashboardLayoutProps {
  children?: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const location = useLocation();
  const isSettingsRoute = location.pathname.startsWith('/settings');
  const { isMobileOpen, setIsMobileOpen } = useNavigation();

  return (
    <div className="flex h-full w-full overflow-hidden bg-[var(--app-bg)] text-[var(--sidebar-text-active)] font-sans antialiased transition-colors duration-200">
      {/* 1. Main Workspace Sidebar (when not in settings) */}
      {!isSettingsRoute && <Sidebar />}

      {/* 2. Account Settings Sidebar (when in settings) - Reaches all the way to top of screen */}
      {isSettingsRoute && (
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

      {/* Main Viewport: Header starts next to sidebar and spans to the end of screen */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[var(--app-bg)] transition-colors duration-200">
        {/* Header bar from sidebar start to end */}
        <Header />

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto min-w-0">
          {children}
        </main>
      </div>

      {/* Global Command Palette / Search Modal */}
      <GlobalSearch />

      {/* Quick Issue Creator Modal */}
      <CreateModal />
    </div>
  );
};
