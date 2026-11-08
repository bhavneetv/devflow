import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LucideIcon, Star } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigation } from '../../context/NavigationContext';

interface NavigationItemProps {
  title: string;
  path: string;
  icon?: LucideIcon;
  badge?: string | number;
  badgeVariant?: 'default' | 'subtle' | 'accent';
  level?: number;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  starPosition?: 'left' | 'right';
  customIcon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const NavigationItem: React.FC<NavigationItemProps> = ({
  title,
  path,
  icon: Icon,
  badge,
  badgeVariant = 'subtle',
  level = 0,
  isFavorite,
  onToggleFavorite,
  starPosition = 'right',
  customIcon,
  onClick,
  className,
}) => {
  const location = useLocation();
  const { isCollapsed, setIsMobileOpen } = useNavigation();

  // Active match check: either exact path or starting with path for deep sub-routes
  const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path + '/'));

  const handleClick = () => {
    if (onClick) onClick();
    setIsMobileOpen(false);
  };

  return (
    <NavLink
      to={path}
      onClick={handleClick}
      className={cn(
        'group flex items-center rounded-md transition-all duration-200 select-none relative overflow-hidden',
        level === 1 && !isCollapsed
          ? 'h-[32px] text-[13px]'
          : 'h-[34px] text-[13.5px]',
        isCollapsed ? 'justify-center px-0 w-10 mx-auto' : 'justify-between px-2 w-full',
        level === 2 && !isCollapsed && 'ml-7 pl-2 border-l border-sidebar-border',
        isActive
          ? 'bg-sidebar-active text-sidebar-text-active font-medium'
          : level === 1
            ? 'text-zinc-400 hover:text-zinc-100 hover:bg-sidebar-hover'
            : 'text-sidebar-text hover:text-sidebar-text-active hover:bg-sidebar-hover',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 min-w-0 transition-all duration-200',
          isCollapsed && 'justify-center'
        )}
      >
        {!isCollapsed && onToggleFavorite && starPosition === 'left' && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={cn(
              'p-0.5 -ml-1 rounded transition-colors shrink-0',
              isFavorite
                ? 'text-amber-400 opacity-100 hover:text-amber-300'
                : 'text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-amber-400'
            )}
            title={isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
          >
            <Star size={13} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        )}

        {customIcon ? (
          <div className="shrink-0 flex items-center justify-center">{customIcon}</div>
        ) : Icon ? (
          <Icon
            size={level === 1 ? 15 : 16}
            className={cn(
              'flex-shrink-0 transition-colors duration-150',
              isActive
                ? 'text-sidebar-icon-active'
                : 'text-sidebar-icon group-hover:text-sidebar-text-active'
            )}
          />
        ) : (
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            <span className={cn('w-1.5 h-1.5 rounded-full', isActive ? 'bg-white' : 'bg-zinc-600')} />
          </div>
        )}
        {!isCollapsed && (
          <span className="truncate tracking-[-0.01em] transition-opacity duration-200">{title}</span>
        )}
      </div>

      {!isCollapsed && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {badge !== undefined && (
            <span
              className={cn(
                'px-1.5 py-0.2 rounded text-[11px] font-medium leading-tight',
                badgeVariant === 'accent'
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-sidebar-text-muted bg-[var(--sidebar-border)] group-hover:text-sidebar-text-active'
              )}
            >
              {badge}
            </span>
          )}

          {onToggleFavorite && starPosition === 'right' && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite();
              }}
              className={cn(
                'p-0.5 rounded text-zinc-500 hover:text-amber-400 transition-opacity',
                isFavorite ? 'opacity-100 text-amber-400' : 'opacity-0 group-hover:opacity-100'
              )}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star size={12} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
      )}

      {/* Floating tooltip on hover when collapsed */}
      {isCollapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-[#1C1C1F] border border-sidebar-border text-white text-xs font-medium rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
          {title}
        </div>
      )}
    </NavLink>
  );
};
