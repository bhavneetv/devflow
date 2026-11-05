import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Users, UserPlus, Search, Clock, CheckCircle2, Crown,
  MoreHorizontal, Shield, Trash2, RefreshCw, X, ChevronDown,
  Copy, Check, AlertCircle, Loader2, Mail, Building2, Plus,
  Filter, UserMinus, Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { teamService } from '../services/team.service';
import type { Team, TeamMember, TeamInvitation, TeamMemberRole } from '../types/team';
import { ROLE_LABELS, ROLE_COLORS, ASSIGNABLE_ROLES } from '../types/team';

// ─── Utility helpers ─────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getAvatarBg(str: string): string {
  const colors = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#BE185D', '#0891B2', '#6D28D9'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Avatar: React.FC<{ name: string; avatarUrl?: string | null; size?: number; muted?: boolean }> = ({
  name, avatarUrl, size = 32, muted = false
}) => {
  const bg = getAvatarBg(name);
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 overflow-hidden font-semibold text-white"
      style={{
        width: size, height: size,
        backgroundColor: avatarUrl ? 'transparent' : bg,
        fontSize: size * 0.33,
        opacity: muted ? 0.5 : 1,
      }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </div>
  );
};

const RoleBadge: React.FC<{ role: TeamMemberRole; small?: boolean }> = ({ role, small = false }) => {
  const colors = ROLE_COLORS[role];
  return (
    <span
      className={`inline-flex items-center font-medium rounded-md whitespace-nowrap ${small ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'}`}
      style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
    >
      {role === 'OWNER' && <Crown size={small ? 9 : 10} className="mr-1" />}
      {role === 'ADMIN' && <Shield size={small ? 9 : 10} className="mr-1" />}
      {ROLE_LABELS[role]}
    </span>
  );
};

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; accent?: string }> = ({
  label, value, icon, accent = '#8B5CF6'
}) => (
  <div className="bg-[#0E0E10] border border-[#27272A] rounded-xl p-4 flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}18` }}>
      <div style={{ color: accent }}>{icon}</div>
    </div>
    <div>
      <p className="text-[22px] font-bold text-white leading-none">{value}</p>
      <p className="text-[11px] text-zinc-400 mt-0.5">{label}</p>
    </div>
  </div>
);

// Skeleton loader
const SkeletonRow: React.FC = () => (
  <div className="flex items-center gap-3 p-3.5 animate-pulse">
    <div className="w-8 h-8 rounded-full bg-zinc-800" />
    <div className="flex-1 space-y-1.5">
      <div className="h-3 bg-zinc-800 rounded w-32" />
      <div className="h-2.5 bg-zinc-800 rounded w-48" />
    </div>
    <div className="h-5 bg-zinc-800 rounded w-24" />
    <div className="h-5 bg-zinc-800 rounded w-16" />
    <div className="w-7 h-7 rounded bg-zinc-800" />
  </div>
);

// ─── Create Team Modal ─────────────────────────────────────────────────────────
const TEAM_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#6366F1'];

const CreateTeamModal: React.FC<{
  onClose: () => void;
  onCreated: (team: any) => void;
}> = ({ onClose, onCreated }) => {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#8B5CF6');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const res = await teamService.createTeam({ name: name.trim(), description: description.trim() || undefined, color });
    setLoading(false);
    if (res.success && res.data) {
      toast.success('Team created!', `"${name}" is ready.`);
      onCreated(res.data);
    } else {
      toast.error('Failed to create team', res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md bg-[#0C0D10] border border-[#27272A] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[#27272A]">
          <div>
            <h2 className="text-[15px] font-semibold text-white">Create a team</h2>
            <p className="text-[12px] text-zinc-400 mt-0.5">Set up your team workspace</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-300 mb-1.5">Team name <span className="text-red-400">*</span></label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engineering, Design, Product"
              className="w-full h-10 px-3 rounded-lg bg-[#111216] border border-[#27272A] text-[13px] text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-300 mb-1.5">Description <span className="text-zinc-500">(optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this team work on?"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-[#111216] border border-[#27272A] text-[13px] text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-300 mb-2">Team color</label>
            <div className="flex gap-2">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{
                    backgroundColor: c,
                    boxShadow: color === c ? `0 0 0 2px #0C0D10, 0 0 0 4px ${c}` : 'none',
                    transform: color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 p-5 pt-0">
          <button onClick={onClose} className="flex-1 h-9 rounded-lg border border-[#27272A] text-zinc-400 hover:text-white text-[13px] font-medium transition-colors hover:bg-white/[0.04]">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className="flex-1 h-9 rounded-lg bg-[#8B5CF6] hover:brightness-110 text-[#0A0B10] text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            style={{ boxShadow: '0 3px 14px #8B5CF630' }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {loading ? 'Creating...' : 'Create team'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Invite Modal ─────────────────────────────────────────────────────────────

const InviteModal: React.FC<{
  teamId: number;
  teamName: string;
  onClose: () => void;
  onInvited: (invitation: TeamInvitation, inviteLink: string) => void;
}> = ({ teamId, teamName, onClose, onInvited }) => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamMemberRole>('DEVELOPER');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) return;
    setLoading(true);
    const res = await teamService.sendInvitation(teamId, { email: email.trim(), role, message: message.trim() || undefined });
    setLoading(false);
    if (res.success && res.data) {
      const link = `${window.location.origin}${res.inviteLink}`;
      setInviteLink(link);
      onInvited(res.data, link);
      toast.success('Invitation sent!', `Invite link created for ${email}`);
    } else {
      toast.error('Failed to send invitation', res.error);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied!', 'Invite link copied to clipboard');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md bg-[#0C0D10] border border-[#27272A] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[#27272A]">
          <div>
            <h2 className="text-[15px] font-semibold text-white">Invite to {teamName}</h2>
            <p className="text-[12px] text-zinc-400 mt-0.5">Send an invitation link to a teammate</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {inviteLink ? (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div className="flex items-center gap-2 text-[#4ADE80]">
                <CheckCircle2 size={16} />
                <span className="text-[13px] font-medium">Invitation created!</span>
              </div>
              <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A] space-y-2">
                <p className="text-[11px] text-zinc-500">Share this link with {email}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] text-zinc-300 font-mono truncate">{inviteLink}</code>
                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-400 hover:text-white transition-colors shrink-0"
                  >
                    {copied ? <Check size={13} className="text-[#4ADE80]" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500">The link expires in 7 days. The invited user must have the matching email address.</p>
              <button onClick={onClose} className="w-full h-9 rounded-lg bg-[#8B5CF6] hover:brightness-110 text-[#0A0B10] text-[13px] font-semibold transition-all" style={{ boxShadow: '0 3px 14px #8B5CF630' }}>
                Done
              </button>
            </motion.div>
          ) : (
            <>
              <div>
                <label className="block text-[12px] font-medium text-zinc-300 mb-1.5">
                  <Mail size={12} className="inline mr-1 opacity-70" />
                  Email address <span className="text-red-400">*</span>
                </label>
                <input
                  autoFocus
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="colleague@company.com"
                  className="w-full h-10 px-3 rounded-lg bg-[#111216] border border-[#27272A] text-[13px] text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-zinc-300 mb-1.5">Role</label>
                <div className="relative">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as TeamMemberRole)}
                    className="w-full h-10 pl-3 pr-8 rounded-lg bg-[#111216] border border-[#27272A] text-[13px] text-white focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-colors appearance-none cursor-pointer"
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-zinc-300 mb-1.5">
                  Personal message <span className="text-zinc-500">(optional)</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Hey, I'd love for you to join our team on DevFlow..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#111216] border border-[#27272A] text-[13px] text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-colors resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={onClose} className="flex-1 h-9 rounded-lg border border-[#27272A] text-zinc-400 hover:text-white text-[13px] font-medium transition-colors hover:bg-white/[0.04]">
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={!email.trim() || loading}
                  className="flex-1 h-9 rounded-lg bg-[#8B5CF6] hover:brightness-110 text-[#0A0B10] text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  style={{ boxShadow: '0 3px 14px #8B5CF630' }}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  {loading ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ─── Member Row ───────────────────────────────────────────────────────────────

const MemberRow: React.FC<{
  member: TeamMember;
  myRole: TeamMemberRole;
  currentUserId: number;
  onRoleChange: (memberId: number, role: TeamMemberRole) => void;
  onRemove: (member: TeamMember) => void;
}> = ({ member, myRole, currentUserId, onRoleChange, onRemove }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const isSelf = member.userId === currentUserId;
  const isOwner = member.role === 'OWNER';
  const myHierarchy = { OWNER: 5, ADMIN: 4, PROJECT_MANAGER: 3, DEVELOPER: 2, FRONTEND_DEVELOPER: 2, BACKEND_DEVELOPER: 2, TESTER: 2, DESIGNER: 2, VIEWER: 1 };
  const canEdit = (myHierarchy[myRole] ?? 0) > (myHierarchy[member.role] ?? 0) && !isOwner;

  return (
    <div className="group flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors border-b border-[#27272A]/50 last:border-b-0">
      <Avatar name={member.user.name} avatarUrl={member.user.avatarUrl} size={34} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-white truncate">{member.user.name}</span>
          {isSelf && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#8B5CF620] text-[#A78BFA] border border-[#8B5CF640] font-medium">You</span>}
        </div>
        <span className="text-[11px] text-zinc-500 truncate block">{member.user.email}</span>
      </div>

      <div className="hidden sm:block">
        {canEdit ? (
          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              <RoleBadge role={member.role} small />
              <ChevronDown size={10} className="text-zinc-500" />
            </button>
            <AnimatePresence>
              {showRoleDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowRoleDropdown(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.14 }}
                    className="absolute left-0 top-full mt-1.5 z-20 w-48 bg-[#17181D] border border-[#27272A] rounded-xl shadow-xl overflow-hidden py-1"
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <button
                        key={r}
                        onClick={() => { onRoleChange(member.userId, r); setShowRoleDropdown(false); }}
                        className={`w-full px-3 py-2 text-left text-[12px] flex items-center justify-between hover:bg-white/[0.05] transition-colors ${member.role === r ? 'text-white' : 'text-zinc-400'}`}
                      >
                        <span>{ROLE_LABELS[r]}</span>
                        {member.role === r && <Check size={11} className="text-[#A78BFA]" />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <RoleBadge role={member.role} small />
        )}
      </div>

      <div className="hidden md:flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
        <span className="text-[11px] text-zinc-500">Active</span>
      </div>

      <span className="hidden lg:block text-[11px] text-zinc-500 whitespace-nowrap">{formatDate(member.joinedAt)}</span>

      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all opacity-0 group-hover:opacity-100 ${showMenu ? 'opacity-100' : ''}`}
        >
          <MoreHorizontal size={15} />
        </button>
        <AnimatePresence>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 top-full mt-1 z-20 w-44 bg-[#17181D] border border-[#27272A] rounded-xl shadow-xl overflow-hidden py-1"
              >
                {canEdit && (
                  <button
                    onClick={() => { setShowMenu(false); setShowRoleDropdown(true); }}
                    className="w-full px-3 py-2 text-left text-[12px] text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors flex items-center gap-2"
                  >
                    <Settings size={12} />
                    Change role
                  </button>
                )}
                {!isOwner && (
                  <button
                    onClick={() => { setShowMenu(false); onRemove(member); }}
                    className="w-full px-3 py-2 text-left text-[12px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                  >
                    <UserMinus size={12} />
                    {isSelf ? 'Leave team' : 'Remove member'}
                  </button>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Pending Invitation Row ────────────────────────────────────────────────────

const PendingInvitationRow: React.FC<{
  invitation: TeamInvitation;
  myRole: TeamMemberRole;
  onResend: (invId: number) => void;
  onCancel: (invId: number) => void;
  newlyAdded?: boolean;
}> = ({ invitation, myRole, onResend, onCancel, newlyAdded = false }) => {
  const [copied, setCopied] = useState(false);
  const isExpired = new Date() > new Date(invitation.expiresAt);
  const canManage = ['OWNER', 'ADMIN'].includes(myRole);
  const link = `${window.location.origin}/invite/${invitation.invitationToken}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={newlyAdded ? { opacity: 0, y: -6, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="group flex items-center gap-3 px-4 py-3 hover:bg-[#FBBF24]/[0.02] transition-colors border-b border-dashed border-[#FBBF2430]/50 last:border-b-0"
    >
      {/* Clock avatar */}
      <div className="w-8 h-8 rounded-full bg-[#FBBF2410] border border-[#FBBF2430] flex items-center justify-center shrink-0">
        <Clock size={14} className="text-[#FBBF24]" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-zinc-300 truncate">{invitation.invitedEmail}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FBBF2415] text-[#FBBF24] border border-[#FBBF2430] font-medium whitespace-nowrap">
            {isExpired ? 'Expired' : 'Invitation Pending'}
          </span>
        </div>
        <span className="text-[11px] text-zinc-500">
          Invited {formatDate(invitation.createdAt)} · Expires {formatDate(invitation.expiresAt)}
        </span>
      </div>

      <div className="hidden sm:block opacity-60">
        <RoleBadge role={invitation.assignedRole} small />
      </div>

      {canManage && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            title="Copy invite link"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
          >
            {copied ? <Check size={13} className="text-[#4ADE80]" /> : <Copy size={13} />}
          </button>
          <button
            onClick={() => onResend(invitation.id)}
            title="Resend invitation"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-[#A78BFA] hover:bg-[#8B5CF620] transition-colors"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={() => onCancel(invitation.id)}
            title="Cancel invitation"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </motion.div>
  );
};

// ─── Remove Member Confirm Dialog ─────────────────────────────────────────────

const ConfirmRemoveDialog: React.FC<{
  member: TeamMember;
  isSelf: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}> = ({ member, isSelf, onConfirm, onCancel, loading }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.18 }}
      className="relative z-10 w-full max-w-sm bg-[#0C0D10] border border-[#27272A] rounded-2xl shadow-2xl p-5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
          <AlertCircle size={18} className="text-red-400" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-white">{isSelf ? 'Leave team?' : 'Remove member?'}</h3>
          <p className="text-[12px] text-zinc-400">{isSelf ? 'You will lose access to this team.' : `${member.user.name} will lose access.`}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 h-9 rounded-lg border border-[#27272A] text-zinc-400 hover:text-white text-[13px] font-medium transition-colors hover:bg-white/[0.04]">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 h-9 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-60"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : null}
          {isSelf ? 'Leave' : 'Remove'}
        </button>
      </div>
    </motion.div>
  </div>
);

// ─── Empty State ───────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }> = ({
  icon, title, description, action
}) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-3 text-zinc-500">
      {icon}
    </div>
    <p className="text-[13px] font-medium text-zinc-300">{title}</p>
    <p className="text-[12px] text-zinc-500 mt-1 max-w-xs">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// ─── Main TeamView ─────────────────────────────────────────────────────────────

export const TeamView: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [teamLoading, setTeamLoading] = useState(false);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<TeamMemberRole | ''>('');
  const [newlyAddedInviteId, setNewlyAddedInviteId] = useState<number | null>(null);

  const loadTeamDetail = useCallback(async (id: number) => {
    setTeamLoading(true);
    const res = await teamService.getTeam(id);
    setTeamLoading(false);
    if (res.success && res.data) {
      setSelectedTeam(res.data);
      setLoadError('');
    } else {
      setLoadError(res.error || 'Failed to load team');
      toast.error('Failed to load team', res.error);
    }
  }, []);

  // ─── Load teams
  useEffect(() => {
    const loadTeams = async () => {
      const res = await teamService.listTeams();
      setLoading(false);
      if (res.success && res.data) {
        setTeams(res.data);
        if (res.data.length > 0) {
          const requestedId = teamId && /^\d+$/.test(teamId) ? Number(teamId) : null;
          const initialTeam = res.data.find((team) => team.id === requestedId) ?? res.data[0];
          loadTeamDetail(initialTeam.id);
          if (teamId !== String(initialTeam.id)) navigate(`/teams/${initialTeam.id}`, { replace: true });
        }
      } else {
        setLoadError(res.error || 'Failed to load teams');
      }
    };
    loadTeams();
  }, [teamId, loadTeamDetail, navigate]);

  // ─── Filtered members
  const filteredMembers = useMemo(() => {
    if (!selectedTeam) return [];
    return selectedTeam.members.filter((m) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || m.user.name.toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q);
      const matchesRole = !roleFilter || m.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [selectedTeam, searchQuery, roleFilter]);

  const filteredInvitations = useMemo(() => {
    if (!selectedTeam) return [];
    return selectedTeam.invitations.filter((inv) => {
      const q = searchQuery.toLowerCase();
      return !q || inv.invitedEmail.toLowerCase().includes(q);
    });
  }, [selectedTeam, searchQuery]);

  // ─── Stats
  const activeCount = selectedTeam?.members.length ?? 0;
  const pendingCount = selectedTeam?.invitations.length ?? 0;
  const totalCount = activeCount + pendingCount;
  const myRole = selectedTeam?.myRole ?? 'VIEWER';
  const canManageTeam = ['OWNER', 'ADMIN'].includes(myRole);

  // ─── Handlers

  const handleInvited = (invitation: TeamInvitation, _link: string) => {
    if (!selectedTeam) return;
    setSelectedTeam((prev) => prev ? { ...prev, invitations: [invitation, ...prev.invitations] } : prev);
    setNewlyAddedInviteId(invitation.id);
    setTimeout(() => setNewlyAddedInviteId(null), 3000);
    setShowInviteModal(false);
  };

  const handleResendInvitation = async (invId: number) => {
    if (!selectedTeam) return;
    const res = await teamService.resendInvitation(selectedTeam.id, invId);
    if (res.success) {
      toast.success('Invitation resent', 'A fresh invite link has been generated');
      loadTeamDetail(selectedTeam.id);
    } else {
      toast.error('Failed to resend', res.error);
    }
  };

  const handleCancelInvitation = async (invId: number) => {
    if (!selectedTeam) return;
    const res = await teamService.cancelInvitation(selectedTeam.id, invId);
    if (res.success) {
      toast.success('Invitation cancelled');
      setSelectedTeam((prev) => prev ? { ...prev, invitations: prev.invitations.filter((i) => i.id !== invId) } : prev);
    } else {
      toast.error('Failed to cancel', res.error);
    }
  };

  const handleRoleChange = async (memberId: number, role: TeamMemberRole) => {
    if (!selectedTeam) return;
    const res = await teamService.changeMemberRole(selectedTeam.id, memberId, role);
    if (res.success) {
      toast.success('Role updated');
      setSelectedTeam((prev) => prev
        ? { ...prev, members: prev.members.map((m) => m.userId === memberId ? { ...m, role } : m) }
        : prev
      );
    } else {
      toast.error('Failed to change role', res.error);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedTeam || !memberToRemove) return;
    setRemoveLoading(true);
    const res = await teamService.removeMember(selectedTeam.id, memberToRemove.userId);
    setRemoveLoading(false);
    if (res.success) {
      toast.success(memberToRemove.userId === user?.id ? 'You left the team' : `${memberToRemove.user.name} removed`);
      setSelectedTeam((prev) => prev
        ? { ...prev, members: prev.members.filter((m) => m.userId !== memberToRemove.userId) }
        : prev
      );
      setMemberToRemove(null);
    } else {
      toast.error('Failed to remove member', res.error);
    }
  };

  const handleTeamCreated = (team: any) => {
    setTeams((prev) => [team, ...prev]);
    setShowCreateTeamModal(false);
    navigate(`/teams/${team.id}`, { replace: true });
    loadTeamDetail(team.id);
  };

  // ─── Render

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-zinc-800 rounded w-48" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-zinc-800 rounded-xl" />)}
          </div>
          <div className="h-64 bg-zinc-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (loadError && teams.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <EmptyState
          icon={<AlertCircle size={22} />}
          title="Could not load teams"
          description={loadError}
          action={<button onClick={() => window.location.reload()} className="text-[12px] text-[#A78BFA] hover:underline">Try again</button>}
        />
      </div>
    );
  }

  // No teams — show create prompt
  if (teams.length === 0 && !loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <AnimatePresence>
          {showCreateTeamModal && (
            <CreateTeamModal
              onClose={() => setShowCreateTeamModal(false)}
              onCreated={handleTeamCreated}
            />
          )}
        </AnimatePresence>
        <div className="flex items-center justify-between pb-4 border-b border-[#27272A] mb-6">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Teams</h1>
            <p className="text-xs text-zinc-400 mt-0.5">Collaborate with your teammates</p>
          </div>
        </div>
        <EmptyState
          icon={<Users size={22} />}
          title="No teams yet"
          description="Create your first team to start inviting members and collaborating."
          action={
            <button
              onClick={() => setShowCreateTeamModal(true)}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#8B5CF6] hover:brightness-110 text-[#0A0B10] text-[13px] font-semibold transition-all shadow-md"
              style={{ boxShadow: '0 3px 14px #8B5CF630' }}
            >
              <Plus size={14} />
              Create your first team
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      {/* Modals */}
      <AnimatePresence>
        {showInviteModal && selectedTeam && (
          <InviteModal
            teamId={selectedTeam.id}
            teamName={selectedTeam.name}
            onClose={() => setShowInviteModal(false)}
            onInvited={handleInvited}
          />
        )}
        {showCreateTeamModal && (
          <CreateTeamModal
            onClose={() => setShowCreateTeamModal(false)}
            onCreated={handleTeamCreated}
          />
        )}
        {memberToRemove && (
          <ConfirmRemoveDialog
            member={memberToRemove}
            isSelf={memberToRemove.userId === user?.id}
            onConfirm={handleRemoveMember}
            onCancel={() => setMemberToRemove(null)}
            loading={removeLoading}
          />
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="flex items-center justify-between pb-4 border-b border-[#27272A]">
        <div className="flex items-center gap-3 min-w-0">
          {selectedTeam && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ backgroundColor: selectedTeam.color }}
            >
              {selectedTeam.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight truncate">
                {selectedTeam?.name || 'Teams'}
              </h1>
              {selectedTeam && <RoleBadge role={myRole} small />}
            </div>
            {selectedTeam?.description && (
              <p className="text-xs text-zinc-400 mt-0.5 truncate">{selectedTeam.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowCreateTeamModal(true)}
            className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#27272A] text-zinc-400 hover:text-white hover:bg-white/[0.04] text-[12px] font-medium transition-colors"
          >
            <Plus size={13} />
            New team
          </button>
          {canManageTeam && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#8B5CF6] hover:brightness-110 text-[#0A0B10] text-[12px] font-semibold transition-all shadow-sm"
              style={{ boxShadow: '0 2px 10px #8B5CF625' }}
            >
              <UserPlus size={13} />
              <span className="hidden sm:inline">Invite member</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Team Switcher (if multiple teams) ── */}
      {teams.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(`/teams/${t.id}`)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all ${
                selectedTeam?.id === t.id
                  ? 'bg-[#1C1C1F] text-white border border-[#3F3F46]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: t.color }} />
              {t.name}
            </button>
          ))}
        </div>
      )}

      {teamLoading ? (
        <div className="bg-[#0E0E10] border border-[#27272A] rounded-xl overflow-hidden">
          {[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : loadError ? (
        <EmptyState
          icon={<AlertCircle size={18} />}
          title="Could not load this team"
          description={loadError}
          action={<button onClick={() => selectedTeam && loadTeamDetail(selectedTeam.id)} className="text-[12px] text-[#A78BFA] hover:underline">Try again</button>}
        />
      ) : selectedTeam ? (
        <>
          {/* ── Stats ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total members" value={totalCount} icon={<Users size={16} />} accent="#8B5CF6" />
            <StatCard label="Active members" value={activeCount} icon={<CheckCircle2 size={16} />} accent="#4ADE80" />
            <StatCard label="Pending invites" value={pendingCount} icon={<Clock size={16} />} accent="#FBBF24" />
            <StatCard label="Your role" value={ROLE_LABELS[myRole]} icon={myRole === 'OWNER' ? <Crown size={16} /> : <Shield size={16} />} accent="#60A5FA" />
          </div>

          {/* ── Search & Filter ── */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search members or invitations..."
                className="w-full h-9 pl-8 pr-3 rounded-lg bg-[#111216] border border-[#27272A] text-[12px] text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as TeamMemberRole | '')}
                className="h-9 pl-3 pr-7 rounded-lg bg-[#111216] border border-[#27272A] text-[12px] text-zinc-400 focus:outline-none focus:border-zinc-400 appearance-none cursor-pointer transition-colors hover:border-zinc-600"
              >
                <option value="">All roles</option>
                {(['OWNER', ...ASSIGNABLE_ROLES] as TeamMemberRole[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            </div>
          </div>

          {/* ── Active Members ── */}
          <div className="bg-[#0E0E10] border border-[#27272A] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272A]">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-zinc-400" />
                <span className="text-[12px] font-semibold text-white">Active Members</span>
                <span className="text-[11px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-md">{filteredMembers.length}</span>
              </div>
              {/* Column headers */}
              <div className="hidden lg:flex items-center gap-6 text-[10px] text-zinc-500 uppercase tracking-wider pr-8">
                <span className="w-24 text-center">Role</span>
                <span className="w-16 text-center">Status</span>
                <span className="w-24 text-center">Joined</span>
              </div>
            </div>

            {filteredMembers.length === 0 ? (
              <EmptyState
                icon={<Users size={18} />}
                title={searchQuery ? 'No members match your search' : 'No active members'}
                description={searchQuery ? 'Try a different search query or clear filters.' : 'Invite your first team member to get started.'}
              />
            ) : (
              <AnimatePresence>
                {filteredMembers.map((member) => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <MemberRow
                      member={member}
                      myRole={myRole}
                      currentUserId={user?.id ?? -1}
                      onRoleChange={handleRoleChange}
                      onRemove={setMemberToRemove}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* ── Pending Invitations ── */}
          {(filteredInvitations.length > 0 || (canManageTeam && pendingCount === 0)) && (
            <div
              className="bg-[#0E0E10] border rounded-xl overflow-hidden"
              style={{ borderColor: filteredInvitations.length > 0 ? '#FBBF2425' : '#27272A' }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderBottomColor: filteredInvitations.length > 0 ? '#FBBF2425' : '#27272A' }}>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-[#FBBF24]" />
                  <span className="text-[12px] font-semibold text-white">Pending Invitations</span>
                  <span className="text-[11px] text-[#FBBF24] bg-[#FBBF2415] border border-[#FBBF2425] px-1.5 py-0.5 rounded-md">
                    {filteredInvitations.length}
                  </span>
                </div>
                {canManageTeam && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="text-[11px] text-zinc-500 hover:text-[#A78BFA] transition-colors flex items-center gap-1"
                  >
                    <Plus size={11} />
                    Invite
                  </button>
                )}
              </div>

              {filteredInvitations.length === 0 ? (
                <EmptyState
                  icon={<Mail size={18} />}
                  title="No pending invitations"
                  description="All invitations have been accepted or none have been sent yet."
                />
              ) : (
                <AnimatePresence>
                  {filteredInvitations.map((inv) => (
                    <PendingInvitationRow
                      key={inv.id}
                      invitation={inv}
                      myRole={myRole}
                      onResend={handleResendInvitation}
                      onCancel={handleCancelInvitation}
                      newlyAdded={newlyAddedInviteId === inv.id}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          )}

          {/* No search results at all */}
          {searchQuery && filteredMembers.length === 0 && filteredInvitations.length === 0 && (
            <EmptyState
              icon={<Search size={18} />}
              title={`No results for "${searchQuery}"`}
              description="Try searching by name or email address."
              action={
                <button onClick={() => setSearchQuery('')} className="text-[12px] text-[#A78BFA] hover:underline">
                  Clear search
                </button>
              }
            />
          )}
        </>
      ) : null}
    </div>
  );
};
