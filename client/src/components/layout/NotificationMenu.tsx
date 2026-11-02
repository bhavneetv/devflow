import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, Clock, MessageSquare, AlertCircle } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  type: 'mention' | 'assignment' | 'system';
}

export const NotificationMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'n1',
      title: 'Bob Smith assigned you an issue',
      description: 'DEV-102: Implement Express REST API with TypeScript',
      time: '12m ago',
      unread: true,
      type: 'assignment',
    },
    {
      id: 'n2',
      title: 'Alice Johnson merged a pull request',
      description: 'PR #14: Added Prisma singleton and MySQL migration scripts',
      time: '1h ago',
      unread: true,
      type: 'system',
    },
    {
      id: 'n3',
      title: 'Charlie Davis mentioned you in DevFlow Cloud Platform',
      description: '"Can you review the frontend routing integration?"',
      time: '3h ago',
      unread: false,
      type: 'mention',
    },
  ]);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const toggleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: !n.unread } : n))
    );
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-header-search border border-transparent hover:border-sidebar-border transition-colors relative"
        title="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 shadow-sm animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-10 w-80 bg-[#161619] border border-sidebar-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-sidebar-border bg-[#121215]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <CheckCheck size={13} />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-sidebar-border/40">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-xs">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => toggleRead(n.id)}
                  className={`p-3 cursor-pointer transition-colors text-xs hover:bg-[#1C1C1F] flex items-start gap-2.5 ${
                    n.unread ? 'bg-[#18181C]' : ''
                  }`}
                >
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0">
                    {n.unread ? (
                      <span className="block w-2 h-2 rounded-full bg-indigo-500" />
                    ) : (
                      <span className="block w-2 h-2 rounded-full bg-zinc-700" />
                    )}
                  </div>
                  <div className="flex-1 truncate">
                    <div className="font-medium text-zinc-200 text-[12.5px] truncate">
                      {n.title}
                    </div>
                    <div className="text-zinc-400 text-[11px] mt-0.5 line-clamp-2">
                      {n.description}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                      <Clock size={10} />
                      <span>{n.time}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
