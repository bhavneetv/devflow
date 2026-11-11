import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import { UserAvatar } from '../common/UserAvatar';
import { FloatingTooltip } from '../common/FloatingTooltip';

interface UserMenuProps {
  isCollapsed?: boolean;
}

export const UserMenu: React.FC<UserMenuProps> = ({ isCollapsed }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ bottom: number; left: number; width: number }>({
    bottom: 20,
    left: 20,
    width: 220,
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();

  const updateCoords = () => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (isCollapsed) {
      setCoords({
        bottom: Math.max(12, window.innerHeight - rect.bottom),
        left: rect.right + 10,
        width: 230,
      });
    } else {
      setCoords({
        bottom: Math.max(12, window.innerHeight - rect.top + 6),
        left: rect.left + 8,
        width: Math.max(210, rect.width - 16),
      });
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      updateCoords();
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleScrollOrResize = () => {
      if (isOpen) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  const currentUser = {
    name: authUser?.name || 'Developer',
    email: authUser?.email || 'developer@devflow.io',
    username: authUser?.username,
    avatarUrl: authUser?.avatarUrl || null,
    avatarType: authUser?.avatarType || 'initials',
    avatarId: authUser?.avatarId || null,
    avatarColor: authUser?.avatarColor || '#8B5CF6',
    role: authUser?.role || 'Member',
  };

  const handleLogout = () => {
    setIsOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <div ref={menuRef} className="relative pt-1 border-t border-sidebar-border px-2 pb-2">
      {/* User profile button */}
      <FloatingTooltip
        content={`${currentUser.name} (Account)`}
        enabled={Boolean(isCollapsed && !isOpen)}
        side="right"
      >
        <button
          onClick={handleToggle}
          className={`w-full flex items-center justify-between p-1.5 rounded-md hover:bg-sidebar-hover transition-colors duration-150 group ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title={!isCollapsed ? `${currentUser.name} (${currentUser.email})` : undefined}
        >
          <div className="flex items-center gap-2.5 truncate">
            <UserAvatar user={currentUser} size="sm" />
            {!isCollapsed && (
              <div className="text-left truncate">
                <div className="text-[13px] font-medium text-sidebar-text-active truncate leading-tight">
                  {currentUser.name}
                </div>
                <div className="text-[11px] text-sidebar-text-muted truncate leading-none mt-0.5">
                  {currentUser.username ? `@${currentUser.username}` : currentUser.email}
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
      </FloatingTooltip>

      {/* Dropdown Menu - Portaled to document.body to prevent clipping */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              left: `${coords.left}px`,
              bottom: `${coords.bottom}px`,
              width: `${coords.width}px`,
            }}
            className="bg-[#161619] dark:bg-[#161619] border border-sidebar-border rounded-lg shadow-2xl py-1.5 text-xs text-zinc-300 z-[99999] animate-in fade-in zoom-in-95 duration-100"
          >
          <div className="px-3 py-2 border-b border-sidebar-border">
            <div className="font-semibold text-white text-[13px]">{currentUser.name}</div>
            <div className="text-zinc-400 text-[11px] truncate">{currentUser.email}</div>
          </div>

          <div className="p-1 space-y-0.5">
            <NavLink
              to="/settings/account/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-sidebar-hover text-zinc-200"
            >
              <UserIcon size={14} className="text-zinc-400" />
              <span>Profile & Account</span>
            </NavLink>

            <NavLink
              to="/settings/account/security"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-sidebar-hover text-zinc-200"
            >
              <Settings size={14} className="text-zinc-400" />
              <span>Security & Access</span>
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
        </div>,
        document.body
      )}
    </div>
  );
};
