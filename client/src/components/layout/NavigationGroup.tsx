import React from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';

interface NavigationGroupProps {
  id: string;
  title: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  onAction?: () => void;
  actionTitle?: string;
  children: React.ReactNode;
}

export const NavigationGroup: React.FC<NavigationGroupProps> = ({
  id,
  title,
  collapsible = true,
  defaultExpanded = true,
  onAction,
  actionTitle,
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
    <div className="pt-3 pb-1 select-none">
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
          <button
            type="button"
            onClick={onAction}
            title={actionTitle || 'Add'}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-500 hover:text-white hover:bg-sidebar-hover transition-all"
          >
            <Plus size={13} />
          </button>
        )}
      </div>

      {/* Children list */}
      {isExpanded && <div className="space-y-0.5">{children}</div>}
    </div>
  );
};
