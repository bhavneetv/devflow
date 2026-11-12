import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  MessageSquare,
  Paperclip,
} from 'lucide-react';
import type { DevelopmentTaskItem } from '../../types/development';
import { useAccentTheme } from '../../services/accentTheme.service';
import {
  DevAvatarStack,
  formatDevDate,
  getStatusStyle,
  PriorityBadge,
  TaskTypeBadge,
} from './devBadges';
import { AnimatedSelect } from '../settings/AnimatedSelect';

interface DevelopmentBoardViewProps {
  tasks: DevelopmentTaskItem[];
  statuses: string[];
  canEditTasks: boolean;
  onSelectTask: (task: DevelopmentTaskItem) => void;
  onQuickStatusChange: (task: DevelopmentTaskItem, newStatus: string) => void;
}

export const DevelopmentBoardView: React.FC<DevelopmentBoardViewProps> = ({
  tasks,
  statuses,
  canEditTasks,
  onSelectTask,
  onQuickStatusChange,
}) => {
  const { accentColor } = useAccentTheme();
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  const allColumns = Array.from(
    new Set([...statuses, ...tasks.map((t) => t.status)])
  );

  const handleDragStart = (e: React.DragEvent, task: DevelopmentTaskItem) => {
    if (!canEditTasks) return;
    setDraggingTaskId(task.id);
    e.dataTransfer.setData('text/plain', String(task.id));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverStatus(null);
    if (!canEditTasks) return;
    const rawId = e.dataTransfer.getData('text/plain');
    const id = draggingTaskId ?? parseInt(rawId, 10);
    setDraggingTaskId(null);
    const task = tasks.find((t) => t.id === id);
    if (task && task.status !== targetStatus) {
      onQuickStatusChange(task, targetStatus);
    }
  };

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid grid-flow-col auto-cols-[minmax(285px,1fr)] gap-3.5 min-w-full">
        {allColumns.map((colStatus) => {
          const style = getStatusStyle(colStatus);
          const StatusIcon = style.icon;
          const colTasks = tasks.filter((t) => t.status === colStatus);
          const isDropTarget = dragOverStatus === colStatus;

          return (
            <div
              key={colStatus}
              onDragOver={(e) => {
                if (!canEditTasks) return;
                e.preventDefault();
                setDragOverStatus(colStatus);
              }}
              onDragLeave={() => setDragOverStatus((prev) => (prev === colStatus ? null : prev))}
              onDrop={(e) => handleDrop(e, colStatus)}
              className="rounded-2xl bg-[#0E0F14]/95 border flex flex-col max-h-[72vh] transition-colors"
              style={{
                borderColor: isDropTarget ? accentColor : '#27272A',
                boxShadow: isDropTarget ? `0 0 0 1px ${accentColor}50` : undefined,
              }}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-3.5 py-3 border-b border-[#27272A] bg-[#12141B]/70 rounded-t-2xl shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: style.bg, color: style.color }}
                  >
                    <StatusIcon size={13} />
                  </span>
                  <span className="text-xs font-semibold text-white truncate">{colStatus}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#181A22] border border-[#27272A] text-zinc-300">
                  {colTasks.length}
                </span>
              </div>

              {/* Column Cards */}
              <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
                {colTasks.length === 0 ? (
                  <div className="py-8 px-3 text-center rounded-xl border border-dashed border-[#27272A] text-[11px] text-zinc-500">
                    {isDropTarget ? 'Drop task here' : 'No items in this stage'}
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable={canEditTasks}
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={() => {
                        setDraggingTaskId(null);
                        setDragOverStatus(null);
                      }}
                      onClick={() => onSelectTask(task)}
                      className={`rounded-xl bg-[#13151C] hover:bg-[#171923] border border-[#27272A] hover:border-zinc-600 p-3 space-y-2.5 transition-all cursor-pointer ${
                        draggingTaskId === task.id ? 'opacity-50 scale-[0.98]' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-[10px] font-mono font-bold"
                          style={{ color: accentColor }}
                        >
                          {task.taskKey}
                        </span>
                        <PriorityBadge priority={task.priority} compact />
                      </div>

                      <h4 className="text-xs font-semibold text-white leading-snug line-clamp-2">
                        {task.title}
                      </h4>

                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: task.module?.color || accentColor }}
                        />
                        <span className="truncate">{task.module?.name}</span>
                        <span className="text-zinc-600">/</span>
                        <span className="truncate text-zinc-500">{task.submodule?.name}</span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#27272A]/70">
                        <div className="flex items-center gap-2">
                          <TaskTypeBadge taskType={task.taskType} compact />
                          {task.dueDate && (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] ${
                                task.isOverdue
                                  ? 'text-red-400 font-medium'
                                  : task.isDueSoon
                                  ? 'text-amber-300'
                                  : 'text-zinc-400'
                              }`}
                            >
                              {task.isOverdue ? (
                                <AlertTriangle size={10} />
                              ) : (
                                <Calendar size={10} />
                              )}
                              {formatDevDate(task.dueDate)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
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
                          <DevAvatarStack users={task.assignees} max={2} size="xs" />
                        </div>
                      </div>

                      {/* Accessible inline stage switcher */}
                      {canEditTasks && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="pt-1 flex items-center gap-1.5"
                        >
                          <ArrowRightLeft size={10} className="text-zinc-500 shrink-0" />
                          <div className="flex-1">
                            <AnimatedSelect
                              value={task.status}
                              onChange={(nextSt) => {
                                if (nextSt && nextSt !== task.status) {
                                  onQuickStatusChange(task, nextSt);
                                }
                              }}
                              accentColor={accentColor}
                              dropdownMinWidth="w-40"
                              options={allColumns.map((s) => ({ value: s, label: s }))}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

