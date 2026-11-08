import { apiUrl } from '../config/api';
import { authService } from './auth.service';

export interface FavoriteProject {
  id: number;
  name: string;
  slug?: string;
  color?: string;
  icon?: string;
  status?: string;
  organizationId?: number;
}

export interface FavoriteTeam {
  id: number;
  name: string;
  key?: string;
  color?: string;
  icon?: string;
  organizationId?: number;
}

export interface FavoritesResponse {
  favorites: {
    id: number;
    resourceType: 'PROJECT' | 'TEAM';
    resourceId: number;
    organizationId?: number | null;
    createdAt: string;
  }[];
  projects: FavoriteProject[];
  teams: FavoriteTeam[];
}

function getAuthHeaders(): Record<string, string> {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const favoriteService = {
  async getFavorites(params?: {
    organizationSlug?: string;
    organizationId?: number;
  }): Promise<{ success: boolean; data?: FavoritesResponse; error?: string }> {
    try {
      let endpoint = '/favorites';
      if (params?.organizationSlug) {
        endpoint = `/favorites?organizationSlug=${encodeURIComponent(params.organizationSlug)}`;
      } else if (params?.organizationId) {
        endpoint = `/favorites?organizationId=${params.organizationId}`;
      }
      const res = await fetch(apiUrl(endpoint), { headers: getAuthHeaders() });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch favorites' };
    }
  },

  async toggleFavorite(data: {
    resourceType: 'PROJECT' | 'TEAM';
    resourceId: number;
    organizationId?: number;
  }): Promise<{ success: boolean; action?: 'added' | 'removed'; error?: string }> {
    try {
      const res = await fetch(apiUrl('/favorites/toggle'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to toggle favorite' };
    }
  },
};

