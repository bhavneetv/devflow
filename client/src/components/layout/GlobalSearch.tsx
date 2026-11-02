import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  FolderKanban,
  CircleDot,
  Users,
  Settings,
  Plus,
  ArrowRight,
  Command,
  X,
  Layers,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNavigation } from '../../context/NavigationContext';

interface SearchItem {
  id: string;
  category: 'Pages' | 'Projects' | 'Issues' | 'Teams' | 'Actions';
  title: string;
  description?: string;
  icon: any;
  action: () => void;
}

export const GlobalSearch: React.FC = () => {
  const { isSearchOpen, setIsSearchOpen, selectProject, setIsCreateOpen } = useNavigation();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isSearchOpen]);

  const items: SearchItem[] = [
    // Actions
    {
      id: 'act-new-issue',
      category: 'Actions',
      title: 'Create new issue',
      description: 'Open creation modal (C)',
      icon: Plus,
      action: () => {
        setIsSearchOpen(false);
        setIsCreateOpen(true);
      },
    },
    // Projects
    {
      id: 'proj-1',
      category: 'Projects',
      title: 'DevFlow Cloud Platform v2',
      description: 'In Progress • 3 tasks',
      icon: FolderKanban,
      action: () => {
        selectProject({ id: 1, title: 'DevFlow Cloud Platform v2' });
        navigate('/projects/1');
        setIsSearchOpen(false);
      },
    },
    {
      id: 'proj-2',
      category: 'Projects',
      title: 'Mobile App Redesign',
      description: 'Planning • 1 task',
      icon: FolderKanban,
      action: () => {
        selectProject({ id: 2, title: 'Mobile App Redesign' });
        navigate('/projects/2');
        setIsSearchOpen(false);
      },
    },
    // Issues
    {
      id: 'issue-1',
      category: 'Issues',
      title: 'Configure Prisma with MySQL schema',
      description: 'DEV-101 • Done • Alice Johnson',
      icon: CircleDot,
      action: () => {
        navigate('/my-issues');
        setIsSearchOpen(false);
      },
    },
    {
      id: 'issue-2',
      category: 'Issues',
      title: 'Implement Express REST API with TypeScript',
      description: 'DEV-102 • Done • Bob Smith',
      icon: CircleDot,
      action: () => {
        navigate('/my-issues');
        setIsSearchOpen(false);
      },
    },
    {
      id: 'issue-3',
      category: 'Issues',
      title: 'Connect React Frontend to Node API',
      description: 'DEV-103 • In Progress • Charlie Davis',
      icon: CircleDot,
      action: () => {
        navigate('/my-issues');
        setIsSearchOpen(false);
      },
    },
    // Teams
    {
      id: 'team-eng',
      category: 'Teams',
      title: 'Engineering Team',
      description: 'Active sprint, Backlog, Views',
      icon: Users,
      action: () => {
        navigate('/teams/engineering/issues');
        setIsSearchOpen(false);
      },
    },
    {
      id: 'team-des',
      category: 'Teams',
      title: 'Design Team',
      description: 'Figma mockups, design system',
      icon: Layers,
      action: () => {
        navigate('/teams/design/issues');
        setIsSearchOpen(false);
      },
    },
    // Pages
    {
      id: 'page-inbox',
      category: 'Pages',
      title: 'Inbox',
      description: 'Notifications & triage (7 unread)',
      icon: Command,
      action: () => {
        navigate('/inbox');
        setIsSearchOpen(false);
      },
    },
    {
      id: 'page-settings',
      category: 'Pages',
      title: 'Settings',
      description: 'Account, workspace, integrations',
      icon: Settings,
      action: () => {
        navigate('/settings');
        setIsSearchOpen(false);
      },
    },
  ];

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(query.toLowerCase())) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
    }
  };

  if (!isSearchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-[#121215] border border-sidebar-border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-3.5 py-3 border-b border-sidebar-border">
          <Search size={18} className="text-zinc-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-0 outline-none text-white text-[14px] placeholder-zinc-500 font-normal"
            placeholder="Search or jump to... (issues, projects, teams)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={() => setIsSearchOpen(false)}
            className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-[#1C1C1F]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-1.5 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              No results found for "{query}".
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-xs ${
                    isSelected
                      ? 'bg-[#1F1F24] text-white'
                      : 'text-zinc-300 hover:bg-[#18181C]'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-6 h-6 rounded bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-zinc-400 flex-shrink-0">
                      <Icon size={14} />
                    </div>
                    <div className="truncate">
                      <div className="font-medium text-[13px] text-zinc-100 truncate">
                        {item.title}
                      </div>
                      {item.description && (
                        <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                      {item.category}
                    </span>
                    {isSelected && <ArrowRight size={13} className="text-zinc-400" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Shortcut Guide */}
        <div className="px-3.5 py-2 border-t border-sidebar-border/60 bg-[#0E0E11] flex items-center justify-between text-[11px] text-zinc-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-300">
                ↑
              </kbd>{' '}
              <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-300">
                ↓
              </kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-300">
                ↵
              </kbd>{' '}
              Select
            </span>
          </div>
          <span>
            <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-300">
              ESC
            </kbd>{' '}
            Close
          </span>
        </div>
      </div>
    </div>
  );
};
