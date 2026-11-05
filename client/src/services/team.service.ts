import { apiUrl } from '../config/api';
import { authService } from './auth.service';
import type { Team, TeamSummary, TeamMember, TeamInvitation, TeamMemberRole, InvitationPreview } from '../types/team';

function getAuthHeaders(): Record<string, string> {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<{ success: boolean; data?: T; error?: string; [key: string]: any }> {
  const data = await res.json();
  return data;
}

export const teamService = {
  // ─── Teams ────────────────────────────────────────────────────────────────

  async listTeams(): Promise<{ success: boolean; data?: TeamSummary[]; error?: string }> {
    try {
      const res = await fetch(apiUrl('/teams'), { headers: getAuthHeaders() });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch teams' };
    }
  },

  async createTeam(data: {
    name: string;
    description?: string;
    color?: string;
    memberIds?: number[];
    members?: { userId: number; role?: TeamMemberRole }[];
    identifier?: string;
    icon?: string;
  }): Promise<{ success: boolean; data?: TeamSummary; error?: string }> {
    try {
      const res = await fetch(apiUrl('/teams'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create team' };
    }
  },

  async getTeam(teamId: number): Promise<{ success: boolean; data?: Team; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/teams/${teamId}`), { headers: getAuthHeaders() });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch team' };
    }
  },

  async updateTeam(teamId: number, data: { name?: string; description?: string; color?: string }): Promise<{ success: boolean; data?: Team; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/teams/${teamId}`), {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update team' };
    }
  },

  async deleteTeam(teamId: number): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/teams/${teamId}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete team' };
    }
  },

  // ─── Members ──────────────────────────────────────────────────────────────

  async changeMemberRole(teamId: number, memberId: number, role: TeamMemberRole): Promise<{ success: boolean; data?: TeamMember; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/teams/${teamId}/members/${memberId}/role`), {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ role }),
      });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to change role' };
    }
  },

  async removeMember(teamId: number, memberId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/teams/${teamId}/members/${memberId}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to remove member' };
    }
  },

  // ─── Invitations ──────────────────────────────────────────────────────────

  async sendInvitation(teamId: number, data: { email: string; role: TeamMemberRole; message?: string }): Promise<{ success: boolean; data?: TeamInvitation; inviteLink?: string; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/teams/${teamId}/invite`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to send invitation' };
    }
  },

  async resendInvitation(teamId: number, invId: number): Promise<{ success: boolean; data?: TeamInvitation; inviteLink?: string; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/teams/${teamId}/invitations/${invId}/resend`), {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to resend invitation' };
    }
  },

  async cancelInvitation(teamId: number, invId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/teams/${teamId}/invitations/${invId}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to cancel invitation' };
    }
  },

  // ─── Public Invitation Flow ────────────────────────────────────────────────

  async getInvitationByToken(token: string): Promise<{ success: boolean; data?: InvitationPreview; error?: string; status?: string }> {
    try {
      const res = await fetch(apiUrl(`/teams/invitations/${token}`));
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch invitation' };
    }
  },

  async acceptInvitation(token: string): Promise<{ success: boolean; teamId?: number; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/teams/invitations/${token}/accept`), {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to accept invitation' };
    }
  },

  async declineInvitation(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/teams/invitations/${token}/decline`), {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to decline invitation' };
    }
  },
};

