import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  CircleDot,
  AlertTriangle,
  ArrowRight,
  Filter,
  Plus,
  Search,
  X,
  Check,
  Clock,
  Flame,
  Zap,
  Calendar,
  Layers,
  ArrowDownAZ,
  ArrowUpZA,
  List as ListIcon,
  LayoutGrid,
  ListFilter,
  RefreshCw,
  FolderKanban,
  CheckSquare,
  TrendingUp,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  User as UserIcon,
  Kanban,
  GanttChartSquare,
  CalendarDays,
  MoveLeft,
  MoveRight,
  SlidersHorizontal,
  ChevronDown,
  Info,
  CalendarRange,
} from 'lucide-react';
import { Task, TaskStatus, Priority } from '../types';
import { fetchTasks, updateTask, createTask, fetchProjects } from '../api';
import { useAccentTheme } from '../services/accentTheme.service';
import { useToast } from '../context/ToastContext';
import { useNavigation } from '../context/NavigationContext';

type TabOption = 'ACTIVE' | 'TODO' | 'IN_REVIEW' | 'DONE' | 'ALL';
type SortOption = 'priority' | 'due' | 'title-asc' | 'title-desc' | 'recent';
type PriorityFilter = 'ALL' | 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
type ViewMode = 'list' | 'board' | 'gantt' | 'card' | 'calendar';
type GanttZoom = '2weeks' | 'month' | 'quarter';

// ─── Date Math Helpers ────────────────────────────────────────────────────────

const toDate = (val: any): Date | null => {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const addDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

const formatDateShort = (d: Date): string => {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ─── Status Tabs ─────────────────────────────────────────────────────────────

const STATUS_TABS: { id: TabOption; label: string; icon: React.ElementType }[] = [
  { id: 'ACTIVE', label: 'In Progress', icon: Zap },
  { id: 'TODO', label: 'To Do', icon: Clock },
  { id: 'IN_REVIEW', label: 'In Review', icon: Layers },
  { id: 'DONE', label: 'Completed', icon: CheckCircle2 },
  { id: 'ALL', label: 'All Tasks', icon: CheckSquare },
];

const BOARD_COLUMNS: { id: TaskStatus; label: string; dot: string; color: string; border: string }[] = [
  { id: 'TODO', label: 'To Do', dot: '#71717A', color: 'text-zinc-400', border: 'border-zinc-800' },
  { id: 'IN_PROGRESS', label: 'In Progress', dot: '#6366F1', color: 'text-indigo-400', border: 'border-indigo-500/20' },
  { id: 'IN_REVIEW', label: 'In Review', dot: '#A855F7', color: 'text-purple-400', border: 'border-purple-500/20' },
  { id: 'DONE', label: 'Completed', dot: '#10B981', color: 'text-emerald-400', border: 'border-emerald-500/20' },
];

// ─── High-Fidelity Skeleton Screen ───────────────────────────────────────────

const TasksSkeleton: React.FC = () => (
  <div className="w-full space-y-6 animate-pulse text-left">
    {/* Controls Bar Skeleton: 2-Tier */}
    <div className="space-y-3.5">
      <div className="flex items-center justify-between pb-3 border-b border-[#27272A]/70">
        <div className="w-64 h-9 rounded-xl bg-zinc-800/60" />
        <div className="w-24 h-4 rounded bg-zinc-800/60" />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-24 h-9 rounded-xl bg-zinc-800/60 shrink-0" />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-56 h-10 rounded-xl bg-zinc-800/60" />
          <div className="w-10 h-10 rounded-xl bg-zinc-800/60" />
        </div>
      </div>
    </div>

    {/* 2-Column Content Skeleton */}
    <div className="flex flex-col lg:flex-row items-start gap-6 w-full">
      {/* Tasks List Skeleton */}
      <div className="flex-1 w-full space-y-2.5">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl bg-[#0E0F14] border border-[#27272A] flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 flex-1">
              <div className="w-5 h-5 rounded-full bg-zinc-800 shrink-0" />
              <div className="w-16 h-3.5 rounded bg-zinc-800/60 shrink-0" />
              <div className="w-1/2 h-4 rounded bg-zinc-800/80" />
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-20 h-4 rounded bg-zinc-800/50" />
              <div className="w-14 h-5 rounded-md bg-zinc-800/60" />
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar Skeleton */}
      <div className="w-full lg:w-80 shrink-0 space-y-4">
        <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-5 space-y-3">
          <div className="w-32 h-4 rounded bg-zinc-800/80" />
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="h-16 rounded-xl bg-zinc-800/50" />
            <div className="h-16 rounded-xl bg-zinc-800/50" />
          </div>
        </div>
        <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-5 space-y-3">
          <div className="w-36 h-4 rounded bg-zinc-800/80" />
          <div className="space-y-2 pt-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <div className="w-20 h-2.5 rounded bg-zinc-800/60" />
                  <div className="w-8 h-2.5 rounded bg-zinc-800/60" />
                </div>
                <div className="w-full h-1.5 rounded bg-zinc-800/40" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const MyIssuesView: React.FC = () => {
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();
  const { setIsCreateOpen } = useNavigation();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Controls State
  const [activeTab, setActiveTab] = useState<TabOption>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Filter Popover Menu State
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // Create Task Modal State
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('MEDIUM');
  const [newStatus, setNewStatus] = useState<TaskStatus>('TODO');
  const [newProjectId, setNewProjectId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Gantt Chart State
  const [ganttZoom, setGanttZoom] = useState<GanttZoom>('month');
  const [ganttOffsetDays, setGanttOffsetDays] = useState<number>(0);
  const [hoveredGanttTaskId, setHoveredGanttTaskId] = useState<number | null>(null);

  // Calendar State
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  const today = useMemo(() => new Date(), []);

  // Close filter popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };
    if (isFilterMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isFilterMenuOpen]);

  // Load tasks and projects
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksData, projsData] = await Promise.all([
        fetchTasks(),
        fetchProjects().catch(() => []),
      ]);
      setTasks(tasksData);
      setProjectsList(projsData);
      if (projsData.length > 0 && !newProjectId) {
        setNewProjectId(projsData[0].id);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load tasks', err.message || 'Error fetching tasks');
    } finally {
      setLoading(false);
    }
  }, [newProjectId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Cycling Status
  const handleCycleStatus = async (task: Task, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextMap: Record<string, TaskStatus> = {
      TODO: 'IN_PROGRESS',
      IN_PROGRESS: 'IN_REVIEW',
      IN_REVIEW: 'DONE',
      DONE: 'TODO',
    };
    const nextStatus = nextMap[task.status] || 'TODO';
    try {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
      );
      await updateTask(task.id, { status: nextStatus });
      if (nextStatus === 'DONE') {
        toast.success('Task Completed', `"${task.title}" marked as done.`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Update failed', 'Could not update task status.');
      loadData();
    }
  };

  // Move status specifically (for Kanban Board forward / backward buttons)
  const handleMoveStatus = async (task: Task, direction: 'prev' | 'next', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const flow: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
    const currentIndex = flow.indexOf(task.status as TaskStatus);
    const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= flow.length) return;
    const targetStatus = flow[nextIndex];

    try {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: targetStatus } : t))
      );
      await updateTask(task.id, { status: targetStatus });
      if (targetStatus === 'DONE') {
        toast.success('Task Completed', `"${task.title}" completed.`);
      } else {
        toast.success('Status Updated', `Moved to ${targetStatus.replace('_', ' ')}`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Update failed', 'Could not update task status.');
      loadData();
    }
  };

  // Open modal with preselected status
  const handleOpenCreateWithStatus = (presetStatus: TaskStatus = 'TODO') => {
    setNewStatus(presetStatus);
    setIsNewTaskOpen(true);
  };

  // Create Task Handler
  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error('Title required', 'Please provide a task title.');
      return;
    }
    setIsSubmitting(true);
    try {
      await createTask({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        priority: newPriority,
        status: newStatus,
        projectId: newProjectId || projectsList[0]?.id || 1,
      });
      toast.success('Task Created', `"${newTitle}" added to your queue.`);
      setNewTitle('');
      setNewDescription('');
      setNewPriority('MEDIUM');
      setNewStatus('TODO');
      setIsNewTaskOpen(false);
      loadData();
    } catch (err: any) {
      toast.error('Creation failed', err.message || 'Could not create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Priority Tag Helper
  const getPriorityMeta = (p: string) => {
    switch (p?.toUpperCase()) {
      case 'URGENT':
        return {
          label: 'URGENT',
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/25',
          icon: Flame,
        };
      case 'HIGH':
        return {
          label: 'HIGH',
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
          icon: Zap,
        };
      case 'MEDIUM':
        return {
          label: 'MED',
          color: 'text-sky-400 bg-sky-500/10 border-sky-500/25',
          icon: CheckCircle2,
        };
      default:
        return {
          label: 'LOW',
          color: 'text-zinc-400 bg-zinc-800/80 border-zinc-700/60',
          icon: Clock,
        };
    }
  };

  // Status Badge Helper
  const getStatusMeta = (status: string) => {
    switch (status) {
      case 'DONE':
        return {
          label: 'Completed',
          color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
          dot: '#10B981',
        };
      case 'IN_PROGRESS':
        return {
          label: 'In Progress',
          color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25',
          dot: '#6366F1',
        };
      case 'IN_REVIEW':
        return {
          label: 'In Review',
          color: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
          dot: '#A855F7',
        };
      default:
        return {
          label: 'To Do',
          color: 'bg-zinc-800 text-zinc-400 border-zinc-700/60',
          dot: '#71717A',
        };
    }
  };

  // Filtered & Sorted Tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // In Board view, tabs can either focus or show all; for list/gantt/cards:
    if (viewMode !== 'board') {
      if (activeTab === 'ACTIVE') {
        result = result.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW');
      } else if (activeTab === 'TODO') {
        result = result.filter((t) => t.status === 'TODO');
      } else if (activeTab === 'IN_REVIEW') {
        result = result.filter((t) => t.status === 'IN_REVIEW');
      } else if (activeTab === 'DONE') {
        result = result.filter((t) => t.status === 'DONE');
      }
    }

    // Priority filter
    if (priorityFilter !== 'ALL') {
      result = result.filter((t) => t.priority === priorityFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((t) => {
        const title = (t.title || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        const proj = (t.project?.title || '').toLowerCase();
        return title.includes(q) || desc.includes(q) || proj.includes(q);
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'title-asc') return a.title.localeCompare(b.title);
      if (sortBy === 'title-desc') return b.title.localeCompare(a.title);

      const pWeight: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      if (sortBy === 'priority') {
        const diff = (pWeight[b.priority] || 0) - (pWeight[a.priority] || 0);
        if (diff !== 0) return diff;
      }

      if (sortBy === 'due') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }

      // Default: recent
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
    });

    return result;
  }, [tasks, activeTab, priorityFilter, searchQuery, sortBy, viewMode]);

  // Velocity & Analytics for Sidebar
  const analytics = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'DONE').length;
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const inReview = tasks.filter((t) => t.status === 'IN_REVIEW').length;
    const todo = tasks.filter((t) => t.status === 'TODO').length;
    const urgent = tasks.filter((t) => t.priority === 'URGENT' && t.status !== 'DONE').length;

    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Project breakdown
    const projMap: Record<string, { title: string; count: number; id: number }> = {};
    tasks.forEach((t) => {
      const title = t.project?.title || 'DevFlow Cloud';
      const id = t.projectId || 1;
      if (!projMap[title]) {
        projMap[title] = { title, count: 0, id };
      }
      projMap[title].count += 1;
    });

    const projectCounts = Object.values(projMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    return {
      total,
      completed,
      inProgress,
      inReview,
      todo,
      urgent,
      rate,
      projectCounts,
    };
  }, [tasks]);

  // ─── Gantt Timeline Calculation ───────────────────────────────────────────

  const ganttWindow = useMemo(() => {
    const baseDate = addDays(today, ganttOffsetDays);
    const cfg =
      ganttZoom === '2weeks'
        ? { before: 4, after: 10, tick: 1 }
        : ganttZoom === 'month'
        ? { before: 7, after: 23, tick: 2 }
        : { before: 14, after: 76, tick: 7 };

    const start = addDays(baseDate, -cfg.before);
    const end = addDays(baseDate, cfg.after);
    const spanMs = Math.max(end.getTime() - start.getTime(), 1);

    const ticks: Date[] = [];
    for (let d = new Date(start); d <= end; d = addDays(d, cfg.tick)) {
      ticks.push(new Date(d));
    }

    const pct = (d: Date) => clamp(((d.getTime() - start.getTime()) / spanMs) * 100, 0, 100);

    return { start, end, ticks, pct, baseDate };
  }, [today, ganttOffsetDays, ganttZoom]);

  const ganttRows = useMemo(() => {
    return filteredTasks.map((t, idx) => {
      const created = toDate(t.createdAt) || addDays(today, -5 + (idx % 4));
      let start = created;
      let end = toDate(t.dueDate);
      if (!end || end <= start) {
        const durDays =
          t.status === 'DONE' ? 4 : t.status === 'IN_REVIEW' ? 6 : t.status === 'IN_PROGRESS' ? 8 : 12;
        end = addDays(start, durDays);
      }

      const progress =
        t.status === 'DONE' ? 100 : t.status === 'IN_REVIEW' ? 85 : t.status === 'IN_PROGRESS' ? 50 : 15;

      const totalDur = Math.max(end.getTime() - start.getTime(), 86400000);
      const isOverdue = end < today && t.status !== 'DONE';

      const leftPct = ganttWindow.pct(start);
      const rightPct = ganttWindow.pct(end);
      const widthPct = Math.max(rightPct - leftPct, 3.5);

      return {
        task: t,
        start,
        end,
        progress,
        isOverdue,
        leftPct,
        widthPct,
      };
    });
  }, [filteredTasks, today, ganttWindow]);

  // ─── Calendar Month Calculation ───────────────────────────────────────────

  const calendarData = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const startingDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean; tasks: Task[] }[] = [];

    // Previous month filler
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({ date: d, isCurrentMonth: false, tasks: [] });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTasks = filteredTasks.filter((t) => {
        const due = t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : null;
        const created = t.createdAt ? new Date(t.createdAt).toISOString().split('T')[0] : null;
        return due === dateStr || (!due && created === dateStr);
      });
      days.push({ date: d, isCurrentMonth: true, tasks: dayTasks });
    }

    // Next month filler
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false, tasks: [] });
    }

    return days;
  }, [calendarMonth, filteredTasks]);

  const isFilterActive = sortBy !== 'priority' || priorityFilter !== 'ALL';

  return (
    <div className="w-full max-w-[1600px] pl-4 sm:pl-8 lg:pl-10 pr-4 sm:pr-8 mr-auto pt-4 sm:pt-6 pb-16 space-y-6 text-left">
      {/* ─── Page Header (Pure Typography, No Icon in Header) ────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#27272A]/70">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-[32px] font-extrabold text-[#FFFFFF] tracking-tight leading-tight">
            My Tasks
          </h1>
          <p className="text-sm sm:text-[14.5px] text-[#A1A1AA] mt-1.5 leading-relaxed">
            Personal execution queue, sprint issues, and deliverables across List, Kanban Board, Gantt Timeline, and Calendar views.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-xl bg-[#171A21] hover:bg-[#1f232d] border border-[#27272A] text-xs sm:text-sm font-medium text-zinc-300 hover:text-white transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenCreateWithStatus('TODO')}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl hover:brightness-110 active:scale-[0.98] text-[#0A0B10] text-xs sm:text-sm font-semibold transition-all shadow-md cursor-pointer"
            style={{ backgroundColor: accentColor, boxShadow: `0 4px 18px ${accentColor}35` }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>New task</span>
          </button>
        </div>
      </div>

      {loading ? (
        <TasksSkeleton />
      ) : (
        /* ─── Main 2-Column Directory Layout ──────────────────────────────── */
        <div className="flex flex-col lg:flex-row items-start gap-6 w-full">
          {/* ─── LEFT COLUMN: Tabs, Controls & Views ─────────────────────────── */}
          <div className="flex-1 w-full lg:min-w-0 space-y-4">
            {/* ─── Top Controls: 2-Tier Layout (View Switcher Tier + Filter/Search Tier) ─── */}
            <div className="space-y-3.5">
              {/* Tier 1: Multi-View Switcher (List, Board, Gantt, Cards, Calendar) + View Stats */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#27272A]/70">
                {/* Multi-View Switcher */}
                <div className="p-1 rounded-xl bg-[#111216] border border-[#27272A] flex items-center gap-1 shadow-inner shrink-0 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'list', label: 'List', icon: ListIcon },
                    { id: 'board', label: 'Board', icon: Kanban },
                    { id: 'gantt', label: 'Gantt', icon: GanttChartSquare },
                    { id: 'card', label: 'Cards', icon: LayoutGrid },
                    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
                  ].map((mode) => {
                    const Icon = mode.icon;
                    const isSelected = viewMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setViewMode(mode.id as ViewMode)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0 ${
                          isSelected
                            ? 'text-black shadow-sm font-bold'
                            : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                        }`}
                        style={isSelected ? { backgroundColor: accentColor } : {}}
                        title={`${mode.label} view`}
                      >
                        <Icon size={14} />
                        <span>{mode.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Right Context Counter */}
                <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
                  <span className="hidden sm:inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
                    <span>{filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} shown</span>
                  </span>
                  {isFilterActive && (
                    <button
                      type="button"
                      onClick={() => {
                        setSortBy('priority');
                        setPriorityFilter('ALL');
                      }}
                      className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              </div>

              {/* Tier 2: Status Filter Tabs + Search + Icon-Only ListFilter */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Status Tab Switcher Pills */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[#111216] border border-[#27272A] shadow-inner overflow-x-auto max-w-full scrollbar-none shrink-0">
                  {STATUS_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    let count = tasks.length;
                    if (tab.id === 'ACTIVE') {
                      count = tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW').length;
                    } else if (tab.id === 'TODO') {
                      count = tasks.filter((t) => t.status === 'TODO').length;
                    } else if (tab.id === 'IN_REVIEW') {
                      count = tasks.filter((t) => t.status === 'IN_REVIEW').length;
                    } else if (tab.id === 'DONE') {
                      count = tasks.filter((t) => t.status === 'DONE').length;
                    }

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                          isActive ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="taskActiveTabPill"
                            className="absolute inset-0 rounded-lg shadow-sm"
                            style={{ backgroundColor: `${accentColor}25`, border: `1px solid ${accentColor}50` }}
                            transition={{ duration: 0.18 }}
                          />
                        )}
                        <Icon size={13} className="relative z-10 shrink-0" />
                        <span className="relative z-10 whitespace-nowrap">{tab.label}</span>
                        <span
                          className={`relative z-10 px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                            isActive ? 'bg-white/15 text-white' : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Right: Search + Icon-Only ListFilter */}
                <div className="flex items-center gap-2 w-full md:w-auto">
                  {/* Search */}
                  <div className="relative flex-1 md:w-64">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search issues..."
                      className="w-full h-10 pl-9 pr-8 rounded-xl bg-[#111216] border border-[#27272A] text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/30 transition-colors"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-1 cursor-pointer"
                        title="Clear search"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Filter & Sort Icon-Only Button + Popover */}
                  <div ref={filterMenuRef} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsFilterMenuOpen((prev) => !prev)}
                      className="relative w-10 h-10 rounded-xl bg-[#111216] border border-[#27272A] hover:border-zinc-500 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-inner"
                      title="Sort and filter options"
                      aria-label="Sort and filter options"
                    >
                      <ListFilter
                        size={15}
                        className={isFilterActive ? 'text-white' : 'text-zinc-400'}
                        style={isFilterActive ? { color: accentColor } : {}}
                      />
                      {isFilterActive && (
                        <span
                          className="absolute top-2 right-2 w-2 h-2 rounded-full ring-2 ring-[#111216]"
                          style={{ backgroundColor: accentColor }}
                        />
                      )}
                    </button>

                    {/* Popover Menu (No background on icons) */}
                    <AnimatePresence>
                      {isFilterMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.97 }}
                          animate={{ opacity: 1, y: 4, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.97 }}
                          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                          className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-[#14161C]/98 backdrop-blur-xl border border-[#27272A] p-2 shadow-2xl z-50 text-left space-y-1.5"
                        >
                          {/* Section: Sort by */}
                          <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                            <span>Sort by</span>
                            <Calendar size={11} className="text-zinc-500" />
                          </div>

                          <div className="space-y-1">
                            {[
                              {
                                value: 'priority',
                                label: 'Priority (Urgent First)',
                                sublabel: 'Urgency index',
                                icon: <Flame size={14} className="text-rose-400" />,
                              },
                              {
                                value: 'recent',
                                label: 'Recently Updated',
                                sublabel: 'Latest activity',
                                icon: <Clock size={14} className="text-zinc-400" />,
                              },
                              {
                                value: 'due',
                                label: 'Due Date',
                                sublabel: 'Target deadline',
                                icon: <CalendarRange size={14} className="text-amber-400" />,
                              },
                              {
                                value: 'title-asc',
                                label: 'Title (A → Z)',
                                sublabel: 'Alphabetical',
                                icon: <ArrowDownAZ size={14} className="text-sky-400" />,
                              },
                              {
                                value: 'title-desc',
                                label: 'Title (Z → A)',
                                sublabel: 'Reverse order',
                                icon: <ArrowUpZA size={14} className="text-indigo-400" />,
                              },
                            ].map((opt) => {
                              const isSelected = sortBy === opt.value;
                              return (
                                <motion.button
                                  key={opt.value}
                                  type="button"
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => {
                                    setSortBy(opt.value as SortOption);
                                    setIsFilterMenuOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs sm:text-[12.5px] transition-all cursor-pointer border ${
                                    isSelected
                                      ? 'font-medium shadow-sm'
                                      : 'text-[#D4D4D8] border-transparent hover:bg-white/[0.06] hover:text-white'
                                  }`}
                                  style={
                                    isSelected
                                      ? {
                                          backgroundColor: `${accentColor}20`,
                                          borderColor: `${accentColor}40`,
                                          color: '#FFFFFF',
                                        }
                                      : undefined
                                  }
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <span className="shrink-0 flex items-center justify-center">
                                      {opt.icon}
                                    </span>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="font-semibold text-white truncate shrink-0">
                                        {opt.label}
                                      </span>
                                      {opt.sublabel && (
                                        <span className="text-[10px] font-mono text-zinc-400 truncate">
                                          {opt.sublabel}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <Check
                                      size={13}
                                      strokeWidth={2.5}
                                      className="flex-shrink-0"
                                      style={{ color: accentColor }}
                                    />
                                  )}
                                </motion.button>
                              );
                            })}
                          </div>

                          {/* Divider */}
                          <div className="my-1.5 border-t border-[#27272A]/80" />

                          {/* Section: Priority Filter */}
                          <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                            <span>Filter Priority</span>
                            <Zap size={11} className="text-zinc-500" />
                          </div>

                          <div className="space-y-1">
                            {[
                              { value: 'ALL', label: 'All Priorities', icon: <Clock size={14} className="text-zinc-400" /> },
                              { value: 'URGENT', label: 'Urgent Only', icon: <Flame size={14} className="text-rose-400" /> },
                              { value: 'HIGH', label: 'High Priority', icon: <Zap size={14} className="text-amber-400" /> },
                              { value: 'MEDIUM', label: 'Medium', icon: <CheckCircle2 size={14} className="text-sky-400" /> },
                              { value: 'LOW', label: 'Low', icon: <CheckCircle2 size={14} className="text-zinc-400" /> },
                            ].map((pOpt) => {
                              const isPSelected = priorityFilter === pOpt.value;
                              return (
                                <motion.button
                                  key={pOpt.value}
                                  type="button"
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => {
                                    setPriorityFilter(pOpt.value as PriorityFilter);
                                    setIsFilterMenuOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs sm:text-[12.5px] transition-all cursor-pointer border ${
                                    isPSelected
                                      ? 'font-medium shadow-sm'
                                      : 'text-[#D4D4D8] border-transparent hover:bg-white/[0.06] hover:text-white'
                                  }`}
                                  style={
                                    isPSelected
                                      ? {
                                          backgroundColor: `${accentColor}20`,
                                          borderColor: `${accentColor}40`,
                                          color: '#FFFFFF',
                                        }
                                      : undefined
                                  }
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <span className="shrink-0 flex items-center justify-center">
                                      {pOpt.icon}
                                    </span>
                                    <span className="font-semibold text-white truncate">
                                      {pOpt.label}
                                    </span>
                                  </div>
                                  {isPSelected && (
                                    <Check
                                      size={13}
                                      strokeWidth={2.5}
                                      className="flex-shrink-0"
                                      style={{ color: accentColor }}
                                    />
                                  )}
                                </motion.button>
                              );
                            })}
                          </div>

                          {/* Reset button if active */}
                          {isFilterActive && (
                            <div className="pt-1.5 border-t border-[#27272A]/80">
                              <button
                                type="button"
                                onClick={() => {
                                  setSortBy('priority');
                                  setPriorityFilter('ALL');
                                  setIsFilterMenuOpen(false);
                                }}
                                className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer group"
                              >
                                <RefreshCw size={11} className="transition-transform group-hover:rotate-180 duration-300" />
                                <span>Reset filters & sort</span>
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>

            {/* Empty State */}
            {filteredTasks.length === 0 ? (
              <div className="rounded-2xl border border-[#27272A] bg-[#0E0F14] p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20 shadow-sm">
                  <CheckSquare size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">All caught up</h3>
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                    {searchQuery || isFilterActive
                      ? 'No tasks match the active filters or search query.'
                      : 'No issues currently in this status queue. Create a new task or take a break!'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenCreateWithStatus('TODO')}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0A0B10] shadow-md cursor-pointer hover:brightness-110"
                  style={{ backgroundColor: accentColor }}
                >
                  <Plus size={14} />
                  <span>Create Task</span>
                </button>
              </div>
            ) : viewMode === 'list' ? (
              /* ─── 1. LIST TABLE VIEW ─────────────────────────────────────── */
              <div className="rounded-2xl border border-[#27272A] bg-[#0E0F14] divide-y divide-[#1C1D24] overflow-hidden shadow-sm">
                {filteredTasks.map((task) => {
                  const pMeta = getPriorityMeta(task.priority);
                  const statusMeta = getStatusMeta(task.status);
                  const isDone = task.status === 'DONE';

                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-white/[0.025] transition-colors gap-3 text-xs group text-left cursor-pointer"
                      onClick={() => handleCycleStatus(task)}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {/* Interactive Status Cycle Button */}
                        <button
                          type="button"
                          onClick={(e) => handleCycleStatus(task, e)}
                          className="w-5 h-5 rounded-full border border-zinc-600 hover:border-white flex items-center justify-center shrink-0 transition-colors cursor-pointer group-hover:scale-105"
                          title="Click to cycle status"
                        >
                          {isDone ? (
                            <Check size={12} className="text-emerald-400" strokeWidth={3} />
                          ) : task.status === 'IN_PROGRESS' ? (
                            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                          ) : task.status === 'IN_REVIEW' ? (
                            <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                          ) : null}
                        </button>

                        {/* ID & Title */}
                        <span className="font-mono text-zinc-500 text-[11px] shrink-0">
                          DEV-{100 + task.id}
                        </span>

                        <span
                          className={`font-medium truncate group-hover:text-white transition-colors text-xs sm:text-[13px] ${
                            isDone ? 'line-through text-zinc-500' : 'text-zinc-200'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Project Tag */}
                        <span className="text-[11px] font-mono text-zinc-400 hidden md:inline truncate max-w-[140px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                          {task.project?.title || 'DevFlow Cloud'}
                        </span>

                        {/* Priority Pill */}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border font-bold ${pMeta.color}`}
                        >
                          {pMeta.label}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border font-medium ${statusMeta.color}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : viewMode === 'board' ? (
              /* ─── 2. KANBAN BOARD VIEW ───────────────────────────────────── */
              <div className="w-full overflow-x-auto pb-4 scrollbar-thin">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 min-w-[760px] lg:min-w-[820px]">
                  {BOARD_COLUMNS.map((col) => {
                    const colTasks = tasks.filter((t) => t.status === col.id);
                    return (
                      <div
                        key={col.id}
                        className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-3.5 flex flex-col min-h-[500px] space-y-3 shadow-sm"
                      >
                        {/* Column Header */}
                        <div className="flex items-center justify-between pb-2 border-b border-[#1C1D24]">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.dot }} />
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                              {col.label}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full bg-zinc-800/80 text-[10px] font-mono text-zinc-400 font-semibold">
                              {colTasks.length}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenCreateWithStatus(col.id)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                            title={`Add task to ${col.label}`}
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        {/* Column Cards Stream */}
                        <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[700px] pr-0.5">
                          {colTasks.length === 0 ? (
                            <div className="h-40 rounded-xl border border-dashed border-zinc-800 flex flex-col items-center justify-center p-4 text-center space-y-2">
                              <p className="text-[11px] text-zinc-500">No issues in {col.label}</p>
                              <button
                                type="button"
                                onClick={() => handleOpenCreateWithStatus(col.id)}
                                className="text-[10px] text-zinc-400 hover:text-white underline cursor-pointer"
                              >
                                + Add issue
                              </button>
                            </div>
                          ) : (
                            colTasks.map((task) => {
                              const pMeta = getPriorityMeta(task.priority);
                              const isDone = task.status === 'DONE';

                              return (
                                <motion.div
                                  key={task.id}
                                  layout
                                  initial={{ opacity: 0, scale: 0.98 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="p-3.5 rounded-xl bg-[#121319] border border-[#27272A] hover:border-zinc-500 transition-all shadow-sm space-y-2.5 text-left group"
                                >
                                  {/* Card Top: ID & Priority */}
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="font-mono text-zinc-500 text-[10.5px]">
                                      DEV-{100 + task.id}
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono uppercase tracking-wider border font-bold ${pMeta.color}`}
                                    >
                                      {pMeta.label}
                                    </span>
                                  </div>

                                  {/* Card Title */}
                                  <h4
                                    className={`text-xs font-semibold leading-snug group-hover:text-white transition-colors ${
                                      isDone ? 'line-through text-zinc-500' : 'text-zinc-200'
                                    }`}
                                  >
                                    {task.title}
                                  </h4>

                                  {task.description && (
                                    <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                                      {task.description}
                                    </p>
                                  )}

                                  {/* Card Bottom: Project Tag & Move buttons */}
                                  <div className="pt-2 border-t border-[#1C1D24] flex items-center justify-between text-[10.5px]">
                                    <span className="text-zinc-500 font-mono truncate max-w-[100px]">
                                      {task.project?.title || 'DevFlow Core'}
                                    </span>

                                    <div className="flex items-center gap-1 shrink-0">
                                      {/* Move Left */}
                                      {task.status !== 'TODO' && (
                                        <button
                                          type="button"
                                          onClick={(e) => handleMoveStatus(task, 'prev', e)}
                                          className="p-1 rounded bg-[#181922] hover:bg-[#252736] text-zinc-400 hover:text-white transition-colors"
                                          title="Move to previous stage"
                                        >
                                          <ChevronLeft size={12} />
                                        </button>
                                      )}

                                      {/* Complete / Reopen Checkmark */}
                                      <button
                                        type="button"
                                        onClick={(e) => handleCycleStatus(task, e)}
                                        className="p-1 rounded bg-[#181922] hover:bg-[#252736] text-zinc-400 hover:text-emerald-400 transition-colors"
                                        title="Advance status"
                                      >
                                        <Check size={12} />
                                      </button>

                                      {/* Move Right */}
                                      {task.status !== 'DONE' && (
                                        <button
                                          type="button"
                                          onClick={(e) => handleMoveStatus(task, 'next', e)}
                                          className="p-1 rounded bg-[#181922] hover:bg-[#252736] text-zinc-400 hover:text-white transition-colors"
                                          title="Move to next stage"
                                        >
                                          <ChevronRight size={12} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : viewMode === 'gantt' ? (
              /* ─── 3. GANTT CHART TIMELINE VIEW ("ghat chat") ─────────────── */
              <div className="rounded-2xl border border-[#27272A] bg-[#0E0F14] p-4 sm:p-5 shadow-sm space-y-4">
                {/* Gantt Controls Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#27272A]/80">
                  <div className="flex items-center gap-2">
                    <GanttChartSquare size={16} className="text-amber-400 shrink-0" />
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-white">
                        Sprint Execution Timeline
                      </h3>
                      <p className="text-[11px] text-zinc-400">
                        {formatDateShort(ganttWindow.start)} – {formatDateShort(ganttWindow.end)} • Interactive schedule bars
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Navigation buttons */}
                    <div className="flex items-center gap-1 rounded-xl bg-[#111216] border border-[#27272A] p-0.5">
                      <button
                        type="button"
                        onClick={() => setGanttOffsetDays((d) => d - (ganttZoom === '2weeks' ? 7 : 14))}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors"
                        title="Previous timeline span"
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setGanttOffsetDays(0)}
                        className="px-2 py-1 text-[10.5px] font-mono text-zinc-300 hover:text-white"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setGanttOffsetDays((d) => d + (ganttZoom === '2weeks' ? 7 : 14))}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors"
                        title="Next timeline span"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>

                    {/* Zoom Levels */}
                    <div className="flex items-center gap-1 rounded-xl bg-[#111216] border border-[#27272A] p-0.5 text-[11px]">
                      {[
                        { id: '2weeks', label: '2W' },
                        { id: 'month', label: '1M' },
                        { id: 'quarter', label: '3M' },
                      ].map((z) => (
                        <button
                          key={z.id}
                          type="button"
                          onClick={() => setGanttZoom(z.id as GanttZoom)}
                          className={`px-2 py-1 rounded-lg font-mono transition-all ${
                            ganttZoom === z.id
                              ? 'bg-zinc-800 text-white font-bold'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {z.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Gantt Chart Body: Task List on Left + Horizontal Timeline on Right */}
                <div className="border border-[#27272A] rounded-xl overflow-hidden bg-[#0A0B0E] flex flex-col">
                  {/* Gantt Header */}
                  <div className="flex border-b border-[#27272A] bg-[#111216] text-[10.5px] font-mono uppercase text-zinc-400">
                    <div className="w-56 sm:w-64 shrink-0 px-3 py-2 border-r border-[#27272A]">
                      Task / Issue
                    </div>
                    <div className="flex-1 relative h-8 overflow-hidden">
                      {ganttWindow.ticks.map((t, idx) => {
                        const isWeekend = t.getDay() === 0 || t.getDay() === 6;
                        return (
                          <div
                            key={idx}
                            className={`absolute top-0 bottom-0 flex items-center px-1 border-l border-[#1C1D24] text-[10px] ${
                              isWeekend ? 'text-zinc-500 font-bold' : 'text-zinc-400'
                            }`}
                            style={{ left: `${ganttWindow.pct(t)}%` }}
                          >
                            <span>{formatDateShort(t)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Gantt Rows */}
                  <div className="divide-y divide-[#1C1D24]">
                    {ganttRows.map((row) => {
                      const statusMeta = getStatusMeta(row.task.status);
                      const isHovered = hoveredGanttTaskId === row.task.id;

                      return (
                        <div
                          key={row.task.id}
                          onMouseEnter={() => setHoveredGanttTaskId(row.task.id)}
                          onMouseLeave={() => setHoveredGanttTaskId(null)}
                          className={`flex items-center text-xs transition-colors cursor-pointer group ${
                            isHovered ? 'bg-white/[0.03]' : 'hover:bg-white/[0.015]'
                          }`}
                          onClick={() => handleCycleStatus(row.task)}
                        >
                          {/* Left Task Registry Info */}
                          <div className="w-56 sm:w-64 shrink-0 px-3 py-2.5 border-r border-[#27272A] flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: statusMeta.dot }}
                              />
                              <span className="font-mono text-zinc-500 text-[10.5px] shrink-0">
                                DEV-{100 + row.task.id}
                              </span>
                              <span className="truncate text-zinc-200 group-hover:text-white font-medium text-[11.5px]">
                                {row.task.title}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                              {row.progress}%
                            </span>
                          </div>

                          {/* Right Timeline Bar Track */}
                          <div className="flex-1 relative h-10 overflow-hidden flex items-center">
                            {/* Grid vertical tick lines */}
                            {ganttWindow.ticks.map((t, idx) => (
                              <div
                                key={idx}
                                className="absolute top-0 bottom-0 w-px bg-[#181922]"
                                style={{ left: `${ganttWindow.pct(t)}%` }}
                              />
                            ))}

                            {/* Today vertical indicator line */}
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-rose-500/70 z-10 pointer-events-none"
                              style={{ left: `${ganttWindow.pct(today)}%` }}
                            />

                            {/* Gantt Bar */}
                            <div
                              className={`absolute h-6 rounded-md transition-all flex items-center px-2 overflow-hidden border shadow-sm ${
                                row.task.status === 'DONE'
                                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                                  : row.task.status === 'IN_REVIEW'
                                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                                  : row.task.status === 'IN_PROGRESS'
                                  ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                                  : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                              }`}
                              style={{
                                left: `${row.leftPct}%`,
                                width: `${row.widthPct}%`,
                              }}
                              title={`DEV-${100 + row.task.id}: ${row.task.title} (${row.progress}%)`}
                            >
                              {/* Inner progress fill */}
                              <div
                                className="absolute left-0 top-0 bottom-0 bg-white/[0.08]"
                                style={{ width: `${row.progress}%` }}
                              />
                              <span className="relative z-10 text-[10.5px] font-mono font-semibold truncate">
                                DEV-{100 + row.task.id} • {row.task.title}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : viewMode === 'card' ? (
              /* ─── 4. CARD GRID VIEW ──────────────────────────────────────── */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTasks.map((task) => {
                  const pMeta = getPriorityMeta(task.priority);
                  const statusMeta = getStatusMeta(task.status);
                  const isDone = task.status === 'DONE';

                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => handleCycleStatus(task)}
                      className="p-4.5 rounded-2xl bg-[#0E0F14] border border-[#27272A] hover:border-zinc-600/80 transition-all flex flex-col justify-between space-y-3 cursor-pointer group text-left shadow-sm"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-zinc-500 text-[11px]">
                            DEV-{100 + task.id}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border font-bold ${pMeta.color}`}
                          >
                            {pMeta.label}
                          </span>
                        </div>

                        <h4
                          className={`text-sm font-semibold leading-snug group-hover:text-white transition-colors ${
                            isDone ? 'line-through text-zinc-500' : 'text-zinc-100'
                          }`}
                        >
                          {task.title}
                        </h4>

                        {task.description && (
                          <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-[#1C1D24] flex items-center justify-between text-xs">
                        <span className="text-[11px] font-mono text-zinc-400 truncate max-w-[140px]">
                          {task.project?.title || 'DevFlow Core'}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded text-[10.5px] font-mono uppercase tracking-wider border font-medium ${statusMeta.color}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* ─── 5. CALENDAR VIEW ───────────────────────────────────────── */
              <div className="rounded-2xl border border-[#27272A] bg-[#0E0F14] p-4 sm:p-5 shadow-sm space-y-4 text-left">
                {/* Calendar Month Navigation Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={16} className="text-indigo-400" />
                    <h3 className="text-sm font-bold text-white">
                      {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarMonth(
                          new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
                        )
                      }
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                      title="Previous month"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarMonth(new Date())}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono text-zinc-300 hover:text-white bg-zinc-800/60"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarMonth(
                          new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
                        )
                      }
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                      title="Next month"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {/* Day of week headers */}
                <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11px] text-zinc-400 uppercase py-1 border-b border-[#1C1D24]">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid Days */}
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarData.map((cell, idx) => {
                    const isToday =
                      cell.date.getDate() === today.getDate() &&
                      cell.date.getMonth() === today.getMonth() &&
                      cell.date.getFullYear() === today.getFullYear();

                    return (
                      <div
                        key={idx}
                        className={`min-h-[90px] p-2 rounded-xl border flex flex-col justify-between transition-colors ${
                          cell.isCurrentMonth
                            ? isToday
                              ? 'bg-indigo-950/20 border-indigo-500/40'
                              : 'bg-[#121318] border-[#27272A]/70 hover:border-zinc-600'
                            : 'bg-[#0A0B0E]/60 border-[#1C1D24] opacity-40'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center font-semibold ${
                              isToday ? 'bg-indigo-500 text-white' : 'text-zinc-400'
                            }`}
                          >
                            {cell.date.getDate()}
                          </span>
                        </div>

                        {/* Task Chips */}
                        <div className="space-y-1 mt-1 overflow-hidden">
                          {cell.tasks.slice(0, 2).map((t) => {
                            const isDone = t.status === 'DONE';
                            return (
                              <div
                                key={t.id}
                                onClick={() => handleCycleStatus(t)}
                                className={`px-1.5 py-0.5 rounded text-[9.5px] truncate cursor-pointer transition-colors border font-medium ${
                                  isDone
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 line-through'
                                    : 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:border-zinc-500'
                                }`}
                                title={`DEV-${100 + t.id}: ${t.title}`}
                              >
                                DEV-{100 + t.id}
                              </div>
                            );
                          })}
                          {cell.tasks.length > 2 && (
                            <span className="text-[9px] font-mono text-zinc-500 block">
                              +{cell.tasks.length - 2} more
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ─── RIGHT SIDEBAR: Task Velocity & Priority Distribution ────────── */}
          <div className="w-full lg:w-80 shrink-0 space-y-4">
            {/* Box 1: Execution Velocity */}
            <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-3.5 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-[#27272A]/80">
                <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                  <TrendingUp size={13} className="text-emerald-400" />
                  <span>Execution Velocity</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ON TRACK</span>
                </div>
              </div>

              {/* Counters */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A]/80 space-y-1">
                  <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Completed</p>
                  <p className="text-xl font-bold text-emerald-400 font-mono tracking-tight">
                    {analytics.completed}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A]/80 space-y-1">
                  <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">In Flight</p>
                  <p className="text-xl font-bold text-white font-mono tracking-tight">
                    {analytics.inProgress + analytics.inReview}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 text-[11px]">Sprint Completion</span>
                  <span className="text-white font-mono font-semibold">{analytics.rate}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-800/80 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${analytics.rate}%`,
                      backgroundColor: accentColor,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Box 2: Priority Breakdown */}
            <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-3.5 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-[#27272A]/80">
                <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                  <Flame size={13} className="text-amber-400" />
                  <span>Urgency Profile</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Tasks</span>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Urgent', count: tasks.filter((t) => t.priority === 'URGENT').length, color: '#F43F5E' },
                  { label: 'High', count: tasks.filter((t) => t.priority === 'HIGH').length, color: '#F59E0B' },
                  { label: 'Medium', count: tasks.filter((t) => t.priority === 'MEDIUM').length, color: '#38BDF8' },
                  { label: 'Low', count: tasks.filter((t) => t.priority === 'LOW').length, color: '#71717A' },
                ].map((item) => {
                  const pct = tasks.length ? Math.round((item.count / tasks.length) * 100) : 0;
                  return (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span>{item.label}</span>
                        </span>
                        <span className="font-mono text-[11px] text-zinc-400">
                          {item.count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-zinc-800/80 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Box 3: Active Workstreams / Projects */}
            <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-3.5 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-[#27272A]/80">
                <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                  <FolderKanban size={13} className="text-indigo-400" />
                  <span>Active Projects</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Workload</span>
              </div>

              {analytics.projectCounts.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-2 text-center">No projects assigned.</p>
              ) : (
                <div className="space-y-2.5">
                  {analytics.projectCounts.map((proj) => (
                    <Link
                      key={proj.id}
                      to={`/projects/${proj.id}`}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#111216] border border-[#27272A]/60 hover:border-zinc-500 transition-colors group"
                    >
                      <span className="text-xs text-white font-medium truncate group-hover:text-emerald-300 transition-colors">
                        {proj.title}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] font-mono text-zinc-300 font-semibold shrink-0">
                        {proj.count} tasks
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Create New Task ────────────────────────────────────────── */}
      <AnimatePresence>
        {isNewTaskOpen && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setIsNewTaskOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="bg-[#0E0F14] border border-[#27272A] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-[#0A0B10]"
                    style={{ backgroundColor: accentColor }}
                  >
                    <CheckSquare size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">Create Issue</h3>
                    <p className="text-[11px] text-zinc-400">Add a new deliverable to your personal queue</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewTaskOpen(false)}
                  className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-white/[0.05]"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateTaskSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Task Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Implement Webhook Dispatcher"
                    className="w-full h-10 px-3 bg-[#111216] border border-[#27272A] rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-zinc-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Description</label>
                  <textarea
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Describe the acceptance criteria or context..."
                    className="w-full p-3 bg-[#111216] border border-[#27272A] rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-zinc-400 resize-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-zinc-300">Priority</label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as any)}
                      className="w-full h-10 px-3 bg-[#111216] border border-[#27272A] rounded-xl text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="URGENT">Urgent</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-zinc-300">Initial Stage</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
                      className="w-full h-10 px-3 bg-[#111216] border border-[#27272A] rounded-xl text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="IN_REVIEW">In Review</option>
                      <option value="DONE">Completed</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-zinc-300">Target Project</label>
                    <select
                      value={newProjectId || ''}
                      onChange={(e) => setNewProjectId(Number(e.target.value))}
                      className="w-full h-10 px-3 bg-[#111216] border border-[#27272A] rounded-xl text-xs text-white outline-none cursor-pointer"
                    >
                      {projectsList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title || p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#27272A]">
                  <button
                    type="button"
                    onClick={() => setIsNewTaskOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newTitle.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0A0B10] disabled:opacity-50 shadow-md hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                    style={{ backgroundColor: accentColor }}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} strokeWidth={2.5} />
                        <span>Add Task</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyIssuesView;
