import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Github,
  GitBranch,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Trash2,
  Search,
  Lock,
  Globe,
  KeyRound,
  Check,
  ArrowRight,
  X,
  Loader2,
  LogOut,
} from 'lucide-react';
import { gitService } from '../../services/git.service';
import { useToast } from '../../context/ToastContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import type {
  GitProviderConnectionItem,
  GitRepositoryConnectionItem,
} from '../../types/git';

interface ProjectGitHubLinkerProps {
  projectId: number;
  currentRepoUrl?: string;
  onRepoLinked?: (fullName: string) => void;
  onRepoUnlinked?: () => void;
}

interface ProviderRepo {
  providerRepoId?: string;
  id?: string | number;
  name: string;
  fullName: string;
  owner?: string;
  isPrivate: boolean;
  webUrl?: string;
  html_url?: string;
  defaultBranch?: string;
  description?: string;
}

export const ProjectGitHubLinker: React.FC<ProjectGitHubLinkerProps> = ({
  projectId,
  currentRepoUrl,
  onRepoLinked,
  onRepoUnlinked,
}) => {
  const { toast } = useToast();
  const { accentColor } = useAccentTheme();

  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<GitProviderConnectionItem[]>([]);
  const [connectedRepos, setConnectedRepos] = useState<GitRepositoryConnectionItem[]>([]);
  const [envConfig, setEnvConfig] = useState<{
    hasEnvToken: boolean;
    envTokenMasked: string | null;
    hasOAuth: boolean;
    clientId: string | null;
    callbackUrl: string;
  } | null>(null);

  // Modals & workflows
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRepoPickerOpen, setIsRepoPickerOpen] = useState(false);
  const [patInput, setPatInput] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Repo picker state
  const [providerRepos, setProviderRepos] = useState<ProviderRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<ProviderRepo | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    branchesCount?: number;
    commitsCount?: number;
    issuesCount?: number;
    mrsCount?: number;
  } | null>(null);

  // Syncing existing repo state
  const [isReSyncing, setIsReSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Active connected GitHub repo for this project
  const linkedRepo =
    connectedRepos.find((r) => r.fullName.toLowerCase() === currentRepoUrl?.toLowerCase()) ||
    connectedRepos[0];
  const githubConnection = connections.find((c) => c.provider === 'github');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [connRes, repoRes, envRes] = await Promise.all([
        gitService.getConnections(projectId),
        gitService.getRepositories(projectId),
        gitService.getEnvConfig(projectId),
      ]);

      if (connRes.success && connRes.data) {
        setConnections(connRes.data);
      }
      if (repoRes.success && repoRes.data) {
        setConnectedRepos(repoRes.data);
      }
      if (envRes.success && envRes.data) {
        setEnvConfig(envRes.data);
      }
    } catch (err: any) {
      console.error('Failed to load GitHub integration state:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open repository picker for an authenticated connection
  const openRepoPickerForConnection = async (connId: number) => {
    setIsRepoPickerOpen(true);
    setIsLoadingRepos(true);
    setRepoSearch('');
    setSelectedRepo(null);
    setSyncResult(null);

    try {
      const res = await gitService.getProviderRepos(projectId, connId);
      if (res.success && res.data) {
        setProviderRepos(res.data as ProviderRepo[]);
      } else {
        toast.error(res.error || 'Failed to list GitHub repositories');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error fetching repositories');
    } finally {
      setIsLoadingRepos(false);
    }
  };

  // Primary action: user clicks "Connect GitHub" or "Link GitHub"
  const handleInitiateLink = async () => {
    if (githubConnection) {
      // User is already signed in, immediately show repositories!
      await openRepoPickerForConnection(githubConnection.id);
      return;
    }

    // If server has a GitHub token configured, automatically connect and show repos!
    if (envConfig?.hasEnvToken) {
      setIsSubmittingAuth(true);
      try {
        const res = await gitService.connectEnvToken(projectId);
        if (res.success && res.data) {
          toast.success(`Connected GitHub account @${res.data.accountName}`);
          await loadData();
          await openRepoPickerForConnection(res.data.id);
          return;
        }
      } catch (err: any) {
        console.error('Auto-connect error:', err);
      } finally {
        setIsSubmittingAuth(false);
      }
    }

    // Otherwise show sign in modal
    setIsAuthModalOpen(true);
  };

  // Sign in via GitHub OAuth App
  const handleStartOAuth = () => {
    if (!envConfig?.clientId) {
      toast.error('GitHub OAuth client ID is not configured');
      return;
    }

    const state = Math.random().toString(36).substring(7);
    const redirectUri = encodeURIComponent(envConfig.callbackUrl);
    const scope = encodeURIComponent('repo read:user user:email');
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${envConfig.clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    const popup = window.open(
      authUrl,
      'GitHub OAuth Sign-In',
      `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width=${width}, height=${height}, top=${top}, left=${left}`
    );

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'GITHUB_OAUTH_CODE' && event.data?.code) {
        window.removeEventListener('message', handleMessage);
        popup?.close();
        setIsSubmittingAuth(true);
        try {
          const res = await gitService.oauthExchange(projectId, event.data.code);
          if (res.success && res.data) {
            toast.success(`Connected as @${res.data.accountName}!`);
            setIsAuthModalOpen(false);
            await loadData();
            await openRepoPickerForConnection(res.data.id);
          } else {
            toast.error(res.error || 'Failed to exchange GitHub authorization code');
          }
        } catch (err: any) {
          toast.error(err.message || 'OAuth authentication failed');
        } finally {
          setIsSubmittingAuth(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
  };

  // Connect via Personal Access Token
  const handleConnectPat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patInput.trim()) {
      toast.error('Please enter a GitHub Personal Access Token');
      return;
    }

    setIsSubmittingAuth(true);
    try {
      const res = await gitService.addConnection(projectId, {
        provider: 'github',
        token: patInput.trim(),
        authType: 'pat',
      });

      if (res.success && res.data) {
        toast.success(`Connected as @${res.data.accountName}!`);
        setPatInput('');
        setIsAuthModalOpen(false);
        await loadData();
        await openRepoPickerForConnection(res.data.id);
      } else {
        toast.error(res.error || 'Failed to verify token with GitHub');
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication error');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Link selected repository and trigger initial deep sync
  const handleLinkAndSyncRepository = async (repo: ProviderRepo) => {
    if (!githubConnection) {
      toast.error('No GitHub account connected');
      return;
    }

    setSelectedRepo(repo);
    setIsSyncing(true);

    try {
      const repoFullName = repo.fullName || repo.name;
      const repoOwner = repo.owner || repoFullName.split('/')[0] || githubConnection.accountName;
      const repoName = repo.name || repoFullName.split('/')[1] || repoFullName;
      const providerRepoId = String(repo.providerRepoId || repo.id || repoFullName);
      const webUrl = repo.webUrl || repo.html_url || `https://github.com/${repoFullName}`;

      const connectRes = await gitService.connectRepository(projectId, {
        connectionId: githubConnection.id,
        providerRepoId,
        name: repoName,
        fullName: repoFullName,
        owner: repoOwner,
        defaultBranch: repo.defaultBranch || 'main',
        isPrivate: Boolean(repo.isPrivate),
        webUrl,
      });

      if (!connectRes.success || !connectRes.data) {
        toast.error(connectRes.error || 'Failed to link repository');
        setIsSyncing(false);
        return;
      }

      const connectedRepoItem = connectRes.data;

      // Trigger deep sync for branches, commits, issues, and PRs
      const syncRes = await gitService.syncRepository(projectId, connectedRepoItem.id);
      let statsMsg = '';
      if (syncRes.success && syncRes.data?.syncStats) {
        const stats = syncRes.data.syncStats;
        setSyncResult(stats);
        statsMsg = ` (${stats.branchesCount || 0} branches, ${stats.commitsCount || 0} commits, ${stats.issuesCount || 0} issues, ${stats.mrsCount || 0} PRs)`;
      }

      toast.success(`Linked and synced ${repoFullName}!${statsMsg}`);
      onRepoLinked?.(repoFullName);
      await loadData();

      // Automatically close modal after brief delay so user sees sync complete
      setTimeout(() => {
        setIsRepoPickerOpen(false);
      }, 1200);
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync repository');
    } finally {
      setIsSyncing(false);
    }
  };

  // Re-sync linked repository
  const handleReSync = async () => {
    if (!linkedRepo) return;
    setIsReSyncing(true);
    try {
      const res = await gitService.syncRepository(projectId, linkedRepo.id);
      if (res.success) {
        const stats = res.data?.syncStats;
        if (stats) {
          toast.success(
            `Synced ${linkedRepo.fullName}: ${stats.branchesCount} branches, ${stats.commitsCount} commits, ${stats.issuesCount} issues, ${stats.mrsCount} PRs.`
          );
        } else {
          toast.success(`Successfully re-synced ${linkedRepo.fullName}`);
        }
        await loadData();
      } else {
        toast.error(res.error || 'Failed to sync repository');
      }
    } catch (err: any) {
      toast.error(err.message || 'Sync failed');
    } finally {
      setIsReSyncing(false);
    }
  };

  // Disconnect repository
  const handleDisconnectRepo = async () => {
    if (!linkedRepo) return;
    if (!confirm(`Are you sure you want to disconnect ${linkedRepo.fullName}? You can re-link it at any time.`)) {
      return;
    }

    setIsDisconnecting(true);
    try {
      const res = await gitService.disconnectRepository(projectId, linkedRepo.id);
      if (res.success) {
        toast.info(`Disconnected ${linkedRepo.fullName}`);
        onRepoUnlinked?.();
        await loadData();
      } else {
        toast.error(res.error || 'Failed to disconnect repository');
      }
    } catch (err: any) {
      toast.error(err.message || 'Disconnect failed');
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Log out / disconnect Git account from project
  const handleLogoutGitAccount = async () => {
    if (!githubConnection) return;
    const accountName = githubConnection.accountName;
    const confirmed = window.confirm(
      `Are you sure you want to log out the GitHub account @${accountName}?\n\nThis will disconnect your GitHub credentials and any linked repositories from this project.`
    );
    if (!confirmed) return;

    setIsLoggingOut(true);
    try {
      if (linkedRepo) {
        await gitService.disconnectRepository(projectId, linkedRepo.id);
        onRepoUnlinked?.();
      }

      const res = await gitService.removeConnection(projectId, githubConnection.id);
      if (res.success) {
        toast.success(`Logged out GitHub account @${accountName}`);
        setIsRepoPickerOpen(false);
        setIsAuthModalOpen(false);
        await loadData();
      } else {
        toast.error(res.error || 'Failed to log out GitHub account');
      }
    } catch (err: any) {
      toast.error(err.message || 'Logout failed');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const filteredRepos = providerRepos.filter(
    (r) =>
      r.fullName.toLowerCase().includes(repoSearch.toLowerCase()) ||
      r.name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 bg-[#111216] border border-[#27272A] rounded-2xl flex items-center justify-center gap-3 text-xs text-zinc-400">
        <Loader2 size={16} className="animate-spin text-zinc-500" />
        <span>Loading GitHub integration status...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── CARD A: ALREADY LINKED REPOSITORY ─────────────────────────────── */}
      {linkedRepo ? (
        <div className="p-5 sm:p-6 bg-gradient-to-br from-[#121318] to-[#161820] border border-[#27272A] rounded-2xl shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white shrink-0">
                <Github size={20} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={linkedRepo.webUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-white text-sm sm:text-base font-mono hover:underline flex items-center gap-1.5"
                  >
                    <span>{linkedRepo.fullName}</span>
                    <ExternalLink size={12} className="text-zinc-500" />
                  </a>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      linkedRepo.isPrivate
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    {linkedRepo.isPrivate ? <Lock size={10} /> : <Globe size={10} />}
                    {linkedRepo.isPrivate ? 'Private' : 'Public'}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800/80 text-zinc-300 border border-zinc-700/60">
                    <GitBranch size={10} />
                    {linkedRepo.defaultBranch}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Healthy & Synced
                  </span>
                  {linkedRepo.lastSyncAt && (
                    <span>
                      Last sync: {new Date(linkedRepo.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {githubConnection && (
                    <span className="text-zinc-500">
                      account: @{githubConnection.accountName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={handleReSync}
                disabled={isReSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-800/90 hover:bg-zinc-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                title="Fetch latest branches, commits, issues & pull requests from GitHub"
              >
                <RefreshCw size={13} className={isReSyncing ? 'animate-spin' : ''} />
                <span>{isReSyncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>

              <button
                type="button"
                onClick={handleInitiateLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-800/60 hover:bg-zinc-700/80 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                <span>Change Repo</span>
              </button>

              <Link
                to={`/projects/${projectId}/git-overview`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: accentColor }}
              >
                <span>Git Overview</span>
                <ArrowRight size={13} />
              </Link>

              <button
                type="button"
                onClick={handleDisconnectRepo}
                disabled={isDisconnecting}
                className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Disconnect repository"
              >
                <Trash2 size={14} />
              </button>

              {githubConnection && (
                <button
                  type="button"
                  onClick={handleLogoutGitAccount}
                  disabled={isLoggingOut}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer disabled:opacity-50"
                  title={`Log out GitHub account @${githubConnection.accountName}`}
                >
                  <LogOut size={13} className={isLoggingOut ? 'animate-spin' : ''} />
                  <span>Log Out Git</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ─── CARD B: NOT LINKED YET (CLEAN CONNECT GITHUB UI) ───────────── */
        <div className="p-6 bg-[#111216] border border-[#27272A] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white shrink-0">
              <Github size={22} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-white">GitHub Integration</h4>
                {githubConnection && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Connected as @{githubConnection.accountName}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 max-w-lg leading-relaxed">
                Connect your GitHub account to sync repositories, inspect branches, track pull requests, and link commits to project tasks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleInitiateLink}
              disabled={isSubmittingAuth}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-white shadow-sm transition-transform active:scale-95 cursor-pointer hover:opacity-95 disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              {isSubmittingAuth ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Github size={15} />
                  <span>{githubConnection ? 'Select Repository' : 'Connect GitHub'}</span>
                </>
              )}
            </button>

            {githubConnection && (
              <button
                type="button"
                onClick={handleLogoutGitAccount}
                disabled={isLoggingOut}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer disabled:opacity-50"
                title={`Log out GitHub account @${githubConnection.accountName}`}
              >
                <LogOut size={14} className={isLoggingOut ? 'animate-spin' : ''} />
                <span>Log Out</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL 1: SIGN IN TO GITHUB (CLEAN / NO TECHNICAL DETAILS) ─────── */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#111216] border border-[#27272A] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#27272A] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
                  <Github size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Connect GitHub Account</h3>
                  <p className="text-[11px] text-zinc-400">Authenticate to select your repositories</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Option: GitHub OAuth Sign-In */}
              {envConfig?.hasOAuth && (
                <button
                  type="button"
                  onClick={handleStartOAuth}
                  disabled={isSubmittingAuth}
                  className="w-full py-2.5 px-3 rounded-xl text-xs font-medium bg-white hover:bg-zinc-200 text-black transition-colors cursor-pointer flex items-center justify-center gap-2 font-medium disabled:opacity-50"
                >
                  <Github size={15} />
                  <span>Sign In with GitHub</span>
                </button>
              )}

              {/* Personal Access Token Input */}
              <form onSubmit={handleConnectPat} className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-medium text-zinc-300">Personal Access Token</label>
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=DevFlow%20Integration"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 underline underline-offset-2"
                    >
                      <span>Create Token</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                  <div className="relative">
                    <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="password"
                      value={patInput}
                      onChange={(e) => setPatInput(e.target.value)}
                      placeholder="ghp_••••••••••••••••••••••••••••••••••••"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors font-mono"
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 block leading-relaxed">
                    Requires <code className="text-zinc-400 font-mono">repo</code> scope. Token is encrypted server-side with AES-256-GCM.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingAuth || !patInput.trim()}
                  className="w-full py-2.5 px-3 rounded-xl text-xs font-medium text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  style={{ backgroundColor: accentColor }}
                >
                  {isSubmittingAuth ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  <span>Connect & View Repositories</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: SELECT REPOSITORY OF LOGGED-IN USER ────────────────── */}
      {isRepoPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#111216] border border-[#27272A] rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#27272A] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
                  <Github size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Select GitHub Repository</h3>
                  <p className="text-[11px] text-zinc-400">
                    Choose a repository to link and sync with this project
                    {githubConnection && (
                      <span className="text-zinc-300"> • Logged in as @{githubConnection.accountName}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {githubConnection && (
                  <button
                    type="button"
                    onClick={handleLogoutGitAccount}
                    disabled={isLoggingOut}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer disabled:opacity-50"
                    title={`Log out GitHub account @${githubConnection.accountName}`}
                  >
                    <LogOut size={12} className={isLoggingOut ? 'animate-spin' : ''} />
                    <span>Log Out</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsRepoPickerOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Search Filter */}
            <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/40 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  placeholder="Filter repositories by name..."
                  className="w-full pl-9 pr-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-colors font-mono"
                />
              </div>
            </div>

            {/* Sync Progress Banner if syncing */}
            {isSyncing && (
              <div className="p-4 bg-blue-500/10 border-b border-blue-500/20 flex items-center gap-3 shrink-0">
                <Loader2 size={16} className="animate-spin text-blue-400 shrink-0" />
                <div className="text-xs text-blue-300">
                  <span className="font-semibold text-white">Linking & Syncing {selectedRepo?.fullName}...</span>
                  <p className="text-[11px] text-zinc-400">Fetching branches, commits, issues, and pull requests from GitHub.</p>
                </div>
              </div>
            )}

            {/* Sync Summary Result Banner */}
            {syncResult && (
              <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 text-xs text-emerald-300">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>
                    <strong>Sync Complete:</strong> {syncResult.branchesCount || 0} branches, {syncResult.commitsCount || 0} commits, {syncResult.issuesCount || 0} issues, {syncResult.mrsCount || 0} pull requests.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRepoPickerOpen(false)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}

            {/* Repository List */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {isLoadingRepos ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-zinc-400">
                  <Loader2 size={20} className="animate-spin text-zinc-500" />
                  <span>Loading repositories from GitHub...</span>
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500">
                  {repoSearch ? 'No repositories match your filter' : 'No repositories found for this account'}
                </div>
              ) : (
                filteredRepos.map((repo) => {
                  const repoFullName = repo.fullName || repo.name;
                  const isCurrent = linkedRepo?.fullName.toLowerCase() === repoFullName.toLowerCase();
                  return (
                    <div
                      key={String(repo.providerRepoId || repo.id || repoFullName)}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-emerald-500/5 border-emerald-500/30'
                          : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-white font-mono truncate">
                            {repoFullName}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                              repo.isPrivate
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}
                          >
                            {repo.isPrivate ? <Lock size={9} /> : <Globe size={9} />}
                            {repo.isPrivate ? 'Private' : 'Public'}
                          </span>
                          {repo.defaultBranch && (
                            <span className="text-[10px] text-zinc-500 font-mono">
                              branch: {repo.defaultBranch}
                            </span>
                          )}
                        </div>
                        {repo.description && (
                          <p className="text-[11px] text-zinc-400 truncate max-w-md">
                            {repo.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium px-2 py-1 bg-emerald-500/10 rounded-lg">
                            <Check size={12} />
                            <span>Linked</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleLinkAndSyncRepository(repo)}
                            disabled={isSyncing}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isSyncing && selectedRepo?.fullName === repoFullName ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                <span>Syncing...</span>
                              </>
                            ) : (
                              <>
                                <GitBranch size={12} />
                                <span>Select & Sync</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#27272A] bg-zinc-950/60 flex items-center justify-between text-xs text-zinc-400 shrink-0">
              <span>{filteredRepos.length} repositories available</span>
              <button
                type="button"
                onClick={() => setIsRepoPickerOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
