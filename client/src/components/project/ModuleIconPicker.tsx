import React, { useState } from 'react';
import {
  Folder,
  FolderKanban,
  FolderTree,
  Layers,
  Boxes,
  LayoutGrid,
  Kanban,
  Terminal,
  Code2,
  GitFork,
  GitBranch,
  GitPullRequest,
  GitCommit,
  Cpu,
  Database,
  CheckSquare,
  AlertCircle,
  Bug,
  ShieldCheck,
  PlayCircle,
  Shield,
  FileText,
  BookOpen,
  FileCode,
  Flag,
  Target,
  RotateCcw,
  Clock,
  Calendar,
  Zap,
  Sparkles,
  Activity,
  Globe,
  Users,
  Compass,
  Flame,
  CircleDot,
  Hash,
  Sliders,
  Search,
  Check,
  X,
  LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface IconOption {
  id: string;
  label: string;
  category: 'Structure' | 'Development' | 'Quality' | 'Documentation' | 'Planning' | 'General';
  icon: LucideIcon;
}

export const MODULE_ICONS: IconOption[] = [
  // Structure
  { id: 'folder', label: 'Folder', category: 'Structure', icon: Folder },
  { id: 'folder-kanban', label: 'Kanban Folder', category: 'Structure', icon: FolderKanban },
  { id: 'folder-tree', label: 'Project Tree', category: 'Structure', icon: FolderTree },
  { id: 'layers', label: 'Layers', category: 'Structure', icon: Layers },
  { id: 'boxes', label: 'Boxes', category: 'Structure', icon: Boxes },
  { id: 'layout-grid', label: 'Grid', category: 'Structure', icon: LayoutGrid },
  { id: 'kanban', label: 'Kanban', category: 'Structure', icon: Kanban },

  // Development
  { id: 'terminal', label: 'Terminal', category: 'Development', icon: Terminal },
  { id: 'code', label: 'Code', category: 'Development', icon: Code2 },
  { id: 'git-fork', label: 'Git Fork', category: 'Development', icon: GitFork },
  { id: 'git-branch', label: 'Git Branch', category: 'Development', icon: GitBranch },
  { id: 'git-pull-request', label: 'Pull Request', category: 'Development', icon: GitPullRequest },
  { id: 'git-commit', label: 'Git Commit', category: 'Development', icon: GitCommit },
  { id: 'cpu', label: 'CPU', category: 'Development', icon: Cpu },
  { id: 'database', label: 'Database', category: 'Development', icon: Database },

  // Quality
  { id: 'check-square', label: 'Check Square', category: 'Quality', icon: CheckSquare },
  { id: 'alert-circle', label: 'Defect', category: 'Quality', icon: AlertCircle },
  { id: 'bug', label: 'Bug', category: 'Quality', icon: Bug },
  { id: 'shield-check', label: 'Security Check', category: 'Quality', icon: ShieldCheck },
  { id: 'play-circle', label: 'Test Run', category: 'Quality', icon: PlayCircle },
  { id: 'shield', label: 'Shield', category: 'Quality', icon: Shield },

  // Documentation
  { id: 'file-text', label: 'File Text', category: 'Documentation', icon: FileText },
  { id: 'book-open', label: 'Docs Book', category: 'Documentation', icon: BookOpen },
  { id: 'file-code', label: 'Specs File', category: 'Documentation', icon: FileCode },

  // Planning
  { id: 'flag', label: 'Milestone Flag', category: 'Planning', icon: Flag },
  { id: 'target', label: 'Target Objective', category: 'Planning', icon: Target },
  { id: 'rotate-ccw', label: 'Cycle / Sprint', category: 'Planning', icon: RotateCcw },
  { id: 'clock', label: 'Timeline Clock', category: 'Planning', icon: Clock },
  { id: 'calendar', label: 'Calendar', category: 'Planning', icon: Calendar },
  { id: 'zap', label: 'Lightning', category: 'Planning', icon: Zap },
  { id: 'sparkles', label: 'Sparkles', category: 'Planning', icon: Sparkles },
  { id: 'activity', label: 'Activity Logs', category: 'Planning', icon: Activity },

  // General
  { id: 'circle-dot', label: 'Circle Dot', category: 'General', icon: CircleDot },
  { id: 'globe', label: 'Globe', category: 'General', icon: Globe },
  { id: 'users', label: 'Team Users', category: 'General', icon: Users },
  { id: 'compass', label: 'Compass', category: 'General', icon: Compass },
  { id: 'flame', label: 'Flame', category: 'General', icon: Flame },
  { id: 'hash', label: 'Hash Tag', category: 'General', icon: Hash },
  { id: 'sliders', label: 'Sliders', category: 'General', icon: Sliders },
];

const ICON_MAP = new Map<string, LucideIcon>();
MODULE_ICONS.forEach((item) => {
  ICON_MAP.set(item.id, item.icon);
});

export function resolveModuleIcon(iconName?: string | null, fallback: LucideIcon = Folder): LucideIcon {
  if (!iconName) return fallback;
  return ICON_MAP.get(iconName.toLowerCase()) || fallback;
}

interface ModuleIconPickerProps {
  value: string;
  onChange: (iconId: string) => void;
  accentColor?: string;
}

export const ModuleIconPicker: React.FC<ModuleIconPickerProps> = ({
  value,
  onChange,
  accentColor = '#8B5CF6',
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Structure', 'Development', 'Quality', 'Documentation', 'Planning', 'General'];

  const filteredIcons = MODULE_ICONS.filter((item) => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      !search.trim() ||
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      item.id.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const selectedIconOption = MODULE_ICONS.find((item) => item.id === value);

  return (
    <div className="space-y-2.5">
      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search icons (e.g. git, code, folder)..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#0E0F14] border border-[#27272A] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-0.5"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {categories.map((cat) => {
            const isCatSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer border',
                  isCatSelected
                    ? 'text-white border-zinc-700 bg-zinc-800 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-zinc-800/60'
                )}
                style={
                  isCatSelected
                    ? { borderColor: `${accentColor}80`, backgroundColor: `${accentColor}20` }
                    : undefined
                }
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Icon Chip */}
      {selectedIconOption && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#0E0F14] border border-[#27272A]/80 text-xs">
          <span className="text-zinc-400 text-[11px]">Active Icon</span>
          <div className="flex items-center gap-1.5 font-medium text-white">
            <selectedIconOption.icon size={14} style={{ color: accentColor }} />
            <span className="text-[11.5px]">{selectedIconOption.label}</span>
          </div>
        </div>
      )}

      {/* Icons Grid */}
      <div className="grid grid-cols-7 sm:grid-cols-8 md:grid-cols-9 gap-1.5 p-2.5 bg-[#0E0F14] border border-[#27272A] rounded-xl max-h-[175px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
        {filteredIcons.map((opt) => {
          const Icon = opt.icon;
          const isSelected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={cn(
                'relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border transition-all cursor-pointer group',
                isSelected
                  ? 'text-white shadow-md scale-105'
                  : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-800/80 hover:scale-105'
              )}
              style={
                isSelected
                  ? {
                      borderColor: accentColor,
                      backgroundColor: `${accentColor}25`,
                      boxShadow: `0 0 12px ${accentColor}30`,
                    }
                  : undefined
              }
              title={opt.label}
            >
              <Icon size={17} strokeWidth={isSelected ? 2.3 : 1.9} />
              {isSelected && (
                <div
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[8px] shadow-sm ring-2 ring-[#0E0F14]"
                  style={{ backgroundColor: accentColor }}
                >
                  <Check size={8} strokeWidth={3.5} />
                </div>
              )}
            </button>
          );
        })}

        {filteredIcons.length === 0 && (
          <div className="col-span-full py-8 text-center text-xs text-zinc-500">
            No icons matching "{search}"
          </div>
        )}
      </div>
    </div>
  );
};

