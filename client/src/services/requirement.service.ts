import { apiUrl } from '../config/api';

export type RequirementWorkflowStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'DEPRECATED'
  | 'ARCHIVED';

export type RequirementImplementationStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'IMPLEMENTED'
  | 'VERIFIED';

export type RequirementType =
  | 'FUNCTIONAL'
  | 'NON_FUNCTIONAL'
  | 'BUSINESS'
  | 'TECHNICAL'
  | 'SECURITY'
  | 'PERFORMANCE'
  | 'USABILITY'
  | 'COMPLIANCE'
  | 'INTERFACE';

export type RequirementPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface RequirementCategory {
  id: number;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  defaultType?: RequirementType;
  isActive: boolean;
}

export interface RequirementSummary {
  id: number;
  code: string;
  projectId: number;
  title: string;
  summary?: string | null;
  type: RequirementType;
  priority: RequirementPriority;
  workflowStatus: RequirementWorkflowStatus;
  implementationStatus: RequirementImplementationStatus;
  currentVersion: number;
  targetDate?: string | null;
  submittedAt?: string | null;
  submittedBy?: {
    id: number;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  project?: {
    id: number;
    title: string;
    status: string;
  };
  category?: {
    id: number;
    name: string;
    color?: string | null;
    icon?: string | null;
  } | null;
  author: {
    id: number;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
  reviewer?: {
    id: number;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
  assignee?: {
    id: number;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
  links?: Array<{
    id: number;
    targetId: number;
    isPrimary: boolean;
  }>;
  _count?: {
    acceptanceCriteria: number;
    versions: number;
    comments: number;
    links: number;
  };
}

export interface RequirementStats {
  total: number;
  approved: number;
  pendingReview: number;
  rejected: number;
  draft: number;
  inProgress: number;
  completed: number;
  blocked: number;
}

export interface RequirementWidgets {
  noLinkedTasks: Array<{ id: number; code: string; title: string }>;
  approachingTargetDates: Array<{
    id: number;
    code: string;
    title: string;
    targetDate: string;
  }>;
}

export interface RequirementFilters {
  projectId?: number | string;
  organizationId?: number | string;
  organizationSlug?: string;
  search?: string;
  type?: string;
  categoryId?: number | string;
  priority?: string;
  workflowStatus?: string;
  implementationStatus?: string;
  authorId?: number | string;
  ownerId?: number | string;
  subFilter?:
    | 'all'
    | 'functional'
    | 'non_functional'
    | 'pending_approval'
    | 'approved'
    | 'traceability';
}

export interface RequirementListResponse {
  items: RequirementSummary[];
  stats: RequirementStats;
  widgets: RequirementWidgets;
  categories: RequirementCategory[];
  projects: Array<{ id: number; title: string }>;
}

export const requirementService = {
  async getRequirements(filters: RequirementFilters = {}): Promise<{
    success: boolean;
    data?: RequirementListResponse;
    error?: string;
  }> {
    try {
      const params = new URLSearchParams();
      if (filters.projectId) params.append('projectId', String(filters.projectId));
      if (filters.organizationId) params.append('organizationId', String(filters.organizationId));
      if (filters.organizationSlug) params.append('organizationSlug', filters.organizationSlug);
      if (filters.search) params.append('search', filters.search);
      if (filters.type) params.append('type', filters.type);
      if (filters.categoryId) params.append('categoryId', String(filters.categoryId));
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.workflowStatus) params.append('workflowStatus', filters.workflowStatus);
      if (filters.implementationStatus) params.append('implementationStatus', filters.implementationStatus);
      if (filters.authorId) params.append('authorId', String(filters.authorId));
      if (filters.ownerId) params.append('ownerId', String(filters.ownerId));
      if (filters.subFilter && filters.subFilter !== 'all') params.append('subFilter', filters.subFilter);

      const res = await fetch(apiUrl(`/requirements?${params.toString()}`));
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch requirements' };
    }
  },

  async exportRequirementsCsv(filters: { projectId?: number | string; organizationId?: number | string } = {}): Promise<void> {
    const params = new URLSearchParams();
    if (filters.projectId) params.append('projectId', String(filters.projectId));
    if (filters.organizationId) params.append('organizationId', String(filters.organizationId));

    const token = localStorage.getItem('devflow_auth_token');
    const res = await fetch(apiUrl(`/requirements/export?${params.toString()}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to export requirements');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `requirements-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  async getRequirementById(id: number | string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const res = await fetch(apiUrl(`/requirements/${id}`));
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to load requirement' };
    }
  },

  async getNextCode(projectId: number | string): Promise<{
    success: boolean;
    data?: { nextCode: string; nextNumber: number };
    error?: string;
  }> {
    try {
      const res = await fetch(apiUrl(`/requirements/next-code?projectId=${projectId}`));
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to get next code' };
    }
  },

  async getMetadata(projectId?: number | string): Promise<{
    success: boolean;
    data?: {
      project?: any;
      categories: RequirementCategory[];
      members: Array<{ id: number; name: string; email: string; avatarUrl?: string; orgRole?: string }>;
      teams: Array<{ id: number; name: string; color: string }>;
    };
    error?: string;
  }> {
    try {
      const url = projectId ? apiUrl(`/requirements/metadata?projectId=${projectId}`) : apiUrl('/requirements/metadata');
      const res = await fetch(url);
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to load metadata' };
    }
  },

  async createRequirement(payload: any): Promise<{
    success: boolean;
    data?: any;
    error?: string;
    message?: string;
  }> {
    try {
      const res = await fetch(apiUrl('/requirements'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create requirement' };
    }
  },

  async updateRequirement(
    id: number | string,
    payload: any
  ): Promise<{
    success: boolean;
    data?: any;
    newVersion?: any;
    error?: string;
    message?: string;
    code?: string;
    status?: number;
    serverVersion?: number;
    clientVersion?: number;
  }> {
    try {
      const res = await fetch(apiUrl(`/requirements/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      json.status = res.status;
      return json;
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update requirement' };
    }
  },

  async addCriterion(
    requirementId: number | string,
    payload: { description: string; verificationMethod?: string; code?: string }
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const res = await fetch(apiUrl(`/requirements/${requirementId}/criteria`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to add criterion' };
    }
  },

  async deleteCriterion(
    requirementId: number | string,
    criterionId: number | string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const res = await fetch(apiUrl(`/requirements/${requirementId}/criteria/${criterionId}`), {
        method: 'DELETE',
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete criterion' };
    }
  },

  async toggleCriterion(
    requirementId: number | string,
    criterionId: number | string
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const res = await fetch(
        apiUrl(`/requirements/${requirementId}/criteria/${criterionId}/toggle`),
        {
          method: 'PATCH',
        }
      );
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to toggle criterion' };
    }
  },

  async linkTask(
    requirementId: number | string,
    payload: { taskId: number | string; isPrimary?: boolean }
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const res = await fetch(apiUrl(`/requirements/${requirementId}/links`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to link task' };
    }
  },

  async addComment(
    requirementId: number | string,
    payload: { body: string; parentId?: number | null; versionId?: number | null; authorId?: number }
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const res = await fetch(apiUrl(`/requirements/${requirementId}/comments`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to add comment' };
    }
  },

  async resolveComment(
    requirementId: number | string,
    commentId: number | string
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const res = await fetch(
        apiUrl(`/requirements/${requirementId}/comments/${commentId}/resolve`),
        {
          method: 'PATCH',
        }
      );
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to resolve comment' };
    }
  },

  async submitForReview(id: number | string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
    message?: string;
  }> {
    try {
      const res = await fetch(apiUrl(`/requirements/${id}/submit`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to submit requirement for review' };
    }
  },

  async submitReview(
    id: number | string,
    payload: {
      decision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED';
      checklist?: Record<string, boolean>;
      comment?: string;
      reviewerId?: number;
    }
  ): Promise<{
    success: boolean;
    data?: any;
    review?: any;
    error?: string;
    message?: string;
  }> {
    try {
      const res = await fetch(apiUrl(`/requirements/${id}/review`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to submit review decision' };
    }
  },

  // Categories CRUD
  async createCategory(payload: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    defaultType?: RequirementType;
    scope?: 'ORG' | 'PROJECT';
    organizationId?: number;
    projectId?: number;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(apiUrl('/requirements/categories'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create category' };
    }
  },

  async updateCategory(
    id: number | string,
    payload: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/requirements/categories/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update category' };
    }
  },

  async deleteCategory(
    id: number | string,
    reassignToCategoryId?: number | string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/requirements/categories/${id}`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reassignToCategoryId }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete category' };
    }
  },

  // Templates
  async getTemplates(params?: { organizationId?: number; projectId?: number }): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
  }> {
    try {
      const q = new URLSearchParams();
      if (params?.organizationId) q.append('organizationId', String(params.organizationId));
      if (params?.projectId) q.append('projectId', String(params.projectId));
      const res = await fetch(apiUrl(`/requirements/templates?${q.toString()}`));
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to load templates' };
    }
  },

  async createTemplate(payload: {
    name: string;
    description?: string;
    structure: any;
    scope?: 'ORG' | 'PROJECT';
    organizationId?: number;
    projectId?: number;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(apiUrl('/requirements/templates'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create template' };
    }
  },

  // Dependencies with cycle prevention
  async getDependencies(id: number | string): Promise<{
    success: boolean;
    data?: { outgoing: any[]; incoming: any[] };
    error?: string;
  }> {
    try {
      const res = await fetch(apiUrl(`/requirements/${id}/dependencies`));
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to load dependencies' };
    }
  },

  async addDependency(
    id: number | string,
    payload: { targetRequirementId: number | string; type: string }
  ): Promise<{ success: boolean; data?: any; error?: string; message?: string }> {
    try {
      const res = await fetch(apiUrl(`/requirements/${id}/dependencies`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to add dependency' };
    }
  },

  async deleteDependency(
    requirementId: number | string,
    dependencyId: number | string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(
        apiUrl(`/requirements/${requirementId}/dependencies/${dependencyId}`),
        {
          method: 'DELETE',
        }
      );
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete dependency' };
    }
  },

  // Traceability & Reports
  async getTraceability(params?: { projectId?: number | string; organizationId?: number | string }): Promise<{
    success: boolean;
    data?: {
      matrix: any[];
      coverage: {
        total: number;
        withCriteriaCount: number;
        withCriteriaPercent: number;
        withTasksCount: number;
        withTasksPercent: number;
        withTestsCount: number;
        withTestsPercent: number;
        fullyVerifiedCount: number;
        fullyVerifiedPercent: number;
        withWarningsCount: number;
      };
      tree: any[];
    };
    error?: string;
  }> {
    try {
      const q = new URLSearchParams();
      if (params?.projectId) q.append('projectId', String(params.projectId));
      if (params?.organizationId) q.append('organizationId', String(params.organizationId));
      const res = await fetch(apiUrl(`/requirements/traceability?${q.toString()}`));
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to load traceability data' };
    }
  },

  exportTraceabilityCsv(params?: { projectId?: number | string; organizationId?: number | string }) {
    const q = new URLSearchParams();
    if (params?.projectId) q.append('projectId', String(params.projectId));
    if (params?.organizationId) q.append('organizationId', String(params.organizationId));
    window.open(apiUrl(`/requirements/traceability/export?${q.toString()}`), '_blank');
  },
};





