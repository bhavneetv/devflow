import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  X,
  Plus,
  ArrowRight,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  GitPullRequest,
  ExternalLink,
  Layers,
  Sparkles,
  Command,
  Filter,
} from 'lucide-react';
import { requirementService } from '../../services/requirement.service';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import {
  WorkflowStatusBadge,
  PriorityBadge,
} from './RequirementBadges';

export const RequirementsSlideOver: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const { accentColor } = useAccentTheme();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'attention' | 'recent' | 'all'>('attention');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | 'all'>('all');
  const [requirements, setRequirements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentReqs, setRecentReqs] = useState<any[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Track drawer mount state and handle ?launcher=requirements deep link
  useEffect(() => {
    (window as any).__devflow_requirements_drawer_mounted = true;
    const params = new URLSearchParams(location.search);
    if (params.get('launcher') === 'requirements') {
      setIsOpen(true);
    }
    return () => {
      (window as any).__devflow_requirements_drawer_mounted = false;
    };
  }, [location.search]);

  // ─── Keyboard Shortcuts (g r, Ctrl+Shift+R, Escape) ────────────────────────
  useEffect(() => {
    let lastKey = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in an input/textarea
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Escape closes drawer
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        return;
      }

      // Cmd/Ctrl + Shift + R toggles drawer
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // 'g' then 'r' sequential shortcut (Gmail/Linear pattern)
      if (!isInput) {
        const now = Date.now();
        if (e.key.toLowerCase() === 'g') {
          lastKey = 'g';
          lastKeyTime = now;
        } else if (e.key.toLowerCase() === 'r' && lastKey === 'g' && now - lastKeyTime < 1000) {
          e.preventDefault();
          setIsOpen((prev) => !prev);
          lastKey = '';
        } else {
          lastKey = '';
        }
      }
    };

    const handleCustomTrigger = () => setIsOpen((prev) => !prev);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('devflow:toggle-requirements-drawer', handleCustomTrigger);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('devflow:toggle-requirements-drawer', handleCustomTrigger);
    };
  }, [isOpen]);

  // Load requirements when opened
  useEffect(() => {
    if (!isOpen) return;

    // Focus search on open
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 150);

    const loadData = async () => {
      setIsLoading(true);
      try {
        const res = await requirementService.getRequirements({
          organizationSlug: currentOrganization?.slug,
          projectId: selectedProjectId === 'all' ? undefined : selectedProjectId,
        });
        if (res.success && res.data) {
          setRequirements(res.data.items || []);
        }
      } catch (err) {
        console.error('Failed to load slideover requirements', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Load recent requirements from localStorage
    try {
      const stored = localStorage.getItem('devflow_recent_requirements');
      if (stored) {
        setRecentReqs(JSON.parse(stored).slice(0, 5));
      }
    } catch {}
  }, [isOpen, currentOrganization?.slug, selectedProjectId]);

  // Save recent requirements to localStorage helper
  const handleSelectRequirement = (req: any) => {
    try {
      const existingStr = localStorage.getItem('devflow_recent_requirements');
      const existing = existingStr ? JSON.parse(existingStr) : [];
      const filtered = existing.filter((item: any) => item.id !== req.id);
      const updated = [
        {
          id: req.id,
          code: req.code,
          title: req.title,
          workflowStatus: req.workflowStatus,
          priority: req.priority,
          projectId: req.projectId,
          viewedAt: new Date().toISOString(),
        },
        ...filtered,
      ].slice(0, 8);
      localStorage.setItem('devflow_recent_requirements', JSON.stringify(updated));
    } catch {}

    setIsOpen(false);
    navigate(`/requirements/${req.id}`);
  };

  // Metrics
  const stats = useMemo(() => {
    const total = requirements.length;
    const pendingReview = requirements.filter((r) => r.workflowStatus === 'PENDING_REVIEW').length;
    const inProgress = requirements.filter((r) => r.implementationStatus === 'IN_PROGRESS').length;
    const blocked = requirements.filter((r) => r.implementationStatus === 'BLOCKED').length;
    const approved = requirements.filter((r) => r.workflowStatus === 'APPROVED').length;
    return { total, pendingReview, inProgress, blocked, approved };
  }, [requirements]);

  // Needs Attention items
  const attentionItems = useMemo(() => {
    const currentUserId = user?.id;
    return requirements.filter((r) => {
      // 1. Awaiting my review
      const isMyReview = r.workflowStatus === 'PENDING_REVIEW' && r.reviewerId === currentUserId;
      // 2. Changes requested on my requirement
      const isMyChangesRequested =
        r.workflowStatus === 'CHANGES_REQUESTED' && r.authorId === currentUserId;
      // 3. Blocked implementation
      const isBlocked = r.implementationStatus === 'BLOCKED';
      // 4. Overdue unverified
      const isOverdue =
        r.targetDate &&
        new Date(r.targetDate).getTime() < Date.now() &&
        r.implementationStatus !== 'VERIFIED';

      return isMyReview || isMyChangesRequested || isBlocked || isOverdue;
    });
  }, [requirements, user?.id]);

  // Filtered by Search
  const filteredList = useMemo(() => {
    let source = requirements;
    if (activeTab === 'attention') {
      source = attentionItems.length > 0 ? attentionItems : requirements.slice(0, 10);
    } else if (activeTab === 'recent') {
      source = recentReqs;
    }

    if (!searchQuery.trim()) return source;
    const query = searchQuery.toLowerCase().trim();
    return requirements.filter(
      (r) =>
        r.code?.toLowerCase().includes(query) ||
        r.title?.toLowerCase().includes(query) ||
        r.summary?.toLowerCase().includes(query)
    );
  }, [requirements, activeTab, attentionItems, recentReqs, searchQuery]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Glassmorphic Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Slide-Over Drawer Container (480px) */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Requirements Hub"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full max-w-[480px] h-full bg-[#0B0C10] border-l border-[#27272A] shadow-2xl flex flex-col z-10 text-left overflow-hidden"
          >
            {/* ─── Drawer Header ─── */}
            <div className="p-4 sm:p-5 border-b border-[#27272A]/80 bg-[#0E0F14]/90 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: `${accentColor}18`,
                    borderColor: `${accentColor}40`,
                    color: accentColor,
                  }}
                >
                  <FileText size={18} strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                      Requirements Hub
                    </h2>
                    <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-zinc-800/80 border border-zinc-700/60">
                      g r
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate">
                    Fast navigation, approvals & traceability
                  </p>
                </div>
              </div>

              {/* Close Button & Action Pill */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  title="Close (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* ─── Quick Stats Strip ─── */}
            <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-[#111216] border-b border-[#27272A]/70 shrink-0 text-center">
              <div className="p-2 rounded-lg bg-[#0B0C10] border border-[#27272A]/60">
                <p className="text-[10px] font-mono uppercase text-zinc-400">Total</p>
                <p className="text-base font-bold font-mono text-white mt-0.5">{stats.total}</p>
              </div>
              <div className="p-2 rounded-lg bg-[#0B0C10] border border-[#27272A]/60">
                <p className="text-[10px] font-mono uppercase text-amber-400">Review</p>
                <p className="text-base font-bold font-mono text-amber-300 mt-0.5">
                  {stats.pendingReview}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-[#0B0C10] border border-[#27272A]/60">
                <p className="text-[10px] font-mono uppercase text-blue-400">Active</p>
                <p className="text-base font-bold font-mono text-blue-300 mt-0.5">
                  {stats.inProgress}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-[#0B0C10] border border-[#27272A]/60">
                <p className="text-[10px] font-mono uppercase text-rose-400">Blocked</p>
                <p className="text-base font-bold font-mono text-rose-300 mt-0.5">
                  {stats.blocked}
                </p>
              </div>
            </div>

            {/* ─── Action Shortcuts Bar ─── */}
            <div className="px-4 py-2.5 border-b border-[#27272A]/60 flex items-center justify-between gap-2 shrink-0 bg-[#0E0F14]/50">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/requirements/new');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-black transition-all hover:brightness-110 active:scale-95 shadow-sm"
                style={{ backgroundColor: accentColor }}
              >
                <Plus size={13} strokeWidth={2.5} />
                <span>New Spec</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/requirements/traceability');
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1"
                >
                  <Layers size={12} className="text-purple-400" />
                  <span>Traceability</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/requirements');
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1"
                >
                  <span>Dashboard</span>
                  <ExternalLink size={11} className="text-zinc-500" />
                </button>
              </div>
            </div>

            {/* ─── Search & Tab Filters ─── */}
            <div className="p-4 space-y-3 border-b border-[#27272A]/60 shrink-0">
              {/* Search Bar */}
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Quick search by ID (REQ-001) or title..."
                  className="w-full h-9 pl-9 pr-8 rounded-xl bg-[#111216] border border-[#27272A] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* View Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#111216] border border-[#27272A]/80 text-xs">
                {[
                  { id: 'attention', label: `Needs Attention ${attentionItems.length ? `(${attentionItems.length})` : ''}` },
                  { id: 'recent', label: 'Recent' },
                  { id: 'all', label: `All (${requirements.length})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-1 px-2 text-center rounded-lg font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── Requirement Cards List ─── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {isLoading ? (
                <div className="space-y-3 py-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl bg-[#111216] border border-[#27272A]/60 animate-pulse space-y-2"
                    >
                      <div className="w-24 h-3 rounded bg-zinc-800" />
                      <div className="w-3/4 h-4 rounded bg-zinc-800/80" />
                    </div>
                  ))}
                </div>
              ) : filteredList.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-[#111216]/60 border border-[#27272A]/70 my-6 space-y-2">
                  <CheckCircle2 size={24} className="mx-auto text-emerald-400" />
                  <p className="text-xs font-semibold text-white">All caught up!</p>
                  <p className="text-[11px] text-zinc-400">
                    {searchQuery
                      ? 'No requirements matching your search query.'
                      : activeTab === 'attention'
                      ? 'No items currently require immediate review or intervention.'
                      : 'No requirements recorded in this project.'}
                  </p>
                </div>
              ) : (
                filteredList.map((req) => (
                  <motion.div
                    key={req.id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleSelectRequirement(req)}
                    className="p-3.5 rounded-xl bg-[#111216] hover:bg-[#15171E] border border-[#27272A] hover:border-zinc-700/80 transition-all cursor-pointer space-y-2 group shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-blue-400">
                          {req.code}
                        </span>
                        {req.currentVersion && req.currentVersion > 1 && (
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono text-zinc-400 bg-zinc-800">
                            v{req.currentVersion}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <PriorityBadge priority={req.priority} size="sm" />
                        <WorkflowStatusBadge status={req.workflowStatus} size="sm" />
                      </div>
                    </div>

                    <p className="text-xs sm:text-[13px] font-semibold text-zinc-200 group-hover:text-white transition-colors line-clamp-2">
                      {req.title}
                    </p>

                    <div className="flex items-center justify-between text-[10.5px] font-mono text-zinc-500 pt-1 border-t border-zinc-800/60">
                      <span>{req.type || 'FUNCTIONAL'}</span>
                      <span className="group-hover:text-blue-400 flex items-center gap-1 transition-colors">
                        <span>Open spec</span>
                        <ArrowRight size={10} />
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* ─── Bottom Footer ─── */}
            <div className="p-3 bg-[#0E0F14] border-t border-[#27272A]/80 text-[11px] text-zinc-500 flex items-center justify-between shrink-0">
              <span className="flex items-center gap-1">
                <Command size={11} className="text-zinc-400" />
                <span>Tip: Press <strong>g r</strong> anytime</span>
              </span>
              <span className="text-[10px] font-mono">DevFlow Requirements v1.0</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
