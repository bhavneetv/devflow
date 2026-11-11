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
  PenTool,
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
  { id: 'pen-tool', label: 'Whiteboard', category: 'General', icon: PenTool },
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
  gridHeight?: string;
}

export const ModuleIconPicker: React.FC<ModuleIconPickerProps> = ({
  value,
  onChange,
  accentColor = '#8B5CF6',
  gridHeight = 'max-h-[210px]',
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
    <div className="space-y-2">
      {/* Search & Selected Icon Header */}
      <div className="flex items-center gap-2">
        {selectedIconOption && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs shrink-0 select-none shadow-xs"
            style={{
              borderColor: `${accentColor}50`,
              backgroundColor: `${accentColor}18`,
            }}
            title={selectedIconOption.label}
          >
            <selectedIconOption.icon size={13} style={{ color: accentColor }} />
            <span className="text-[11px] font-medium text-zinc-200">{selectedIconOption.label}</span>
          </div>
        )}
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search icons..."
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
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
        {categories.map((cat) => {
          const isCatSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-2 py-0.5 rounded-md text-[10.5px] font-medium whitespace-nowrap transition-all cursor-pointer border',
                isCatSelected
                  ? 'text-white border-zinc-700 bg-zinc-800 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-zinc-800/60'
              )}
              style={
                isCatSelected
                  ? { borderColor: `${accentColor}80`, backgroundColor: `${accentColor}25` }
                  : undefined
              }
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Compact Icons Grid */}
      <div className={cn(
        'grid grid-cols-7 sm:grid-cols-9 md:grid-cols-10 gap-1 p-2 bg-[#0E0F14] border border-[#27272A] rounded-xl overflow-y-auto scrollbar-none',
        gridHeight
      )}>
        {filteredIcons.map((opt) => {
          const Icon = opt.icon;
          const isSelected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={cn(
                'relative w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer group',
                isSelected
                  ? 'text-white shadow-md scale-105'
                  : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-800/80'
              )}
              style={
                isSelected
                  ? {
                      borderColor: accentColor,
                      backgroundColor: `${accentColor}25`,
                      boxShadow: `0 0 10px ${accentColor}30`,
                    }
                  : undefined
              }
              title={opt.label}
            >
              <Icon size={15} strokeWidth={isSelected ? 2.3 : 1.9} />
              {isSelected && (
                <div
                  className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center text-white text-[7px] shadow-sm ring-1 ring-[#0E0F14]"
                  style={{ backgroundColor: accentColor }}
                >
                  <Check size={7} strokeWidth={3.5} />
                </div>
              )}
            </button>
          );
        })}

        {filteredIcons.length === 0 && (
          <div className="col-span-full py-6 text-center text-xs text-zinc-500">
            No icons matching "{search}"
          </div>
        )}
      </div>
    </div>
  );
};

