import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import type { DevelopmentTaskItem } from '../../types/development';
import { useAccentTheme } from '../../services/accentTheme.service';
import { getStatusStyle, PRIORITY_STYLES } from './devBadges';

interface DevelopmentCalendarViewProps {
  tasks: DevelopmentTaskItem[];
  onSelectTask: (task: DevelopmentTaskItem) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toLocalDateKey(isoOrDate?: string | null): string | null {
  if (!isoOrDate) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) return isoOrDate;
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export const DevelopmentCalendarView: React.FC<DevelopmentCalendarViewProps> = ({
  tasks,
  onSelectTask,
}) => {
  const { accentColor } = useAccentTheme();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const todayKey = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const { cells, tasksByDate, unscheduledTasks, scheduledInMonthCount } = useMemo(() => {
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const gridCells: { dateKey: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Leading days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const pm = month === 0 ? 11 : month - 1;
      const py = month === 0 ? year - 1 : year;
      gridCells.push({
        dateKey: `${py}-${String(pm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      gridCells.push({
        dateKey: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    // Trailing days to complete 35 or 42 cell grid
    const totalNeeded = gridCells.length <= 35 ? 35 : 42;
    let nextDay = 1;
    while (gridCells.length < totalNeeded) {
      const nm = month === 11 ? 0 : month + 1;
      const ny = month === 11 ? year + 1 : year;
      gridCells.push({
        dateKey: `${ny}-${String(nm + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`,
        dayNum: nextDay,
        isCurrentMonth: false,
      });
      nextDay++;
    }

    type CalendarTaskEntry = {
      task: DevelopmentTaskItem;
      spanPosition: 'single' | 'start' | 'middle' | 'end';
      isCompletedSpan: boolean;
    };

    const map = new Map<string, CalendarTaskEntry[]>();
    const unscheduled: DevelopmentTaskItem[] = [];
    const scheduledTaskIdsInMonth = new Set<number>();
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

    for (const t of tasks) {
      if (!t.startDate && !t.dueDate) {
        unscheduled.push(t);
        continue;
      }

      const isEnded = Boolean(
        t.isEndStatus || t.completedAt || t.status.trim().toLowerCase() === 'completed'
      );
      const completedKey = isEnded && t.completedAt ? toLocalDateKey(t.completedAt) : null;
      const fallbackStart = toLocalDateKey(t.createdAt);
      const rawStart =
        t.startDate ||
        (t.dueDate && fallbackStart && fallbackStart <= t.dueDate ? fallbackStart : t.dueDate) ||
        completedKey;
      const rawEnd = completedKey || t.dueDate || rawStart;

      if (!rawStart || !rawEnd) {
        unscheduled.push(t);
        continue;
      }

      const startKey = rawStart;
      const endKey = rawEnd < startKey ? startKey : rawEnd;

      for (const cell of gridCells) {
        if (cell.dateKey >= startKey && cell.dateKey <= endKey) {
          if (cell.dateKey.startsWith(monthPrefix)) {
            scheduledTaskIdsInMonth.add(t.id);
          }
          const spanPosition: CalendarTaskEntry['spanPosition'] =
            startKey === endKey
              ? 'single'
              : cell.dateKey === startKey
              ? 'start'
              : cell.dateKey === endKey
              ? 'end'
              : 'middle';
          if (!map.has(cell.dateKey)) map.set(cell.dateKey, []);
          map.get(cell.dateKey)!.push({
            task: t,
            spanPosition,
            isCompletedSpan: Boolean(completedKey),
          });
        }
      }
    }

    return {
      cells: gridCells,
      tasksByDate: map,
      unscheduledTasks: unscheduled,
      scheduledInMonthCount: scheduledTaskIdsInMonth.size,
    };
  }, [tasks, year, month]);

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] overflow-hidden shadow-xl">
        {/* Calendar Header */}
        <div className="px-4 py-3 border-b border-[#27272A] bg-[#12141B]/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${accentColor}1A`, color: accentColor }}
            >
              <CalendarIcon size={15} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{monthLabel}</h3>
              <p className="text-[11px] font-mono text-zinc-500">
                {scheduledInMonthCount} scheduled item{scheduledInMonthCount === 1 ? '' : 's'} this month
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
              className="p-1.5 rounded-lg bg-[#161820] hover:bg-[#1E202B] border border-[#27272A] text-zinc-300 hover:text-white cursor-pointer"
              title="Previous month"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
              }}
              className="px-3 py-1.5 rounded-lg bg-[#161820] hover:bg-[#1E202B] border border-[#27272A] text-xs font-medium text-zinc-200 cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
              className="p-1.5 rounded-lg bg-[#161820] hover:bg-[#1E202B] border border-[#27272A] text-zinc-300 hover:text-white cursor-pointer"
              title="Next month"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-[#27272A] bg-[#0B0C10]">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-[10px] font-mono uppercase tracking-wider text-zinc-500"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-[#27272A]/70">
          {cells.map((cell) => {
            const dayTasks = tasksByDate.get(cell.dateKey) || [];
            const isToday = cell.dateKey === todayKey;

            return (
              <div
                key={cell.dateKey}
                className={`min-h-[108px] p-1.5 sm:p-2 flex flex-col gap-1 transition-colors ${
                  cell.isCurrentMonth ? 'bg-[#0E0F14]' : 'bg-[#090A0D]/70 opacity-55'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono ${
                      isToday
                        ? 'font-bold text-[#0A0B10]'
                        : cell.isCurrentMonth
                        ? 'text-zinc-300'
                        : 'text-zinc-600'
                    }`}
                    style={isToday ? { backgroundColor: accentColor } : undefined}
                  >
                    {cell.dayNum}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-[10px] font-mono text-zinc-500">{dayTasks.length}</span>
                  )}
                </div>

                <div className="space-y-1 overflow-y-auto max-h-[82px] pr-0.5">
                  {dayTasks.map(({ task: t, spanPosition, isCompletedSpan }) => {
                    const stStyle = getStatusStyle(t.status);
                    const pStyle = PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.Medium;
                    const roundedCls =
                      spanPosition === 'single'
                        ? 'rounded-md'
                        : spanPosition === 'start'
                        ? 'rounded-l-md rounded-r-[2px] border-r-0'
                        : spanPosition === 'end'
                        ? 'rounded-r-md rounded-l-[2px]'
                        : 'rounded-[2px] border-x-0';
                    return (
                      <button
                        key={`${t.id}-${cell.dateKey}`}
                        type="button"
                        onClick={() => onSelectTask(t)}
                        title={`${t.taskKey}: ${t.title} (${t.status})${
                          isCompletedSpan && t.completedAt
                            ? ` · Ended ${toLocalDateKey(t.completedAt)}`
                            : t.dueDate
                            ? ` · Due ${t.dueDate}`
                            : ''
                        }`}
                        className={`w-full text-left px-1.5 py-1 text-[10px] bg-[#14161F] hover:bg-[#1B1E2A] border border-[#27272A] flex items-center gap-1.5 transition-colors cursor-pointer ${roundedCls}`}
                        style={{
                          borderLeftWidth: spanPosition === 'middle' || spanPosition === 'end' ? '2px' : undefined,
                          borderLeftColor:
                            spanPosition === 'middle' || spanPosition === 'end'
                              ? isCompletedSpan
                                ? '#10B981'
                                : stStyle.color
                              : undefined,
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: isCompletedSpan
                              ? '#10B981'
                              : t.isOverdue
                              ? '#EF4444'
                              : pStyle.color,
                          }}
                        />
                        <span className="font-mono font-semibold shrink-0" style={{ color: stStyle.color }}>
                          {t.taskKey}
                        </span>
                        <span className="text-zinc-200 truncate">{t.title}</span>
                        {t.isOverdue && (
                          <AlertTriangle size={9} className="text-red-400 shrink-0 ml-auto" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unscheduled Items Strip */}
      {unscheduledTasks.length > 0 && (
        <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-3.5 space-y-2.5 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <Clock size={13} className="text-zinc-400" />
              <span>Unscheduled Work Items (no start or due date)</span>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">{unscheduledTasks.length}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unscheduledTasks.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTask(t)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#13151C] hover:bg-[#1A1D28] border border-[#27272A] text-[11px] text-zinc-200 cursor-pointer"
              >
                <span className="font-mono font-semibold" style={{ color: accentColor }}>
                  {t.taskKey}
                </span>
                <span className="truncate max-w-[180px]">{t.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

