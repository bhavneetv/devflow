// API Base URL configuration
// If VITE_API_URL is set (e.g. on Vercel), requests will point to your backend (e.g. Render).
// In local development or when using proxy, it defaults to '/api'.

const rawApiUrl = import.meta.env.VITE_API_URL || '';
export const API_BASE = rawApiUrl
  ? `${rawApiUrl.replace(/\/+$/, '')}/api`
  : '/api';

/**
 * Resolves an API endpoint path against the configured API_BASE.
 * Handles paths with or without leading '/api' or '/'.
 * 
 * Example:
 * apiUrl('/auth/login') -> 'https://devflow-api.onrender.com/api/auth/login' (if VITE_API_URL set)
 *                       -> '/api/auth/login' (in local dev)
 */
export function apiUrl(endpoint: string): string {
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (clean.startsWith('/api/')) {
    return `${API_BASE}${clean.substring(4)}`;
  }
  return `${API_BASE}${clean}`;
}

/**
 * Resolves the Socket.IO server URL.
 * In production (e.g. deployed on Netlify or Vercel), uses VITE_SOCKET_URL or derives from VITE_API_URL.
 * In local development, defaults to 'http://localhost:5000'.
 */
export function getSocketUrl(): string {
  const socketEnv = import.meta.env.VITE_SOCKET_URL;
  if (socketEnv) return socketEnv.replace(/\/+$/, '');

  const apiEnv = import.meta.env.VITE_API_URL;
  if (apiEnv) {
    return apiEnv.replace(/\/+$/, '').replace(/\/api\/?$/, '');
  }

  if (typeof window !== 'undefined' && window.location.origin.includes('localhost')) {
    return 'http://localhost:5000';
  }

  return '/';
}
