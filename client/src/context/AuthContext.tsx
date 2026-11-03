import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService, AuthUser } from '../services/auth.service';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  socialLogin: (provider: 'github' | 'google') => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => authService.getUser());
  const [token, setToken] = useState<string | null>(() => authService.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Validate session on mount
    const initAuth = async () => {
      const storedToken = authService.getToken();
      if (storedToken) {
        const me = await authService.getMe();
        if (me) {
          setUser(me);
        } else {
          // If server fails or user invalid, fallback to stored user or clear
          const localUser = authService.getUser();
          if (localUser) setUser(localUser);
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    const res = await authService.login(email, password);
    setIsLoading(false);
    if (res.success && res.user && res.token) {
      setUser(res.user);
      setToken(res.token);
      return { success: true };
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
      return { success: true };
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
      return { success: true };
    }
    return { success: false, error: res.error || 'Social authentication failed' };
  };

  const logout = () => {
    authService.clearSession();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        register,
        socialLogin,
        logout,
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
