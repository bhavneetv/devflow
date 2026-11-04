import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService, AuthUser } from '../services/auth.service';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOnboardingCompleted: boolean;
  setIsOnboardingCompleted: (completed: boolean) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; isNewUser?: boolean; user?: AuthUser; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; isNewUser?: boolean; user?: AuthUser; error?: string }>;
  socialLogin: (provider: 'github' | 'google') => Promise<{ success: boolean; isNewUser?: boolean; user?: AuthUser; error?: string }>;
  demoNewUserSession: () => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateCurrentUser: (userUpdates: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => authService.getUser());
  const [token, setToken] = useState<string | null>(() => authService.getToken());
  const [isOnboardingCompleted, setIsOnboardingCompletedState] = useState<boolean>(() =>
    authService.isOnboardingCompleted()
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Validate session on mount
    const initAuth = async () => {
      const storedToken = authService.getToken();
      if (storedToken) {
        const me = await authService.getMe();
        if (me) {
          setUser(me);
          if (me.onboardingCompleted !== undefined) {
            authService.setOnboardingCompleted(me.onboardingCompleted);
            setIsOnboardingCompletedState(me.onboardingCompleted);
          }
        } else {
          const localUser = authService.getUser();
          if (localUser) setUser(localUser);
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const setIsOnboardingCompleted = (completed: boolean) => {
    authService.setOnboardingCompleted(completed);
    setIsOnboardingCompletedState(completed);
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    const res = await authService.login(email, password);
    setIsLoading(false);
    if (res.success && res.user && res.token) {
      setUser(res.user);
      setToken(res.token);
      const isCompleted = res.user.onboardingCompleted ?? !res.isNewUser;
      setIsOnboardingCompleted(isCompleted);
      return { success: true, isNewUser: !isCompleted, user: res.user };
    }
    return { success: false, error: res.error || 'Invalid credentials' };
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    const res = await authService.register(name, email, password);
    setIsLoading(false);
    if (res.success && res.user && res.token) {
      setUser(res.user);
      setToken(res.token);
      setIsOnboardingCompleted(false);
      return { success: true, isNewUser: true, user: res.user };
    }
    return { success: false, error: res.error || 'Registration failed' };
  };

  const socialLogin = async (provider: 'github' | 'google') => {
    setIsLoading(true);
    const res = await authService.socialLogin(provider);
    setIsLoading(false);
    if (res.success && res.user && res.token) {
      setUser(res.user);
      setToken(res.token);
      const isCompleted = res.user.onboardingCompleted ?? !res.isNewUser;
      setIsOnboardingCompleted(isCompleted);
      return { success: true, isNewUser: !isCompleted, user: res.user };
    }
    return { success: false, error: res.error || 'Social authentication failed' };
  };

  const demoNewUserSession = async () => {
    setIsLoading(true);
    const res = await authService.demoNewUser();
    setIsLoading(false);
    if (res.success && res.user && res.token) {
      setUser(res.user);
      setToken(res.token);
      setIsOnboardingCompleted(false);
      return { success: true };
    }
    return { success: false, error: res.error || 'Failed to start demo user session' };
  };

  const updateCurrentUser = (userUpdates: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...userUpdates };
      const currentToken = authService.getToken();
      if (currentToken) {
        authService.setSession(currentToken, updated);
      }
      return updated;
    });
  };

  const logout = () => {
    authService.clearSession();
    setUser(null);
    setToken(null);
    setIsOnboardingCompletedState(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        isOnboardingCompleted,
        setIsOnboardingCompleted,
        login,
        register,
        socialLogin,
        demoNewUserSession,
        logout,
        updateCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
