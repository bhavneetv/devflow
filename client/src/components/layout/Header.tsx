import React, { useState, useRef, useEffect } from 'react';
import {
  PanelLeftClose,
  PanelLeft,
  Search,
  HelpCircle,
  Menu,
  Moon,
  Sun,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useTheme } from '../../context/ThemeContext';
import { Breadcrumbs } from './Breadcrumbs';
import { NotificationMenu } from './NotificationMenu';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserAvatar } from '../common/UserAvatar';

export const Header: React.FC = () => {
  const location = useLocation();
  const isSettingsRoute = location.pathname.startsWith('/settings');
  const {
    isCollapsed,
    toggleSidebar,
    setIsMobileOpen,
    setIsSearchOpen,
  } = useNavigation();

  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setIsHelpOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <header className="h-[56px] bg-[var(--header-bg)] border-b border-[var(--header-border)] px-3.5 flex items-center justify-between gap-4 sticky top-0 z-30 select-none transition-colors duration-200">
      {/* Left Section: Sidebar Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile menu trigger */}
        <button
          onClick={() => setIsMobileOpen(true)}
          className="md:hidden p-1.5 rounded-md text-[var(--sidebar-icon)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)]"
          title="Open menu"
        >
          <Menu size={18} />
        </button>

        {/* Desktop sidebar collapse / expand toggle */}
        <button
          onClick={toggleSidebar}
          className="hidden md:flex p-1.5 rounded-md text-[var(--sidebar-icon)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)] border border-transparent hover:border-[var(--sidebar-border)] transition-all duration-200"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>

        <div className="h-4 w-[1px] bg-[var(--header-border)] hidden sm:block" />

        {/* Breadcrumb Navigation */}
        <Breadcrumbs />
      </div>

      {/* Right Section: Specs Launcher -> Search Bar -> Dark Mode Button -> Notifications -> Help -> Avatar */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Quick Requirements Launcher */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('devflow:toggle-requirements-drawer'))}
          className="hidden sm:flex items-center gap-1.5 h-[34px] px-2.5 rounded-lg text-xs font-medium text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text-active)] bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--header-border)] hover:border-blue-500/50 transition-all cursor-pointer shadow-sm"
          title="Requirements Quick Hub (Shortcut: g then r)"
        >
          <FileText size={14} className="text-blue-400 shrink-0" />
          <span className="hidden md:inline font-medium">Specs</span>
          <kbd className="px-1 py-0.2 rounded bg-[var(--sidebar-border)] text-[9.5px] font-mono text-[var(--sidebar-text-muted)]">
            g r
          </kbd>
        </button>

        {/* Search Bar placed directly left to the Dark Mode button */}
        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="flex items-center justify-between h-[34px] w-48 sm:w-64 px-3 bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--header-border)] hover:border-zinc-500 rounded-lg text-xs text-[var(--sidebar-text-muted)] transition-all duration-150 group cursor-pointer shadow-sm"
          title={isSettingsRoute ? 'Search in settings (Ctrl + K)' : 'Search or jump to (Ctrl + K)'}
        >
          <div className="flex items-center gap-2 truncate">
            <Search size={14} className="text-[var(--sidebar-icon)] group-hover:text-[var(--sidebar-text-active)] transition-colors" />
            <span className="truncate group-hover:text-[var(--sidebar-text-active)]">
              {isSettingsRoute ? 'Search in settings...' : 'Search...'}
            </span>
          </div>

          <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-[var(--sidebar-border)] text-[10px] font-mono text-[var(--sidebar-text-muted)]">
            Ctrl K
          </kbd>
        </button>

        {/* Dark Mode Toggle Button */}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--sidebar-icon)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)] border border-[var(--header-border)] transition-all duration-150 relative"
          title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
        >
          {theme === 'dark' ? (
            <Sun size={16} className="text-amber-400 hover:rotate-45 transition-transform duration-200" />
          ) : (
            <Moon size={16} className="text-indigo-600 hover:-rotate-12 transition-transform duration-200" />
          )}
        </button>

        {/* Notifications Dropdown */}
        <NotificationMenu />

        {/* Help Menu */}
        <div ref={helpRef} className="relative">
          <button
            onClick={() => setIsHelpOpen(!isHelpOpen)}
            className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--sidebar-icon)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)] border border-transparent hover:border-[var(--sidebar-border)] transition-colors"
            title="Help & Support"
          >
            <HelpCircle size={16} />
          </button>

          {isHelpOpen && (
            <div className="absolute right-0 top-10 w-64 bg-[#161619] border border-sidebar-border rounded-xl shadow-2xl p-1 z-50 text-xs text-zinc-300 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2.5 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Support & Resources
              </div>

              <a
                href="https://linear.app"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-sidebar-hover text-zinc-300"
              >
                <span>Documentation</span>
                <ExternalLink size={12} className="text-zinc-500" />
              </a>

              <button
                onClick={() => {
                  setIsHelpOpen(false);
                  setIsSearchOpen(true);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-sidebar-hover text-zinc-300 text-left"
              >
                <span>Keyboard Shortcuts</span>
                <kbd className="px-1 py-0.2 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-400">
                  ?
                </kbd>
              </button>

              <div className="my-1 border-t border-sidebar-border" />

              <div className="p-2 bg-[#121215] rounded-md border border-sidebar-border/50 text-[11px] text-zinc-400">
                <div className="font-medium text-white mb-0.5">DevFlow v1.0</div>
                Connected to Node + MySQL (XAMPP) via Prisma
              </div>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <Link
          to="/settings/account/profile"
          className="rounded-full overflow-hidden border border-[var(--sidebar-border)] hover:border-[var(--settings-accent)] transition-all flex-shrink-0 cursor-pointer hover:scale-105"
          title={`${user?.name || 'Account'} (Settings)`}
        >
          <UserAvatar user={user} size="sm" />
        </Link>
      </div>
    </header>
  );
};
