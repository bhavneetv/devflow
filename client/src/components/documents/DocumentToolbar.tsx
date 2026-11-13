import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  ListFilter,
  LayoutGrid,
  List as ListIcon,
  FolderTree,
  RefreshCw,
  Plus,
  FolderPlus,
  Upload,
  ChevronDown,
  ChevronRight,
  Check,
  Calendar,
  FileType,
  Folder,
  ArrowUpDown,
  ArrowDownAZ,
  ArrowUpZA,
  Clock,
  Layers,
  User,
  PanelLeft,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { DocumentCategory } from '../../types/document';
import { useAccentTheme } from '../../services/accentTheme.service';
import { AnimatedSelect, SelectOption } from '../settings/AnimatedSelect';
import { UserAvatar } from '../common/UserAvatar';

export type ViewMode = 'cards' | 'list' | 'hierarchy';
export type GroupByMode = 'none' | 'date' | 'type' | 'folder';

export interface DocumentAuthorOption {
  id: number;
  name: string;
  email?: string;
  avatarUrl?: string;
  avatarColor?: string;
}

interface DocumentToolbarProps {
  search: string;
  onSearchChange: (search: string) => void;
  categories: DocumentCategory[];
  selectedCategoryId?: number;
  onSelectCategory?: (id?: number) => void;
  selectedFileType?: string;
  onSelectFileType: (type?: string) => void;
  selectedAuthorId?: number;
  onSelectAuthorId?: (id?: number) => void;
  authorOptions?: DocumentAuthorOption[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  groupBy: GroupByMode;
  onGroupByChange: (group: GroupByMode) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onUploadClick: () => void;
  onNewFolderClick: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
}

const FILE_TYPE_OPTIONS: Array<{ value: string; label: string; icon?: string }> = [
  { value: '', label: 'All File Types' },
  { value: 'pdf', label: 'PDF Documents' },
  { value: 'image', label: 'Images & Photos' },
  { value: 'code', label: 'Code & Scripts' },
  { value: 'video', label: 'Media & Videos' },
  { value: 'archive', label: 'Archives & ZIP' },
  { value: 'document', label: 'Docs & Notes' },
];

const GROUP_OPTIONS: Array<{
  key: GroupByMode;
  label: string;
  sublabel: string;
  shortLabel: string;
  icon: React.ReactNode;
}> = [
  { key: 'none', label: 'No Grouping', sublabel: 'Flat list or card view', shortLabel: 'None', icon: <ListIcon size={13} className="text-zinc-400" /> },
  { key: 'date', label: 'By Date', sublabel: 'Group by upload date', shortLabel: 'Date', icon: <Calendar size={13} className="text-cyan-400" /> },
  { key: 'type', label: 'By File Type', sublabel: 'PDF, Image, Docs, etc.', shortLabel: 'Type', icon: <FileType size={13} className="text-emerald-400" /> },
  { key: 'folder', label: 'By Folder', sublabel: 'Folder tree grouping', shortLabel: 'Folder', icon: <Folder size={13} className="text-indigo-400" /> },
];

const SORT_OPTIONS: Array<{
  key: string;
  sb: string;
  so: 'asc' | 'desc';
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}> = [
  { key: 'createdAt:desc', sb: 'createdAt', so: 'desc', label: 'Newest First', sublabel: 'Most recent uploads', icon: <Clock size={13} className="text-emerald-400" /> },
  { key: 'createdAt:asc', sb: 'createdAt', so: 'asc', label: 'Oldest First', sublabel: 'Earliest uploads', icon: <Calendar size={13} className="text-zinc-400" /> },
  { key: 'displayName:asc', sb: 'displayName', so: 'asc', label: 'Name (A → Z)', sublabel: 'Alphabetical order', icon: <ArrowDownAZ size={13} className="text-sky-400" /> },
  { key: 'displayName:desc', sb: 'displayName', so: 'desc', label: 'Name (Z → A)', sublabel: 'Reverse alphabetical', icon: <ArrowUpZA size={13} className="text-indigo-400" /> },
  { key: 'sizeBytes:desc', sb: 'sizeBytes', so: 'desc', label: 'Size (Largest)', sublabel: 'High storage first', icon: <Layers size={13} className="text-amber-400" /> },
  { key: 'sizeBytes:asc', sb: 'sizeBytes', so: 'asc', label: 'Size (Smallest)', sublabel: 'Low storage first', icon: <Layers size={13} className="text-zinc-400" /> },
];

export const DocumentToolbar: React.FC<DocumentToolbarProps> = ({
  search,
  onSearchChange,
  categories,
  selectedCategoryId,
  onSelectCategory,
  selectedFileType,
  onSelectFileType,
  selectedAuthorId,
  onSelectAuthorId,
  authorOptions = [],
  sortBy,
  sortOrder,
  onSortChange,
  groupBy,
  onGroupByChange,
  viewMode,
  onViewModeChange,
  onUploadClick,
  onNewFolderClick,
  onRefresh,
  isLoading,
  showSidebar,
  onToggleSidebar,
}) => {
  const { accentColor } = useAccentTheme();
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortGroupOpen, setIsSortGroupOpen] = useState(false);
  const [isGroupByHovered, setIsGroupByHovered] = useState(false);

  const newDropdownRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const sortGroupRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (newDropdownRef.current && !newDropdownRef.current.contains(event.target as Node)) {
        setShowNewDropdown(false);
      }
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
      if (sortGroupRef.current && !sortGroupRef.current.contains(event.target as Node)) {
        setIsSortGroupOpen(false);
        setIsGroupByHovered(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options formatted for AnimatedSelect
  const fileTypeSelectOptions: SelectOption[] = useMemo(
    () => FILE_TYPE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
    []
  );

  const authorSelectOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Authors' },
      ...authorOptions.map((a) => ({
        value: String(a.id),
        label: a.name,
        icon: <UserAvatar user={a} size="xs" />,
      })),
    ],
    [authorOptions]
  );

  const categorySelectOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Folders' },
      ...categories.map((c) => ({
        value: String(c.id),
        label: c.name,
        icon: <Folder size={12} className="text-indigo-400" />,
      })),
    ],
    [categories]
  );

  // Active filter items for pills
  const activeFilters = useMemo(() => {
    const list: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (selectedFileType) {
      const opt = FILE_TYPE_OPTIONS.find((t) => t.value === selectedFileType);
      list.push({
        key: 'type',
        label: `Type: ${opt?.label || selectedFileType}`,
        onRemove: () => onSelectFileType(undefined),
      });
    }
    if (selectedAuthorId) {
      const auth = authorOptions.find((a) => a.id === selectedAuthorId);
      list.push({
        key: 'author',
        label: `Author: ${auth?.name || `User #${selectedAuthorId}`}`,
        onRemove: () => onSelectAuthorId?.(undefined),
      });
    }
    if (selectedCategoryId) {
      const cat = categories.find((c) => c.id === selectedCategoryId);
      list.push({
        key: 'folder',
        label: `Folder: ${cat?.name || `Folder #${selectedCategoryId}`}`,
        onRemove: () => onSelectCategory?.(undefined),
      });
    }
    return list;
  }, [selectedFileType, selectedAuthorId, selectedCategoryId, authorOptions, categories, onSelectFileType, onSelectAuthorId, onSelectCategory]);

  const activeFilterCount = activeFilters.length;
  const isSortGroupModified = groupBy !== 'none' || sortBy !== 'createdAt' || sortOrder !== 'desc';
  const activeGroupOption = GROUP_OPTIONS.find((g) => g.key === groupBy) || GROUP_OPTIONS[0];

  const handleResetFilters = () => {
    onSelectFileType(undefined);
    onSelectAuthorId?.(undefined);
    onSelectCategory?.(undefined);
  };

  return (
    <div className="relative z-[60] flex flex-col gap-2 pb-1">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Left side: Sidebar toggle & Search input */}
        <div className="flex items-center gap-2 flex-1 max-w-2xl">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              title={showSidebar ? 'Hide folder sidebar' : 'Show folder sidebar'}
              className={cn(
                'p-2 rounded-xl border text-xs transition-colors shrink-0 cursor-pointer',
                !showSidebar && 'bg-[#0E0F14] border-[#27272A] text-zinc-400 hover:text-white hover:border-zinc-700'
              )}
              style={
                showSidebar
                  ? {
                      backgroundColor: `${accentColor}18`,
                      borderColor: `${accentColor}45`,
                      color: accentColor,
                    }
                  : undefined
              }
            >
              <PanelLeft size={14} />
            </button>
          )}

          {/* Search */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search documents by name, path..."
              className="w-full bg-[#0E0F14] border border-[#27272A] rounded-xl pl-9 pr-8 py-2 text-[12px] text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5 rounded cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Right side: Icon-Only Filter button, Icon-Only Sort & Group button, View switchers, Refresh, + New */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
          {/* ── 1. ICON-ONLY FILTER BUTTON ────────────────────────────────── */}
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              title={activeFilterCount > 0 ? `Filter options (${activeFilterCount} active)` : 'Filter options'}
              aria-label="Filter options"
              onClick={() => {
                setIsFilterOpen((prev) => !prev);
                setIsSortGroupOpen(false);
                setIsGroupByHovered(false);
              }}
              className={`relative w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                activeFilterCount > 0
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm'
                  : isFilterOpen
                  ? 'bg-[#181A22] border-zinc-500 text-white'
                  : 'bg-[#0E0F14] text-zinc-300 border-[#27272A] hover:text-white hover:border-zinc-700'
              }`}
            >
              <ListFilter size={15} style={activeFilterCount > 0 ? { color: accentColor } : undefined} />
              {activeFilterCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full text-[9.5px] font-mono font-bold text-white flex items-center justify-center shadow-md border border-[#111216]"
                  style={{ backgroundColor: accentColor }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Filter Popover Panel (Zero Horizontal Scrollbar with AnimatedSelect) */}
            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 top-full mt-2 w-[320px] sm:w-[360px] rounded-2xl bg-[#12141C] border border-[#27272A] shadow-2xl z-50 overflow-hidden text-xs"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272A] bg-[#161824]">
                    <div className="flex items-center gap-2">
                      <ListFilter size={14} style={{ color: accentColor }} />
                      <span className="font-semibold text-white">Filter Documents</span>
                      {activeFilterCount > 0 && (
                        <span
                          className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold text-white shadow-sm"
                          style={{ backgroundColor: accentColor }}
                        >
                          {activeFilterCount} active
                        </span>
                      )}
                    </div>
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="text-[11px] font-mono text-zinc-400 hover:text-white underline cursor-pointer"
                      >
                        Reset all
                      </button>
                    )}
                  </div>

                  <div className="p-4 space-y-3 max-h-[62vh] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-zinc-700">
                    {/* Author / Uploader Filter */}
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Author / Uploader</label>
                      <AnimatedSelect
                        options={authorSelectOptions}
                        value={selectedAuthorId ? String(selectedAuthorId) : ''}
                        onChange={(val) => onSelectAuthorId?.(val ? parseInt(val, 10) : undefined)}
                        placeholder="All Authors"
                        dropdownMinWidth="w-full"
                        accentColor={accentColor}
                      />
                    </div>

                    {/* File Type Filter */}
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">File Type</label>
                      <AnimatedSelect
                        options={fileTypeSelectOptions}
                        value={selectedFileType || ''}
                        onChange={(val) => onSelectFileType(val || undefined)}
                        placeholder="All File Types"
                        dropdownMinWidth="w-full"
                        accentColor={accentColor}
                      />
                    </div>

                    {/* Folder / Category Filter */}
                    {categories.length > 0 && onSelectCategory && (
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 mb-1">Folder / Category</label>
                        <AnimatedSelect
                          options={categorySelectOptions}
                          value={selectedCategoryId ? String(selectedCategoryId) : ''}
                          onChange={(val) => onSelectCategory(val ? parseInt(val, 10) : undefined)}
                          placeholder="All Folders"
                          dropdownMinWidth="w-full"
                          accentColor={accentColor}
                        />
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-2.5 border-t border-[#27272A] bg-[#161824] flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setIsFilterOpen(false)}
                      className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white shadow-md hover:brightness-110 transition-all cursor-pointer"
                      style={{ backgroundColor: accentColor }}
                    >
                      Apply
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── 2. ICON-ONLY SORT & GROUP BUTTON (WITH EXPANDABLE SUBMENU FLYOUT) ── */}
          <div className="relative" ref={sortGroupRef}>
            <button
              type="button"
              onClick={() => {
                setIsSortGroupOpen(!isSortGroupOpen);
                setIsFilterOpen(false);
                setIsGroupByHovered(false);
              }}
              title={isSortGroupModified ? 'Sort & Group options (modified)' : 'Sort & Group options'}
              aria-label="Sort & Group options"
              className={`relative w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                isSortGroupModified
                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-300 shadow-sm'
                  : isSortGroupOpen
                  ? 'bg-[#181A22] border-zinc-500 text-white'
                  : 'bg-[#0E0F14] text-zinc-300 border-[#27272A] hover:text-white hover:border-zinc-700'
              }`}
            >
              <ArrowUpDown size={15} style={isSortGroupModified ? { color: accentColor } : undefined} />
              {isSortGroupModified && (
                <span
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-[#0E0F14] shadow-sm"
                  style={{ backgroundColor: accentColor }}
                />
              )}
            </button>

            <AnimatePresence>
              {isSortGroupOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 top-full mt-2 w-64 max-h-[calc(100vh-120px)] overflow-visible rounded-2xl bg-[#14161C]/98 backdrop-blur-xl border border-[#27272A] p-2 shadow-2xl z-50 space-y-1.5 text-left"
                >
                  {/* Section 1: Sort by (with icons) */}
                  <div>
                    <div className="px-2.5 py-1 text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                      <span>Sort By</span>
                      <ArrowUpDown size={11} className="text-zinc-500" />
                    </div>
                    <div className="space-y-0.5">
                      {SORT_OPTIONS.map((item) => {
                        const isSelected = sortBy === item.sb && sortOrder === item.so;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => {
                              onSortChange(item.sb, item.so);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-white/10 text-white font-medium border border-white/10 shadow-sm'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="shrink-0">{item.icon}</span>
                              <div className="truncate">
                                <span className="block truncate text-zinc-200 text-xs">{item.label}</span>
                                <span className="block text-[10px] font-mono text-zinc-500">{item.sublabel}</span>
                              </div>
                            </div>
                            {isSelected && (
                              <Check
                                size={13}
                                className="shrink-0 ml-1"
                                style={{ color: accentColor }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-[#27272A]/70" />

                  {/* Section 2: Group by (Submenu Flyout on Hover / Click) */}
                  <div
                    className="relative"
                    onMouseEnter={() => setIsGroupByHovered(true)}
                    onMouseLeave={() => setIsGroupByHovered(false)}
                  >
                    <div className="px-2.5 py-1 text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                      <span>Group By</span>
                      <ChevronRight size={11} className="text-zinc-500" />
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsGroupByHovered((prev) => !prev)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                        groupBy !== 'none'
                          ? 'bg-purple-500/15 border border-purple-500/40 text-purple-200'
                          : 'text-zinc-300 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0">{activeGroupOption.icon}</span>
                        <div className="truncate">
                          <span className="block text-xs font-medium text-white truncate">
                            {activeGroupOption.label}
                          </span>
                          <span className="block text-[10px] font-mono text-zinc-500">
                            {activeGroupOption.sublabel}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={13} className="text-zinc-400 shrink-0 ml-1" />
                    </button>

                    {/* Flyout Submenu */}
                    <AnimatePresence>
                      {isGroupByHovered && (
                        <motion.div
                          initial={{ opacity: 0, x: 6, scale: 0.97 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: 6, scale: 0.97 }}
                          transition={{ duration: 0.14 }}
                          className="absolute right-full bottom-0 pr-2 z-[9990]"
                        >
                          <div className="w-60 max-h-[75vh] overflow-y-auto rounded-2xl bg-[#14161C]/98 backdrop-blur-xl border border-[#27272A] p-2 shadow-2xl space-y-1 text-left">
                            <div className="px-2.5 py-1 text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                              <span>Group Options</span>
                              <Folder size={11} className="text-zinc-500" />
                            </div>
                            {GROUP_OPTIONS.map((g) => {
                              const isSelected = groupBy === g.key;
                              return (
                                <button
                                  key={g.key}
                                  type="button"
                                  onClick={() => {
                                    onGroupByChange(g.key);
                                    if (g.key === 'folder') {
                                      onViewModeChange('hierarchy');
                                    }
                                    setIsGroupByHovered(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-white/10 text-white font-medium border border-white/10 shadow-sm'
                                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="shrink-0">{g.icon}</span>
                                    <div className="truncate">
                                      <span className="block text-xs text-zinc-200 truncate">{g.label}</span>
                                      <span className="block text-[10px] font-mono text-zinc-500">{g.sublabel}</span>
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <Check
                                      size={13}
                                      className="shrink-0 ml-1"
                                      style={{ color: accentColor }}
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Section 3: Reset to Default Button */}
                  <div className="pt-2 border-t border-[#27272A]/70">
                    <button
                      type="button"
                      onClick={() => {
                        onGroupByChange('none');
                        onSortChange('createdAt', 'desc');
                        setIsSortGroupOpen(false);
                        setIsGroupByHovered(false);
                      }}
                      className="w-full py-1.5 px-2 rounded-lg text-center text-[11px] font-mono text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
                    >
                      Reset to Default
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* View Switchers: List, Card, Hierarchy */}
          <div className="flex items-center p-0.5 rounded-xl bg-[#0A0B0F] border border-[#27272A]">
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              title="List View"
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer',
                viewMode === 'list'
                  ? 'bg-[#1C1E26] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <ListIcon size={13} />
              <span className="hidden md:inline">List</span>
            </button>

            <button
              type="button"
              onClick={() => onViewModeChange('cards')}
              title="Card View"
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer',
                viewMode === 'cards'
                  ? 'bg-[#1C1E26] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <LayoutGrid size={13} />
              <span className="hidden md:inline">Card</span>
            </button>

            <button
              type="button"
              onClick={() => onViewModeChange('hierarchy')}
              title="Hierarchy / Folder-wise View"
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer',
                viewMode === 'hierarchy'
                  ? 'bg-[#1C1E26] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <FolderTree size={13} />
              <span className="hidden md:inline">Hierarchy</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh documents"
            className="p-2 rounded-xl border border-[#27272A] bg-[#0E0F14] text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              size={13}
              className={isLoading ? 'animate-spin' : ''}
              style={isLoading ? { color: accentColor } : undefined}
            />
          </button>

          {/* New / Upload Action Button */}
          <div className="relative" ref={newDropdownRef}>
            <button
              type="button"
              onClick={() => setShowNewDropdown(!showNewDropdown)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-medium text-[12px] text-white shadow-lg transition-all cursor-pointer hover:brightness-110"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 4px 14px -3px ${accentColor}66`,
              }}
            >
              <Plus size={14} />
              <span>New</span>
              <ChevronDown size={12} className={cn('transition-transform duration-200', showNewDropdown && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {showNewDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 4, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full z-[9980] w-48 bg-[#14161C]/98 backdrop-blur-xl border border-[#27272A] rounded-xl shadow-2xl py-1.5 px-1 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewDropdown(false);
                      onUploadClick();
                    }}
                    className="w-full px-2.5 py-2 rounded-lg text-left text-zinc-300 hover:text-white hover:bg-white/[0.06] flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Upload size={13} style={{ color: accentColor }} />
                    <div>
                      <div className="font-medium">Upload File</div>
                      <div className="text-[10px] text-zinc-500">Add to repo directly</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowNewDropdown(false);
                      onNewFolderClick();
                    }}
                    className="w-full px-2.5 py-2 rounded-lg text-left text-zinc-300 hover:text-white hover:bg-white/[0.06] flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <FolderPlus size={13} className="text-amber-400" />
                    <div>
                      <div className="font-medium">New Submodule Folder</div>
                      <div className="text-[10px] text-zinc-500">Create directory</div>
                    </div>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Active Filter Chips Bar */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#27272A]/50">
          <span className="text-[10px] font-mono uppercase text-zinc-500 mr-0.5">Filters:</span>
          {activeFilters.map((pill) => (
            <span
              key={pill.key}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] bg-white/[0.06] text-zinc-200 border border-white/10"
            >
              <span>{pill.label}</span>
              <button
                type="button"
                onClick={pill.onRemove}
                className="text-zinc-400 hover:text-white cursor-pointer ml-0.5"
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer ml-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};
