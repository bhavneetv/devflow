import React from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { SidebarHeader } from './SidebarHeader';
import { SidebarNavigation } from './SidebarNavigation';
import { UserMenu } from './UserMenu';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { isCollapsed, isMobileOpen, setIsMobileOpen } = useNavigation();

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
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] md:static will-change-[width,transform]',
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

        {/* Bottom User & Settings Section */}
        <UserMenu isCollapsed={isCollapsed} />
      </aside>
    </>
  );
};
