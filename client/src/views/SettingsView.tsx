import React from 'react';
import { Settings, Shield, Database, Key, Bell, User, Check } from 'lucide-react';

export const SettingsView: React.FC = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="pb-3 border-b border-[#27272A]">
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Settings size={20} className="text-zinc-400" />
          <span>Workspace Settings</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Manage your DevFlow configuration, database connection, and team preferences
        </p>
      </div>

      <div className="space-y-4">
        {/* Workspace Profile */}
        <div className="p-4 rounded-xl border border-[#27272A] bg-[#0E0E10] space-y-3">
          <h2 className="text-sm font-semibold text-white">General Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                Workspace Name
              </label>
              <input
                type="text"
                readOnly
                value="DevFlow"
                className="w-full bg-[#161619] border border-[#27272A] rounded px-3 py-1.5 text-zinc-200 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                Workspace URL
              </label>
              <input
                type="text"
                readOnly
                value="app.devflow.io/workspace"
                className="w-full bg-[#161619] border border-[#27272A] rounded px-3 py-1.5 text-zinc-200 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Database & Stack Connection */}
        <div className="p-4 rounded-xl border border-[#27272A] bg-[#0E0E10] space-y-3">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Database & ORM Configuration</h2>
          </div>
          <p className="text-xs text-zinc-400">
            DevFlow is connected to MySQL via Prisma Client.
          </p>

          <div className="p-3 bg-[#141417] border border-zinc-800 rounded-lg text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Provider:</span>
              <span className="font-mono text-zinc-200">MySQL (XAMPP localhost:3306)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Database Name:</span>
              <span className="font-mono text-zinc-200">devflow_db</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Prisma Status:</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Check size={13} /> Synchronized
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
