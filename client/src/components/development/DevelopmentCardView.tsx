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
import type { DevAssigneeGroups, DevelopmentTaskItem } from '../../types/development';
import { useAccentTheme } from '../../services/accentTheme.service';
import {
  DevAvatarStack,
  formatDevDate,
  PriorityBadge,
  StatusBadge,
  TaskTypeBadge,
} from './devBadges';

interface DevelopmentCardViewProps {
  tasks: DevelopmentTaskItem[];
  assigneeGroups?: DevAssigneeGroups;
  canEditTasks: boolean;
  onSelectTask: (task: DevelopmentTaskItem) => void;
  onEditTask: (task: DevelopmentTaskItem) => void;
  onQuickStatusChange: (task: DevelopmentTaskItem, status: string) => void;
  onDeleteTask: (task: DevelopmentTaskItem) => void;
}

export const DevelopmentCardView: React.FC<DevelopmentCardViewProps> = ({
  tasks,
  assigneeGroups,
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
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {tasks.map((task) => (
        <div
          key={task.id}
          onClick={() => onSelectTask(task)}
          className="group rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] hover:border-zinc-600 p-4 shadow-xl transition-all cursor-pointer flex flex-col justify-between gap-3.5"
        >
          {/* Top Row: Key + Badges + Action Menu */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#161820] border border-[#27272A]"
                  style={{ color: accentColor }}
                >
                  {task.taskKey}
                </span>
                <TaskTypeBadge taskType={task.taskType} compact />
                <PriorityBadge priority={task.priority} compact />
              </div>

              <button
                type="button"
                onClick={(e) => openMenu(e, task)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1E202B] transition-colors cursor-pointer shrink-0"
              >
                <MoreVertical size={14} />
              </button>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-white">
                {task.title}
              </h4>
              {task.description && (
                <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                  {task.description}
                </p>
              )}
            </div>

            {/* Module -> Submodule pill */}
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 bg-[#12141B] border border-[#27272A]/80 rounded-lg px-2.5 py-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: task.module?.color || accentColor }}
              />
              <span className="font-medium text-zinc-200 truncate">{task.module?.name}</span>
              <span className="text-zinc-600">/</span>
              <span className="truncate">{task.submodule?.name}</span>
            </div>

            {/* Labels */}
            {task.labels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {task.labels.slice(0, 4).map((lbl) => (
                  <span
                    key={lbl}
                    className="px-2 py-0.5 rounded-md bg-[#161820] border border-[#27272A] text-[10px] text-zinc-400"
                  >
                    #{lbl}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Footer: Status + Due + Assignees */}
          <div className="pt-3 border-t border-[#27272A]/70 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={task.status} compact />
              {task.dueDate && (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] ${
                    task.isOverdue
                      ? 'text-red-400 font-medium'
                      : task.isDueSoon
                      ? 'text-amber-300 font-medium'
                      : 'text-zinc-400'
                  }`}
                >
                  {task.isOverdue ? <AlertTriangle size={11} /> : <Calendar size={11} />}
                  <span>{formatDevDate(task.dueDate)}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {task.commentCount > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[11px] text-zinc-500">
                  <MessageSquare size={11} />
                  {task.commentCount}
                </span>
              )}
              {task.attachmentCount > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[11px] text-zinc-500">
                  <Paperclip size={11} />
                  {task.attachmentCount}
                </span>
              )}
              <DevAvatarStack
                users={task.assignees}
                assignedTeams={task.assignedTeams}
                max={3}
                size="xs"
              />
            </div>
          </div>
        </div>
      ))}

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

