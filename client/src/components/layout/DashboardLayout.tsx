import React from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { GlobalSearch } from './GlobalSearch';
import { CreateModal } from './CreateModal';

interface DashboardLayoutProps {
  children?: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const location = useLocation();
  const isSettingsRoute = location.pathname.startsWith('/settings');

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--app-bg)] text-[var(--sidebar-text-active)] font-sans antialiased transition-colors duration-200">
      {/* Sidebar (Compact, Linear-styled, collapsible) */}
      {!isSettingsRoute && <Sidebar />}

      {/* Main Workspace Viewport */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[var(--app-bg)] transition-colors duration-200">
        {/* Header */}
        <Header />

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto">
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
