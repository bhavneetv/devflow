import { apiUrl } from '../config/api';
import { authService } from './auth.service';
import type {
  GitProviderConnectionItem,
  GitRepositoryConnectionItem,
  GitNormalizedIssue,
  GitNormalizedMR,
  GitDiffFile,
  GitOverviewStats,
  GitActivityEvent,
  GitRecordLinkItem,
  GitTreeItem,
  GitFileContent,
  GitCommitDetail,
  GitCommitSummary,
} from '../types/git';

function getAuthHeaders(): Record<string, string> {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const gitService = {
  // ─── Provider Connections ──────────────────────────────────────────────────

  async getConnections(projectId: number): Promise<{ success: boolean; data?: GitProviderConnectionItem[]; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/connections`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch git connections' };
    }
  },

  async addConnection(
    projectId: number,
    data: { provider: 'github' | 'gitlab'; token: string; authType?: 'pat' | 'oauth' }
  ): Promise<{ success: boolean; data?: GitProviderConnectionItem; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/connections`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to connect provider account' };
    }
  },

  async removeConnection(projectId: number, connectionId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/connections/${connectionId}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to remove provider connection' };
    }
  },

  async getProviderRepos(
    projectId: number,
    connectionId: number
  ): Promise<{ success: boolean; data?: Array<{ id: string; name: string; fullName: string; isPrivate: boolean; webUrl: string; defaultBranch: string }>; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/provider-repos/${connectionId}`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch provider repositories' };
    }
  },

  // ─── Repositories ──────────────────────────────────────────────────────────

  async getRepositories(projectId: number): Promise<{ success: boolean; data?: GitRepositoryConnectionItem[]; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/repositories`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch repositories' };
    }
  },

  async connectRepository(
    projectId: number,
    data: {
      connectionId: number;
      providerRepoId: string;
      name: string;
      fullName: string;
      owner: string;
      defaultBranch: string;
      isPrivate: boolean;
      webUrl: string;
      cloneUrl?: string;
    }
  ): Promise<{ success: boolean; data?: GitRepositoryConnectionItem; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/repositories`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to connect repository' };
    }
  },

  async disconnectRepository(projectId: number, repoId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/repositories/${repoId}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to disconnect repository' };
    }
  },

  async syncRepository(
    projectId: number,
    repoId: number
  ): Promise<{
    success: boolean;
    data?: GitRepositoryConnectionItem & {
      syncStats?: { branchesCount: number; commitsCount: number; issuesCount: number; mrsCount: number };
    };
    error?: string;
  }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/repositories/${repoId}/sync`), {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to sync repository' };
    }
  },

  async getBranches(
    projectId: number,
    repoId: number
  ): Promise<{ success: boolean; data?: Array<{ name: string; isDefault: boolean; commitSha: string }>; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/repositories/${repoId}/branches`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch repository branches' };
    }
  },

  async getCommits(
    projectId: number,
    repoId: number,
    branch?: string
  ): Promise<{ success: boolean; data?: GitCommitSummary[]; error?: string }> {
    try {
      const query = branch ? `?branch=${encodeURIComponent(branch)}` : '';
      const res = await fetch(apiUrl(`/projects/${projectId}/git/repositories/${repoId}/commits${query}`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch repository commits' };
    }
  },

  async getCommit(
    projectId: number,
    repoId: number,
    sha: string
  ): Promise<{ success: boolean; data?: GitCommitDetail; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/repositories/${repoId}/commits/${sha}`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch commit detail' };
    }
  },

  async getTree(
    projectId: number,
    repoId: number,
    path = '',
    ref?: string
  ): Promise<{ success: boolean; data?: GitTreeItem[]; error?: string }> {
    try {
      const query = new URLSearchParams();
      if (path) query.set('path', path);
      if (ref) query.set('ref', ref);
      const res = await fetch(
        apiUrl(`/projects/${projectId}/git/repositories/${repoId}/tree${query.toString() ? `?${query.toString()}` : ''}`),
        { headers: getAuthHeaders() }
      );
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch repository tree' };
    }
  },

  async getFileContent(
    projectId: number,
    repoId: number,
    path: string,
    ref?: string
  ): Promise<{ success: boolean; data?: GitFileContent; error?: string }> {
    try {
      const query = new URLSearchParams({ path });
      if (ref) query.set('ref', ref);
      const res = await fetch(
        apiUrl(`/projects/${projectId}/git/repositories/${repoId}/blob?${query.toString()}`),
        { headers: getAuthHeaders() }
      );
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch file content' };
    }
  },

  // ─── Overview & Activity ───────────────────────────────────────────────────

  async getOverview(projectId: number): Promise<{
    success: boolean;
    data?: {
      stats: GitOverviewStats;
      activity: GitActivityEvent[];
      recentIssues: GitNormalizedIssue[];
      recentMergeRequests: GitNormalizedMR[];
    };
    error?: string;
  }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/overview`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch git overview' };
    }
  },

  // ─── Issues ────────────────────────────────────────────────────────────────

  async getIssues(
    projectId: number,
    params?: {
      state?: string;
      search?: string;
      repoId?: number | string;
      assignee?: string;
      labels?: string[];
      sort?: string;
      page?: number;
    }
  ): Promise<{ success: boolean; data?: GitNormalizedIssue[]; error?: string }> {
    try {
      const query = new URLSearchParams();
      if (params?.state) query.set('state', params.state);
      if (params?.search) query.set('search', params.search);
      if (params?.repoId && params.repoId !== 'all') query.set('repoId', params.repoId.toString());
      if (params?.assignee) query.set('assignee', params.assignee);
      if (params?.labels?.length) query.set('labels', params.labels.join(','));
      if (params?.sort) query.set('sort', params.sort);
      if (params?.page) query.set('page', params.page.toString());

      const res = await fetch(apiUrl(`/projects/${projectId}/git/issues?${query.toString()}`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch git issues' };
    }
  },

  async getIssue(
    projectId: number,
    repoId: number,
    issueNumber: number
  ): Promise<{ success: boolean; data?: GitNormalizedIssue; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/issues/${repoId}/${issueNumber}`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch issue details' };
    }
  },

  async createIssue(
    projectId: number,
    repoId: number,
    data: { title: string; body: string; assignees?: string[]; labels?: string[] }
  ): Promise<{ success: boolean; data?: GitNormalizedIssue; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/issues/${repoId}`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create git issue' };
    }
  },

  async updateIssue(
    projectId: number,
    repoId: number,
    issueNumber: number,
    data: { title?: string; body?: string; state?: 'open' | 'closed'; assignees?: string[]; labels?: string[] }
  ): Promise<{ success: boolean; data?: GitNormalizedIssue; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/issues/${repoId}/${issueNumber}`), {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update git issue' };
    }
  },

  // ─── Merge Requests ────────────────────────────────────────────────────────

  async getMergeRequests(
    projectId: number,
    params?: {
      state?: string;
      search?: string;
      repoId?: number | string;
      hasConflicts?: boolean;
      awaitingReview?: boolean;
      approved?: boolean;
    }
  ): Promise<{ success: boolean; data?: GitNormalizedMR[]; error?: string }> {
    try {
      const query = new URLSearchParams();
      if (params?.state) query.set('state', params.state);
      if (params?.search) query.set('search', params.search);
      if (params?.repoId && params.repoId !== 'all') query.set('repoId', params.repoId.toString());
      if (params?.hasConflicts !== undefined) query.set('hasConflicts', String(params.hasConflicts));
      if (params?.awaitingReview !== undefined) query.set('awaitingReview', String(params.awaitingReview));
      if (params?.approved !== undefined) query.set('approved', String(params.approved));

      const res = await fetch(apiUrl(`/projects/${projectId}/git/merge-requests?${query.toString()}`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch merge requests' };
    }
  },

  async getMergeRequest(
    projectId: number,
    repoId: number,
    mrNumber: number
  ): Promise<{ success: boolean; data?: GitNormalizedMR; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/merge-requests/${repoId}/${mrNumber}`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch merge request details' };
    }
  },

  async getMergeRequestDiff(
    projectId: number,
    repoId: number,
    mrNumber: number
  ): Promise<{ success: boolean; data?: GitDiffFile[]; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/merge-requests/${repoId}/${mrNumber}/diff`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch merge request diff' };
    }
  },

  async createMergeRequest(
    projectId: number,
    repoId: number,
    data: { title: string; body: string; sourceBranch: string; targetBranch: string; draft?: boolean }
  ): Promise<{ success: boolean; data?: GitNormalizedMR; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/merge-requests/${repoId}`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create merge request' };
    }
  },

  async mergeMergeRequest(
    projectId: number,
    repoId: number,
    mrNumber: number,
    options: { commitTitle?: string; commitMessage?: string; mergeMethod?: 'merge' | 'squash' | 'rebase' }
  ): Promise<{ success: boolean; sha?: string; message?: string; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/merge-requests/${repoId}/${mrNumber}/merge`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(options),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to execute merge request' };
    }
  },

  // ─── Record Linking ────────────────────────────────────────────────────────

  async getRecordLinks(
    projectId: number,
    recordId: string
  ): Promise<{ success: boolean; data?: GitRecordLinkItem[]; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/links?recordId=${encodeURIComponent(recordId)}`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch record links' };
    }
  },

  async createRecordLink(
    projectId: number,
    data: {
      repositoryId?: number;
      provider: 'github' | 'gitlab';
      recordType: 'issue' | 'merge_request' | 'commit' | 'branch';
      recordNumber?: number;
      recordId: string;
      recordTitle?: string;
      recordUrl?: string;
      targetType: 'task' | 'requirement' | 'defect';
      targetId: number;
    }
  ): Promise<{ success: boolean; data?: GitRecordLinkItem; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/links`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to link record' };
    }
  },

  async deleteRecordLink(projectId: number, linkId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/links/${linkId}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete record link' };
    }
  },

  // ─── Environment Config & OAuth ──────────────────────────────────────────

  async getEnvConfig(projectId: number): Promise<{
    success: boolean;
    data?: {
      hasEnvToken: boolean;
      envTokenMasked: string | null;
      hasOAuth: boolean;
      clientId: string | null;
      callbackUrl: string;
    };
    error?: string;
  }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/env-config`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch environment config' };
    }
  },

  async connectEnvToken(projectId: number): Promise<{ success: boolean; data?: GitProviderConnectionItem; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/auth/github/connect-env-token`), {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to connect using GITHUB_TOKEN from .env' };
    }
  },

  async oauthExchange(projectId: number, code: string): Promise<{ success: boolean; data?: GitProviderConnectionItem; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/git/auth/github/oauth-exchange`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ code }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to complete OAuth authentication' };
    }
  },
};

