import { apiUrl } from '../config/api';
import { authService } from './auth.service';
import type {
  CreateDevelopmentTaskPayload,
  DevelopmentDashboardData,
  DevelopmentModuleMaster,
  DevelopmentProjectConfig,
  DevelopmentSubmoduleMaster,
  DevelopmentTaskActivity,
  DevelopmentTaskAttachment,
  DevelopmentTaskComment,
  DevelopmentTaskItem,
  DevelopmentTaskListParams,
  DevelopmentTaskListResponse,
  UpdateDevelopmentTaskPayload,
} from '../types/development';

function getAuthHeaders(): Record<string, string> {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function requestJson<T>(
  path: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(apiUrl(path), {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...(options?.headers || {}),
      },
    });
    const text = await res.text().catch(() => '');
    if (!text) {
      return {
        success: res.ok,
        error: res.ok ? undefined : `Server returned status ${res.status}`,
      };
    }
    try {
      return JSON.parse(text);
    } catch {
      return { success: false, error: `Unexpected server response (${res.status})` };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network request failed' };
  }
}

export const developmentService = {
  // ─── Dashboard & Analytics ────────────────────────────────────────────────

  async getDashboard(
    projectId: number,
    filters?: { moduleId?: number; startDate?: string; endDate?: string }
  ) {
    const query = new URLSearchParams();
    if (filters?.moduleId) query.set('moduleId', String(filters.moduleId));
    if (filters?.startDate) query.set('startDate', filters.startDate);
    if (filters?.endDate) query.set('endDate', filters.endDate);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return requestJson<DevelopmentDashboardData>(`/projects/${projectId}/development/dashboard${qs}`);
  },

  async updateSettings(projectId: number, payload: Partial<DevelopmentProjectConfig>) {
    return requestJson<DevelopmentProjectConfig>(`/projects/${projectId}/development/settings`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // ─── Master Modules & Submodules ──────────────────────────────────────────

  async listModules(projectId: number, includeArchived = false) {
    const qs = includeArchived ? '?includeArchived=true' : '';
    return requestJson<DevelopmentModuleMaster[]>(
      `/projects/${projectId}/development/masters/modules${qs}`
    );
  },

  async createModule(
    projectId: number,
    payload: { name: string; description?: string; icon?: string; color?: string }
  ) {
    return requestJson<DevelopmentModuleMaster>(
      `/projects/${projectId}/development/masters/modules`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  async updateModule(
    projectId: number,
    moduleId: number,
    payload: {
      name?: string;
      description?: string | null;
      icon?: string | null;
      color?: string | null;
      isArchived?: boolean;
      position?: number;
    }
  ) {
    return requestJson<DevelopmentModuleMaster>(
      `/projects/${projectId}/development/masters/modules/${moduleId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
  },

  async reorderModules(projectId: number, orderedIds: number[]) {
    return requestJson<void>(`/projects/${projectId}/development/masters/modules/reorder`, {
      method: 'POST',
      body: JSON.stringify({ orderedIds }),
    });
  },

  async deleteModule(projectId: number, moduleId: number) {
    return requestJson<void>(`/projects/${projectId}/development/masters/modules/${moduleId}`, {
      method: 'DELETE',
    });
  },

  async createSubmodule(
    projectId: number,
    payload: { moduleId: number; name: string; description?: string; icon?: string }
  ) {
    return requestJson<DevelopmentSubmoduleMaster>(
      `/projects/${projectId}/development/masters/submodules`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  async updateSubmodule(
    projectId: number,
    submoduleId: number,
    payload: {
      name?: string;
      moduleId?: number;
      description?: string | null;
      icon?: string | null;
      isArchived?: boolean;
      position?: number;
    }
  ) {
    return requestJson<DevelopmentSubmoduleMaster>(
      `/projects/${projectId}/development/masters/submodules/${submoduleId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
  },

  async reorderSubmodules(projectId: number, orderedIds: number[]) {
    return requestJson<void>(`/projects/${projectId}/development/masters/submodules/reorder`, {
      method: 'POST',
      body: JSON.stringify({ orderedIds }),
    });
  },

  async migrateSubmoduleTasks(
    projectId: number,
    submoduleId: number,
    targetSubmoduleId: number,
    archiveSource = true
  ) {
    return requestJson<{ migratedCount: number }>(
      `/projects/${projectId}/development/masters/submodules/${submoduleId}/migrate`,
      {
        method: 'POST',
        body: JSON.stringify({ targetSubmoduleId, archiveSource }),
      }
    );
  },

  async deleteSubmodule(projectId: number, submoduleId: number) {
    return requestJson<void>(
      `/projects/${projectId}/development/masters/submodules/${submoduleId}`,
      {
        method: 'DELETE',
      }
    );
  },

  // ─── Tasks CRUD ───────────────────────────────────────────────────────────

  async listTasks(projectId: number, params: DevelopmentTaskListParams = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.moduleId) query.set('moduleId', String(params.moduleId));
    if (params.submoduleId) query.set('submoduleId', String(params.submoduleId));
    if (params.assigneeId !== undefined) query.set('assigneeId', String(params.assigneeId));
    if (params.priority) query.set('priority', params.priority);
    if (params.status) query.set('status', params.status);
    if (params.taskType) query.set('taskType', params.taskType);
    if (params.metric) query.set('metric', params.metric);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return requestJson<DevelopmentTaskListResponse>(
      `/projects/${projectId}/development/tasks${qs}`
    );
  },

  async getTaskDetail(projectId: number, taskId: number) {
    return requestJson<
      DevelopmentTaskItem & {
        comments: DevelopmentTaskComment[];
        activities: DevelopmentTaskActivity[];
      }
    >(`/projects/${projectId}/development/tasks/${taskId}`);
  },

  async createTask(projectId: number, payload: CreateDevelopmentTaskPayload) {
    return requestJson<DevelopmentTaskItem>(`/projects/${projectId}/development/tasks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateTask(projectId: number, taskId: number, payload: UpdateDevelopmentTaskPayload) {
    return requestJson<DevelopmentTaskItem>(`/projects/${projectId}/development/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async updateTaskStatus(projectId: number, taskId: number, status: string) {
    return requestJson<DevelopmentTaskItem>(
      `/projects/${projectId}/development/tasks/${taskId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }
    );
  },

  async deleteTask(projectId: number, taskId: number) {
    return requestJson<void>(`/projects/${projectId}/development/tasks/${taskId}`, {
      method: 'DELETE',
    });
  },

  async addComment(projectId: number, taskId: number, body: string) {
    return requestJson<DevelopmentTaskComment>(
      `/projects/${projectId}/development/tasks/${taskId}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({ body }),
      }
    );
  },

  async addAttachment(
    projectId: number,
    taskId: number,
    payload:
      | { documentId: number }
      | { fileName: string; fileUrl: string; mimeType?: string; fileSize?: number }
  ) {
    return requestJson<DevelopmentTaskAttachment>(
      `/projects/${projectId}/development/tasks/${taskId}/attachments`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  async removeAttachment(projectId: number, taskId: number, attId: number) {
    return requestJson<void>(
      `/projects/${projectId}/development/tasks/${taskId}/attachments/${attId}`,
      {
        method: 'DELETE',
      }
    );
  },
};

