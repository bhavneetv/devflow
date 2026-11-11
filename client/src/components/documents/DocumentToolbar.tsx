import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  X,
  SlidersHorizontal,
  LayoutGrid,
  List as ListIcon,
  FolderTree,
  RefreshCw,
  Plus,
  FolderPlus,
  Upload,
  ChevronDown,
  Check,
  Calendar,
  FileType,
  Folder,
  ArrowUpDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { DocumentCategory } from '../../types/document';

export type ViewMode = 'cards' | 'list' | 'hierarchy';
export type GroupByMode = 'none' | 'date' | 'type' | 'folder';

interface DocumentToolbarProps {
  search: string;
  onSearchChange: (search: string) => void;
  categories: DocumentCategory[];
  selectedFileType?: string;
  onSelectFileType: (type?: string) => void;
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
}

const FILE_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'pdf', label: 'PDF Documents' },
  { value: 'image', label: 'Images' },
  { value: 'code', label: 'Code & Scripts' },
  { value: 'video', label: 'Media & Videos' },
  { value: 'archive', label: 'Archives' },
  { value: 'document', label: 'Documents & Notes' },
];

export const DocumentToolbar: React.FC<DocumentToolbarProps> = ({
  search,
  onSearchChange,
  categories: _categories,
  selectedFileType,
  onSelectFileType,
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
}) => {
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const newDropdownRef = useRef<HTMLDivElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (newDropdownRef.current && !newDropdownRef.current.contains(event.target as Node)) {
        setShowNewDropdown(false);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-1">
      {/* Left side: Search input & File Type filter */}
      <div className="flex items-center gap-2 flex-1 max-w-xl">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search documents..."
            className="w-full bg-[#0E0F14] border border-[#27272A] rounded-xl pl-9 pr-8 py-2 text-[12px] text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/60 transition-colors"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* File Type Dropdown */}
        <div className="relative shrink-0">
          <select
            value={selectedFileType || ''}
            onChange={(e) => onSelectFileType(e.target.value || undefined)}
            aria-label="Filter by file type"
            className="appearance-none bg-[#0E0F14] border border-[#27272A] rounded-xl pl-3 pr-8 py-2 text-[12px] text-zinc-300 hover:text-white focus:outline-none focus:border-blue-500/60 transition-colors cursor-pointer"
          >
            {FILE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#17181D] text-zinc-200">
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        </div>
      </div>

      {/* Right side: View switchers, Filter dropdown, Refresh button, + New button */}
      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
        {/* View Switchers: List, Card, Hierarchy */}
        <div className="flex items-center p-0.5 rounded-xl bg-[#0A0B0F] border border-[#27272A]">
          <button
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

        {/* Filter (Sort & Group) Dropdown */}
        <div className="relative" ref={filterDropdownRef}>
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-medium transition-colors cursor-pointer',
              showFilterDropdown || groupBy !== 'none'
                ? 'bg-[#1C1E26] text-blue-400 border-blue-500/40'
                : 'bg-[#0E0F14] text-zinc-300 border-[#27272A] hover:text-white hover:border-zinc-700'
            )}
          >
            <SlidersHorizontal size={13} />
            <span>Filter</span>
            {groupBy !== 'none' && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            )}
          </button>

          {showFilterDropdown && (
            <div className="absolute right-0 mt-1.5 z-30 w-56 bg-[#17181D] border border-[#27272A] rounded-xl shadow-2xl py-2 px-1 text-xs animate-in fade-in zoom-in-95 duration-150">
              {/* Group By Section */}
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Group By
              </div>
              <div className="space-y-0.5">
                {[
                  { key: 'none', label: 'None (Flat list)', icon: ListIcon },
                  { key: 'date', label: 'By Date', icon: Calendar },
                  { key: 'type', label: 'By Type', icon: FileType },
                  { key: 'folder', label: 'By Folder', icon: Folder },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => {
                      onGroupByChange(item.key as GroupByMode);
                      if (item.key === 'folder') {
                        onViewModeChange('hierarchy');
                      }
                      setShowFilterDropdown(false);
                    }}
                    className={cn(
                      'w-full px-2.5 py-1.5 rounded-lg text-left text-[12px] flex items-center justify-between hover:bg-white/[0.05] transition-colors cursor-pointer',
                      groupBy === item.key ? 'text-white font-medium bg-white/[0.04]' : 'text-zinc-400'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <item.icon size={13} className={groupBy === item.key ? 'text-blue-400' : 'text-zinc-500'} />
                      <span>{item.label}</span>
                    </div>
                    {groupBy === item.key && <Check size={12} className="text-blue-400" />}
                  </button>
                ))}
              </div>

              <div className="my-1.5 border-t border-[#27272A]" />

              {/* Sort By Section */}
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Sort By
              </div>
              <div className="space-y-0.5">
                {[
                  { sb: 'createdAt', so: 'desc', label: 'Newest First' },
                  { sb: 'createdAt', so: 'asc', label: 'Oldest First' },
                  { sb: 'displayName', so: 'asc', label: 'Name (A to Z)' },
                  { sb: 'displayName', so: 'desc', label: 'Name (Z to A)' },
                  { sb: 'sizeBytes', so: 'desc', label: 'Size (Largest)' },
                  { sb: 'sizeBytes', so: 'asc', label: 'Size (Smallest)' },
                ].map((item) => {
                  const isSelected = sortBy === item.sb && sortOrder === item.so;
                  return (
                    <button
                      key={`${item.sb}-${item.so}`}
                      onClick={() => {
                        onSortChange(item.sb, item.so as 'asc' | 'desc');
                        setShowFilterDropdown(false);
                      }}
                      className={cn(
                        'w-full px-2.5 py-1.5 rounded-lg text-left text-[12px] flex items-center justify-between hover:bg-white/[0.05] transition-colors cursor-pointer',
                        isSelected ? 'text-white font-medium bg-white/[0.04]' : 'text-zinc-400'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <ArrowUpDown size={12} className={isSelected ? 'text-blue-400' : 'text-zinc-500'} />
                        <span>{item.label}</span>
                      </div>
                      {isSelected && <Check size={12} className="text-blue-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh documents"
          className="p-2 rounded-xl border border-[#27272A] bg-[#0E0F14] text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin text-blue-400' : ''} />
        </button>

        {/* + New Button with Dropdown (Folder, File) */}
        <div className="relative" ref={newDropdownRef}>
          <button
            onClick={() => setShowNewDropdown(!showNewDropdown)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-sm shadow-blue-900/30 cursor-pointer"
          >
            <Plus size={14} />
            <span>New</span>
            <ChevronDown size={11} className={cn('transition-transform', showNewDropdown && 'rotate-180')} />
          </button>

          {showNewDropdown && (
            <div className="absolute right-0 mt-1.5 z-30 w-48 bg-[#17181D] border border-[#27272A] rounded-xl shadow-2xl py-1 px-1 text-xs animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => {
                  setShowNewDropdown(false);
                  onNewFolderClick();
                }}
                className="w-full px-3 py-2 rounded-lg text-left text-[12px] flex items-center gap-2.5 text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <div className="w-6 h-6 rounded-md bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                  <FolderPlus size={13} />
                </div>
                <div>
                  <div className="font-medium text-white">Folder</div>
                  <div className="text-[10px] text-zinc-500">Create new folder</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowNewDropdown(false);
                  onUploadClick();
                }}
                className="w-full px-3 py-2 rounded-lg text-left text-[12px] flex items-center gap-2.5 text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <div className="w-6 h-6 rounded-md bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                  <Upload size={13} />
                </div>
                <div>
                  <div className="font-medium text-white">File</div>
                  <div className="text-[10px] text-zinc-500">Upload documents</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
