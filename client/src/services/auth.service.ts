import { OnboardingData } from '../types/onboarding';
import { apiUrl } from '../config/api';
import { saveAccentColor } from './accentTheme.service';

export interface AuthUser {
  id: number;
  name: string;
  username?: string | null;
  email: string;
  role: string;
  avatarUrl?: string | null;
  avatarType?: 'initials' | 'icon' | 'upload' | string | null;
  avatarId?: string | null;
  avatarColor?: string | null;
  accentColor?: string | null;
  onboardingCompleted?: boolean;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: AuthUser;
  error?: string;
  isNewUser?: boolean;
}

const TOKEN_KEY = 'devflow_auth_token';
const USER_KEY = 'devflow_auth_user';
const ONBOARDING_COMPLETED_KEY = 'devflow_onboarding_completed';

export const authService = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  getUser(): AuthUser | null {
    const data = localStorage.getItem(USER_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  setSession(token: string, user: AuthUser): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  isOnboardingCompleted(): boolean {
    return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true';
  },

  setOnboardingCompleted(completed: boolean): void {
    if (completed) {
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } else {
      localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    }
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const res = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success && data.token && data.user) {
        this.setSession(data.token, data.user);
        const isCompleted = data.user.onboardingCompleted ?? !data.isNewUser;
        this.setOnboardingCompleted(isCompleted);
        if (data.user.accentColor) {
          saveAccentColor(data.user.accentColor);
        }
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Unable to connect to authentication server.',
      };
    }
  },

  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    try {
      const res = await fetch(apiUrl('/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (data.success && data.token && data.user) {
        this.setSession(data.token, data.user);
        // Newly registered users need to go through onboarding
        this.setOnboardingCompleted(false);
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Unable to register account.',
      };
    }
  },

  async socialLogin(provider: 'github' | 'google'): Promise<AuthResponse> {
    try {
      const res = await fetch(apiUrl('/auth/social'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (data.success && data.token && data.user) {
        this.setSession(data.token, data.user);
        const isCompleted = data.user.onboardingCompleted ?? !data.isNewUser;
        this.setOnboardingCompleted(isCompleted);
        if (data.user.accentColor) {
          saveAccentColor(data.user.accentColor);
        }
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || `Failed to sign in with ${provider}.`,
      };
    }
  },

  async demoNewUser(): Promise<AuthResponse> {
    try {
      const res = await fetch(apiUrl('/auth/demo-new-user'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success && data.token && data.user) {
        this.setSession(data.token, data.user);
        this.setOnboardingCompleted(false);
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to start demo new user session.',
      };
    }
  },

  async submitOnboarding(data: OnboardingData): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    try {
      const token = this.getToken();
      const res = await fetch(apiUrl('/auth/onboarding'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (resData.success && resData.user) {
        this.setOnboardingCompleted(true);
        const currentUser = this.getUser();
        const updatedUser: AuthUser = {
          ...(currentUser || {}),
          ...resData.user,
          name: data.displayName,
          username: data.username,
          avatarType: data.avatarType,
          avatarId: data.avatarId,
          avatarUrl: data.avatarUrl || resData.user.avatarUrl,
          avatarColor: data.avatarColor,
          accentColor: data.accentColor,
          onboardingCompleted: true,
        };
        this.setSession(token || 'devflow_session', updatedUser);

        if (data.accentColor) {
          saveAccentColor(data.accentColor);
        }

        // Synchronize account settings cache immediately so settings page has matching user
        try {
          const profileCache = {
            displayName: data.displayName,
            username: data.username || `user_${resData.user.id}`,
            email: updatedUser.email,
            isEmailVerified: true,
            avatarUrl: updatedUser.avatarUrl || '',
            avatarType: data.avatarType,
            avatarId: data.avatarId,
            avatarColor: data.avatarColor,
            accentColor: data.accentColor,
            bio: 'Full-stack software engineer & developer.',
            jobTitle: data.role ? `${data.role.charAt(0).toUpperCase() + data.role.slice(1)} Engineer` : 'Software Engineer',
            company: data.projectName || 'DevFlow',
            location: 'Remote',
            dateOfBirth: '1996-06-15',
            gender: 'Female',
            country: 'US',
            phoneNumber: '+1 (555) 234-5678',
            isPublicProfile: true,
            websiteUrl: '',
            githubUrl: '',
            linkedinUrl: '',
          };
          localStorage.setItem('devflow_user_profile_settings', JSON.stringify(profileCache));
        } catch {}
      }
      return resData;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to save onboarding configuration.',
      };
    }
  },

  async getMe(): Promise<AuthUser | null> {
    const token = this.getToken();
    if (!token) return null;
    try {
      const res = await fetch(apiUrl('/auth/me'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.user) {
        return data.user;
      }
      return null;
    } catch {
      return null;
    }
  },
};
