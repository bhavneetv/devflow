import React, { useState, useRef, useEffect } from 'react';
import {
  User as UserIcon,
  Settings,
  LogOut,
  Moon,
  Sun,
  ExternalLink,
  ChevronUp,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

interface UserMenuProps {
  isCollapsed?: boolean;
}

export const UserMenu: React.FC<UserMenuProps> = ({ isCollapsed }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const currentUser = {
    name: authUser?.name || 'Alice Johnson',
    email: authUser?.email || 'alice@devflow.io',
    avatarUrl: authUser?.avatarUrl || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    role: authUser?.role || 'Admin',
  };

  const handleLogout = () => {
    setIsOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <div ref={menuRef} className="relative pt-1 border-t border-sidebar-border px-2 pb-2">
      {/* User profile button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-1.5 rounded-md hover:bg-sidebar-hover transition-colors duration-150 group ${
          isCollapsed ? 'justify-center' : ''
        }`}
        title={`${currentUser.name} (${currentUser.email})`}
      >
        <div className="flex items-center gap-2.5 truncate">
          <img
            src={currentUser.avatarUrl}
            alt={currentUser.name}
            className="w-7 h-7 rounded-full object-cover border border-sidebar-border flex-shrink-0"
          />
          {!isCollapsed && (
            <div className="text-left truncate">
              <div className="text-[13px] font-medium text-sidebar-text-active truncate leading-tight">
                {currentUser.name}
              </div>
              <div className="text-[11px] text-sidebar-text-muted truncate leading-none mt-0.5">
                {currentUser.email}
              </div>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <ChevronUp
            size={14}
            className={`text-sidebar-text-muted group-hover:text-sidebar-text-active transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute bottom-full left-2 right-2 mb-2 bg-[#161619] dark:bg-[#161619] border border-sidebar-border rounded-lg shadow-2xl py-1.5 text-xs text-zinc-300 z-50 animate-in fade-in zoom-in-95 duration-100 ${
            isCollapsed ? 'left-12 w-56' : ''
          }`}
        >
          <div className="px-3 py-2 border-b border-sidebar-border">
            <div className="font-semibold text-white text-[13px]">{currentUser.name}</div>
            <div className="text-zinc-400 text-[11px] truncate">{currentUser.email}</div>
          </div>

          <div className="p-1 space-y-0.5">
            <NavLink
              to="/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-sidebar-hover text-zinc-200"
            >
              <UserIcon size={14} className="text-zinc-400" />
              <span>Profile & Account</span>
            </NavLink>

            <NavLink
              to="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-sidebar-hover text-zinc-200"
            >
              <Settings size={14} className="text-zinc-400" />
              <span>Settings</span>
            </NavLink>

            <div className="my-1 border-t border-sidebar-border" />

            <button
              onClick={() => {
                toggleTheme();
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-sidebar-hover text-zinc-200"
            >
              <div className="flex items-center gap-2">
                {theme === 'dark' ? (
                  <Sun size={14} className="text-amber-400" />
                ) : (
                  <Moon size={14} className="text-indigo-400" />
                )}
                <span>Theme</span>
              </div>
              <span className="text-[10px] text-zinc-400 capitalize">{theme} mode</span>
            </button>

            <a
              href="https://linear.app"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-sidebar-hover text-zinc-200"
            >
              <div className="flex items-center gap-2">
                <ExternalLink size={14} className="text-zinc-400" />
                <span>Documentation</span>
              </div>
            </a>

            <div className="my-1 border-t border-sidebar-border" />

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-red-500/10 text-red-400"
            >
              <LogOut size={14} />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
