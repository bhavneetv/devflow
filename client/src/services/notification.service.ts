import { apiUrl } from '../config/api';
import { authService } from './auth.service';

export interface InAppNotification {
  id: number;
  recipientId: number;
  type: 'ORGANIZATION_INVITATION' | 'TEAM_INVITATION' | 'SYSTEM';
  title: string;
  message: string;
  data?: string | null;
  parsedData?: {
    invitationToken?: string;
    organizationName?: string;
    teamName?: string;
    role?: string;
    inviterName?: string;
    [key: string]: any;
  } | null;
  isRead: boolean;
  relatedInvitationId?: number | null;
  relatedOrganizationId?: number | null;
  relatedTeamId?: number | null;
  createdAt: string;
}

function getAuthHeaders(): Record<string, string> {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const notificationService = {
  async getNotifications(): Promise<{ success: boolean; data?: InAppNotification[]; error?: string }> {
    try {
      const res = await fetch(apiUrl('/notifications'), { headers: getAuthHeaders() });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch notifications' };
    }
  },

  async getUnreadCount(): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      const res = await fetch(apiUrl('/notifications/unread-count'), { headers: getAuthHeaders() });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch unread count' };
    }
  },

  async markAsRead(id: number): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/notifications/${id}/read`), {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to mark notification as read' };
    }
  },

  async markAllAsRead(): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(apiUrl('/notifications/read-all'), {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to mark all as read' };
    }
  },

  async respondToInvitation(
    id: number,
    action: 'ACCEPT' | 'DECLINE'
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/notifications/${id}/action`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to respond to invitation' };
    }
  },
};

