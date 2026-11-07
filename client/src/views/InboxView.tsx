import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox,
  CheckCircle2,
  Clock,
  ListFilter,
  Archive,
  Check,
  Sparkles,
  Bell,
  MessageSquare,
  GitPullRequest,
  AlertCircle,
  ArrowUpRight,
  Search,
  Eye,
  Trash2,
  ShieldAlert,
  CheckCheck,
  RefreshCw,
  Layers,
  ChevronRight,
  X,
  Calendar,
  User,
  Tag,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Flame,
  CheckSquare,
  Radio,
  ExternalLink,
  ChevronDown
} from 'lucide-react';

export type NotificationCategory = 'ALL' | 'UNREAD' | 'ASSIGNMENT' | 'REVIEW' | 'MENTION' | 'SYSTEM';
export type NotificationPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  fullBody?: string;
  category: 'ASSIGNMENT' | 'REVIEW' | 'MENTION' | 'SYSTEM';
  priority: NotificationPriority;
  actor: {
    name: string;
    avatar: string;
    role?: string;
  };
  team: string;
  time: string;
  timestamp: number;
  unread: boolean;
  archived: boolean;
  link?: string;
  linkLabel?: string;
  metadata?: {
    repo?: string;
    prNumber?: string;
    issueId?: string;
    branch?: string;
  };
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    title: 'Bob Smith assigned you task #DEV-102',
    detail: 'Implement Express REST API with TypeScript and Zod validation',
    fullBody: 'You have been assigned as lead engineer for the Express REST API module. This includes setting up Zod request schemas, JWT authentication middleware, and database connection pools for MySQL 8.0 on port 3306.',
    category: 'ASSIGNMENT',
    priority: 'HIGH',
    actor: {
      name: 'Bob Smith',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
      role: 'Staff Architect'
    },
    team: 'Engineering',
    time: '12m ago',
    timestamp: Date.now() - 12 * 60 * 1000,
    unread: true,
    archived: false,
    link: '#/tasks/DEV-102',
    linkLabel: 'Open Task #DEV-102',
    metadata: {
      issueId: 'DEV-102',
      branch: 'feature/express-rest-api'
    }
  },
  {
    id: '2',
    title: 'Alice Johnson created project milestone: Backend Architecture Sync',
    detail: 'Prisma schema and MySQL database synchronization completed on port 3306',
    fullBody: 'All schemas have migrated cleanly. Docker compose environments are updated with the latest migration scripts and seed data sets.',
    category: 'SYSTEM',
    priority: 'MEDIUM',
    actor: {
      name: 'Alice Johnson',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces',
      role: 'DevOps Lead'
    },
    team: 'DevFlow Core',
    time: '1h ago',
    timestamp: Date.now() - 60 * 60 * 1000,
    unread: true,
    archived: false,
    link: '#/projects/backend-sync',
    linkLabel: 'View Milestone Specs',
    metadata: {
      repo: 'devflow-api'
    }
  },
  {
    id: '3',
    title: 'Charlie Davis requested review on PR #14',
    detail: 'Added custom tree line guides and collapsible Linear-style navigation',
    fullBody: 'Refactored navigation tree line indentation with pixel-perfect SVG guides. Added collapsible group persistence in localStorage and keyboard accessibility shortcuts.',
    category: 'REVIEW',
    priority: 'URGENT',
    actor: {
      name: 'Charlie Davis',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces',
      role: 'Senior UI/UX Engineer'
    },
    team: 'Design',
    time: '3h ago',
    timestamp: Date.now() - 3 * 60 * 60 * 1000,
    unread: true,
    archived: false,
    link: '#/pulls/14',
    linkLabel: 'Review Pull Request #14',
    metadata: {
      repo: 'devflow-client',
      prNumber: '#14',
      branch: 'nav/tree-lines'
    }
  },
  {
    id: '4',
    title: 'Elena Rostova mentioned you in #DEV-88 discussion',
    detail: '"Can we double check the token refresh rotation timeout on Redis cluster?"',
    fullBody: 'We noticed a brief spike in token verification failures during the rolling deployment on staging cluster us-west-2. Could you verify the Redis TTL settings?',
    category: 'MENTION',
    priority: 'HIGH',
    actor: {
      name: 'Elena Rostova',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=faces',
      role: 'Security Engineer'
    },
    team: 'Cloud Ops',
    time: '5h ago',
    timestamp: Date.now() - 5 * 60 * 60 * 1000,
    unread: false,
    archived: false,
    link: '#/tasks/DEV-88',
    linkLabel: 'View Thread',
    metadata: {
      issueId: 'DEV-88'
    }
  },
  {
    id: '5',
    title: 'Automated CI Security Alert: Vulnerability patched',
    detail: 'Dependabot bump axios from 1.6.2 to 1.7.4 passed all test suites',
    fullBody: 'High severity CVE in transitive dependency resolved cleanly. Automated integration test run suite #891 finished with 100% green exit status.',
    category: 'SYSTEM',
    priority: 'LOW',
    actor: {
      name: 'DevFlow Bot',
      avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop&crop=faces',
      role: 'CI Pipeline'
    },
    team: 'DevFlow Core',
    time: '1d ago',
    timestamp: Date.now() - 24 * 60 * 60 * 1000,
    unread: false,
    archived: false,
    link: '#/security/dependabot',
    linkLabel: 'View Security Audit',
    metadata: {
      repo: 'devflow-core'
    }
  }
];

// High-fidelity shimmer skeleton
const InboxSkeleton: React.FC = () => {
  return (
    <div className="w-full space-y-6 animate-pulse">
      {/* Controls Shimmer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="h-10 bg-[#18181B] border border-[#27272A] rounded-xl w-full sm:w-96" />
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="h-9 w-9 bg-[#18181B] border border-[#27272A] rounded-lg" />
          <div className="h-9 w-20 bg-[#18181B] border border-[#27272A] rounded-lg" />
        </div>
      </div>

      {/* Main 2-column layout shimmer */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        <div className="flex-1 w-full space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="bg-[#121215] border border-[#27272A] rounded-xl p-4 flex items-start gap-4"
            >
              <div className="w-9 h-9 rounded-full bg-[#27272A] shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[#27272A] rounded w-3/5" />
                <div className="h-3 bg-[#1C1C20] rounded w-4/5" />
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-4 w-16 bg-[#18181B] rounded" />
                  <div className="h-4 w-12 bg-[#18181B] rounded" />
                </div>
              </div>
              <div className="w-16 h-7 bg-[#1C1C20] rounded-lg shrink-0" />
            </div>
          ))}
        </div>

        {/* Right Sidebar Shimmer */}
        <div className="w-full lg:w-80 shrink-0 space-y-4">
          <div className="h-44 bg-[#121215] border border-[#27272A] rounded-2xl p-5" />
          <div className="h-56 bg-[#121215] border border-[#27272A] rounded-2xl p-5" />
          <div className="h-48 bg-[#121215] border border-[#27272A] rounded-2xl p-5" />
        </div>
      </div>
    </div>
  );
};

export const InboxView: React.FC = () => {
  const [items, setItems] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'compact'>('card');
  const [loading, setLoading] = useState(false);

  // Filter Popover state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'priority'>('newest');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'URGENT' | 'HIGH_PLUS'>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');

  // Selected Notification for Detail Modal
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);

  const refreshInbox = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 600);
  };

  const markRead = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unread: false } : item))
    );
    if (selectedNotification?.id === id) {
      setSelectedNotification((prev) => (prev ? { ...prev, unread: false } : null));
    }
  };

  const markUnread = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unread: true } : item))
    );
    if (selectedNotification?.id === id) {
      setSelectedNotification((prev) => (prev ? { ...prev, unread: true } : null));
    }
  };

  const archiveItem = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (selectedNotification?.id === id) {
      setSelectedNotification(null);
    }
  };

  const markAllRead = () => {
    setItems((prev) => prev.map((item) => ({ ...item, unread: false })));
  };

  const clearAllRead = () => {
    setItems((prev) => prev.filter((item) => item.unread));
  };

  // Distinct Teams
  const distinctTeams = useMemo(() => {
    const teams = new Set(items.map((i) => i.team));
    return Array.from(teams);
  }, [items]);

  // Priority ranking
  const priorityWeight: Record<NotificationPriority, number> = {
    URGENT: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1
  };

  // Filtered and Sorted Notifications
  const filteredNotifications = useMemo(() => {
    return items
      .filter((item) => {
        // Tab Category Filter
        if (selectedCategory === 'UNREAD' && !item.unread) return false;
        if (selectedCategory === 'ASSIGNMENT' && item.category !== 'ASSIGNMENT') return false;
        if (selectedCategory === 'REVIEW' && item.category !== 'REVIEW') return false;
        if (selectedCategory === 'MENTION' && item.category !== 'MENTION') return false;
        if (selectedCategory === 'SYSTEM' && item.category !== 'SYSTEM') return false;

        // Popover Team filter
        if (teamFilter !== 'ALL' && item.team !== teamFilter) return false;

        // Popover Priority filter
        if (priorityFilter === 'URGENT' && item.priority !== 'URGENT') return false;
        if (priorityFilter === 'HIGH_PLUS' && item.priority !== 'URGENT' && item.priority !== 'HIGH') return false;

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchDetail = item.detail.toLowerCase().includes(q);
          const matchActor = item.actor.name.toLowerCase().includes(q);
          const matchTeam = item.team.toLowerCase().includes(q);
          const matchIssue = item.metadata?.issueId?.toLowerCase().includes(q);
          return matchTitle || matchDetail || matchActor || matchTeam || matchIssue;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === 'newest') return b.timestamp - a.timestamp;
        if (sortOption === 'oldest') return a.timestamp - b.timestamp;
        if (sortOption === 'priority') return priorityWeight[b.priority] - priorityWeight[a.priority];
        return 0;
      });
  }, [items, selectedCategory, teamFilter, priorityFilter, searchQuery, sortOption]);

  // Sidebar Analytics
  const analytics = useMemo(() => {
    const total = items.length;
    const unread = items.filter((i) => i.unread).length;
    const read = total - unread;
    const readRate = total > 0 ? Math.round((read / total) * 100) : 100;
    const urgentCount = items.filter((i) => i.priority === 'URGENT' && i.unread).length;

    const byCategory = {
      ASSIGNMENT: items.filter((i) => i.category === 'ASSIGNMENT').length,
      REVIEW: items.filter((i) => i.category === 'REVIEW').length,
      MENTION: items.filter((i) => i.category === 'MENTION').length,
      SYSTEM: items.filter((i) => i.category === 'SYSTEM').length
    };

    const byTeam: Record<string, number> = {};
    items.forEach((item) => {
      byTeam[item.team] = (byTeam[item.team] || 0) + 1;
    });

    return {
      total,
      unread,
      read,
      readRate,
      urgentCount,
      byCategory,
      byTeam
    };
  }, [items]);

  const tabs: { key: NotificationCategory; label: string; count?: number }[] = [
    { key: 'ALL', label: 'All', count: items.length },
    { key: 'UNREAD', label: 'Unread', count: analytics.unread },
    { key: 'ASSIGNMENT', label: 'Assignments', count: analytics.byCategory.ASSIGNMENT },
    { key: 'REVIEW', label: 'Reviews', count: analytics.byCategory.REVIEW },
    { key: 'MENTION', label: 'Mentions', count: analytics.byCategory.MENTION },
    { key: 'SYSTEM', label: 'System', count: analytics.byCategory.SYSTEM }
  ];

  const getCategoryIcon = (category: NotificationItem['category']) => {
    switch (category) {
      case 'ASSIGNMENT':
        return <CheckSquare size={16} className="text-emerald-400" />;
      case 'REVIEW':
        return <GitPullRequest size={16} className="text-indigo-400" />;
      case 'MENTION':
        return <MessageSquare size={16} className="text-sky-400" />;
      case 'SYSTEM':
        return <Radio size={16} className="text-amber-400" />;
    }
  };

  const getPriorityBadge = (priority: NotificationPriority) => {
    switch (priority) {
      case 'URGENT':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Flame size={10} />
            Urgent
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            High
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            Medium
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            Low
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-[1600px] pl-4 sm:pl-8 lg:pl-10 pr-4 sm:pr-8 mr-auto pt-4 sm:pt-6 pb-16 space-y-6 text-left">
      {/* Header - Pure Typography, No Icon in Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#27272A]">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-[32px] font-extrabold text-[#FFFFFF] tracking-tight">
            Inbox
          </h1>
          <p className="text-xs sm:text-sm text-[#71717A] mt-1">
            Notifications, mentions, code reviews, and issue updates across your workspaces
          </p>
        </div>

        <div className="flex items-center gap-2">
          {analytics.unread > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] hover:border-zinc-700 rounded-lg transition-colors shadow-sm"
              title="Mark all as read"
            >
              <CheckCheck size={14} className="text-emerald-400" />
              <span>Mark all read</span>
            </button>
          )}

          {analytics.read > 0 && (
            <button
              onClick={clearAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] hover:border-zinc-700 rounded-lg transition-colors shadow-sm"
              title="Clear all read notifications"
            >
              <Archive size={14} className="text-zinc-400" />
              <span className="hidden sm:inline">Archive read</span>
            </button>
          )}

          <button
            onClick={refreshInbox}
            disabled={loading}
            className="p-2 text-zinc-400 hover:text-white bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] hover:border-zinc-700 rounded-lg transition-colors shadow-sm"
            title="Refresh feed"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-400' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <InboxSkeleton />
      ) : (
        <>
          {/* Controls Bar: Tabs + Search + Icon-only ListFilter + View Switcher */}
          <div className="space-y-4">
            {/* Animated Tab Bar */}
            <div className="flex items-center justify-between gap-4 overflow-x-auto no-scrollbar pb-1 border-b border-[#27272A]/70">
              <div className="flex items-center gap-1.5">
                {tabs.map((tab) => {
                  const isActive = selectedCategory === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setSelectedCategory(tab.key)}
                      className={`relative px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                        isActive
                          ? 'text-white'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="inbox-active-tab"
                          className="absolute inset-0 bg-[#27272A] rounded-lg shadow-sm"
                          transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                        />
                      )}
                      <span className="relative z-10">{tab.label}</span>
                      {typeof tab.count === 'number' && tab.count > 0 && (
                        <span
                          className={`relative z-10 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                            isActive
                              ? tab.key === 'UNREAD'
                                ? 'bg-indigo-500 text-white'
                                : 'bg-[#18181B] text-zinc-200'
                              : tab.key === 'UNREAD'
                              ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/40'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* View Switcher: Card vs Compact */}
              <div className="hidden sm:flex items-center p-0.5 rounded-lg bg-[#18181B] border border-[#27272A]">
                <button
                  onClick={() => setViewMode('card')}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === 'card'
                      ? 'bg-[#27272A] text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Card view"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setViewMode('compact')}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === 'compact'
                      ? 'bg-[#27272A] text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Compact list view"
                >
                  <List size={14} />
                </button>
              </div>
            </div>

            {/* Search + Filter Row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative w-full sm:max-w-md">
                <Search
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <input
                  type="text"
                  placeholder="Search notifications, mentions, squads, or task IDs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 text-xs bg-[#121215] border border-[#27272A] rounded-xl text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Icon-only Filter button with popover */}
              <div className="relative flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`p-2 rounded-lg border transition-colors flex items-center justify-center relative ${
                    isFilterOpen || priorityFilter !== 'ALL' || teamFilter !== 'ALL'
                      ? 'bg-[#27272A] border-indigo-500/50 text-indigo-400'
                      : 'bg-[#18181B] border-[#27272A] text-zinc-400 hover:text-white hover:border-zinc-700'
                  }`}
                  title="Filter and sort notifications"
                >
                  <ListFilter size={15} />
                  {(priorityFilter !== 'ALL' || teamFilter !== 'ALL') && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-500" />
                  )}
                </button>

                {/* Filter Popover Dropdown */}
                <AnimatePresence>
                  {isFilterOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsFilterOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-72 bg-[#121215] border border-[#27272A] rounded-xl shadow-2xl p-4 z-50 space-y-4"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-[#27272A]">
                          <div className="text-xs font-semibold text-zinc-200">
                            Notification Filters
                          </div>
                          <button
                            onClick={() => {
                              setPriorityFilter('ALL');
                              setTeamFilter('ALL');
                              setSortOption('newest');
                            }}
                            className="text-[11px] text-zinc-400 hover:text-indigo-400 transition-colors"
                          >
                            Reset
                          </button>
                        </div>

                        {/* Sort Order */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                            Sort Order
                          </label>
                          <div className="space-y-1">
                            {[
                              { key: 'newest', label: 'Newest First' },
                              { key: 'oldest', label: 'Oldest First' },
                              { key: 'priority', label: 'Urgency / Priority' }
                            ].map((s) => (
                              <button
                                key={s.key}
                                onClick={() => setSortOption(s.key as any)}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                  sortOption === s.key
                                    ? 'bg-[#27272A] text-white font-medium'
                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#18181B]'
                                }`}
                              >
                                <span>{s.label}</span>
                                {sortOption === s.key && <Check size={13} className="text-indigo-400" />}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Priority Filter */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                            Priority
                          </label>
                          <div className="space-y-1">
                            {[
                              { key: 'ALL', label: 'All Priorities' },
                              { key: 'URGENT', label: 'Urgent Only' },
                              { key: 'HIGH_PLUS', label: 'High & Urgent' }
                            ].map((p) => (
                              <button
                                key={p.key}
                                onClick={() => setPriorityFilter(p.key as any)}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                  priorityFilter === p.key
                                    ? 'bg-[#27272A] text-white font-medium'
                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#18181B]'
                                }`}
                              >
                                <span>{p.label}</span>
                                {priorityFilter === p.key && <Check size={13} className="text-indigo-400" />}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Squad / Team Filter */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                            Squad / Workspace
                          </label>
                          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                            <button
                              onClick={() => setTeamFilter('ALL')}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                teamFilter === 'ALL'
                                  ? 'bg-[#27272A] text-white font-medium'
                                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#18181B]'
                              }`}
                            >
                              <span>All Squads</span>
                              {teamFilter === 'ALL' && <Check size={13} className="text-indigo-400" />}
                            </button>
                            {distinctTeams.map((team) => (
                              <button
                                key={team}
                                onClick={() => setTeamFilter(team)}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                  teamFilter === team
                                    ? 'bg-[#27272A] text-white font-medium'
                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#18181B]'
                                }`}
                              >
                                <span className="truncate">{team}</span>
                                {teamFilter === team && <Check size={13} className="text-indigo-400" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* 2-Column Layout */}
          <div className="flex flex-col lg:flex-row items-start gap-6">
            {/* Left Column: Notification Feed */}
            <div className="flex-1 w-full lg:min-w-0 space-y-3">
              {filteredNotifications.length === 0 ? (
                <div className="py-20 text-center bg-[#121215] border border-[#27272A] rounded-2xl p-8 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                    <CheckCircle2 size={24} className="text-emerald-500" />
                  </div>
                  <h3 className="text-base font-bold text-white">All caught up!</h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    {searchQuery || priorityFilter !== 'ALL' || teamFilter !== 'ALL'
                      ? 'No notifications match your current filter and search criteria.'
                      : 'You have cleared all active notifications in this category.'}
                  </p>
                  {(searchQuery || priorityFilter !== 'ALL' || teamFilter !== 'ALL') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setPriorityFilter('ALL');
                        setTeamFilter('ALL');
                      }}
                      className="px-3.5 py-1.5 text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-colors inline-block"
                    >
                      Clear search & filters
                    </button>
                  )}
                </div>
              ) : viewMode === 'card' ? (
                /* Card View Mode */
                filteredNotifications.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    onClick={() => setSelectedNotification(item)}
                    className={`group relative rounded-xl border p-4 transition-all cursor-pointer ${
                      item.unread
                        ? 'bg-[#121215] border-[#27272A] hover:border-zinc-700 shadow-md shadow-black/20'
                        : 'bg-[#0E0E11]/80 border-zinc-900 hover:border-zinc-800 opacity-90 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Avatar / Category Indicator */}
                      <div className="relative shrink-0">
                        <img
                          src={item.actor.avatar}
                          alt={item.actor.name}
                          className="w-10 h-10 rounded-full object-cover border border-[#27272A]"
                        />
                        <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-[#121215] border border-[#27272A]">
                          {getCategoryIcon(item.category)}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors">
                            {item.actor.name}
                          </span>
                          {item.actor.role && (
                            <span className="text-[11px] text-zinc-500 hidden sm:inline">
                              • {item.actor.role}
                            </span>
                          )}
                          <span className="text-zinc-600 text-xs">•</span>
                          <span className="text-[11px] text-zinc-500 flex items-center gap-1 font-mono">
                            <Clock size={11} />
                            {item.time}
                          </span>
                          <div className="ml-auto flex items-center gap-1.5">
                            {getPriorityBadge(item.priority)}
                            {item.unread && (
                              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                            )}
                          </div>
                        </div>

                        <h4 className="text-[13.5px] font-semibold text-zinc-100 leading-snug line-clamp-1">
                          {item.title}
                        </h4>

                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                          {item.detail}
                        </p>

                        {/* Metadata Pills */}
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-[#18181B] border border-[#27272A] text-[11px] font-medium text-zinc-300 font-mono">
                            {item.team}
                          </span>

                          {item.metadata?.issueId && (
                            <span className="px-2 py-0.5 rounded-md bg-indigo-950/40 border border-indigo-800/40 text-[11px] font-medium text-indigo-300 font-mono">
                              {item.metadata.issueId}
                            </span>
                          )}

                          {item.metadata?.prNumber && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-950/40 border border-purple-800/40 text-[11px] font-medium text-purple-300 font-mono">
                              PR {item.metadata.prNumber}
                            </span>
                          )}

                          {item.linkLabel && (
                            <span className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 ml-auto">
                              <span>{item.linkLabel}</span>
                              <ChevronRight size={12} />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick Action Buttons */}
                      <div className="flex flex-col items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                        {item.unread ? (
                          <button
                            onClick={(e) => markRead(item.id, e)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-[#18181B] transition-colors"
                            title="Mark as read"
                          >
                            <Check size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => markUnread(item.id, e)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-indigo-400 hover:bg-[#18181B] transition-colors"
                            title="Mark as unread"
                          >
                            <Bell size={14} />
                          </button>
                        )}
                        <button
                          onClick={(e) => archiveItem(item.id, e)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-[#18181B] transition-colors"
                          title="Archive notification"
                        >
                          <Archive size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                /* Compact List View Mode */
                <div className="bg-[#121215] border border-[#27272A] rounded-2xl overflow-hidden divide-y divide-[#27272A]">
                  {filteredNotifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedNotification(item)}
                      className={`flex items-center justify-between p-3.5 hover:bg-[#18181B]/70 transition-colors cursor-pointer gap-3 ${
                        item.unread ? 'bg-[#141418]' : 'bg-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            item.unread ? 'bg-indigo-500' : 'bg-transparent'
                          }`}
                        />
                        <div className="shrink-0">{getCategoryIcon(item.category)}</div>
                        <div className="min-w-0 truncate">
                          <span className="text-xs font-semibold text-zinc-200 mr-2">
                            {item.actor.name}:
                          </span>
                          <span className="text-xs text-zinc-300 truncate">
                            {item.title}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="px-1.5 py-0.5 rounded bg-[#18181B] border border-[#27272A] text-[10px] font-mono text-zinc-400 hidden sm:inline">
                          {item.team}
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          {item.time}
                        </span>
                        <div className="flex items-center gap-1">
                          {item.unread ? (
                            <button
                              onClick={(e) => markRead(item.id, e)}
                              className="p-1 rounded text-zinc-400 hover:text-white"
                              title="Mark read"
                            >
                              <Check size={13} />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => markUnread(item.id, e)}
                              className="p-1 rounded text-zinc-500 hover:text-white"
                              title="Mark unread"
                            >
                              <Bell size={13} />
                            </button>
                          )}
                          <button
                            onClick={(e) => archiveItem(item.id, e)}
                            className="p-1 rounded text-zinc-500 hover:text-rose-400"
                            title="Archive"
                          >
                            <Archive size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Notification Intelligence Sidebar */}
            <div className="w-full lg:w-80 shrink-0 space-y-4">
              {/* Notification Pulse KPI Card */}
              <div className="bg-[#121215] border border-[#27272A] rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white uppercase tracking-wider">
                    Inbox Health
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <Sparkles size={11} />
                    Live
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-[#18181B] border border-[#27272A]">
                    <div className="text-[11px] text-zinc-400 font-medium">Unread</div>
                    <div className="text-2xl font-extrabold text-white mt-1">
                      {analytics.unread}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#18181B] border border-[#27272A]">
                    <div className="text-[11px] text-zinc-400 font-medium">Read Rate</div>
                    <div className="text-2xl font-extrabold text-indigo-400 mt-1">
                      {analytics.readRate}%
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Triage Progress</span>
                    <span className="font-mono text-zinc-300">
                      {analytics.read} / {analytics.total} handled
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#18181B] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                      style={{ width: `${analytics.readRate}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* By Category Distribution */}
              <div className="bg-[#121215] border border-[#27272A] rounded-2xl p-5 space-y-3 shadow-sm">
                <div className="text-xs font-bold text-white uppercase tracking-wider">
                  By Category
                </div>

                <div className="space-y-2.5 pt-1">
                  {[
                    {
                      label: 'Assignments',
                      count: analytics.byCategory.ASSIGNMENT,
                      icon: <CheckSquare size={14} className="text-emerald-400" />,
                      color: 'bg-emerald-500'
                    },
                    {
                      label: 'PR Reviews',
                      count: analytics.byCategory.REVIEW,
                      icon: <GitPullRequest size={14} className="text-indigo-400" />,
                      color: 'bg-indigo-500'
                    },
                    {
                      label: 'User Mentions',
                      count: analytics.byCategory.MENTION,
                      icon: <MessageSquare size={14} className="text-sky-400" />,
                      color: 'bg-sky-500'
                    },
                    {
                      label: 'System & CI',
                      count: analytics.byCategory.SYSTEM,
                      icon: <Radio size={14} className="text-amber-400" />,
                      color: 'bg-amber-500'
                    }
                  ].map((cat) => (
                    <div
                      key={cat.label}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-[#18181B] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {cat.icon}
                        <span className="text-zinc-300">{cat.label}</span>
                      </div>
                      <span className="font-mono font-bold text-zinc-400">
                        {cat.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Squad Sources */}
              <div className="bg-[#121215] border border-[#27272A] rounded-2xl p-5 space-y-3 shadow-sm">
                <div className="text-xs font-bold text-white uppercase tracking-wider">
                  Active Squad Sources
                </div>

                <div className="space-y-2 pt-1">
                  {Object.entries(analytics.byTeam).map(([teamName, count]) => (
                    <div
                      key={teamName}
                      className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#18181B]/60 border border-[#27272A]/80"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-400" />
                        <span className="text-zinc-200 font-medium">{teamName}</span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-400">
                        {count} items
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notification Preferences Quick Status */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#18181B] to-[#121215] border border-[#27272A] space-y-2 text-xs">
                <div className="flex items-center gap-2 text-zinc-200 font-semibold">
                  <Bell size={14} className="text-indigo-400" />
                  <span>Realtime Dispatch</span>
                </div>
                <p className="text-[11.5px] text-zinc-400 leading-relaxed">
                  Desktop push and workspace webhook notifications are active.
                </p>
                <div className="pt-1 flex items-center gap-2 text-[11px] text-indigo-400 font-medium">
                  <span>Manage alert routes</span>
                  <ExternalLink size={11} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Selected Notification Detail Modal */}
      <AnimatePresence>
        {selectedNotification && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-xl bg-[#121215] border border-[#27272A] rounded-2xl shadow-2xl overflow-hidden text-left"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-[#27272A] flex items-start justify-between gap-4 bg-[#18181B]/40">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedNotification.actor.avatar}
                    alt={selectedNotification.actor.name}
                    className="w-10 h-10 rounded-full border border-[#27272A]"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {selectedNotification.actor.name}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {selectedNotification.actor.role || selectedNotification.team} • {selectedNotification.time}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getPriorityBadge(selectedNotification.priority)}
                  <button
                    onClick={() => setSelectedNotification(null)}
                    className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#27272A] transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                <div>
                  <h4 className="text-base font-bold text-zinc-100">
                    {selectedNotification.title}
                  </h4>
                  <p className="text-xs text-zinc-300 mt-2 leading-relaxed">
                    {selectedNotification.fullBody || selectedNotification.detail}
                  </p>
                </div>

                {/* Metadata details */}
                <div className="p-4 rounded-xl bg-[#18181B] border border-[#27272A] space-y-2.5 text-xs">
                  <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Context Details
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-zinc-300">
                    <div>
                      <span className="text-zinc-500">Squad:</span>{' '}
                      <span className="font-mono text-zinc-200">{selectedNotification.team}</span>
                    </div>
                    {selectedNotification.metadata?.issueId && (
                      <div>
                        <span className="text-zinc-500">Issue:</span>{' '}
                        <span className="font-mono text-indigo-400">{selectedNotification.metadata.issueId}</span>
                      </div>
                    )}
                    {selectedNotification.metadata?.prNumber && (
                      <div>
                        <span className="text-zinc-500">Pull Request:</span>{' '}
                        <span className="font-mono text-purple-400">{selectedNotification.metadata.prNumber}</span>
                      </div>
                    )}
                    {selectedNotification.metadata?.branch && (
                      <div>
                        <span className="text-zinc-500">Branch:</span>{' '}
                        <span className="font-mono text-zinc-300">{selectedNotification.metadata.branch}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-[#18181B]/50 border-t border-[#27272A] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {selectedNotification.unread ? (
                    <button
                      onClick={() => markRead(selectedNotification.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors flex items-center gap-1.5"
                    >
                      <Check size={13} />
                      <span>Mark Read</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => markUnread(selectedNotification.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] transition-colors flex items-center gap-1.5"
                    >
                      <Bell size={13} />
                      <span>Mark Unread</span>
                    </button>
                  )}
                  <button
                    onClick={() => archiveItem(selectedNotification.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-rose-400 bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] transition-colors flex items-center gap-1.5"
                  >
                    <Archive size={13} />
                    <span>Archive</span>
                  </button>
                </div>

                {selectedNotification.link && (
                  <a
                    href={selectedNotification.link}
                    onClick={() => setSelectedNotification(null)}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <span>{selectedNotification.linkLabel || 'Open in Workspace'}</span>
                    <ArrowUpRight size={13} />
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

