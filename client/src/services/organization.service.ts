import { apiUrl } from '../config/api';
import { authService } from './auth.service';
import type {
  Organization,
  OrganizationMember,
  OrganizationInvitation,
  OrganizationActivity,
  OrganizationOverviewData,
  OrganizationRole,
  CreateOrganizationInput,
  UpdateOrganizationInput,
} from '../types/organization';

function getAuthHeaders(): Record<string, string> {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<{ success: boolean; data?: T; error?: string; [key: string]: any }> {
  try {
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to parse response' };
  }
}

export const organizationService = {
  // ─── Organizations ────────────────────────────────────────────────────────

  async listOrganizations(): Promise<{ success: boolean; data?: Organization[]; error?: string }> {
    try {
      const res = await fetch(apiUrl('/organizations'), { headers: getAuthHeaders() });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch organizations' };
    }
  },

  async getOrganization(slugOrId: string | number): Promise<{ success: boolean; data?: Organization; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/organizations/${slugOrId}`), { headers: getAuthHeaders() });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch organization' };
    }
  },

  async getOverview(slugOrId: string | number): Promise<{ success: boolean; data?: OrganizationOverviewData; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/organizations/${slugOrId}/overview`), { headers: getAuthHeaders() });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch overview' };
    }
  },

  async createOrganization(input: CreateOrganizationInput): Promise<{ success: boolean; data?: Organization; error?: string }> {
    try {
      const res = await fetch(apiUrl('/organizations'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create organization' };
    }
  },

  async updateOrganization(slugOrId: string | number, input: UpdateOrganizationInput): Promise<{ success: boolean; data?: Organization; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/organizations/${slugOrId}`), {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update organization' };
    }
  },

  async deleteOrganization(slugOrId: string | number): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/organizations/${slugOrId}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete organization' };
    }
  },

  async transferOwnership(slugOrId: string | number, targetUserId: number): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/organizations/${slugOrId}/transfer-ownership`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ targetUserId }),
      });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to transfer ownership' };
    }
  },

  async checkSlugAvailability(slug: string): Promise<{ success: boolean; available?: boolean; error?: string }> {
    try {
      const cleanSlug = encodeURIComponent(slug.trim().toLowerCase());
      const res = await fetch(apiUrl(`/organizations/check-slug/${cleanSlug}`));
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to check slug' };
    }
  },

  // ─── Members ──────────────────────────────────────────────────────────────

  async listMembers(slugOrId: string | number): Promise<{ success: boolean; data?: OrganizationMember[]; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/organizations/${slugOrId}/members`), { headers: getAuthHeaders() });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch members' };
    }
  },

  async changeMemberRole(slugOrId: string | number, memberId: number, role: OrganizationRole): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/organizations/${slugOrId}/members/${memberId}/role`), {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ role }),
      });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to change role' };
    }
  },

  async removeMember(slugOrId: string | number, memberId: number): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/organizations/${slugOrId}/members/${memberId}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to remove member' };
    }
  },

  // ─── Invitations ──────────────────────────────────────────────────────────

  async listInvitations(slugOrId: string | number): Promise<{ success: boolean; data?: OrganizationInvitation[]; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/organizations/${slugOrId}/invitations`), { headers: getAuthHeaders() });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch invitations' };
    }
  },

  async sendInvitation(slugOrId: string | number, email: string, role: OrganizationRole = 'MEMBER'): Promise<{ success: boolean; data?: OrganizationInvitation; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/organizations/${slugOrId}/invitations`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ email, role }),
      });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to send invitation' };
    }
  },

  async cancelInvitation(slugOrId: string | number, invitationId: number): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/organizations/${slugOrId}/invitations/${invitationId}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to cancel invitation' };
    }
  },

  async joinOrganization(token: string): Promise<{ success: boolean; data?: { organization: Organization; role: OrganizationRole }; message?: string; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/organizations/join/${token}`), {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to join organization' };
    }
  },

  // ─── Scoped Teams, Projects & Activity ────────────────────────────────────

  async listTeams(slugOrId: string | number): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/organizations/${slugOrId}/teams`), { headers: getAuthHeaders() });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch teams' };
    }
  },

  async listProjects(slugOrId: string | number): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/organizations/${slugOrId}/projects`), { headers: getAuthHeaders() });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch projects' };
    }
  },

  async listActivity(slugOrId: string | number, filter: string = 'all'): Promise<{ success: boolean; data?: OrganizationActivity[]; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/organizations/${slugOrId}/activity?filter=${encodeURIComponent(filter)}`), { headers: getAuthHeaders() });
      return handleResponse(res);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch activity' };
    }
  },
};
