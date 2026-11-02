import React, { useState } from 'react';
import { Inbox, CheckCircle2, Clock, Filter, Archive, Check } from 'lucide-react';

export const InboxView: React.FC = () => {
  const [items, setItems] = useState([
    {
      id: '1',
      title: 'Bob Smith assigned you task #DEV-102',
      detail: 'Implement Express REST API with TypeScript and Zod validation',
      time: '12m ago',
      team: 'Engineering',
      unread: true,
    },
    {
      id: '2',
      title: 'Alice Johnson created project milestone: Backend Architecture Sync',
      detail: 'Prisma schema and MySQL database synchronization completed on port 3306',
      time: '1h ago',
      team: 'DevFlow Core',
      unread: true,
    },
    {
      id: '3',
      title: 'Charlie Davis requested review on PR #14',
      detail: 'Added custom tree line guides and collapsible Linear-style navigation',
      time: '3h ago',
      team: 'Design',
      unread: false,
    },
  ]);

  const markRead = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, unread: false } : item)));
  };

  const archiveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Inbox size={20} className="text-zinc-400" />
            <span>Inbox</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Notifications, mentions, and issue updates across your workspaces
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setItems((prev) => prev.map((i) => ({ ...i, unread: false })))}
            className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            Mark all read
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {items.length === 0 ? (
          <div className="py-16 text-center text-zinc-500 text-xs">
            <CheckCircle2 size={32} className="mx-auto mb-2 text-zinc-600" />
            <p className="text-zinc-300 font-medium">All caught up!</p>
            <p className="text-zinc-500 mt-1">No unread notifications in your inbox.</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`flex items-start justify-between p-3.5 rounded-lg border transition-colors ${
                item.unread
                  ? 'bg-[#121215] border-[#27272A] hover:border-zinc-700'
                  : 'bg-[#0B0B0D] border-zinc-900 hover:border-zinc-800'
              }`}
            >
              <div className="flex items-start gap-3 truncate">
                <div className="mt-1">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      item.unread ? 'bg-indigo-500' : 'bg-transparent'
                    }`}
                  />
                </div>
                <div className="truncate">
                  <div className="text-[13px] font-medium text-zinc-200 truncate">
                    {item.title}
                  </div>
                  <div className="text-[12px] text-zinc-400 mt-0.5 truncate">
                    {item.detail}
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-[10.5px] text-zinc-500">
                    <span className="px-1.5 py-0.2 rounded bg-zinc-800 border border-zinc-700/60 font-mono">
                      {item.team}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {item.time}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {item.unread && (
                  <button
                    onClick={() => markRead(item.id)}
                    className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800"
                    title="Mark read"
                  >
                    <Check size={14} />
                  </button>
                )}
                <button
                  onClick={() => archiveItem(item.id)}
                  className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800"
                  title="Archive"
                >
                  <Archive size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
