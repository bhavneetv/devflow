import { apiUrl } from '../config/api';
import { authService } from './auth.service';
import type {
  ProjectModule,
  ProjectSubmodule,
  CreateModuleInput,
  UpdateModuleInput,
  CreateSubmoduleInput,
  UpdateSubmoduleInput,
} from '../types/module';

function getAuthHeaders(): Record<string, string> {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const projectModuleService = {
  // ─── Modules ─────────────────────────────────────────────────────────────

  async getModules(projectId: number): Promise<{ success: boolean; data?: ProjectModule[]; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/modules`), {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch project modules' };
    }
  },

  async createModule(
    projectId: number,
    data: CreateModuleInput
  ): Promise<{ success: boolean; data?: ProjectModule; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/modules`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create module' };
    }
  },

  async updateModule(
    projectId: number,
    moduleId: number,
    data: UpdateModuleInput
  ): Promise<{ success: boolean; data?: ProjectModule; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/modules/${moduleId}`), {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update module' };
    }
  },

  async deleteModule(
    projectId: number,
    moduleId: number,
    options?: { targetModuleId?: number; cascade?: boolean }
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      let query = '';
      if (options?.targetModuleId) {
        query = `?targetModuleId=${options.targetModuleId}`;
      } else if (options?.cascade) {
        query = `?cascade=true`;
      }
      const res = await fetch(apiUrl(`/projects/${projectId}/modules/${moduleId}${query}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete module' };
    }
  },

  async reorderModules(
    projectId: number,
    moduleIds: number[]
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/modules/reorder`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ moduleIds }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to reorder modules' };
    }
  },

  // ─── Submodules ──────────────────────────────────────────────────────────

  async createSubmodule(
    projectId: number,
    moduleId: number,
    data: CreateSubmoduleInput
  ): Promise<{ success: boolean; data?: ProjectSubmodule; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/modules/${moduleId}/submodules`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create submodule' };
    }
  },

  async updateSubmodule(
    projectId: number,
    submoduleId: number,
    data: UpdateSubmoduleInput
  ): Promise<{ success: boolean; data?: ProjectSubmodule; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/submodules/${submoduleId}`), {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update submodule' };
    }
  },

  async moveSubmodule(
    projectId: number,
    submoduleId: number,
    targetModuleId: number
  ): Promise<{ success: boolean; data?: ProjectSubmodule; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/submodules/${submoduleId}/move`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ targetModuleId }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to move submodule' };
    }
  },

  async reorderSubmodules(
    projectId: number,
    moduleId: number,
    submoduleIds: number[]
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/modules/${moduleId}/submodules/reorder`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ submoduleIds }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to reorder submodules' };
    }
  },

  async deleteSubmodule(
    projectId: number,
    submoduleId: number
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(apiUrl(`/projects/${projectId}/submodules/${submoduleId}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete submodule' };
    }
  },
};

