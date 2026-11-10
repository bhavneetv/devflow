import React from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { cn } from '../../lib/utils';

interface NavigationGroupProps {
  id: string;
  title: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  onAction?: () => void;
  actionTitle?: string;
  actionShortcut?: string;
  className?: string;
  children: React.ReactNode;
}

export const NavigationGroup: React.FC<NavigationGroupProps> = ({
  id,
  title,
  collapsible = true,
  defaultExpanded = true,
  onAction,
  actionTitle,
  actionShortcut,
  className,
  children,
}) => {
  const { isCollapsed, isGroupExpanded, toggleGroup } = useNavigation();
  const isExpanded = isGroupExpanded(id, defaultExpanded);

  if (isCollapsed) {
    return (
      <div className="py-2 border-t border-sidebar-border/40 first:border-0">
        <div className="space-y-1">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn('pt-2 pb-0.5 select-none', className)}>
      {/* Group Header */}
      <div className="flex items-center justify-between px-2.5 mb-1 group">
        <button
          type="button"
          onClick={() => collapsible && toggleGroup(id)}
          className={`flex items-center gap-1.5 text-[11.5px] font-semibold text-sidebar-text-muted hover:text-zinc-200 transition-colors uppercase tracking-wider ${
            collapsible ? 'cursor-pointer' : 'cursor-default'
          }`}
        >
          <span>{title}</span>
          {collapsible && (
            <ChevronDown
              size={12}
              className={`text-zinc-500 group-hover:text-zinc-300 transition-transform duration-150 ${
                isExpanded ? '' : '-rotate-90'
              }`}
            />
          )}
        </button>

        {onAction && (
          <div className="flex items-center gap-1">
            {actionShortcut && (
              <kbd className="hidden sm:inline-flex items-center px-1 py-0.2 rounded text-[9px] font-mono font-medium text-zinc-500 bg-white/[0.04] border border-white/[0.08] opacity-0 group-hover:opacity-100 transition-opacity">
                {actionShortcut}
              </kbd>
            )}
            <button
              type="button"
              onClick={onAction}
              title={actionTitle ? `${actionTitle}${actionShortcut ? ` (${actionShortcut})` : ''}` : 'Add'}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-500 hover:text-white hover:bg-sidebar-hover transition-all"
            >
              <Plus size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Children list */}
      {isExpanded && <div className="space-y-0.5">{children}</div>}
    </div>
  );
};
