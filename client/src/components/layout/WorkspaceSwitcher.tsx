import React from 'react';
import { Check, Plus, Settings, UserPlus, LogOut, Building, ShieldCheck } from 'lucide-react';

interface WorkspaceSwitcherProps {
  onClose: () => void;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ onClose }) => {
  const workspaces = [
    { id: 'devflow', name: 'DevFlow', plan: 'Enterprise', active: true },
    { id: 'personal', name: 'Personal Projects', plan: 'Hobby', active: false },
    { id: 'acme', name: 'Acme Studio', plan: 'Pro', active: false },
  ];

  return (
    <div className="absolute top-12 left-2 right-2 z-50 bg-[#161619] border border-sidebar-border rounded-lg shadow-2xl py-1.5 text-xs text-zinc-300 animate-in fade-in zoom-in-95 duration-100">
      <div className="px-2.5 py-1 text-[10px] font-semibold text-sidebar-text-muted uppercase tracking-wider">
        Workspaces
      </div>

      <div className="space-y-0.5 px-1 py-1">
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            onClick={() => {
              onClose();
            }}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors ${
              ws.active
                ? 'bg-[#222226] text-white font-medium'
                : 'hover:bg-sidebar-hover text-zinc-300'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <div
                className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                  ws.active ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {ws.name.charAt(0)}
              </div>
              <div className="truncate">
                <div className="text-[13px] leading-tight truncate">{ws.name}</div>
                <div className="text-[10px] text-zinc-500 leading-none mt-0.5">{ws.plan}</div>
              </div>
            </div>
            {ws.active && <Check size={14} className="text-zinc-200" />}
          </button>
        ))}
      </div>

      <div className="my-1 border-t border-sidebar-border" />

      <div className="space-y-0.5 px-1">
        <button
          onClick={onClose}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-sidebar-hover text-zinc-300 transition-colors"
        >
          <Settings size={14} className="text-zinc-400" />
          <span className="text-[12.5px]">Workspace settings</span>
        </button>

        <button
          onClick={onClose}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-sidebar-hover text-zinc-300 transition-colors"
        >
          <UserPlus size={14} className="text-zinc-400" />
          <span className="text-[12.5px]">Invite members</span>
        </button>

        <button
          onClick={onClose}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-sidebar-hover text-zinc-300 transition-colors"
        >
          <Plus size={14} className="text-zinc-400" />
          <span className="text-[12.5px]">Create new workspace</span>
        </button>
      </div>
    </div>
  );
};
