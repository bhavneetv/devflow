import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NavigationProvider } from './context/NavigationContext';
import { ChatProvider } from './context/ChatContext';
import { OrganizationProvider, useOrganization } from './context/OrganizationContext';
import { ToastProvider } from './context/ToastContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { OverviewView } from './views/OverviewView';
import { InboxView } from './views/InboxView';
import { MyIssuesView } from './views/MyIssuesView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { RequirementsDashboardView } from './views/requirements/RequirementsDashboardView';
import { CreateRequirementWizard } from './views/requirements/CreateRequirementWizard';
import { RequirementDetailView } from './views/requirements/RequirementDetailView';
import { RequirementReviewView } from './views/requirements/RequirementReviewView';
import { RequirementsTraceabilityView } from './views/requirements/RequirementsTraceabilityView';
import { ProjectSettingsView } from './views/project/ProjectSettingsView';
import { SubmodulePlaceholderView } from './views/project/SubmodulePlaceholderView';
import { ProjectOverviewView } from './views/project/ProjectOverviewView';
import { WhiteboardView } from './views/project/WhiteboardView';
import { PublicWhiteboardView } from './views/public/PublicWhiteboardView';
import { DocumentsKnowledgeBaseView } from './views/project/DocumentsKnowledgeBaseView';
import { PublicDocumentShareView } from './views/public/PublicDocumentShareView';
import { TeamView } from './views/TeamView';
import { SettingsView } from './views/SettingsView';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { InviteAcceptPage } from './pages/InviteAcceptPage';
import { OrgInviteAcceptPage } from './pages/OrgInviteAcceptPage';
import { ProfileSettingsPage } from './pages/settings/account/ProfileSettingsPage';
import { SecuritySettingsPage } from './pages/settings/account/SecuritySettingsPage';
import { ConnectedAccountsPage } from './pages/settings/account/ConnectedAccountsPage';
import { AccountManagementPage } from './pages/settings/account/AccountManagementPage';

// Git Module Views
import { GitOverviewPage } from './views/project/git/GitOverviewPage';
import { GitRepositoriesPage } from './views/project/git/GitRepositoriesPage';
import { GitIssuesPage } from './views/project/git/GitIssuesPage';
import { GitMergeRequestsPage } from './views/project/git/GitMergeRequestsPage';
import { GitCommitsPage } from './views/project/git/GitCommitsPage';
import { GitCodePage } from './views/project/git/GitCodePage';
import { GitOAuthCallbackView } from './views/project/git/GitOAuthCallbackView';

// Organization Views
import {
  OrganizationOverviewView,
  OrganizationMembersView,
  OrganizationTeamsView,
  OrganizationProjectsView,
  OrganizationActivityView,
  OrganizationSettingsView,
  NoOrganizationView,
} from './views/organization';

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

// Smart Root Route Component: Redirects to active organization's overview or displays NoOrganizationView
const RootOrganizationRoute: React.FC = () => {
  const { currentOrganization, organizations, isLoading } = useOrganization();

  if (isLoading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#A78BFA] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (organizations.length === 0) {
    return <NoOrganizationView />;
  }

  if (currentOrganization) {
    return <Navigate to={`/organizations/${currentOrganization.slug}/overview`} replace />;
  }

  return <OverviewView />;
};

// Route Helpers for organization-aware top level tabs
const ProjectsRedirectRoute: React.FC = () => {
  const { currentOrganization } = useOrganization();
  if (currentOrganization) {
    return <Navigate to={`/organizations/${currentOrganization.slug}/projects`} replace />;
  }
  return <OverviewView />;
};

const TeamsRedirectRoute: React.FC = () => {
  const { currentOrganization } = useOrganization();
  if (currentOrganization) {
    return <Navigate to={`/organizations/${currentOrganization.slug}/teams`} replace />;
  }
  return <TeamView />;
};

const ActivityRedirectRoute: React.FC = () => {
  const { currentOrganization } = useOrganization();
  if (currentOrganization) {
    return <Navigate to={`/organizations/${currentOrganization.slug}/activity`} replace />;
  }
  return <OverviewView />;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <OrganizationProvider>
              <Routes>
                {/* Standalone Authentication Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<LoginPage />} />
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/invite/:token" element={<InviteAcceptPage />} />
                <Route path="/invite/org/:token" element={<OrgInviteAcceptPage />} />
                <Route path="/join/org/:token" element={<OrgInviteAcceptPage />} />
                <Route path="/git/callback" element={<GitOAuthCallbackView />} />
                <Route path="/whiteboard/share/:token" element={<PublicWhiteboardView />} />
                <Route path="/share/documents/:token" element={<PublicDocumentShareView />} />
                <Route path="/documents/share/:token" element={<PublicDocumentShareView />} />

                {/* Authenticated Workspace Application */}
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <NavigationProvider>
                        <ChatProvider>
                          <DashboardLayout>
                            <Routes>
                            {/* Root & Workspace Dashboard: Redirect to active organization */}
                            <Route path="/" element={<RootOrganizationRoute />} />
                            <Route path="/workspace/overview" element={<RootOrganizationRoute />} />

                            {/* Organization Specific Scoped Routes */}
                            <Route path="/organizations/:organizationSlug/overview" element={<OrganizationOverviewView />} />
                            <Route path="/organizations/:organizationSlug/members" element={<OrganizationMembersView />} />
                            <Route path="/organizations/:organizationSlug/teams" element={<OrganizationTeamsView />} />
                            <Route path="/organizations/:organizationSlug/teams/:teamId" element={<TeamView />} />
                            <Route path="/organizations/:organizationSlug/teams/:teamId/*" element={<TeamView />} />
                            <Route path="/organizations/:organizationSlug/projects" element={<OrganizationProjectsView />} />
                            <Route path="/organizations/:organizationSlug/projects/:id" element={<ProjectOverviewView />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/overview" element={<ProjectOverviewView />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/classic" element={<ProjectDetailView />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/classic/*" element={<ProjectDetailView />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/settings" element={<ProjectSettingsView />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/settings/:section" element={<ProjectSettingsView />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/modules/:moduleId" element={<SubmodulePlaceholderView />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/submodules/:submoduleId" element={<SubmodulePlaceholderView />} />
                            {/* Organization Project Git Routes */}
                            <Route path="/organizations/:organizationSlug/projects/:id/git-overview" element={<GitOverviewPage />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/repositories" element={<GitRepositoriesPage />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/issues" element={<GitIssuesPage />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/pulls" element={<GitMergeRequestsPage />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/git-pulls" element={<GitMergeRequestsPage />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/commits" element={<GitCommitsPage />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/git-commits" element={<GitCommitsPage />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/code" element={<GitCodePage />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/git-code" element={<GitCodePage />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/whiteboard" element={<WhiteboardView />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/whiteboard/:submoduleId" element={<WhiteboardView />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/documents" element={<DocumentsKnowledgeBaseView />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/documents/:submoduleId" element={<DocumentsKnowledgeBaseView />} />
                            <Route path="/organizations/:organizationSlug/projects/:id/docs" element={<DocumentsKnowledgeBaseView />} />

                            <Route path="/organizations/:organizationSlug/activity" element={<OrganizationActivityView />} />
                            <Route path="/organizations/:organizationSlug/settings" element={<OrganizationSettingsView />} />
                            <Route path="/organizations/:organizationSlug" element={<Navigate to="overview" replace />} />
                            <Route path="/organizations" element={<RootOrganizationRoute />} />

                            {/* 1. Inbox - Notifications and assigned updates */}
                            <Route path="/inbox" element={<InboxView />} />

                            {/* 3. Projects - Scoped to organization */}
                            <Route path="/projects" element={<ProjectsRedirectRoute />} />

                            {/* Requirements - Global Dashboard & Creation */}
                            <Route path="/requirements" element={<RequirementsDashboardView />} />
                            <Route path="/requirements/new" element={<CreateRequirementWizard />} />
                            <Route path="/requirements/traceability" element={<RequirementsTraceabilityView />} />
                            <Route path="/requirements/:reqId" element={<RequirementDetailView />} />
                            <Route path="/requirements/:reqId/review" element={<RequirementReviewView />} />

                            {/* 4. My Tasks - Tasks assigned to me */}
                            <Route path="/my-tasks" element={<MyIssuesView />} />
                            <Route path="/my-issues" element={<MyIssuesView />} />

                            {/* 5. Teams - Manage workspace teams */}
                            <Route path="/teams" element={<TeamsRedirectRoute />} />
                            <Route path="/teams/:teamId" element={<TeamView />} />
                            <Route path="/teams/:teamId/*" element={<TeamView />} />

                            {/* 6. Activity - Organization Activity */}
                            <Route path="/activity" element={<ActivityRedirectRoute />} />

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
                            <Route path="/projects/:id/requirements/new" element={<CreateRequirementWizard />} />
                            <Route path="/projects/:id/requirements/traceability" element={<RequirementsTraceabilityView />} />
                            <Route path="/projects/:id/requirements/:reqId" element={<RequirementDetailView />} />
                            <Route path="/projects/:id/requirements/:reqId/review" element={<RequirementReviewView />} />
                            <Route path="/projects/:id/requirements" element={<RequirementsDashboardView />} />
                            <Route path="/projects/:id/git-overview" element={<GitOverviewPage />} />
                            <Route path="/projects/:id/repositories" element={<GitRepositoriesPage />} />
                            <Route path="/projects/:id/issues" element={<GitIssuesPage />} />
                            <Route path="/projects/:id/pulls" element={<GitMergeRequestsPage />} />
                            <Route path="/projects/:id/git-pulls" element={<GitMergeRequestsPage />} />
                            <Route path="/projects/:id/commits" element={<GitCommitsPage />} />
                            <Route path="/projects/:id/git-commits" element={<GitCommitsPage />} />
                            <Route path="/projects/:id/code" element={<GitCodePage />} />
                            <Route path="/projects/:id/git-code" element={<GitCodePage />} />
                            <Route path="/projects/:id/whiteboard" element={<WhiteboardView />} />
                            <Route path="/projects/:id/whiteboard/:submoduleId" element={<WhiteboardView />} />
                            <Route path="/projects/:id/documents" element={<DocumentsKnowledgeBaseView />} />
                            <Route path="/projects/:id/documents/:submoduleId" element={<DocumentsKnowledgeBaseView />} />
                            <Route path="/projects/:id/docs" element={<DocumentsKnowledgeBaseView />} />
                            <Route path="/projects/:id/settings" element={<ProjectSettingsView />} />
                            <Route path="/projects/:id/settings/:section" element={<ProjectSettingsView />} />
                            <Route path="/projects/:id/modules/:moduleId" element={<SubmodulePlaceholderView />} />
                            <Route path="/projects/:id/submodules/:submoduleId" element={<SubmodulePlaceholderView />} />
                            <Route path="/projects/:id/overview" element={<ProjectOverviewView />} />
                            <Route path="/projects/:id/classic" element={<ProjectDetailView />} />
                            <Route path="/projects/:id/classic/*" element={<ProjectDetailView />} />
                            <Route path="/projects/:id" element={<ProjectOverviewView />} />
                            <Route path="/projects/:id/*" element={<ProjectOverviewView />} />

                            {/* Fallback */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                          </Routes>
                        </DashboardLayout>
                      </ChatProvider>
                    </NavigationProvider>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </OrganizationProvider>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
};
