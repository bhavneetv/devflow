import React from 'react';
import { Search, X, Filter, ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { GitRepositoryConnectionItem } from '../../types/git';

export interface GitFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  repositories?: GitRepositoryConnectionItem[];
  selectedRepoId?: string | number;
  onRepoChange?: (repoId: string | number) => void;
  statusOptions?: Array<{ id: string; label: string; count?: number }>;
  selectedStatus?: string;
  onStatusChange?: (status: string) => void;
  sortOptions?: Array<{ id: string; label: string }>;
  selectedSort?: string;
  onSortChange?: (sort: string) => void;
  actions?: React.ReactNode;
}

export const GitFilterBar: React.FC<GitFilterBarProps> = ({
  search,
  onSearchChange,
  searchPlaceholder = 'Search by title, number, or branch...',
  repositories = [],
  selectedRepoId = 'all',
  onRepoChange,
  statusOptions,
  selectedStatus = 'all',
  onStatusChange,
  sortOptions,
  selectedSort,
  onSortChange,
  actions,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border border-[#27272A] bg-[#0E0F15]">
      {/* Left side filters: Search, Repo Selector, Status Pills */}
      <div className="flex flex-1 items-center gap-2.5 flex-wrap min-w-0">
        {/* Search Input */}
        <div className="relative min-w-[200px] sm:min-w-[260px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-8.5 pr-8 py-1.5 text-xs bg-[#14151D] border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Repository Filter Dropdown */}
        {repositories.length > 0 && onRepoChange && (
          <div className="relative shrink-0">
            <select
              value={selectedRepoId}
              onChange={(e) => onRepoChange(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs bg-[#14151D] border border-zinc-800 rounded-lg text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors focus:outline-none cursor-pointer"
            >
              <option value="all">All Repositories ({repositories.length})</option>
              {repositories.map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.fullName}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
        )}

        {/* Status Toggle Pills */}
        {statusOptions && onStatusChange && (
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[#14151D] border border-zinc-800/80 text-xs">
            {statusOptions.map((opt) => {
              const active = selectedStatus === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onStatusChange(opt.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5',
                    active
                      ? 'bg-zinc-800 text-white shadow-xs font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  <span>{opt.label}</span>
                  {opt.count !== undefined && (
                    <span
                      className={cn(
                        'px-1.5 py-0.2 rounded-full text-[10px]',
                        active ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800/80 text-zinc-500'
                      )}
                    >
                      {opt.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Sort Filter Dropdown */}
        {sortOptions && onSortChange && selectedSort && (
          <div className="relative shrink-0">
            <select
              value={selectedSort}
              onChange={(e) => onSortChange(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs bg-[#14151D] border border-zinc-800 rounded-lg text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors focus:outline-none cursor-pointer"
            >
              {sortOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  Sort: {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Right side custom actions (e.g. New Issue / New MR buttons) */}
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
};

