import React, { useState, useEffect } from 'react';
import {
  GitFork,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  GitBranch,
  GitCommit,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Globe,
  Loader2,
  X,
  Search,
} from 'lucide-react';
import { gitService } from '../../services/git.service';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';
import type {
  GitRepositoryConnectionItem,
  GitProviderConnectionItem,
} from '../../types/git';

export interface GitRepositoryListProps {
  projectId: number;
}

export const GitRepositoryList: React.FC<GitRepositoryListProps> = ({ projectId }) => {
  const { toast } = useToast();
  const [repositories, setRepositories] = useState<GitRepositoryConnectionItem[]>([]);
  const [connections, setConnections] = useState<GitProviderConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [syncingRepoId, setSyncingRepoId] = useState<number | null>(null);

  // Connect Modal state
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);
  const [availableRepos, setAvailableRepos] = useState<any[]>([]);
  const [loadingAvailableRepos, setLoadingAvailableRepos] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Add Account / PAT state
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [providerType, setProviderType] = useState<'github' | 'gitlab'>('github');
  const [personalToken, setPersonalToken] = useState('');
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  // Drilldown Branch / Commits modal
  const [inspectingRepo, setInspectingRepo] = useState<GitRepositoryConnectionItem | null>(null);
  const [inspectTab, setInspectTab] = useState<'branches' | 'commits'>('branches');
  const [branches, setBranches] = useState<any[]>([]);
  const [commits, setCommits] = useState<any[]>([]);
  const [loadingInspect, setLoadingInspect] = useState(false);

  // Disconnect confirmation modal
  const [disconnectingRepo, setDisconnectingRepo] = useState<GitRepositoryConnectionItem | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [repoRes, connRes] = await Promise.all([
        gitService.getRepositories(projectId),
        gitService.getConnections(projectId),
      ]);
      if (repoRes.success && repoRes.data) setRepositories(repoRes.data);
      if (connRes.success && connRes.data) {
        setConnections(connRes.data);
        if (connRes.data.length > 0 && !selectedConnectionId) {
          setSelectedConnectionId(connRes.data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  // Fetch available repos when connection is selected in connect modal
  useEffect(() => {
    if (!isConnectModalOpen || !selectedConnectionId) return;

    let isMounted = true;
    const fetchAvailable = async () => {
      setLoadingAvailableRepos(true);
      try {
        const res = await gitService.getProviderRepos(projectId, selectedConnectionId);
        if (isMounted && res.success && res.data) {
          setAvailableRepos(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoadingAvailableRepos(false);
      }
    };
    fetchAvailable();
    return () => {
      isMounted = false;
    };
  }, [isConnectModalOpen, selectedConnectionId, projectId]);

  // Fetch branches/commits when inspecting a repo
  useEffect(() => {
    if (!inspectingRepo) return;

    let isMounted = true;
    const fetchInspectData = async () => {
      setLoadingInspect(true);
      try {
        if (inspectTab === 'branches') {
          const res = await gitService.getBranches(projectId, inspectingRepo.id);
          if (isMounted && res.success && res.data) setBranches(res.data);
        } else {
          const res = await gitService.getCommits(projectId, inspectingRepo.id);
          if (isMounted && res.success && res.data) setCommits(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoadingInspect(false);
      }
    };

    fetchInspectData();
    return () => {
      isMounted = false;
    };
  }, [inspectingRepo, inspectTab, projectId]);

  // Handle Sync
  const handleSync = async (repoId: number) => {
    try {
      setSyncingRepoId(repoId);
      const res = await gitService.syncRepository(projectId, repoId);
      if (res.success) {
        toast.success('Repository synchronized successfully');
        await loadData();
      } else {
        toast.error(res.error || 'Failed to sync repository');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error during sync');
    } finally {
      setSyncingRepoId(null);
    }
  };

  // Handle Disconnect
  const handleConfirmDisconnect = async () => {
    if (!disconnectingRepo) return;
    try {
      setIsDisconnecting(true);
      const res = await gitService.disconnectRepository(projectId, disconnectingRepo.id);
      if (res.success) {
        setRepositories((prev) => prev.filter((r) => r.id !== disconnectingRepo.id));
        toast.info(`Disconnected ${disconnectingRepo.name}`);
        setDisconnectingRepo(null);
      } else {
        toast.error(res.error || 'Failed to disconnect repository');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error disconnecting repository');
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Handle Add Account Token
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalToken.trim()) return;

    try {
      setIsAddingAccount(true);
      const res = await gitService.addConnection(projectId, {
        provider: providerType,
        token: personalToken.trim(),
        authType: 'pat',
      });

      if (res.success && res.data) {
        toast.success(`Connected ${res.data.accountName} (${providerType})`);
        setConnections((prev) => [...prev, res.data!]);
        setSelectedConnectionId(res.data.id);
        setIsAddAccountOpen(false);
        setPersonalToken('');
      } else {
        toast.error(res.error || 'Invalid personal access token');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error connecting account');
    } finally {
      setIsAddingAccount(false);
    }
  };

  // Handle Authorize Repo
  const handleAuthorizeRepo = async (provRepo: any) => {
    if (!selectedConnectionId) return;
    try {
      setIsConnecting(true);
      const res = await gitService.connectRepository(projectId, {
        connectionId: selectedConnectionId,
        providerRepoId: provRepo.id,
        name: provRepo.name,
        fullName: provRepo.fullName,
        owner: provRepo.fullName.split('/')[0] || 'owner',
        defaultBranch: provRepo.defaultBranch || 'main',
        isPrivate: provRepo.isPrivate,
        webUrl: provRepo.webUrl,
      });

      if (res.success && res.data) {
        toast.success(`Repository ${res.data.name} connected!`);
        setRepositories((prev) => [...prev, res.data!]);
        setIsConnectModalOpen(false);
      } else {
        toast.error(res.error || 'Failed to authorize repository');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error connecting repository');
    } finally {
      setIsConnecting(false);
    }
  };

  const filteredRepositories = repositories.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.fullName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-[#27272A] bg-[#0E0F15]">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="relative min-w-[200px] sm:min-w-[280px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter repositories..."
              className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-[#14151D] border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>
          <span className="text-xs text-zinc-500 hidden sm:inline">
            {repositories.length} repository{repositories.length === 1 ? '' : 'ies'} authorized
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsAddAccountOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors shadow-xs cursor-pointer"
          >
            Link Account
          </button>
          <button
            type="button"
            onClick={() => setIsConnectModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={13} />
            <span>Connect Repository</span>
          </button>
        </div>
      </div>

      {/* Repositories Grid / List */}
      {loading ? (
        <div className="p-16 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
          <Loader2 size={20} className="animate-spin text-zinc-400" />
          <span>Loading authorized repositories...</span>
        </div>
      ) : filteredRepositories.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-[#27272A] bg-[#0E0F15] text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
            <GitFork size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white">No Repositories Connected</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Link your GitHub or GitLab account and authorize repositories to track commits, branches, issues, and pull requests.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsConnectModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={13} />
            <span>Connect First Repository</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRepositories.map((repo) => (
            <div
              key={repo.id}
              className="p-4 rounded-xl border border-[#27272A] bg-[#0E0F15] hover:border-zinc-700 transition-all space-y-3.5 group shadow-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-300 shrink-0">
                    <GitFork size={17} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-indigo-400 transition-colors">
                        {repo.name}
                      </h4>
                      {repo.isPrivate ? (
                        <span title="Private" className="shrink-0">
                          <Lock size={11} className="text-amber-400" />
                        </span>
                      ) : (
                        <span title="Public" className="shrink-0">
                          <Globe size={11} className="text-zinc-500" />
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-500 font-mono truncate block">
                      {repo.fullName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <a
                    href={repo.webUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 text-zinc-500 hover:text-white transition-colors rounded"
                    title="Open in provider"
                  >
                    <ExternalLink size={13} />
                  </a>
                  <button
                    type="button"
                    onClick={() => setDisconnectingRepo(repo)}
                    className="p-1 text-zinc-500 hover:text-red-400 transition-colors rounded cursor-pointer"
                    title="Disconnect"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Status and Default Branch */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-800/60">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 font-mono text-[11px] text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">
                    <GitBranch size={11} className="text-indigo-400" />
                    <span>{repo.defaultBranch}</span>
                  </span>

                  <span
                    className={cn(
                      'flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border',
                      repo.syncStatus === 'healthy'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    )}
                  >
                    <CheckCircle2 size={10} />
                    <span className="capitalize">{repo.syncStatus}</span>
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setInspectingRepo(repo);
                      setInspectTab('branches');
                    }}
                    className="px-2 py-1 text-[11px] text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    Inspect
                  </button>
                  <button
                    type="button"
                    disabled={syncingRepoId === repo.id}
                    onClick={() => handleSync(repo.id)}
                    className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                    title="Sync now"
                  >
                    <RefreshCw size={12} className={cn(syncingRepoId === repo.id && 'animate-spin text-indigo-400')} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL 1: Connect Repository */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl border border-[#27272A] bg-[#121319] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 px-5 border-b border-[#27272A] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <GitFork size={15} className="text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">Authorize Repository</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0 scrollbar-thin scrollbar-thumb-zinc-700">
              {connections.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <p className="text-xs text-zinc-400">
                    No Git provider accounts connected. Link your GitHub or GitLab token first.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsConnectModalOpen(false);
                      setIsAddAccountOpen(true);
                    }}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                  >
                    Link Git Account Now
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">Provider Account</label>
                    <select
                      value={selectedConnectionId || ''}
                      onChange={(e) => setSelectedConnectionId(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-[#0E0F14] border border-zinc-800 rounded-lg text-white"
                    >
                      {connections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.accountName} ({c.provider.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-300">Available Repositories</label>
                    {loadingAvailableRepos ? (
                      <div className="p-8 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin text-zinc-400" />
                        <span>Fetching repositories from provider...</span>
                      </div>
                    ) : availableRepos.length === 0 ? (
                      <div className="p-6 text-center text-xs text-zinc-500 border border-zinc-800 rounded-xl">
                        No repositories found under this account.
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl bg-[#0E0F14] max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
                        {availableRepos.map((provRepo) => {
                          const alreadyConnected = repositories.some(
                            (r) => r.fullName.toLowerCase() === provRepo.fullName.toLowerCase()
                          );
                          return (
                            <div
                              key={provRepo.id}
                              className="p-3 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0">
                                <span className="font-semibold text-zinc-200 block truncate">
                                  {provRepo.fullName}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  Branch: {provRepo.defaultBranch || 'main'} • {provRepo.isPrivate ? 'Private' : 'Public'}
                                </span>
                              </div>

                              <button
                                type="button"
                                disabled={alreadyConnected || isConnecting}
                                onClick={() => handleAuthorizeRepo(provRepo)}
                                className={cn(
                                  'px-3 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer',
                                  alreadyConnected
                                    ? 'bg-zinc-800 text-zinc-500 cursor-default'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                                )}
                              >
                                {alreadyConnected ? 'Connected' : 'Authorize'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Link Account (PAT) */}
      {isAddAccountOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-[#27272A] bg-[#121319] shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-semibold text-white">Link Git Account</h3>
              <button
                type="button"
                onClick={() => setIsAddAccountOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Provider</label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#0E0F14] border border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setProviderType('github')}
                    className={cn(
                      'py-2 rounded-lg font-medium transition-all cursor-pointer',
                      providerType === 'github'
                        ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    GitHub
                  </button>
                  <button
                    type="button"
                    onClick={() => setProviderType('gitlab')}
                    className={cn(
                      'py-2 rounded-lg font-medium transition-all cursor-pointer',
                      providerType === 'gitlab'
                        ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    GitLab
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">
                  Personal Access Token (PAT)
                </label>
                <input
                  type="password"
                  required
                  value={personalToken}
                  onChange={(e) => setPersonalToken(e.target.value)}
                  placeholder={providerType === 'github' ? 'ghp_...' : 'glpat-...'}
                  className="w-full px-3 py-2 text-xs bg-[#0E0F14] border border-zinc-800 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Requires <code>repo</code> & <code>read:user</code> scopes on GitHub, or <code>api</code> on GitLab. Tokens are encrypted server-side with AES-256-GCM.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddAccountOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingAccount || !personalToken.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isAddingAccount ? 'Verifying...' : 'Authenticate & Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Inspect Repo (Branches / Commits) */}
      {inspectingRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-[#27272A] bg-[#121319] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 px-5 border-b border-[#27272A] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <GitFork size={15} className="text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">{inspectingRepo.fullName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingRepo(null)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Sub-nav */}
            <div className="p-3 px-5 border-b border-[#27272A] bg-[#0E0F14] flex items-center gap-3">
              <button
                type="button"
                onClick={() => setInspectTab('branches')}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                  inspectTab === 'branches' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-white'
                )}
              >
                <GitBranch size={12} />
                <span>Branches</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectTab('commits')}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                  inspectTab === 'commits' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-white'
                )}
              >
                <GitCommit size={12} />
                <span>Recent Commits</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 min-h-0 scrollbar-thin scrollbar-thumb-zinc-700">
              {loadingInspect ? (
                <div className="p-12 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin text-zinc-400" />
                  <span>Loading {inspectTab}...</span>
                </div>
              ) : inspectTab === 'branches' ? (
                <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl bg-[#0E0F14]">
                  {branches.map((b, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <GitBranch size={13} className="text-indigo-400" />
                        <span className="font-mono text-zinc-200">{b.name}</span>
                        {b.isDefault && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-800 text-zinc-400">
                            default
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {b.commitSha.slice(0, 7)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl bg-[#0E0F14]">
                  {commits.map((c, idx) => (
                    <div key={idx} className="p-3 flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="font-mono text-[11px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded mr-1.5">
                          {c.sha.slice(0, 7)}
                        </span>
                        <span className="font-medium text-zinc-200">{c.message}</span>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          by {c.authorName} on {new Date(c.committedDate).toLocaleDateString()}
                        </div>
                      </div>
                      {c.webUrl && (
                        <a
                          href={c.webUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-zinc-500 hover:text-white p-1"
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Disconnect Confirmation */}
      {disconnectingRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#121319] shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <Trash2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Disconnect Repository</h3>
                <p className="text-xs text-zinc-400">Unlink "{disconnectingRepo.name}" from this project?</p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Disconnecting will unauthorize this repository from DevFlow. Your repository and files on the Git provider will remain completely unaffected.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDisconnectingRepo(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDisconnecting}
                onClick={handleConfirmDisconnect}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

