import { apiUrl } from '../config/api';
import { authService } from './auth.service';
import type {
  ProjectDocument,
  DocumentCategory,
  DocumentShare,
  DocumentModuleSettings,
  ProjectStorageConnection,
  ProjectStorageOverview,
  AccessibleStorageRepo,
  DocumentDashboardData,
  DocumentListParams,
  DocumentListResponse,
  PublicShareInfo,
} from '../types/document';

function getAuthHeaders(): Record<string, string> {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const documentService = {
  // ─── Dashboard ────────────────────────────────────────────────────────────

  async getDashboard(
    projectId: number,
    submoduleId?: number
  ): Promise<{ success: boolean; data?: DocumentDashboardData; error?: string }> {
    try {
      const qs = submoduleId ? `?submoduleId=${submoduleId}` : '';
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/dashboard${qs}`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch dashboard data' };
    }
  },

  // ─── Documents CRUD ───────────────────────────────────────────────────────

  async listDocuments(
    projectId: number,
    params: DocumentListParams = {}
  ): Promise<{ success: boolean; data?: DocumentListResponse; error?: string }> {
    try {
      const query = new URLSearchParams();
      if (params.tab) query.set('tab', params.tab);
      if (params.submoduleId !== undefined) query.set('submoduleId', String(params.submoduleId));
      if (params.categoryId !== undefined) query.set('categoryId', String(params.categoryId));
      if (params.authorId !== undefined) query.set('authorId', String(params.authorId));
      if (params.type) query.set('type', params.type);
      else if (params.fileType) query.set('fileType', params.fileType);
      if (params.search) query.set('search', params.search);
      if (params.sortBy) query.set('sortBy', params.sortBy);
      if (params.sortOrder) query.set('sortOrder', params.sortOrder);
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));

      const res = await fetch(apiUrl(`/projects/${projectId}/documents?${query.toString()}`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch documents' };
    }
  },

  async getDocument(
    projectId: number,
    documentId: number
  ): Promise<{ success: boolean; data?: ProjectDocument; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/${documentId}`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch document details' };
    }
  },

  async uploadDocuments(
    projectId: number,
    files: Array<{
      name: string;
      contentBase64: string;
      base64?: string;
      mimeType: string;
      size: number;
      sizeBytes?: number;
      categoryId?: number | null;
      tags?: string[];
      description?: string;
    }>,
    duplicatePolicy?: 'rename' | 'replace' | 'reject',
    submoduleId?: number
  ): Promise<{
    success: boolean;
    data?: {
      uploaded: ProjectDocument[];
      errors: Array<{ fileName: string; reason: string; error?: string }>;
    };
    error?: string;
  }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/upload`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ files, duplicatePolicy, submoduleId }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Upload request failed' };
    }
  },

  async updateDocument(
    projectId: number,
    documentId: number,
    data: {
      name?: string;
      description?: string | null;
      categoryId?: number | null;
      tags?: string[];
    }
  ): Promise<{ success: boolean; data?: ProjectDocument; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/${documentId}`), {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update document' };
    }
  },

  async deleteDocument(
    projectId: number,
    documentId: number,
    deleteFromGitHub = true
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(
        apiUrl(`/projects/${projectId}/documents/${documentId}?deleteFromGitHub=${deleteFromGitHub}`),
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        }
      );
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete document' };
    }
  },

  async bulkDelete(
    projectId: number,
    documentIds: number[],
    deleteFromGitHub = true
  ): Promise<{ success: boolean; deletedCount: number; errors: string[] }> {
    let deletedCount = 0;
    const errors: string[] = [];

    for (const docId of documentIds) {
      try {
        const res = await this.deleteDocument(projectId, docId, deleteFromGitHub);
        if (res.success) {
          deletedCount++;
        } else {
          errors.push(res.error || `Failed to delete doc #${docId}`);
        }
      } catch (e: any) {
        errors.push(e.message || `Failed to delete doc #${docId}`);
      }
    }

    return { success: errors.length === 0, deletedCount, errors };
  },

  async bulkMoveCategory(
    projectId: number,
    documentIds: number[],
    categoryId: number | null
  ): Promise<{ success: boolean; movedCount: number }> {
    let movedCount = 0;
    for (const docId of documentIds) {
      try {
        const res = await this.updateDocument(projectId, docId, { categoryId });
        if (res.success) movedCount++;
      } catch {
        // continue
      }
    }
    return { success: movedCount > 0, movedCount };
  },

  // ─── File Content & Blob Downloading ──────────────────────────────────────

  getContentUrl(projectId: number, documentId: number, download = false): string {
    const token = authService.getToken();
    const query = new URLSearchParams();
    if (download) query.set('download', 'true');
    if (token) query.set('token', token);
    return apiUrl(`/projects/${projectId}/documents/${documentId}/content?${query.toString()}`);
  },

  async downloadDocument(projectId: number, doc: ProjectDocument): Promise<void> {
    try {
      const token = authService.getToken();
      const res = await fetch(
        apiUrl(`/projects/${projectId}/documents/${doc.id}/content?download=true`),
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (!res.ok) {
        throw new Error(`Download failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Download error:', err);
      // Fallback direct link
      window.open(this.getContentUrl(projectId, doc.id, true), '_blank');
    }
  },

  // ─── Sharing ──────────────────────────────────────────────────────────────

  async createShare(
    projectId: number,
    documentId: number,
    data: {
      shareType: 'internal' | 'public';
      permission?: 'view' | 'download';
      sharedWithUserId?: number | null;
      sharedWithTeamId?: number | null;
      password?: string | null;
      expiresAt?: string | null;
      maxDownloads?: number | null;
      message?: string | null;
      allowApproval?: boolean;
    }
  ): Promise<{ success: boolean; data?: DocumentShare; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/${documentId}/share`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create share link' };
    }
  },

  async listApprovals(
    projectId: number,
    status: 'all' | 'approved' | 'declined' | 'pending' = 'all',
    search?: string,
    submoduleId?: number
  ): Promise<{
    success: boolean;
    data?: {
      approvals: import('../types/document').DocumentApprovalEntry[];
      counts: { total: number; approved: number; declined: number; pending: number };
      unlinked?: boolean;
    };
    error?: string;
  }> {
    try {
      const query = new URLSearchParams();
      if (status) query.set('status', status);
      if (search && search.trim()) query.set('search', search.trim());
      if (submoduleId) query.set('submoduleId', String(submoduleId));
      const res = await fetch(
        apiUrl(`/projects/${projectId}/documents/approvals?${query.toString()}`),
        { headers: getAuthHeaders() }
      );
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to load approval files' };
    }
  },

  async revokeShare(
    projectId: number,
    documentId: number,
    shareId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(
        apiUrl(`/projects/${projectId}/documents/${documentId}/share/${shareId}`),
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        }
      );
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to revoke share' };
    }
  },

  // ─── Categories ───────────────────────────────────────────────────────────

  async listCategories(
    projectId: number,
    submoduleId?: number
  ): Promise<{ success: boolean; data?: DocumentCategory[]; error?: string }> {
    try {
      const qs = submoduleId ? `?submoduleId=${submoduleId}` : '';
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/categories${qs}`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch categories' };
    }
  },

  async createCategory(
    projectId: number,
    data: {
      name: string;
      description?: string;
      icon?: string;
      color?: string;
      submoduleId?: number;
    }
  ): Promise<{ success: boolean; data?: DocumentCategory; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/categories`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create category' };
    }
  },

  // ─── Storage Connection & Health ──────────────────────────────────────────

  async getStorageStatus(
    projectId: number
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/storage`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch storage status' };
    }
  },

  async getStorageOverview(
    projectId: number
  ): Promise<{ success: boolean; data?: ProjectStorageOverview; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/storage`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to load storage overview' };
    }
  },

  async listStorageRepos(
    projectId: number
  ): Promise<{ success: boolean; data?: { repos: AccessibleStorageRepo[] }; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/storage/repos`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to list GitHub repositories' };
    }
  },

  async unlinkStorage(
    projectId: number
  ): Promise<{ success: boolean; data?: { storageConnection: any }; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/storage/unlink`), {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to unlink repository' };
    }
  },

  async relinkStorage(
    projectId: number,
    target?: { owner?: string; repositoryName?: string; branch?: string }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/storage/relink`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(target || {}),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to relink repository' };
    }
  },

  async updateScopeConfig(
    projectId: number,
    payload: {
      submoduleId: number;
      storageMode: 'folder' | 'branch';
      folderPath?: string;
      branchName?: string;
    }
  ): Promise<{
    success: boolean;
    data?: { submodule: any; config: any; branchWarning?: string | null };
    error?: string;
  }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/scope-config`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to save submodule storage config' };
    }
  },

  async setupStorage(
    projectId: number,
    customRepoName?: string
  ): Promise<{ success: boolean; data?: ProjectStorageConnection; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/storage/setup`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ customRepoName }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to setup storage repository' };
    }
  },

  // ─── Settings ─────────────────────────────────────────────────────────────

  async getSettings(
    projectId: number
  ): Promise<{ success: boolean; data?: DocumentModuleSettings; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/settings`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch settings' };
    }
  },

  async updateSettings(
    projectId: number,
    settings: Partial<DocumentModuleSettings>
  ): Promise<{ success: boolean; data?: DocumentModuleSettings; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/settings`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(settings),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update settings' };
    }
  },

  // ─── Public Share Operations ──────────────────────────────────────────────

  async getPublicShareInfo(
    token: string
  ): Promise<{ success: boolean; data?: PublicShareInfo; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/documents/public-share/${token}`));
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch shared document information' };
    }
  },

  async verifyPublicSharePassword(
    token: string,
    password: string
  ): Promise<{ success: boolean; data?: PublicShareInfo; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/documents/public-share/${token}/verify`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Password verification failed' };
    }
  },

  async respondToPublicShare(
    token: string,
    payload: {
      decision: 'approved' | 'declined';
      actorName: string;
      note?: string;
      password?: string;
    }
  ): Promise<{ success: boolean; data?: PublicShareInfo; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/documents/public-share/${token}/respond`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to submit document response' };
    }
  },

  getPublicContentUrl(token: string, download = false, password?: string): string {
    const query = new URLSearchParams();
    if (download) query.set('download', 'true');
    if (password) query.set('password', password);
    return apiUrl(`/documents/public-share/${token}/content?${query.toString()}`);
  },
};

