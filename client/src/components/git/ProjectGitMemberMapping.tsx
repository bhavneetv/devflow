import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserCheck,
  UserPlus,
  GitCommit,
  GitBranch,
  Search,
  Plus,
  Trash2,
  X,
  Check,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Tag,
  AtSign,
  Mail,
  Loader2,
  ArrowRight,
  TrendingUp,
  FolderKanban,
} from 'lucide-react';
import { gitService } from '../../services/git.service';
import { useToast } from '../../context/ToastContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { cn } from '../../lib/utils';
import type { GitMemberMapping, DetectedGitAuthor, GitMemberMappingData } from '../../types/git';

interface ProjectGitMemberMappingProps {
  projectId: number;
}

export const ProjectGitMemberMapping: React.FC<ProjectGitMemberMappingProps> = ({ projectId }) => {
  const { toast } = useToast();
  const { accentColor } = useAccentTheme();

  const [data, setData] = useState<GitMemberMappingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'mapped' | 'unmapped'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [inputGitUsername, setInputGitUsername] = useState('');
  const [inputGitName, setInputGitName] = useState('');
  const [inputGitEmail, setInputGitEmail] = useState('');
  const [savingMapping, setSavingMapping] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchMappings = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const res = await gitService.getMemberMappings(projectId);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error('Failed to load member mappings', res.error);
      }
    } catch (err: any) {
      toast.error('Error fetching member mappings', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMappings();
  }, [projectId]);

  // Total commits across detected authors
  const totalRepoCommits = useMemo(() => {
    if (!data?.detectedAuthors) return 0;
    return data.detectedAuthors.reduce((acc, a) => acc + (a.commitCount || 0), 0);
  }, [data]);

  // Unmapped authors
  const unmappedAuthors = useMemo(() => {
    if (!data?.detectedAuthors) return [];
    return data.detectedAuthors.filter((a) => !a.mappedUserId);
  }, [data]);

  // Member groupings and mappings
  const membersWithMappings = useMemo(() => {
    if (!data?.members) return [];

    return data.members.map((member) => {
      const mappings = data.mappings.filter((m) => m.userId === member.id);
      const stats = data.memberStats?.[member.id] || { commitCount: 0, latestCommitDate: null };
      const isMapped = mappings.length > 0 || stats.commitCount > 0;

      return {
        ...member,
        mappings,
        stats,
        isMapped,
      };
    });
  }, [data]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return membersWithMappings.filter((m) => {
      // 1. Search filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.username && m.username.toLowerCase().includes(q)) ||
        m.mappings.some(
          (map) =>
            (map.gitUsername && map.gitUsername.toLowerCase().includes(q)) ||
            (map.gitName && map.gitName.toLowerCase().includes(q)) ||
            (map.gitEmail && map.gitEmail.toLowerCase().includes(q))
        );

      if (!matchesSearch) return false;

      // 2. Mode filter
      if (filterMode === 'mapped') return m.isMapped;
      if (filterMode === 'unmapped') return !m.isMapped;
      return true;
    });
  }, [membersWithMappings, searchQuery, filterMode]);

  // Open modal with quick author preset
  const openLinkModalForAuthor = (author: DetectedGitAuthor) => {
    const matchingMember = data?.members.find(
      (m) =>
        m.email.toLowerCase() === (author.email || '').toLowerCase() ||
        (m.username && m.username.toLowerCase() === (author.username || '').toLowerCase()) ||
        m.name.toLowerCase() === author.name.toLowerCase()
    );

    setSelectedUserId(matchingMember ? matchingMember.id : data?.members[0]?.id || null);
    setInputGitName(author.name || '');
    setInputGitUsername(author.username || '');
    setInputGitEmail(author.email || '');
    setIsModalOpen(true);
  };

  const openLinkModalForMember = (memberId: number) => {
    setSelectedUserId(memberId);
    setInputGitName('');
    setInputGitUsername('');
    setInputGitEmail('');
    setIsModalOpen(true);
  };

  const handleSaveMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.warning('Please select a DevFlow team member');
      return;
    }

    if (!inputGitUsername.trim() && !inputGitName.trim() && !inputGitEmail.trim()) {
      toast.warning('Please provide at least one Git identity (username, name, or email)');
      return;
    }

    try {
      setSavingMapping(true);
      const res = await gitService.saveMemberMapping(projectId, {
        userId: selectedUserId,
        gitUsername: inputGitUsername.trim() || undefined,
        gitName: inputGitName.trim() || undefined,
        gitEmail: inputGitEmail.trim() || undefined,
      });

      if (res.success) {
        toast.success('Git identity linked successfully');
        setIsModalOpen(false);
        fetchMappings(true);
      } else {
        toast.error('Failed to link Git identity', res.error);
      }
    } catch (err: any) {
      toast.error('Error saving mapping', err.message);
    } finally {
      setSavingMapping(false);
    }
  };

  const handleDeleteMapping = async (mappingId: number) => {
    try {
      setDeletingId(mappingId);
      const res = await gitService.deleteMemberMapping(projectId, mappingId);
      if (res.success) {
        toast.success('Git alias unlinked');
        fetchMappings(true);
      } else {
        toast.error('Failed to unlink Git alias', res.error);
      }
    } catch (err: any) {
      toast.error('Error deleting mapping', err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <Loader2 size={32} className="animate-spin text-zinc-500" style={{ color: accentColor }} />
        <span className="text-xs text-zinc-400 font-medium">Scanning Git commits and team identities...</span>
      </div>
    );
  }

  const mappedMembersCount = membersWithMappings.filter((m) => m.isMapped).length;
  const totalMembersCount = membersWithMappings.length;
  const totalAliasesCount = data?.mappings.length || 0;

  return (
    <div className="space-y-6">
      {/* ─── HEADER & ACTIONS ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#27272A]/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">Git Member Mapping</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Commit Attribution
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            Link DevFlow team members with their Git commit author identities (author names, emails, and usernames) so
            repository commits and team progress are accurately attributed.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => fetchMappings(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-[#111216] border border-[#27272A] hover:border-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh commit scan"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedUserId(data?.members[0]?.id || null);
              setInputGitName('');
              setInputGitUsername('');
              setInputGitEmail('');
              setIsModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition-all shadow-md hover:brightness-110 cursor-pointer"
            style={{ backgroundColor: accentColor }}
          >
            <Plus size={14} />
            <span>Link Git Identity</span>
          </button>
        </div>
      </div>

      {/* ─── METRICS CARDS ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Members */}
        <div className="p-4 rounded-2xl bg-[#0E0F14] border border-[#27272A] shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-400">Team Members</span>
            <Users size={15} className="text-zinc-500" />
          </div>
          <div className="text-2xl font-bold text-white mt-2 font-mono">{totalMembersCount}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Project collaborators</div>
        </div>

        {/* Mapped Members */}
        <div className="p-4 rounded-2xl bg-[#0E0F14] border border-[#27272A] shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-400">Mapped Members</span>
            <UserCheck size={15} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2 font-mono">
            {mappedMembersCount}
            <span className="text-xs font-normal text-zinc-500 ml-1">/ {totalMembersCount}</span>
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            {totalMembersCount > 0 ? Math.round((mappedMembersCount / totalMembersCount) * 100) : 0}% team coverage
          </div>
        </div>

        {/* Total Linked Aliases */}
        <div className="p-4 rounded-2xl bg-[#0E0F14] border border-[#27272A] shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-400">Linked Git Aliases</span>
            <Tag size={15} className="text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400 mt-2 font-mono">{totalAliasesCount}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Active identity mappings</div>
        </div>

        {/* Detected Authors */}
        <div className="p-4 rounded-2xl bg-[#0E0F14] border border-[#27272A] shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-400">Unmapped Authors</span>
            <AlertCircle size={15} className={unmappedAuthors.length > 0 ? 'text-amber-400' : 'text-zinc-500'} />
          </div>
          <div
            className={cn(
              'text-2xl font-bold mt-2 font-mono',
              unmappedAuthors.length > 0 ? 'text-amber-400' : 'text-zinc-400'
            )}
          >
            {unmappedAuthors.length}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Found in commit history</div>
        </div>
      </div>

      {/* ─── DETECTED UNMAPPED AUTHORS ALERT / BANNER ─── */}
      {unmappedAuthors.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
              <Sparkles size={14} className="shrink-0" />
              <span>Detected Unmapped Git Commit Authors ({unmappedAuthors.length})</span>
            </div>
            <span className="text-[10px] text-amber-300/70 font-mono">Auto-detected from repository log</span>
          </div>

          <p className="text-xs text-zinc-400">
            The connected repository contains commits from authors that are not yet linked to any DevFlow team member.
            Link them below so their commits and progress appear under their profile.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {unmappedAuthors.map((author) => (
              <div
                key={author.email || author.username || author.name}
                className="p-3 rounded-xl bg-[#0E0F14] border border-[#27272A] hover:border-amber-500/40 transition-colors flex items-center justify-between gap-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
                    {author.avatarUrl ? (
                      <img src={author.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      author.name.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{author.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono truncate">
                      {author.username ? `@${author.username}` : author.email}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {author.commitCount} {author.commitCount === 1 ? 'commit' : 'commits'}
                  </span>
                  <button
                    type="button"
                    onClick={() => openLinkModalForAuthor(author)}
                    className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium transition-colors cursor-pointer"
                    title="Link to DevFlow member"
                  >
                    <UserPlus size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── DIRECTORY FILTER BAR ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search member, email, or Git alias..."
            className="w-full pl-9 pr-3.5 py-2 bg-[#111216] border border-[#27272A] rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-[#111216] p-1 rounded-xl border border-[#27272A] self-start sm:self-auto">
          {(
            [
              { id: 'all', label: 'All Members' },
              { id: 'mapped', label: 'Mapped' },
              { id: 'unmapped', label: 'Unmapped' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilterMode(t.id)}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                filterMode === t.id ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── MEMBERS LIST ─── */}
      <div className="space-y-3">
        {filteredMembers.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-[#27272A] bg-[#0E0F14] text-zinc-500 space-y-2">
            <Users size={28} className="mx-auto text-zinc-600" />
            <div className="text-xs font-semibold text-zinc-400">No members match your criteria</div>
            <div className="text-[11px] text-zinc-500">Try adjusting your search query or filter</div>
          </div>
        ) : (
          filteredMembers.map((member) => {
            const commitCount = member.stats?.commitCount || 0;
            const percentOfTotal = totalRepoCommits > 0 ? Math.round((commitCount / totalRepoCommits) * 100) : 0;

            return (
              <div
                key={member.id}
                className="p-4 rounded-2xl bg-[#0E0F14] border border-[#27272A] hover:border-zinc-700 transition-colors space-y-3"
              >
                {/* Top Row: DevFlow User Details & Stats */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden shadow-sm"
                      style={{ backgroundColor: member.avatarColor || accentColor }}
                    >
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        member.name.slice(0, 2).toUpperCase()
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">{member.name}</span>
                        {member.role && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
                            {member.role}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 truncate flex items-center gap-2 mt-0.5">
                        <span>{member.email}</span>
                        {member.username && (
                          <>
                            <span className="text-zinc-600">•</span>
                            <span className="text-zinc-500 font-mono">@{member.username}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Commit Activity Badge */}
                  <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 justify-end text-xs font-semibold text-white font-mono">
                        <GitCommit size={13} className="text-cyan-400" />
                        <span>{commitCount} commits</span>
                        {totalRepoCommits > 0 && commitCount > 0 && (
                          <span className="text-[10px] text-zinc-500 font-normal">({percentOfTotal}%)</span>
                        )}
                      </div>
                      {member.stats?.latestCommitDate && (
                        <div className="text-[10px] text-zinc-500">
                          Last active: {new Date(member.stats.latestCommitDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => openLinkModalForMember(member.id)}
                      className="px-2.5 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>Add Alias</span>
                    </button>
                  </div>
                </div>

                {/* Bottom Row: Linked Git Aliases */}
                <div className="pt-2 border-t border-[#27272A]/60 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-zinc-500 font-medium mr-1">Linked Git Identities:</span>

                  {member.mappings.length === 0 ? (
                    <span className="text-[11px] text-zinc-600 italic">
                      No explicit aliases. Direct match on email/username applies if identical.
                    </span>
                  ) : (
                    member.mappings.map((mapping) => (
                      <div
                        key={mapping.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#151620] border border-cyan-500/20 text-xs text-zinc-200 group/tag"
                      >
                        {mapping.gitUsername && (
                          <span className="flex items-center gap-1 text-cyan-300 font-mono">
                            <AtSign size={10} className="text-cyan-400" />
                            <span>{mapping.gitUsername}</span>
                          </span>
                        )}
                        {mapping.gitName && (
                          <span className="flex items-center gap-1 text-zinc-300">
                            <span className="text-[10px] text-zinc-500">name:</span>
                            <span>{mapping.gitName}</span>
                          </span>
                        )}
                        {mapping.gitEmail && (
                          <span className="flex items-center gap-1 text-zinc-400 font-mono text-[11px]">
                            <Mail size={10} className="text-zinc-500" />
                            <span>{mapping.gitEmail}</span>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteMapping(mapping.id)}
                          disabled={deletingId === mapping.id}
                          className="ml-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer p-0.5"
                          title="Unlink this Git alias"
                        >
                          {deletingId === mapping.id ? (
                            <Loader2 size={11} className="animate-spin text-zinc-400" />
                          ) : (
                            <X size={11} />
                          )}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ─── MODAL: LINK GIT IDENTITY ─── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md rounded-2xl bg-[#111216] border border-[#27272A] shadow-2xl overflow-hidden"
            >
              <div className="p-5 border-b border-[#27272A] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus size={16} style={{ color: accentColor }} />
                  <h3 className="text-sm font-bold text-white">Link Git Identity to Member</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-zinc-500 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveMapping} className="p-5 space-y-4">
                {/* Member Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    DevFlow Team Member <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={selectedUserId || ''}
                    onChange={(e) => setSelectedUserId(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 bg-[#17181D] border border-[#27272A] rounded-xl text-xs text-white outline-none focus:border-zinc-500 cursor-pointer"
                    required
                  >
                    {data?.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pre-fill suggestion picker from detected authors */}
                {unmappedAuthors.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-medium text-zinc-400">
                      Quick fill from detected commit authors:
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-[#17181D] rounded-xl border border-[#27272A]/70">
                      {unmappedAuthors.map((author) => (
                        <button
                          key={author.email || author.username || author.name}
                          type="button"
                          onClick={() => {
                            setInputGitName(author.name || '');
                            setInputGitUsername(author.username || '');
                            setInputGitEmail(author.email || '');
                          }}
                          className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200 border border-zinc-700 transition-colors cursor-pointer"
                        >
                          {author.name} {author.username ? `(@${author.username})` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Git Username */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Git / GitHub Username <span className="text-zinc-500">(e.g. bhavneetv, aaa)</span>
                  </label>
                  <div className="relative">
                    <AtSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      value={inputGitUsername}
                      onChange={(e) => setInputGitUsername(e.target.value)}
                      placeholder="github-handle"
                      className="w-full pl-8 pr-3 py-2 bg-[#17181D] border border-[#27272A] rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500 font-mono"
                    />
                  </div>
                </div>

                {/* Git Author Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Git Author Name <span className="text-zinc-500">(from git config user.name)</span>
                  </label>
                  <input
                    type="text"
                    value={inputGitName}
                    onChange={(e) => setInputGitName(e.target.value)}
                    placeholder="e.g. aaa or Bhavneet Verma"
                    className="w-full px-3 py-2 bg-[#17181D] border border-[#27272A] rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
                  />
                </div>

                {/* Git Author Email */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Git Author Email <span className="text-zinc-500">(from git config user.email)</span>
                  </label>
                  <div className="relative">
                    <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="email"
                      value={inputGitEmail}
                      onChange={(e) => setInputGitEmail(e.target.value)}
                      placeholder="developer@example.com"
                      className="w-full pl-8 pr-3 py-2 bg-[#17181D] border border-[#27272A] rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500 font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#27272A]">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingMapping}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 shadow-md hover:brightness-110 transition-all cursor-pointer"
                    style={{ backgroundColor: accentColor }}
                  >
                    {savingMapping ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    <span>Save Link</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
