import { authService, AuthUser } from './auth.service';

export interface UserProfileData {
  displayName: string;
  username: string;
  email: string;
  isEmailVerified: boolean;
  avatarUrl: string;
  bio: string;
  jobTitle: string;
  location: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  phoneNumber?: string;
  isPublicProfile: boolean;
  websiteUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
}

export interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  os: string;
  location: string;
  ipAddress: string;
  lastActive: string;
  isCurrent: boolean;
  createdAt: string;
}

export interface LoginActivityEvent {
  id: string;
  type: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'PASSWORD_CHANGE' | 'EMAIL_CHANGE' | 'TWO_FACTOR_CHANGE' | 'SESSION_REVOKED';
  title: string;
  description: string;
  ipAddress: string;
  location: string;
  timestamp: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
}

export interface ConnectedAccount {
  id: string;
  provider: 'github' | 'gitlab' | 'bitbucket' | 'google';
  name: string;
  category: 'code-hosting' | 'sign-in-provider';
  icon: string;
  isConnected: boolean;
  connectedIdentifier?: string;
  connectedAt?: string;
  scopeDescription: string;
  canDisconnect: boolean;
}

const STORAGE_KEYS = {
  PROFILE: 'devflow_user_profile_settings',
  SESSIONS: 'devflow_active_sessions',
  ACTIVITY: 'devflow_login_activity',
  CONNECTIONS: 'devflow_connected_accounts',
  SECURITY: 'devflow_security_settings',
};

export const accountSettingsService = {
  // ── Profile ─────────────────────────────────────────────────────────────
  getProfile(): UserProfileData {
    const authUser = authService.getUser();
    const stored = localStorage.getItem(STORAGE_KEYS.PROFILE);

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          email: authUser?.email || parsed.email || 'alice@devflow.io',
          displayName: parsed.displayName || authUser?.name || 'Alice Johnson',
          avatarUrl: parsed.avatarUrl || authUser?.avatarUrl || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        };
      } catch {
        // Fallback below
      }
    }

    const defaultProfile: UserProfileData = {
      displayName: authUser?.name || 'Emily Johnson',
      username: (authUser?.email?.split('@')[0] || 'emily_johnson').toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      email: authUser?.email || 'johnson@example.com',
      isEmailVerified: true,
      avatarUrl: authUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
      bio: 'Full-stack software engineer & open source contributor. Building developer tools and modern web systems.',
      jobTitle: 'Senior Staff Engineer',
      location: 'California, United States',
      dateOfBirth: 'January 1, 1987',
      gender: 'Female',
      nationality: 'American',
      phoneNumber: '(213) 555-1234',
      isPublicProfile: true,
      websiteUrl: 'https://emilyjohnson.dev',
      githubUrl: 'https://github.com/emilyjohnson',
      linkedinUrl: 'https://linkedin.com/in/emilyjohnson',
    };

    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(defaultProfile));
    return defaultProfile;
  },

  async updateProfile(data: Partial<UserProfileData>): Promise<UserProfileData> {
    // Artificial small delay for realistic UX
    await new Promise((r) => setTimeout(r, 400));

    const current = this.getProfile();
    const updated: UserProfileData = {
      ...current,
      ...data,
    };

    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(updated));

    // Also sync with Auth user session if display name or avatar changed
    const authUser = authService.getUser();
    if (authUser) {
      const updatedAuthUser: AuthUser = {
        ...authUser,
        name: updated.displayName,
        avatarUrl: updated.avatarUrl,
      };
      const token = authService.getToken() || 'devflow_token';
      authService.setSession(token, updatedAuthUser);
    }

    return updated;
  },

  // ── Security & Access ───────────────────────────────────────────────────
  getSecuritySettings(): { is2FAEnabled: boolean; hasPassword: boolean; lastPasswordChange: string } {
    const stored = localStorage.getItem(STORAGE_KEYS.SECURITY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Fallback
      }
    }
    const defaultSettings = {
      is2FAEnabled: false,
      hasPassword: true,
      lastPasswordChange: '30 days ago',
    };
    localStorage.setItem(STORAGE_KEYS.SECURITY, JSON.stringify(defaultSettings));
    return defaultSettings;
  },

  async changePassword(currentPass: string, newPass: string): Promise<{ success: boolean; error?: string }> {
    await new Promise((r) => setTimeout(r, 600));

    if (!currentPass) {
      return { success: false, error: 'Current password is required.' };
    }
    if (newPass.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters long.' };
    }

    const settings = this.getSecuritySettings();
    const updated = {
      ...settings,
      hasPassword: true,
      lastPasswordChange: 'Just now',
    };
    localStorage.setItem(STORAGE_KEYS.SECURITY, JSON.stringify(updated));

    // Log the security event
    this.addLoginActivityEvent({
      type: 'PASSWORD_CHANGE',
      title: 'Password Updated',
      description: 'Account master password was changed successfully.',
      status: 'SUCCESS',
    });

    return { success: true };
  },

  async toggle2FA(enable: boolean): Promise<{ success: boolean; is2FAEnabled: boolean }> {
    await new Promise((r) => setTimeout(r, 500));
    const settings = this.getSecuritySettings();
    const updated = {
      ...settings,
      is2FAEnabled: enable,
    };
    localStorage.setItem(STORAGE_KEYS.SECURITY, JSON.stringify(updated));

    this.addLoginActivityEvent({
      type: 'TWO_FACTOR_CHANGE',
      title: enable ? 'Two-Factor Authentication Enabled' : 'Two-Factor Authentication Disabled',
      description: enable
        ? 'TOTP Authenticator app enrolled for secure login.'
        : 'Two-factor protection was turned off.',
      status: enable ? 'SUCCESS' : 'WARNING',
    });

    return { success: true, is2FAEnabled: enable };
  },

  // ── Active Sessions ─────────────────────────────────────────────────────
  getActiveSessions(): ActiveSession[] {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Fallback
      }
    }

    const defaultSessions: ActiveSession[] = [
      {
        id: 'session-current',
        device: 'Desktop Workstation',
        browser: 'Google Chrome 124.0',
        os: 'Windows 11 64-bit',
        location: 'California, United States',
        ipAddress: '192.0.2.14',
        lastActive: 'Active now',
        isCurrent: true,
        createdAt: 'May 1, 2026 at 09:14 AM',
      },
      {
        id: 'session-mbp',
        device: 'MacBook Pro 16"',
        browser: 'Safari 17.4',
        os: 'macOS Sonoma 14.4',
        location: 'San Francisco, CA, United States',
        ipAddress: '198.51.100.82',
        lastActive: '3 hours ago',
        isCurrent: false,
        createdAt: 'Apr 28, 2026 at 11:22 PM',
      },
      {
        id: 'session-iphone',
        device: 'iPhone 15 Pro',
        browser: 'Mobile Safari',
        os: 'iOS 17.4',
        location: 'Los Angeles, CA, United States',
        ipAddress: '203.0.113.45',
        lastActive: '2 days ago',
        isCurrent: false,
        createdAt: 'Apr 20, 2026 at 03:40 PM',
      },
    ];

    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(defaultSessions));
    return defaultSessions;
  },

  async revokeSession(sessionId: string): Promise<ActiveSession[]> {
    await new Promise((r) => setTimeout(r, 350));
    const sessions = this.getActiveSessions();
    const updated = sessions.filter((s) => s.id !== sessionId || s.isCurrent);
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(updated));

    this.addLoginActivityEvent({
      type: 'SESSION_REVOKED',
      title: 'Session Revoked',
      description: `Revoked access token for session ID: ${sessionId.slice(0, 12)}...`,
      status: 'WARNING',
    });

    return updated;
  },

  async revokeOtherSessions(): Promise<ActiveSession[]> {
    await new Promise((r) => setTimeout(r, 450));
    const sessions = this.getActiveSessions();
    const currentOnly = sessions.filter((s) => s.isCurrent);
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(currentOnly));

    this.addLoginActivityEvent({
      type: 'SESSION_REVOKED',
      title: 'All Other Sessions Signed Out',
      description: 'Terminated active credentials on all other browsers and mobile devices.',
      status: 'WARNING',
    });

    return currentOnly;
  },

  // ── Login Activity ──────────────────────────────────────────────────────
  getLoginActivity(): LoginActivityEvent[] {
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVITY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Fallback
      }
    }

    const defaultActivity: LoginActivityEvent[] = [
      {
        id: 'act-1',
        type: 'LOGIN_SUCCESS',
        title: 'Successful Sign-in',
        description: 'Web dashboard authentication via email credentials.',
        ipAddress: '192.0.2.14',
        location: 'California, United States',
        timestamp: 'Today at 09:14 AM',
        status: 'SUCCESS',
      },
      {
        id: 'act-2',
        type: 'LOGIN_SUCCESS',
        title: 'Successful Sign-in (GitHub OAuth)',
        description: 'Single sign-on token verified via GitHub authorization.',
        ipAddress: '198.51.100.82',
        location: 'San Francisco, CA, United States',
        timestamp: 'Yesterday at 04:32 PM',
        status: 'SUCCESS',
      },
      {
        id: 'act-3',
        type: 'LOGIN_FAILED',
        title: 'Unsuccessful Sign-in Attempt',
        description: 'Incorrect password provided from unfamiliar location.',
        ipAddress: '198.51.100.99',
        location: 'Dallas, TX, United States',
        timestamp: '3 days ago at 10:18 AM',
        status: 'FAILED',
      },
      {
        id: 'act-4',
        type: 'PASSWORD_CHANGE',
        title: 'Password Changed',
        description: 'Account password changed via account security portal.',
        ipAddress: '192.0.2.14',
        location: 'California, United States',
        timestamp: 'Apr 24, 2026 at 02:05 PM',
        status: 'SUCCESS',
      },
    ];

    localStorage.setItem(STORAGE_KEYS.ACTIVITY, JSON.stringify(defaultActivity));
    return defaultActivity;
  },

  addLoginActivityEvent(event: Omit<LoginActivityEvent, 'id' | 'timestamp' | 'ipAddress' | 'location'>): void {
    const activity = this.getLoginActivity();
    const newEvent: LoginActivityEvent = {
      ...event,
      id: `act-${Date.now()}`,
      ipAddress: '192.0.2.14',
      location: 'California, United States',
      timestamp: 'Just now',
    };
    const updated = [newEvent, ...activity.slice(0, 24)];
    localStorage.setItem(STORAGE_KEYS.ACTIVITY, JSON.stringify(updated));
  },

  // ── Connected Accounts ──────────────────────────────────────────────────
  getConnectedAccounts(): ConnectedAccount[] {
    const stored = localStorage.getItem(STORAGE_KEYS.CONNECTIONS);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Fallback
      }
    }

    const defaultConnections: ConnectedAccount[] = [
      {
        id: 'conn-github',
        provider: 'github',
        name: 'GitHub',
        category: 'code-hosting',
        icon: 'github',
        isConnected: true,
        connectedIdentifier: 'emilyjohnson',
        connectedAt: 'Connected on Apr 12, 2026',
        scopeDescription: 'Grants repository read/write, commit status checks, and pull request sync.',
        canDisconnect: true,
      },
      {
        id: 'conn-gitlab',
        provider: 'gitlab',
        name: 'GitLab',
        category: 'code-hosting',
        icon: 'gitlab',
        isConnected: false,
        scopeDescription: 'Connect GitLab CI/CD pipelines, MR webhooks, and issue trackers to DevFlow.',
        canDisconnect: true,
      },
      {
        id: 'conn-bitbucket',
        provider: 'bitbucket',
        name: 'Bitbucket',
        category: 'code-hosting',
        icon: 'bitbucket',
        isConnected: false,
        scopeDescription: 'Integrate Bitbucket Cloud repositories and branch deployments.',
        canDisconnect: true,
      },
      {
        id: 'conn-google',
        provider: 'google',
        name: 'Google',
        category: 'sign-in-provider',
        icon: 'google',
        isConnected: true,
        connectedIdentifier: 'johnson@example.com',
        connectedAt: 'Connected on Jan 14, 2026',
        scopeDescription: 'Single sign-on authentication and Google Workspace identity linkage.',
        canDisconnect: true, // Only if password exists
      },
    ];

    localStorage.setItem(STORAGE_KEYS.CONNECTIONS, JSON.stringify(defaultConnections));
    return defaultConnections;
  },

  async toggleConnection(providerId: string, shouldConnect: boolean): Promise<ConnectedAccount[]> {
    await new Promise((r) => setTimeout(r, 600));
    const connections = this.getConnectedAccounts();

    const updated = connections.map((conn) => {
      if (conn.id === providerId) {
        if (shouldConnect) {
          return {
            ...conn,
            isConnected: true,
            connectedIdentifier: conn.provider === 'github' ? 'emilyjohnson' : 'johnson@example.com',
            connectedAt: 'Just connected',
          };
        } else {
          return {
            ...conn,
            isConnected: false,
            connectedIdentifier: undefined,
            connectedAt: undefined,
          };
        }
      }
      return conn;
    });

    localStorage.setItem(STORAGE_KEYS.CONNECTIONS, JSON.stringify(updated));
    return updated;
  },

  // ── Account Management (Export, Deactivate, Delete) ──────────────────────
  async requestDataExport(): Promise<{ exportId: string; downloadUrl: string; size: string; createdAt: string }> {
    await new Promise((r) => setTimeout(r, 800));
    const profile = this.getProfile();
    const sessions = this.getActiveSessions();
    const activity = this.getLoginActivity();

    const exportPayload = {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      account: profile,
      sessions,
      securityActivity: activity,
      system: 'DevFlow Cloud SDLC Platform',
    };

    // Create a client-side downloadable JSON blob
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);

    return {
      exportId: `devflow-export-${Date.now().toString(36)}`,
      downloadUrl,
      size: `${(blob.size / 1024).toFixed(1)} KB`,
      createdAt: 'Just now',
    };
  },

  async deactivateAccount(): Promise<{ success: boolean }> {
    await new Promise((r) => setTimeout(r, 700));
    this.addLoginActivityEvent({
      type: 'SESSION_REVOKED',
      title: 'Account Deactivated',
      description: 'Account status set to inactive. All sessions terminated.',
      status: 'WARNING',
    });
    return { success: true };
  },

  async deleteAccount(confirmationPhrase: string): Promise<{ success: boolean; error?: string }> {
    await new Promise((r) => setTimeout(r, 900));
    if (confirmationPhrase.trim().toUpperCase() !== 'DELETE MY ACCOUNT') {
      return { success: false, error: 'Confirmation phrase does not match.' };
    }

    // Clear local storage and sign out
    localStorage.removeItem(STORAGE_KEYS.PROFILE);
    localStorage.removeItem(STORAGE_KEYS.SECURITY);
    localStorage.removeItem(STORAGE_KEYS.SESSIONS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVITY);
    localStorage.removeItem(STORAGE_KEYS.CONNECTIONS);
    authService.clearSession();

    return { success: true };
  },
};
