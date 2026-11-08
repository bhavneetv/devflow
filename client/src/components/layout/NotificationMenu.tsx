import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Building2,
  Layers,
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
  UserCheck,
} from 'lucide-react';
import { notificationService, InAppNotification } from '../../services/notification.service';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { useToast } from '../../context/ToastContext';
import { useAccentTheme } from '../../services/accentTheme.service';

export const NotificationMenu: React.FC = () => {
  const { user } = useAuth();
  const { refreshOrganizations } = useOrganization();
  const { toast } = useToast();
  const { accentColor } = useAccentTheme();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [actionDecision, setActionDecision] = useState<'ACCEPT' | 'DECLINE' | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Fetch notifications and unread count
  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const [listRes, countRes] = await Promise.all([
        notificationService.getNotifications(),
        notificationService.getUnreadCount(),
      ]);
      if (listRes.success && Array.isArray(listRes.data)) {
        setNotifications(listRes.data);
      }
      if (countRes.success && typeof countRes.count === 'number') {
        setUnreadCount(countRes.count);
      }
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Connect to Socket.IO for real-time notifications
  useEffect(() => {
    if (!user) return;

    const socketUrl = window.location.origin.includes('localhost')
      ? 'http://localhost:5000'
      : '/';

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.emit('join_user', user.id);

    socket.on('new_notification', (newNotif: InAppNotification) => {
      // Parse data if necessary
      let parsed = newNotif;
      if (typeof newNotif.data === 'string') {
        try {
          parsed = { ...newNotif, parsedData: JSON.parse(newNotif.data) };
        } catch {
          // ignore
        }
      }
      setNotifications((prev) => [parsed, ...prev]);
      setUnreadCount((c) => c + 1);
      toast.info('New Notification', newNotif.title || 'You have a new invite');
    });

    return () => {
      socket.disconnect();
    };
  }, [user, toast]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      const res = await notificationService.markAllAsRead();
      if (res.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleInvitationAction = async (
    notification: InAppNotification,
    action: 'ACCEPT' | 'DECLINE'
  ) => {
    setActioningId(notification.id);
    setActionDecision(action);

    try {
      const res = await notificationService.respondToInvitation(notification.id, action);
      if (res.success) {
        toast.success(
          action === 'ACCEPT' ? 'Invitation Accepted!' : 'Invitation Declined',
          res.message || 'Updated successfully'
        );

        // Mark this notification as read and update message
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id
              ? {
                  ...n,
                  isRead: true,
                  message:
                    action === 'ACCEPT'
                      ? `Accepted: ${n.message}`
                      : `Declined: ${n.message}`,
                }
              : n
          )
        );
        setUnreadCount((c) => Math.max(0, c - 1));

        // Refresh orgs so sidebar and navigation reflect the newly joined organization/team
        await refreshOrganizations();
      } else {
        toast.error('Action Failed', res.error || 'Could not process invitation');
      }
    } catch (err: any) {
      toast.error('Error', err.message || 'Request failed');
    } finally {
      setActioningId(null);
      setActionDecision(null);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-header-search border border-transparent hover:border-sidebar-border transition-colors relative cursor-pointer"
        title="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-indigo-500 text-[10px] font-bold text-white flex items-center justify-center shadow-md animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-10 w-88 sm:w-96 bg-[#111216] border border-[#27272A] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272A] bg-[#0E0F14]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs sm:text-sm text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                <CheckCheck size={13} />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-[#1C1D24]">
            {isLoading && notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                <Loader2 size={18} className="animate-spin mx-auto mb-2 text-zinc-400" />
                <span>Checking notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto text-zinc-500">
                  <Bell size={18} />
                </div>
                <p className="text-xs font-semibold text-zinc-300">No notifications</p>
                <p className="text-[11px] text-zinc-500">
                  Invitations and project updates will appear here.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const isInvite =
                  item.type === 'ORGANIZATION_INVITATION' || item.type === 'TEAM_INVITATION';
                const isOrg = item.type === 'ORGANIZATION_INVITATION';
                const pData = item.parsedData || {};
                const isActioning = actioningId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 transition-colors ${
                      !item.isRead ? 'bg-indigo-500/[0.04]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${
                          isOrg
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            : isInvite
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        {isOrg ? (
                          <Building2 size={15} />
                        ) : isInvite ? (
                          <Layers size={15} />
                        ) : (
                          <Mail size={15} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-white truncate">{item.title}</p>
                          <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                            {formatTimeAgo(item.createdAt)}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-400 leading-relaxed">{item.message}</p>

                        {/* Invitation details and actions */}
                        {isInvite && !item.isRead && (
                          <div className="pt-2 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => handleInvitationAction(item, 'ACCEPT')}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-black bg-emerald-400 hover:bg-emerald-300 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                            >
                              {isActioning && actionDecision === 'ACCEPT' ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={13} />
                              )}
                              <span>Accept</span>
                            </button>

                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => handleInvitationAction(item, 'DECLINE')}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {isActioning && actionDecision === 'DECLINE' ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <XCircle size={13} />
                              )}
                              <span>Decline</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
