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

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

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

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Standalone Authentication Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<LoginPage />} />

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

                        {/* 7. Settings - Workspace configuration */}
                        <Route path="/settings" element={<SettingsView />} />
                        <Route path="/profile" element={<SettingsView />} />

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
    </ThemeProvider>
  );
};
