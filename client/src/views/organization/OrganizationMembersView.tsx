import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Shield,
  Trash2,
  Mail,
  ChevronDown,
  Check,
  X,
  AlertCircle,
  Clock,
  Send,
  RefreshCw,
  MoreVertical,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { useOrganization } from '../../context/OrganizationContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { useToast } from '../../context/ToastContext';
import { organizationService } from '../../services/organization.service';
import type {
  OrganizationMember,
  OrganizationInvitation,
  OrganizationRole,
} from '../../types/organization';

const ROLES: { value: OrganizationRole; label: string; desc: string }[] = [
  { value: 'OWNER', label: 'Owner', desc: 'Full control over billing, settings, and deletion' },
  { value: 'ADMIN', label: 'Admin', desc: 'Can manage members, teams, and projects' },
  { value: 'MEMBER', label: 'Member', desc: 'Can view and collaborate across workspaces' },
  { value: 'VIEWER', label: 'Viewer', desc: 'Read-only access to organization resources' },
];

export const OrganizationMembersView: React.FC = () => {
  const { organizationSlug } = useParams<{ organizationSlug: string }>();
  const { currentOrganization, isAdminOrOwner, isOwner } = useOrganization();
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();

  const targetSlug = organizationSlug || currentOrganization?.slug;

  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Tab switch: 'members' | 'invitations'
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');

  // Invite modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<OrganizationRole>('MEMBER');
  const [isSendingInvite, setIsSendingInvite] = useState<boolean>(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Remove confirmation modal
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(null);
  const [isRemoving, setIsRemoving] = useState<boolean>(false);

  // Active role dropdown state
  const [activeRoleDropdown, setActiveRoleDropdown] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!targetSlug) return;
    setIsLoading(true);
    try {
      const [membersRes, invitesRes] = await Promise.all([
        organizationService.listMembers(targetSlug),
        organizationService.listInvitations(targetSlug),
      ]);

      if (membersRes.success && membersRes.data) {
        setMembers(membersRes.data);
      }
      if (invitesRes.success && invitesRes.data) {
        setInvitations(invitesRes.data);
      }
    } catch (err) {
      console.error('Error fetching members data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [targetSlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Role Change
  const handleChangeRole = async (memberId: number, newRole: OrganizationRole) => {
    if (!targetSlug) return;
    setActiveRoleDropdown(null);
    try {
      const res = await organizationService.changeMemberRole(targetSlug, memberId, newRole);
      if (res.success) {
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
        );
        toast.success('Role updated', `Member role changed to ${newRole}`);
      } else {
        toast.error('Update failed', res.error || 'Could not change member role');
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    }
  };

  // Handle Member Removal
  const handleConfirmRemove = async () => {
    if (!targetSlug || !memberToRemove) return;
    setIsRemoving(true);
    try {
      const res = await organizationService.removeMember(targetSlug, memberToRemove.id);
      if (res.success) {
        setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id));
        toast.success('Member removed', `${memberToRemove.user.name} has been removed.`);
        setMemberToRemove(null);
      } else {
        toast.error('Remove failed', res.error || 'Could not remove member');
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsRemoving(false);
    }
  };

  // Handle Send Invite
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSlug) return;
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      setInviteError('Please enter a valid email address');
      return;
    }

    setIsSendingInvite(true);
    setInviteError(null);
    try {
      const res = await organizationService.sendInvitation(targetSlug, inviteEmail.trim(), inviteRole);
      if (res.success && res.data) {
        setInvitations((prev) => [res.data!, ...prev]);
        toast.success('Invitation sent', `Invited ${inviteEmail} as ${inviteRole}`);
        setInviteEmail('');
        setIsInviteModalOpen(false);
      } else {
        setInviteError(res.error || 'Failed to send invitation');
      }
    } catch (err: any) {
      setInviteError(err.message || 'Error sending invitation');
    } finally {
      setIsSendingInvite(false);
    }
  };

  // Handle Cancel Invite
  const handleCancelInvite = async (invitationId: number, email: string) => {
    if (!targetSlug) return;
    try {
      const res = await organizationService.cancelInvitation(targetSlug, invitationId);
      if (res.success) {
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
        toast.success('Invitation cancelled', `Revoked invitation for ${email}`);
      } else {
        toast.error('Failed to cancel', res.error);
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    }
  };

  // Filtered members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        m.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.user.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || m.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [members, searchQuery, roleFilter]);

  // Filtered invitations
  const filteredInvitations = useMemo(() => {
    return invitations.filter((inv) =>
      inv.invitedEmail.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [invitations, searchQuery]);

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* ─── Breadcrumbs & Header ────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>Organizations</span>
          <ChevronRight size={13} className="text-zinc-600" />
          <Link
            to={`/organizations/${targetSlug}/overview`}
            className="text-zinc-300 hover:text-white transition-colors"
          >
            {currentOrganization?.name || 'Organization'}
          </Link>
          <ChevronRight size={13} className="text-zinc-600" />
          <span className="text-zinc-400">Members</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#27272A]">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Users size={22} className="text-zinc-400" />
              <span>Members & Permissions</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Manage organization memberships, seat allocations, and administrative roles.
            </p>
          </div>

          {isAdminOrOwner && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white shadow-md transition-opacity hover:opacity-95 self-start sm:self-auto cursor-pointer"
              style={{ backgroundColor: accentColor }}
            >
              <UserPlus size={15} />
              <span>Invite Members</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Tabs & Filters ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-[#171A21] border border-[#27272A] w-fit">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'members'
                ? 'bg-[#27272A] text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'invitations'
                ? 'bg-[#27272A] text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Pending Invites ({invitations.length})
          </button>
        </div>

        {/* Search & Role Filter */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full sm:w-64 h-9 pl-8 pr-3 rounded-lg bg-[#171A21] border border-[#27272A] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {activeTab === 'members' && (
            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-9 px-3 rounded-lg bg-[#171A21] border border-[#27272A] text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 cursor-pointer appearance-none pr-8"
              >
                <option value="ALL">All Roles</option>
                <option value="OWNER">Owner</option>
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
              </select>
              <Filter size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* ─── Members Table Tab ────────────────────────────────────────────── */}
      {activeTab === 'members' && (
        <div className="rounded-2xl border border-[#27272A] bg-[#171A21] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#27272A] bg-[#0E0E10]/50 text-zinc-400 uppercase tracking-wider font-mono text-[10.5px]">
                  <th className="py-3 px-4 font-semibold">User</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold">Joined Date</th>
                  {isAdminOrOwner && <th className="py-3 px-4 font-semibold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A]/70">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-zinc-500">
                      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2" style={{ borderColor: `${accentColor} transparent ${accentColor} ${accentColor}` }} />
                      Loading members...
                    </td>
                  </tr>
                ) : filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-zinc-500">
                      No members match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => {
                    const isMemberOwner = member.role === 'OWNER';
                    return (
                      <tr key={member.id} className="hover:bg-white/[0.02] transition-colors">
                        {/* User Column */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            {member.user.avatarUrl ? (
                              <img
                                src={member.user.avatarUrl}
                                alt={member.user.name}
                                className="w-8 h-8 rounded-full object-cover border border-zinc-700"
                              />
                            ) : (
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
                                style={{ backgroundColor: member.user.avatarColor || accentColor }}
                              >
                                {member.user.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-white flex items-center gap-1.5">
                                <span>{member.user.name}</span>
                                {isMemberOwner && (
                                  <span title="Organization Owner">
                                    <Shield size={12} className="text-amber-400" />
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-zinc-500 font-mono">
                                {member.user.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role Column */}
                        <td className="py-3.5 px-4">
                          {isAdminOrOwner && !isMemberOwner ? (
                            <div className="relative inline-block text-left">
                              <button
                                onClick={() =>
                                  setActiveRoleDropdown(
                                    activeRoleDropdown === member.id ? null : member.id
                                  )
                                }
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0E0E10] border border-[#27272A] text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer text-xs font-mono uppercase tracking-wider"
                              >
                                <span>{member.role}</span>
                                <ChevronDown size={11} className="text-zinc-500" />
                              </button>

                              {activeRoleDropdown === member.id && (
                                <div className="absolute left-0 mt-1 w-44 rounded-xl bg-[#141519] border border-[#27272A] shadow-2xl py-1 z-20 animate-in fade-in zoom-in-95 duration-100">
                                  {ROLES.filter((r) => r.value !== 'OWNER').map((r) => (
                                    <button
                                      key={r.value}
                                      onClick={() => handleChangeRole(member.id, r.value)}
                                      className="w-full flex items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-white/[0.05] text-zinc-300 hover:text-white transition-colors cursor-pointer"
                                    >
                                      <span>{r.label}</span>
                                      {member.role === r.value && (
                                        <Check size={12} style={{ color: accentColor }} />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span
                              className={`px-2 py-0.5 rounded text-[10.5px] font-mono uppercase tracking-wider border font-medium ${
                                isMemberOwner
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                              }`}
                            >
                              {member.role}
                            </span>
                          )}
                        </td>

                        {/* Joined Date Column */}
                        <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                          {formatDate(member.joinedAt)}
                        </td>

                        {/* Actions Column */}
                        {isAdminOrOwner && (
                          <td className="py-3.5 px-4 text-right">
                            {!isMemberOwner ? (
                              <button
                                onClick={() => setMemberToRemove(member)}
                                className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                title="Remove member"
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : (
                              <span className="text-[10px] text-zinc-600 font-mono">Owner</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Pending Invitations Tab ─────────────────────────────────────── */}
      {activeTab === 'invitations' && (
        <div className="rounded-2xl border border-[#27272A] bg-[#171A21] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#27272A] bg-[#0E0E10]/50 text-zinc-400 uppercase tracking-wider font-mono text-[10.5px]">
                  <th className="py-3 px-4 font-semibold">Invited Email</th>
                  <th className="py-3 px-4 font-semibold">Assigned Role</th>
                  <th className="py-3 px-4 font-semibold">Sent Date</th>
                  <th className="py-3 px-4 font-semibold">Expires</th>
                  {isAdminOrOwner && <th className="py-3 px-4 font-semibold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A]/70">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-500">
                      Loading invitations...
                    </td>
                  </tr>
                ) : filteredInvitations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-500">
                      No pending invitations.
                    </td>
                  </tr>
                ) : (
                  filteredInvitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 text-white font-medium">
                          <Mail size={14} className="text-zinc-500" />
                          <span>{inv.invitedEmail}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10.5px] font-mono uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium">
                          {inv.assignedRole}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                        {formatDate(inv.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                        {formatDate(inv.expiresAt)}
                      </td>
                      {isAdminOrOwner && (
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleCancelInvite(inv.id, inv.invitedEmail)}
                            className="px-2.5 py-1 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors font-medium cursor-pointer"
                          >
                            Revoke
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Send Invitation Modal ────────────────────────────────────────── */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#171A21] border border-[#27272A] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  <UserPlus size={16} />
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Invite Member
                </h3>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-white/[0.05]"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="collaborator@company.com"
                  className="w-full h-10 px-3 rounded-xl bg-[#0D0F14] border border-[#27272A] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono mb-1.5">
                  Organization Role
                </label>
                <div className="space-y-2">
                  {ROLES.filter((r) => r.value !== 'OWNER').map((r) => (
                    <label
                      key={r.value}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        inviteRole === r.value
                          ? 'bg-[#1C2029] border-zinc-500 shadow-sm'
                          : 'bg-[#0D0F14] border-[#27272A] hover:border-zinc-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="inviteRole"
                        value={r.value}
                        checked={inviteRole === r.value}
                        onChange={() => setInviteRole(r.value)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-xs font-semibold text-white">{r.label}</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">{r.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {inviteError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{inviteError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingInvite}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-50"
                  style={{ backgroundColor: accentColor }}
                >
                  {isSendingInvite ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send size={13} />
                  )}
                  <span>Send Invitation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Remove Member Confirmation Modal ────────────────────────────── */}
      {memberToRemove && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#171A21] border border-red-500/30 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto border border-red-500/20">
              <ShieldAlert size={22} />
            </div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Remove Member?
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Are you sure you want to remove <strong className="text-white">{memberToRemove.user.name}</strong> from this organization? They will lose access to all teams, projects, and internal notes.
            </p>

            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                onClick={() => setMemberToRemove(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                disabled={isRemoving}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors shadow-md disabled:opacity-50"
              >
                {isRemoving ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
