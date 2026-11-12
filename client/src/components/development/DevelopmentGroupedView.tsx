import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import type { DevAssigneeGroups, DevelopmentTaskItem } from '../../types/development';
import { useAccentTheme } from '../../services/accentTheme.service';
import type { DevGroupByMode } from './DevelopmentToolbar';
import {
  DevAvatarStack,
  formatDevDate,
  PriorityBadge,
  StatusBadge,
  TaskTypeBadge,
} from './devBadges';

interface DevelopmentGroupedViewProps {
  tasks: DevelopmentTaskItem[];
  assigneeGroups?: DevAssigneeGroups;
  groupBy: Exclude<DevGroupByMode, 'none'> | DevGroupByMode;
  onSelectTask: (task: DevelopmentTaskItem) => void;
}

export const DevelopmentGroupedView: React.FC<DevelopmentGroupedViewProps> = ({
  tasks,
  assigneeGroups,
  groupBy,
  onSelectTask,
}) => {
  const { accentColor } = useAccentTheme();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; color?: string | null; items: DevelopmentTaskItem[] }>();

    const add = (key: string, label: string, color: string | null | undefined, task: DevelopmentTaskItem) => {
      if (!map.has(key)) {
        map.set(key, { label, color, items: [] });
      }
      map.get(key)!.items.push(task);
    };

    for (const task of tasks) {
      if (groupBy === 'module') {
        add(
          `mod-${task.moduleId}`,
          task.module?.name || 'Uncategorized Module',
          task.module?.color || accentColor,
          task
        );
      } else if (groupBy === 'submodule') {
        add(
          `sub-${task.submoduleId}`,
          `${task.module?.name || 'Module'} / ${task.submodule?.name || 'Submodule'}`,
          task.module?.color || accentColor,
          task
        );
      } else if (groupBy === 'priority') {
        add(`pri-${task.priority}`, task.priority, accentColor, task);
      } else if (groupBy === 'status') {
        add(`st-${task.status}`, task.status, accentColor, task);
      } else if (groupBy === 'assignee') {
        if (!task.assignees || task.assignees.length === 0) {
          add('unassigned', 'Unassigned', '#71717A', task);
        } else {
          for (const u of task.assignees) {
            add(`user-${u.id}`, u.name, u.avatarColor || accentColor, task);
          }
        }
      }
    }

    return Array.from(map.entries()).map(([key, val]) => ({ key, ...val }));
  }, [tasks, groupBy, accentColor]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-3">
      {groups.map((grp) => {
        const isCollapsed = Boolean(collapsedGroups[grp.key]);
        const completedInGroup = grp.items.filter((t) => t.status === 'Completed').length;

        return (
          <div
            key={grp.key}
            className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] overflow-hidden shadow-xl"
          >
            <button
              type="button"
              onClick={() => toggleGroup(grp.key)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#12141B]/80 hover:bg-[#161822] border-b border-[#27272A]/70 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                {isCollapsed ? (
                  <ChevronRight size={15} className="text-zinc-400" />
                ) : (
                  <ChevronDown size={15} className="text-zinc-400" />
                )}
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: grp.color || accentColor }}
                />
                <span className="text-xs font-semibold text-white">{grp.label}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#181A22] border border-[#27272A] text-zinc-300">
                  {grp.items.length}
                </span>
              </div>
              <span className="text-[11px] font-mono text-zinc-500">
                {completedInGroup}/{grp.items.length} completed
              </span>
            </button>

            {!isCollapsed && (
              <div className="divide-y divide-[#27272A]/60">
                {grp.items.map((task) => (
                  <div
                    key={`${grp.key}-${task.id}`}
                    onClick={() => onSelectTask(task)}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 hover:bg-[#151720] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className="text-[11px] font-mono font-semibold shrink-0"
                        style={{ color: accentColor }}
                      >
                        {task.taskKey}
                      </span>
                      <span className="text-xs font-medium text-white truncate">{task.title}</span>
                      <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-zinc-500 shrink-0">
                        <Layers size={11} />
                        {task.module?.name} / {task.submodule?.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <TaskTypeBadge taskType={task.taskType} compact />
                      <StatusBadge status={task.status} compact />
                      <PriorityBadge priority={task.priority} compact />
                      <span className="text-[11px] text-zinc-400 hidden sm:inline">
                        {formatDevDate(task.dueDate)}
                      </span>
                      <DevAvatarStack
                        users={task.assignees}
                        assignedTeams={task.assignedTeams}
                        max={2}
                        size="xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

