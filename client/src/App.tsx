import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NavigationProvider } from './context/NavigationContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { OverviewView } from './views/OverviewView';
import { InboxView } from './views/InboxView';
import { MyIssuesView } from './views/MyIssuesView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { TeamView } from './views/TeamView';
import { SettingsView } from './views/SettingsView';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { ToastProvider } from './context/ToastContext';
import { ProfileSettingsPage } from './pages/settings/account/ProfileSettingsPage';
import { SecuritySettingsPage } from './pages/settings/account/SecuritySettingsPage';
import { ConnectedAccountsPage } from './pages/settings/account/ConnectedAccountsPage';
import { AccountManagementPage } from './pages/settings/account/AccountManagementPage';

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, isOnboardingCompleted } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#08090B] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#A78BFA] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isOnboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
            {/* Standalone Authentication Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<LoginPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />

            {/* Authenticated Workspace Application */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <NavigationProvider>
                    <DashboardLayout>
                      <Routes>
                        {/* 1. Inbox - Notifications and assigned updates */}
                        <Route path="/inbox" element={<InboxView />} />

                        {/* 2. Overview - Workspace dashboard */}
                        <Route path="/" element={<OverviewView />} />
                        <Route path="/workspace/overview" element={<OverviewView />} />

                        {/* 3. Projects - All workspace projects */}
                        <Route path="/projects" element={<OverviewView />} />

                        {/* 4. My Tasks - Tasks assigned to me */}
                        <Route path="/my-tasks" element={<MyIssuesView />} />
                        <Route path="/my-issues" element={<MyIssuesView />} />

                        {/* 5. Teams - Manage workspace teams */}
                        <Route path="/teams" element={<TeamView />} />
                        <Route path="/teams/:teamId" element={<TeamView />} />
                        <Route path="/teams/:teamId/*" element={<TeamView />} />

                        {/* 6. Activity - Workspace-wide activity */}
                        <Route path="/activity" element={<OverviewView />} />

                        {/* 7. Settings - Account Settings & Workspace */}
                        <Route path="/settings/account/profile" element={<ProfileSettingsPage />} />
                        <Route path="/settings/account/security" element={<SecuritySettingsPage />} />
                        <Route path="/settings/account/connections" element={<ConnectedAccountsPage />} />
                        <Route path="/settings/account/management" element={<AccountManagementPage />} />
                        <Route path="/settings/account" element={<Navigate to="/settings/account/profile" replace />} />
                        <Route path="/settings" element={<Navigate to="/settings/account/profile" replace />} />
                        <Route path="/profile" element={<Navigate to="/settings/account/profile" replace />} />
                        <Route path="/settings/workspace" element={<SettingsView />} />

                        {/* 8. Help & Support - Documentation and support */}
                        <Route path="/help" element={<SettingsView />} />

                        {/* Project Context Mode Routes */}
                        <Route path="/projects/:id" element={<ProjectDetailView />} />
                        <Route path="/projects/:id/*" element={<ProjectDetailView />} />

                        {/* Fallback */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </DashboardLayout>
                  </NavigationProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
};
