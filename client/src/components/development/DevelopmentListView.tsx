import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Edit3,
  Eye,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Trash2,
} from 'lucide-react';
import type { DevelopmentTaskItem } from '../../types/development';
import { useAccentTheme } from '../../services/accentTheme.service';
import {
  DevAvatarStack,
  formatDevDate,
  formatEffort,
  PriorityBadge,
  StatusBadge,
  TaskTypeBadge,
} from './devBadges';

interface DevelopmentListViewProps {
  tasks: DevelopmentTaskItem[];
  canEditTasks: boolean;
  onSelectTask: (task: DevelopmentTaskItem) => void;
  onEditTask: (task: DevelopmentTaskItem) => void;
  onQuickStatusChange: (task: DevelopmentTaskItem, status: string) => void;
  onDeleteTask: (task: DevelopmentTaskItem) => void;
}

export const DevelopmentListView: React.FC<DevelopmentListViewProps> = ({
  tasks,
  canEditTasks,
  onSelectTask,
  onEditTask,
  onQuickStatusChange,
  onDeleteTask,
}) => {
  const { accentColor } = useAccentTheme();
  const [menuState, setMenuState] = useState<{
    task: DevelopmentTaskItem;
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    const close = () => setMenuState(null);
    if (menuState) {
      window.addEventListener('scroll', close, true);
      window.addEventListener('resize', close);
      document.addEventListener('mousedown', close);
    }
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('mousedown', close);
    };
  }, [menuState]);

  const openMenu = (e: React.MouseEvent, task: DevelopmentTaskItem) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuState({
      task,
      top: Math.min(window.innerHeight - 170, rect.bottom + 6),
      left: Math.min(window.innerWidth - 190, Math.max(8, rect.right - 176)),
    });
  };

  return (
    <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#27272A] bg-[#12141B]/80 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              <th className="py-3 px-4">Key</th>
              <th className="py-3 px-3 min-w-[240px]">Work Item</th>
              <th className="py-3 px-3">Module / Submodule</th>
              <th className="py-3 px-3">Type</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Priority</th>
              <th className="py-3 px-3">Assignees</th>
              <th className="py-3 px-3">Due Date</th>
              <th className="py-3 px-3">Effort</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#27272A]/60 text-xs">
            {tasks.map((task) => (
              <tr
                key={task.id}
                onClick={() => onSelectTask(task)}
                className="group hover:bg-[#151720] transition-colors cursor-pointer"
              >
                <td className="py-3 px-4 font-mono text-[11px] font-semibold whitespace-nowrap">
                  <span style={{ color: accentColor }}>{task.taskKey}</span>
                </td>

                <td className="py-3 px-3 max-w-[320px]">
                  <div className="font-medium text-white group-hover:text-white truncate">
                    {task.title}
                  </div>
                  {(task.labels.length > 0 || task.commentCount > 0 || task.attachmentCount > 0) && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {task.labels.slice(0, 2).map((lbl) => (
                        <span
                          key={lbl}
                          className="px-1.5 py-0.5 rounded bg-[#1A1C26] border border-[#27272A] text-[10px] text-zinc-400"
                        >
                          #{lbl}
                        </span>
                      ))}
                      {task.labels.length > 2 && (
                        <span className="text-[10px] text-zinc-500">
                          +{task.labels.length - 2}
                        </span>
                      )}
                      {task.commentCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-500">
                          <MessageSquare size={10} />
                          {task.commentCount}
                        </span>
                      )}
                      {task.attachmentCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-500">
                          <Paperclip size={10} />
                          {task.attachmentCount}
                        </span>
                      )}
                    </div>
                  )}
                </td>

                <td className="py-3 px-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: task.module?.color || accentColor }}
                    />
                    <span className="text-zinc-200 font-medium">{task.module?.name}</span>
                  </div>
                  <div className="text-[11px] text-zinc-500 pl-3.5 truncate max-w-[160px]">
                    {task.submodule?.name}
                  </div>
                </td>

                <td className="py-3 px-3 whitespace-nowrap">
                  <TaskTypeBadge taskType={task.taskType} compact />
                </td>

                <td className="py-3 px-3 whitespace-nowrap">
                  <StatusBadge status={task.status} compact />
                </td>

                <td className="py-3 px-3 whitespace-nowrap">
                  <PriorityBadge priority={task.priority} compact />
                </td>

                <td className="py-3 px-3 whitespace-nowrap">
                  <DevAvatarStack users={task.assignees} max={3} size="xs" />
                </td>

                <td className="py-3 px-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <Calendar
                      size={11}
                      className={
                        task.isOverdue
                          ? 'text-red-400'
                          : task.isDueSoon
                          ? 'text-amber-400'
                          : 'text-zinc-500'
                      }
                    />
                    <span
                      className={
                        task.isOverdue
                          ? 'text-red-400 font-medium'
                          : task.isDueSoon
                          ? 'text-amber-300 font-medium'
                          : 'text-zinc-300'
                      }
                    >
                      {formatDevDate(task.dueDate)}
                    </span>
                    {task.isOverdue && (
                      <span title="Overdue" className="inline-flex">
                        <AlertTriangle size={11} className="text-red-400" />
                      </span>
                    )}
                  </div>
                </td>

                <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-zinc-400">
                  {formatEffort(task.estimatedEffort, task.effortUnit)}
                </td>

                <td
                  className="py-3 px-4 text-right whitespace-nowrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => openMenu(e, task)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1E202B] transition-colors cursor-pointer"
                  >
                    <MoreVertical size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {menuState &&
        createPortal(
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{ top: menuState.top, left: menuState.left }}
            className="fixed w-44 rounded-xl bg-[#111319] border border-[#27272A] shadow-2xl py-1.5 z-[9990] text-xs"
          >
            <button
              type="button"
              onClick={() => {
                onSelectTask(menuState.task);
                setMenuState(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-zinc-200 hover:bg-white/[0.06] cursor-pointer"
            >
              <Eye size={13} className="text-zinc-400" />
              <span>View Details</span>
            </button>
            {canEditTasks && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onEditTask(menuState.task);
                    setMenuState(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-zinc-200 hover:bg-white/[0.06] cursor-pointer"
                >
                  <Edit3 size={13} className="text-zinc-400" />
                  <span>Edit Task</span>
                </button>
                {menuState.task.status !== 'Completed' && (
                  <button
                    type="button"
                    onClick={() => {
                      onQuickStatusChange(menuState.task, 'Completed');
                      setMenuState(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-emerald-300 hover:bg-white/[0.06] cursor-pointer"
                  >
                    <CheckCircle2 size={13} />
                    <span>Mark Completed</span>
                  </button>
                )}
                <div className="my-1 border-t border-[#27272A]" />
                <button
                  type="button"
                  onClick={() => {
                    onDeleteTask(menuState.task);
                    setMenuState(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Delete Task</span>
                </button>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

