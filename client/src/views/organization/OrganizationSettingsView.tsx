import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Building2,
  Users,
  Shield,
  Key,
  Globe,
  Trash2,
  AlertTriangle,
  Check,
  ChevronRight,
  Save,
  Github,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  X,
  AlertCircle,
  Sparkles,
  Smile,
  MoreHorizontal,
  Mail,
  FolderKanban,
  Layers,
  Activity,
  Clock,
  UserPlus,
  UserMinus,
  Crown,
  Eye,
  Copy,
  MapPin,
  Briefcase,
  Loader2,
  Link as LinkIcon,
  RefreshCw,
} from 'lucide-react';
import { useOrganization } from '../../context/OrganizationContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { useToast } from '../../context/ToastContext';
import { organizationService } from '../../services/organization.service';
import { SettingsSectionNav, SettingsCategory } from '../../components/settings/SettingsSectionNav';
import { SettingsSection } from '../../components/settings/SettingsSection';
import { SettingsRow } from '../../components/settings/SettingsRow';
import { OrgAvatar, parseOrgAvatar, getOrgInitials } from '../../components/organization/OrgAvatar';
import { AVATAR_ICON_COMPONENTS } from '../../components/onboarding/StepProfile';
import { QUICK_AVATAR_ICONS, MORE_AVATAR_ICONS, AVATAR_COLORS } from '../../types/onboarding';
import type {
  OrganizationMember,
  OrganizationInvitation,
  OrganizationRole,
  OrganizationOverviewData,
} from '../../types/organization';

const SETTINGS_CATEGORIES: SettingsCategory[] = [
  { id: 'general', label: 'General' },
  { id: 'resources', label: 'Workspaces & Resources' },
  { id: 'members', label: 'Members & Access' },
  { id: 'security', label: 'Security & Ownership' },
  { id: 'danger', label: 'Danger Zone' },
];

const INDUSTRY_OPTIONS = [
  'Software & SaaS',
  'Developer Tools',
  'Artificial Intelligence & ML',
  'Fintech & Financial Services',
  'E-Commerce & Retail',
  'Design & Creative Services',
  'Healthcare & Biotechnology',
  'Media & Entertainment',
  'Education & EdTech',
  'Open Source & Community',
  'Other',
];

const ROLE_PERMISSIONS_INFO: Record<OrganizationRole, { label: string; desc: string; icon: React.ReactNode; color: string }> = {
  OWNER: {
    label: 'Owner',
    desc: 'Full administrative access, ownership transfer, billing, and permanent workspace deletion.',
    icon: <Crown size={12} className="text-amber-400" />,
    color: '#F59E0B',
  },
  ADMIN: {
    label: 'Admin',
    desc: 'Can manage workspace settings, invite/remove collaborators, and create teams & projects.',
    icon: <Shield size={12} className="text-indigo-400" />,
    color: '#818CF8',
  },
  MEMBER: {
    label: 'Member',
    desc: 'Can create and participate in projects, tasks, and teams across the organization.',
    icon: <Users size={12} className="text-emerald-400" />,
    color: '#34D399',
  },
  VIEWER: {
    label: 'Viewer',
    desc: 'Read-only access to view roadmaps, boards, teams, and activity without edit permissions.',
    icon: <Eye size={12} className="text-zinc-400" />,
    color: '#A1A1AA',
  },
};

// ─── Metadata Encoding Helpers ───────────────────────────────────────────────

function parseOrgMetadata(description?: string | null) {
  let cleanDesc = description || '';
  let website = '';
  let industry = '';
  let contactEmail = '';
  let location = '';

  if (cleanDesc) {
    const webMatch = cleanDesc.match(/\[website:([^\]]+)\]/);
    if (webMatch) {
      website = webMatch[1];
      cleanDesc = cleanDesc.replace(webMatch[0], '').trim();
    }
    const indMatch = cleanDesc.match(/\[industry:([^\]]+)\]/);
    if (indMatch) {
      industry = indMatch[1];
      cleanDesc = cleanDesc.replace(indMatch[0], '').trim();
    }
    const emailMatch = cleanDesc.match(/\[contact:([^\]]+)\]/);
    if (emailMatch) {
      contactEmail = emailMatch[1];
      cleanDesc = cleanDesc.replace(emailMatch[0], '').trim();
    }
    const locMatch = cleanDesc.match(/\[location:([^\]]+)\]/);
    if (locMatch) {
      location = locMatch[1];
      cleanDesc = cleanDesc.replace(locMatch[0], '').trim();
    }
  }

  return { cleanDesc, website, industry, contactEmail, location };
}

function serializeOrgMetadata(
  cleanDesc: string,
  website?: string,
  industry?: string,
  contactEmail?: string,
  location?: string
) {
  let result = cleanDesc.trim();
  if (website?.trim()) result += ` [website:${website.trim()}]`;
  if (industry?.trim()) result += ` [industry:${industry.trim()}]`;
  if (contactEmail?.trim()) result += ` [contact:${contactEmail.trim()}]`;
  if (location?.trim()) result += ` [location:${location.trim()}]`;
  return result.trim();
}

export const OrganizationSettingsView: React.FC = () => {
  const { organizationSlug } = useParams<{ organizationSlug: string }>();
  const {
    currentOrganization,
    reloadCurrentOrganization,
    refreshOrganizations,
    isAdminOrOwner,
    isOwner,
  } = useOrganization();
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();
  const navigate = useNavigate();

  const targetSlug = organizationSlug || currentOrganization?.slug;

  // ─── General Form State ──────────────────────────────────────────────────
  const [name, setName] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [cleanDescription, setCleanDescription] = useState<string>('');
  const [website, setWebsite] = useState<string>('');
  const [industry, setIndustry] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [location, setLocation] = useState<string>('');

  // Avatar Editor State (like in Teams)
  const [avatarMode, setAvatarMode] = useState<'preset' | 'url'>('preset');
  const [avatarType, setAvatarType] = useState<'initials' | 'icon'>('icon');
  const [avatarId, setAvatarId] = useState<string>('sparkles');
  const [avatarColor, setAvatarColor] = useState<string>('#7C3AED');
  const [customImageUrl, setCustomImageUrl] = useState<string>('');
  const [showMoreModal, setShowMoreModal] = useState<boolean>(false);
  const moreButtonRef = useRef<HTMLDivElement>(null);

  const [isSavingGeneral, setIsSavingGeneral] = useState<boolean>(false);

  // ─── Resources Overview State ────────────────────────────────────────────
  const [overviewData, setOverviewData] = useState<OrganizationOverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(false);

  // ─── Members & Invitations State ─────────────────────────────────────────
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [loadingMembers, setLoadingMembers] = useState<boolean>(false);

  // Member Invite Form State
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<OrganizationRole>('MEMBER');
  const [isSendingInvite, setIsSendingInvite] = useState<boolean>(false);
  const [copiedInviteLink, setCopiedInviteLink] = useState<boolean>(false);

  // Member Role & Removal State
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState<boolean>(false);
  const [activeRoleDropdown, setActiveRoleDropdown] = useState<number | null>(null);

  // ─── Security Toggles & Ownership Transfer ──────────────────────────────
  const [require2FA, setRequire2FA] = useState<boolean>(false);
  const [restrictInvitesToAdmins, setRestrictInvitesToAdmins] = useState<boolean>(true);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState<number | ''>('');
  const [transferConfirmationPhrase, setTransferConfirmationPhrase] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // Danger Zone Deletion
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [deleteConfirmationPhrase, setDeleteConfirmationPhrase] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Close more modal when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (moreButtonRef.current && !moreButtonRef.current.contains(e.target as Node)) {
        setShowMoreModal(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // ─── Load initial organization details ──────────────────────────────────
  useEffect(() => {
    if (currentOrganization) {
      setName(currentOrganization.name);
      setSlug(currentOrganization.slug);

      // Parse metadata from description
      const meta = parseOrgMetadata(currentOrganization.description);
      setCleanDescription(meta.cleanDesc);
      setWebsite(meta.website);
      setIndustry(meta.industry);
      setContactEmail(meta.contactEmail);
      setLocation(meta.location);

      // Parse avatar details from logoUrl
      const avatarDetails = parseOrgAvatar(currentOrganization.logoUrl, currentOrganization.name);
      if (avatarDetails.type === 'image' && avatarDetails.url) {
        setAvatarMode('url');
        setCustomImageUrl(avatarDetails.url);
      } else {
        setAvatarMode('preset');
        setAvatarType(avatarDetails.type === 'icon' ? 'icon' : 'initials');
        setAvatarId(avatarDetails.iconId || 'sparkles');
        setAvatarColor(avatarDetails.color || '#7C3AED');
      }
    }
  }, [currentOrganization]);

  // Load members, invitations, and overview
  const loadWorkspaceResources = useCallback(async () => {
    if (!targetSlug) return;
    setLoadingOverview(true);
    setLoadingMembers(true);
    try {
      const [membersRes, invitesRes, overviewRes] = await Promise.all([
        organizationService.listMembers(targetSlug),
        organizationService.listInvitations(targetSlug),
        organizationService.getOverview(targetSlug),
      ]);

      if (membersRes.success && membersRes.data) {
        setMembers(membersRes.data);
      }
      if (invitesRes.success && invitesRes.data) {
        setInvitations(invitesRes.data);
      }
      if (overviewRes.success && overviewRes.data) {
        setOverviewData(overviewRes.data);
      }
    } catch (err) {
      console.error('Failed to load workspace data:', err);
    } finally {
      setLoadingOverview(false);
      setLoadingMembers(false);
    }
  }, [targetSlug]);

  useEffect(() => {
    loadWorkspaceResources();
  }, [loadWorkspaceResources]);

  // Serialized logoUrl computed from state
  const computedLogoUrl =
    avatarMode === 'url'
      ? customImageUrl.trim()
      : avatarType === 'icon'
      ? `icon:${avatarId}:${avatarColor}`
      : `initials:${avatarColor}`;

  // ─── Handle General Settings Save ────────────────────────────────────────
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSlug) return;
    setIsSavingGeneral(true);

    const serializedDescription = serializeOrgMetadata(
      cleanDescription,
      website,
      industry,
      contactEmail,
      location
    );

    try {
      const res = await organizationService.updateOrganization(targetSlug, {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        description: serializedDescription || undefined,
        logoUrl: computedLogoUrl || undefined,
      });

      if (res.success && res.data) {
        toast.success('Settings updated', 'Organization profile has been saved successfully.');
        await refreshOrganizations();
        await reloadCurrentOrganization();
        if (res.data.slug !== targetSlug) {
          navigate(`/organizations/${res.data.slug}/settings`, { replace: true });
        }
      } else {
        toast.error('Update failed', res.error || 'Could not save organization settings');
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsSavingGeneral(false);
    }
  };

  // ─── Handle Member Role Change ───────────────────────────────────────────
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

  // ─── Handle Member Deactivation / Removal ─────────────────────────────────
  const handleConfirmRemoveMember = async () => {
    if (!targetSlug || !memberToRemove) return;
    setIsRemovingMember(true);
    try {
      const res = await organizationService.removeMember(targetSlug, memberToRemove.userId);
      if (res.success) {
        setMembers((prev) => prev.filter((m) => m.userId !== memberToRemove.userId));
        toast.success('Member removed', `${memberToRemove.user.name} has been removed from this organization.`);
        setMemberToRemove(null);
        await reloadCurrentOrganization();
      } else {
        toast.error('Removal failed', res.error || 'Could not remove member');
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsRemovingMember(false);
    }
  };

  // ─── Handle Invite Member via Email ──────────────────────────────────────
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSlug || !inviteEmail.trim()) return;

    setIsSendingInvite(true);
    try {
      const res = await organizationService.sendInvitation(
        targetSlug,
        inviteEmail.trim().toLowerCase(),
        inviteRole
      );

      if (res.success && res.data) {
        toast.success('Invitation sent', `Invite sent to ${inviteEmail}`);
        setInvitations((prev) => [res.data!, ...prev]);
        setInviteEmail('');
      } else {
        toast.error('Invitation failed', res.error || 'Could not send invitation');
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsSendingInvite(false);
    }
  };

  // ─── Handle Copy Direct Invitation Link ──────────────────────────────────
  const handleCopyInviteLink = async () => {
    const inviteLink = `${window.location.origin}/join/org/${targetSlug}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedInviteLink(true);
      setTimeout(() => setCopiedInviteLink(false), 2000);
      toast.success('Link copied!', 'Organization join link copied to clipboard.');
    } catch {
      toast.error('Failed to copy', 'Could not copy link to clipboard.');
    }
  };

  // ─── Handle Cancel Pending Invite ─────────────────────────────────────────
  const handleCancelInvite = async (inviteId: number) => {
    if (!targetSlug) return;
    try {
      const res = await organizationService.cancelInvitation(targetSlug, inviteId);
      if (res.success) {
        setInvitations((prev) => prev.filter((inv) => inv.id !== inviteId));
        toast.success('Invitation revoked');
      } else {
        toast.error('Could not revoke invite', res.error);
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    }
  };

  // ─── Handle Ownership Transfer ───────────────────────────────────────────
  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSlug || !selectedNewOwnerId) return;

    if (transferConfirmationPhrase.trim() !== slug) {
      toast.error('Confirmation mismatch', `Type "${slug}" exactly to confirm transfer.`);
      return;
    }

    setIsTransferring(true);
    try {
      const res = await organizationService.transferOwnership(targetSlug, Number(selectedNewOwnerId));
      if (res.success) {
        toast.success('Ownership transferred', 'The new owner now holds primary administrative control.');
        setIsTransferModalOpen(false);
        setTransferConfirmationPhrase('');
        await reloadCurrentOrganization();
        await refreshOrganizations();
      } else {
        toast.error('Transfer failed', res.error || 'Could not transfer ownership');
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsTransferring(false);
    }
  };

  // ─── Handle Organization Deletion ─────────────────────────────────────────
  const handleDeleteOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSlug) return;

    if (deleteConfirmationPhrase.trim() !== slug) {
      setDeleteError(`Please type "${slug}" exactly to confirm deletion.`);
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await organizationService.deleteOrganization(targetSlug);
      if (res.success) {
        toast.success('Organization deleted', 'Workspace and resources were permanently removed.');
        setIsDeleteModalOpen(false);
        const orgList = await refreshOrganizations();
        if (orgList.length > 0) {
          navigate(`/organizations/${orgList[0].slug}/overview`);
        } else {
          navigate('/');
        }
      } else {
        setDeleteError(res.error || 'Could not delete organization');
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Error executing deletion');
    } finally {
      setIsDeleting(false);
    }
  };

  const isCurrentMoreIcon = MORE_AVATAR_ICONS.some((i) => i.id === avatarId);
  const CurrentMoreIconComponent = isCurrentMoreIcon ? AVATAR_ICON_COMPONENTS[avatarId] || Sparkles : null;
  const orgInitials = getOrgInitials(name);

  return (
    <div className="min-h-full w-full bg-[#0D0F14] text-[#F4F4F5] pb-24">
      {/* ─── Page Header ─────────────────────────────────────────────────── */}
      <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-6 border-b border-[#27272A]/70 bg-[#0D0F14]">
        <div className="flex items-center gap-2 text-xs text-zinc-400 mb-3">
          <span>Organizations</span>
          <ChevronRight size={13} className="text-zinc-600" />
          <Link
            to={`/organizations/${targetSlug}/overview`}
            className="text-zinc-300 hover:text-white transition-colors"
          >
            {currentOrganization?.name || 'Organization'}
          </Link>
          <ChevronRight size={13} className="text-zinc-600" />
          <span className="text-zinc-400">Settings</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <OrgAvatar
              name={name || 'Organization'}
              logoUrl={computedLogoUrl}
              className="w-12 h-12"
              iconSize={24}
              roundedClassName="rounded-xl"
              fontSize={18}
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {name || 'Organization Settings'}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                Manage organization profile, team resources, collaborator permissions, and security.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider font-mono border"
              style={{
                backgroundColor: `${accentColor}18`,
                color: accentColor,
                borderColor: `${accentColor}33`,
              }}
            >
              Role: {currentOrganization?.currentUserRole || 'MEMBER'}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Sticky Section Nav ──────────────────────────────────────────── */}
      <SettingsSectionNav categories={SETTINGS_CATEGORIES} />

      {/* ─── Content Panels ──────────────────────────────────────────────── */}
      <div className="max-w-5xl px-6 sm:px-8 py-8 space-y-12">
        {/* ═══════════════════════════════════════════════════════════════════
            1. GENERAL SETTINGS
           ═══════════════════════════════════════════════════════════════════ */}
        <SettingsSection
          id="general"
          title="General Settings"
          description="Basic information about your organization visible across all workspace projects."
        >
          <form onSubmit={handleSaveGeneral} className="space-y-6">
            <div className="rounded-2xl border border-[#27272A] bg-[#171A21] p-6 space-y-5">
              {/* Organization Avatar: Icons, Initials, and Colors like Teams */}
              <SettingsRow
                label="Organization Avatar"
                description="Choose custom icons, initials, and theme tones, or provide an image link"
              >
                <div className="space-y-4">
                  {/* Avatar Mode Switcher */}
                  <div className="flex items-center gap-2 p-1 rounded-xl bg-[#0D0F14] border border-[#27272A] w-fit">
                    <button
                      type="button"
                      onClick={() => setAvatarMode('preset')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        avatarMode === 'preset'
                          ? 'bg-[#27272A] text-white shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Presets (Icons & Initials)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarMode('url')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        avatarMode === 'url'
                          ? 'bg-[#27272A] text-white shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Custom Image URL
                    </button>
                  </div>

                  {avatarMode === 'preset' ? (
                    <div className="space-y-3.5">
                      {/* Live Avatar Preview and Pickers */}
                      <div className="flex items-center gap-4">
                        <OrgAvatar
                          name={name || 'Organization'}
                          logoUrl={computedLogoUrl}
                          className="w-14 h-14"
                          iconSize={26}
                          roundedClassName="rounded-2xl"
                          fontSize={20}
                        />

                        <div className="space-y-1">
                          <p className="text-xs font-medium text-white">Live Avatar Preview</p>
                          <p className="text-[11px] text-zinc-400">
                            {avatarType === 'icon' ? `Icon: ${avatarId}` : `Initials: ${orgInitials}`} · Tone: {avatarColor}
                          </p>
                        </div>
                      </div>

                      {/* Icon & Initials Picker Row */}
                      <div ref={moreButtonRef} className="space-y-1.5 relative">
                        <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                          Badge Style
                        </label>

                        <div className="flex items-center gap-2 flex-wrap py-1.5">
                          {/* 1. Initials button */}
                          <button
                            type="button"
                            onClick={() => setAvatarType('initials')}
                            className={`relative w-8 h-8 rounded-full flex items-center justify-center font-mono text-[11px] font-semibold transition-all cursor-pointer ${
                              avatarType === 'initials'
                                ? 'ring-2 ring-offset-2 ring-offset-[#0C0D10] shadow-md scale-105'
                                : 'border border-white/[0.08] hover:scale-105 bg-[#0D0F14] text-zinc-400 hover:text-white'
                            }`}
                            style={{
                              backgroundColor: avatarType === 'initials' ? avatarColor : '#0D0F14',
                              color: avatarType === 'initials' ? '#FFFFFF' : '#A1A1AA',
                            }}
                            title="Use initials"
                          >
                            {orgInitials}
                            {avatarType === 'initials' && (
                              <div
                                className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center text-white text-[7px] shadow"
                                style={{ backgroundColor: accentColor }}
                              >
                                <Check size={8} strokeWidth={3} />
                              </div>
                            )}
                          </button>

                          {/* 2. Quick Icons */}
                          {QUICK_AVATAR_ICONS.map((icon) => {
                            const isSelected = avatarType === 'icon' && avatarId === icon.id;
                            const IconComp = AVATAR_ICON_COMPONENTS[icon.id] || Smile;

                            return (
                              <button
                                key={icon.id}
                                type="button"
                                onClick={() => {
                                  setAvatarType('icon');
                                  setAvatarId(icon.id);
                                }}
                                className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                  isSelected
                                    ? 'ring-2 ring-offset-2 ring-offset-[#0C0D10] shadow-md scale-105'
                                    : 'border border-white/[0.08] hover:scale-105 bg-[#0D0F14] text-zinc-400 hover:text-white'
                                }`}
                                style={{
                                  backgroundColor: isSelected ? avatarColor : '#0D0F14',
                                  color: isSelected ? '#FFFFFF' : '#A1A1AA',
                                }}
                                title={icon.name}
                              >
                                <IconComp size={14} strokeWidth={2.2} />
                                {isSelected && (
                                  <div
                                    className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center text-white text-[7px] shadow"
                                    style={{ backgroundColor: accentColor }}
                                  >
                                    <Check size={8} strokeWidth={3} />
                                  </div>
                                )}
                              </button>
                            );
                          })}

                          {/* 3. 3-Dot More Button */}
                          <button
                            type="button"
                            onClick={() => setShowMoreModal((prev) => !prev)}
                            className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                              isCurrentMoreIcon
                                ? 'ring-2 ring-offset-2 ring-offset-[#0C0D10] shadow-md scale-105'
                                : 'border border-white/[0.08] hover:scale-105 bg-[#0D0F14] text-zinc-400 hover:text-white'
                            }`}
                            style={{
                              backgroundColor: isCurrentMoreIcon ? avatarColor : '#0D0F14',
                              color: isCurrentMoreIcon ? '#FFFFFF' : undefined,
                            }}
                            title="More avatar icons"
                          >
                            {isCurrentMoreIcon && CurrentMoreIconComponent ? (
                              <CurrentMoreIconComponent size={14} strokeWidth={2.2} />
                            ) : (
                              <MoreHorizontal size={14} />
                            )}
                            {isCurrentMoreIcon && (
                              <div
                                className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center text-white text-[7px] shadow"
                                style={{ backgroundColor: accentColor }}
                              >
                                <Check size={8} strokeWidth={3} />
                              </div>
                            )}
                          </button>
                        </div>

                        {/* More Icons Popover */}
                        <AnimatePresence>
                          {showMoreModal && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.94, y: 8 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.94, y: 8 }}
                              transition={{ duration: 0.18 }}
                              className="absolute left-0 bottom-11 z-50 p-3 rounded-2xl bg-[#17181D] border border-[#27272A] shadow-2xl w-[280px] max-w-full backdrop-blur-xl"
                            >
                              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.08]">
                                <span className="text-[11.5px] font-medium text-white flex items-center gap-1.5">
                                  <Sparkles size={12} className="text-[#A78BFA]" />
                                  <span>Choose Icon ({MORE_AVATAR_ICONS.length})</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setShowMoreModal(false)}
                                  className="text-zinc-500 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                                >
                                  <X size={13} />
                                </button>
                              </div>

                              <div className="grid grid-cols-6 gap-1.5 max-h-52 overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-zinc-700">
                                {MORE_AVATAR_ICONS.map((icon) => {
                                  const IconComponent = AVATAR_ICON_COMPONENTS[icon.id] || Sparkles;
                                  const isSelected = avatarType === 'icon' && avatarId === icon.id;

                                  return (
                                    <button
                                      key={icon.id}
                                      type="button"
                                      onClick={() => {
                                        setAvatarType('icon');
                                        setAvatarId(icon.id);
                                        setShowMoreModal(false);
                                      }}
                                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                        isSelected
                                          ? 'bg-[#A78BFA] text-zinc-950 font-bold scale-105 shadow'
                                          : 'hover:bg-white/[0.08] text-zinc-300 hover:text-white'
                                      }`}
                                      title={icon.name}
                                    >
                                      <IconComponent size={14} />
                                    </button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Color Palette */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                          Avatar Tone
                        </label>
                        <div className="flex items-center gap-2 flex-wrap py-1">
                          {AVATAR_COLORS.map((c) => {
                            const isSelected = avatarColor.toLowerCase() === c.hex.toLowerCase();
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setAvatarColor(c.hex)}
                                className={`relative w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                  isSelected
                                    ? 'scale-115 ring-2 ring-offset-2 ring-offset-[#0C0D10]'
                                    : 'hover:scale-110 opacity-80 hover:opacity-100'
                                }`}
                                style={{
                                  backgroundColor: c.hex,
                                  borderColor: isSelected ? '#ffffff' : c.borderHex,
                                }}
                                title={c.name}
                              >
                                {isSelected && (
                                  <Check size={11} strokeWidth={3} className="text-white drop-shadow-sm" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <OrgAvatar
                          name={name || 'Organization'}
                          logoUrl={customImageUrl}
                          className="w-10 h-10"
                          iconSize={18}
                          roundedClassName="rounded-xl"
                        />
                        <input
                          type="url"
                          value={customImageUrl}
                          onChange={(e) => setCustomImageUrl(e.target.value)}
                          placeholder="https://example.com/logo.png"
                          disabled={!isAdminOrOwner}
                          className="w-full h-10 px-3.5 rounded-xl bg-[#0D0F14] border border-[#27272A] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-60"
                        />
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        Paste a direct HTTPS image URL for your organization brand or logo.
                      </p>
                    </div>
                  )}
                </div>
              </SettingsRow>

              {/* Organization Name */}
              <SettingsRow
                label="Organization Name"
                description="The public name of your company or workspace"
                required
              >
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isAdminOrOwner}
                  className="w-full h-10 px-3.5 rounded-xl bg-[#0D0F14] border border-[#27272A] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-60"
                />
              </SettingsRow>

              {/* Organization Slug */}
              <SettingsRow
                label="Organization Slug"
                description="Used in your organization URLs: /organizations/:slug"
                required
              >
                <div className="flex items-center">
                  <span className="h-10 px-3 flex items-center rounded-l-xl bg-[#08090B] border border-r-0 border-[#27272A] text-xs text-zinc-500 font-mono">
                    /organizations/
                  </span>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    disabled={!isAdminOrOwner}
                    className="w-full h-10 px-3 rounded-r-xl bg-[#0D0F14] border border-[#27272A] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono disabled:opacity-60"
                  />
                </div>
              </SettingsRow>

              {/* Website */}
              <SettingsRow
                label="Website URL"
                description="Company website or public product landing page"
              >
                <div className="relative flex items-center">
                  <Globe size={13} className="absolute left-3 text-zinc-500 pointer-events-none" />
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://acme.com"
                    disabled={!isAdminOrOwner}
                    className="w-full h-10 pl-8 pr-3.5 rounded-xl bg-[#0D0F14] border border-[#27272A] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-60"
                  />
                </div>
              </SettingsRow>

              {/* Industry */}
              <SettingsRow
                label="Industry"
                description="Primary sector or domain of your organization"
              >
                <div className="relative flex items-center">
                  <Briefcase size={13} className="absolute left-3 text-zinc-500 pointer-events-none" />
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    disabled={!isAdminOrOwner}
                    className="w-full h-10 pl-8 pr-3.5 rounded-xl bg-[#0D0F14] border border-[#27272A] text-xs text-white focus:outline-none focus:border-zinc-500 disabled:opacity-60 cursor-pointer"
                  >
                    <option value="">Select industry sector...</option>
                    {INDUSTRY_OPTIONS.map((ind) => (
                      <option key={ind} value={ind}>
                        {ind}
                      </option>
                    ))}
                  </select>
                </div>
              </SettingsRow>

              {/* Contact Details */}
              <SettingsRow
                label="Contact Details"
                description="Official support email and office/headquarters location"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative flex items-center">
                    <Mail size={13} className="absolute left-3 text-zinc-500 pointer-events-none" />
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="contact@company.com"
                      disabled={!isAdminOrOwner}
                      className="w-full h-10 pl-8 pr-3.5 rounded-xl bg-[#0D0F14] border border-[#27272A] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-60"
                    />
                  </div>
                  <div className="relative flex items-center">
                    <MapPin size={13} className="absolute left-3 text-zinc-500 pointer-events-none" />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. San Francisco, CA"
                      disabled={!isAdminOrOwner}
                      className="w-full h-10 pl-8 pr-3.5 rounded-xl bg-[#0D0F14] border border-[#27272A] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-60"
                    />
                  </div>
                </div>
              </SettingsRow>

              {/* Description */}
              <SettingsRow
                label="Description"
                description="Short summary of what your team or startup builds"
              >
                <textarea
                  rows={3}
                  value={cleanDescription}
                  onChange={(e) => setCleanDescription(e.target.value)}
                  placeholder="e.g. Building next-generation developer workflows."
                  disabled={!isAdminOrOwner}
                  className="w-full p-3 rounded-xl bg-[#0D0F14] border border-[#27272A] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-60 resize-none"
                />
              </SettingsRow>
            </div>

            {isAdminOrOwner && (
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingGeneral}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-50 cursor-pointer hover:brightness-110 transition-all"
                  style={{ backgroundColor: accentColor, boxShadow: `0 3px 14px ${accentColor}35` }}
                >
                  {isSavingGeneral ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>{isSavingGeneral ? 'Saving changes...' : 'Save Changes'}</span>
                </button>
              </div>
            )}
          </form>
        </SettingsSection>

        {/* ═══════════════════════════════════════════════════════════════════
            2. WORKSPACES & RESOURCES (Displays members, teams, projects, activities)
           ═══════════════════════════════════════════════════════════════════ */}
        <SettingsSection
          id="resources"
          title="Workspaces & Resources"
          description="Live summary of collaborators, teams, active projects, and recent activity."
        >
          <div className="space-y-6">
            {/* Stat Cards Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-2xl border border-[#27272A] bg-[#171A21] flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-[11px] font-mono uppercase tracking-wider">Members</span>
                  <Users size={15} style={{ color: accentColor }} />
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-bold text-white">
                    {overviewData?.summary?.totalMembers ?? members.length}
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono ml-1.5">active</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-[#27272A] bg-[#171A21] flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-[11px] font-mono uppercase tracking-wider">Teams</span>
                  <Layers size={15} className="text-purple-400" />
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-bold text-white">
                    {overviewData?.summary?.totalTeams ?? 0}
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono ml-1.5">teams</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-[#27272A] bg-[#171A21] flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-[11px] font-mono uppercase tracking-wider">Projects</span>
                  <FolderKanban size={15} className="text-emerald-400" />
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-bold text-white">
                    {overviewData?.summary?.totalProjects ?? 0}
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono ml-1.5">boards</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-[#27272A] bg-[#171A21] flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-[11px] font-mono uppercase tracking-wider">Open Tasks</span>
                  <Activity size={15} className="text-blue-400" />
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-bold text-white">
                    {overviewData?.summary?.openIssues ?? 0}
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono ml-1.5">in-flight</span>
                </div>
              </div>
            </div>

            {/* Split Grid: Teams & Projects Lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Teams List */}
              <div className="rounded-2xl border border-[#27272A] bg-[#171A21] p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#27272A]">
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Layers size={13} className="text-purple-400" />
                    <span>Teams ({overviewData?.teams?.length ?? 0})</span>
                  </h4>
                  <Link
                    to={`/organizations/${targetSlug}/teams`}
                    className="text-[11px] text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <span>View all</span>
                    <ArrowRight size={11} />
                  </Link>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                  {(overviewData?.teams || []).length === 0 ? (
                    <p className="text-xs text-zinc-500 italic py-3">No teams created in this organization yet.</p>
                  ) : (
                    overviewData?.teams?.map((t: any) => (
                      <Link
                        key={t.id}
                        to={`/organizations/${targetSlug}/teams/${t.id}`}
                        className="flex items-center justify-between p-2 rounded-xl bg-[#0D0F14] hover:bg-[#12131A] border border-[#27272A]/70 hover:border-zinc-500 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color || '#8B5CF6' }} />
                          <span className="text-xs font-medium text-white truncate">{t.name}</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                          {t._count?.members || 1} members
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              {/* Projects List */}
              <div className="rounded-2xl border border-[#27272A] bg-[#171A21] p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#27272A]">
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <FolderKanban size={13} className="text-emerald-400" />
                    <span>Projects ({overviewData?.projects?.length ?? 0})</span>
                  </h4>
                  <Link
                    to={`/organizations/${targetSlug}/projects`}
                    className="text-[11px] text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <span>View all</span>
                    <ArrowRight size={11} />
                  </Link>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                  {(overviewData?.projects || []).length === 0 ? (
                    <p className="text-xs text-zinc-500 italic py-3">No projects created yet.</p>
                  ) : (
                    overviewData?.projects?.map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-[#0D0F14] border border-[#27272A]/70 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="font-medium text-white truncate">{p.title}</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                          {p._count?.tasks || 0} tasks
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Recent Activity Feed */}
            <div className="rounded-2xl border border-[#27272A] bg-[#171A21] p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#27272A]">
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Activity size={13} className="text-blue-400" />
                  <span>Recent Organization Activity</span>
                </h4>
                <span className="text-[10px] font-mono text-zinc-500">Live feed</span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                {(overviewData?.recentActivities || []).length === 0 ? (
                  <p className="text-xs text-zinc-500 italic py-3">No recent activity recorded.</p>
                ) : (
                  overviewData?.recentActivities?.map((act: any) => (
                    <div
                      key={act.id}
                      className="p-2.5 rounded-xl bg-[#0D0F14] border border-[#27272A]/60 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {act.actor?.name?.charAt(0) || 'U'}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-white">{act.actor?.name || 'Collaborator'} </span>
                          <span className="text-zinc-400 lowercase">{act.action.replace(/_/g, ' ')}</span>
                        </div>
                      </div>
                      <span className="text-[10.5px] font-mono text-zinc-500 shrink-0">
                        {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </SettingsSection>

        {/* ═══════════════════════════════════════════════════════════════════
            3. MEMBERS & ACCESS (Invite email/link, Manage permissions, Deactivate)
           ═══════════════════════════════════════════════════════════════════ */}
        <SettingsSection
          id="members"
          title="Members & Access Permissions"
          description="Invite team members, assign Owner, Admin, Member, and Viewer roles, or deactivate collaborators."
        >
          <div className="rounded-2xl border border-[#27272A] bg-[#171A21] p-6 space-y-6">
            {/* 1. Quick Invite Box */}
            {isAdminOrOwner && (
              <div className="p-4 rounded-xl bg-[#0D0F14] border border-[#27272A] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <UserPlus size={13} style={{ color: accentColor }} />
                    <span>Invite New Collaborators</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-[#27272A] text-[11px] text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    title="Copy direct invite link"
                  >
                    {copiedInviteLink ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedInviteLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
                  </button>
                </div>

                <form onSubmit={handleSendInvite} className="flex flex-col sm:flex-row items-center gap-2.5">
                  <div className="relative flex-1 w-full">
                    <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="teammate@company.com"
                      className="w-full h-9 pl-8 pr-3 rounded-lg bg-[#14151B] border border-[#27272A] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                    />
                  </div>

                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as OrganizationRole)}
                    className="h-9 px-3 rounded-lg bg-[#14151B] border border-[#27272A] text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 cursor-pointer w-full sm:w-auto"
                  >
                    <option value="MEMBER">Member (Collaborator)</option>
                    <option value="ADMIN">Admin (Manager)</option>
                    <option value="VIEWER">Viewer (Read-only)</option>
                  </select>

                  <button
                    type="submit"
                    disabled={isSendingInvite || !inviteEmail.trim()}
                    className="h-9 px-4 rounded-lg text-xs font-semibold text-black hover:brightness-110 active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 w-full sm:w-auto"
                    style={{ backgroundColor: accentColor }}
                  >
                    {isSendingInvite ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                    <span>Send Invite</span>
                  </button>
                </form>
              </div>
            )}

            {/* 2. Active Members List with Permission Manager */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">Active Members ({members.length})</h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Manage role permissions (Owner, Admin, Member, Viewer) or deactivate access.
                  </p>
                </div>
              </div>

              <div className="divide-y divide-[#27272A]/70 border border-[#27272A] rounded-xl overflow-hidden bg-[#0D0F14]">
                {members.map((member) => {
                  const roleConfig = ROLE_PERMISSIONS_INFO[member.role] || ROLE_PERMISSIONS_INFO.MEMBER;
                  const canModify = isAdminOrOwner && member.role !== 'OWNER';

                  return (
                    <div
                      key={member.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Left: User Avatar & Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm"
                          style={{ backgroundColor: member.user.avatarColor || '#6D28D9' }}
                        >
                          {member.user.avatarUrl ? (
                            <img src={member.user.avatarUrl} alt={member.user.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            getOrgInitials(member.user.name)
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white truncate">{member.user.name}</span>
                            {member.isSelf && (
                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono bg-zinc-800 text-zinc-300">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-500 font-mono truncate block">{member.user.email}</span>
                        </div>
                      </div>

                      {/* Right: Role Dropdown & Actions */}
                      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                        {canModify ? (
                          <div className="relative">
                            <select
                              value={member.role}
                              onChange={(e) => handleChangeRole(member.id, e.target.value as OrganizationRole)}
                              className="h-8 pl-2.5 pr-7 rounded-lg bg-[#161720] border border-[#27272A] text-xs font-medium text-white focus:outline-none focus:border-zinc-500 cursor-pointer"
                              style={{ color: roleConfig.color }}
                            >
                              <option value="ADMIN">Admin</option>
                              <option value="MEMBER">Member</option>
                              <option value="VIEWER">Viewer</option>
                            </select>
                          </div>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold uppercase tracking-wider border"
                            style={{
                              backgroundColor: `${roleConfig.color}15`,
                              borderColor: `${roleConfig.color}35`,
                              color: roleConfig.color,
                            }}
                          >
                            {roleConfig.icon}
                            <span>{roleConfig.label}</span>
                          </span>
                        )}

                        {/* Deactivate / Remove button */}
                        {canModify && !member.isSelf && (
                          <button
                            type="button"
                            onClick={() => setMemberToRemove(member)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Deactivate / Remove collaborator"
                          >
                            <UserMinus size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Pending Invitations */}
            {invitations.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                  Pending Invitations ({invitations.length})
                </h4>
                <div className="divide-y divide-[#27272A]/70 border border-[#27272A] rounded-xl overflow-hidden bg-[#0D0F14]">
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Mail size={14} className="text-zinc-500 shrink-0" />
                        <span className="font-mono text-zinc-300 truncate">{inv.invitedEmail}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400">
                          {inv.assignedRole}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCancelInvite(inv.id)}
                          className="px-2 py-1 rounded-lg text-[11px] text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SettingsSection>

        {/* ═══════════════════════════════════════════════════════════════════
            4. SECURITY & OWNERSHIP TRANSFER
           ═══════════════════════════════════════════════════════════════════ */}
        <SettingsSection
          id="security"
          title="Security Policies & Ownership Transfer"
          description="Workspace security standards and secure organization ownership transfer."
        >
          <div className="rounded-2xl border border-[#27272A] bg-[#171A21] p-6 space-y-6">
            {/* Ownership Transfer Box (Secure) */}
            {isOwner && (
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/30 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-amber-300 flex items-center gap-1.5">
                      <ShieldAlert size={15} />
                      <span>Transfer Organization Ownership</span>
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
                      Transfer primary ownership of this organization to another active collaborator.
                      You will remain an organization Administrator with full access to projects.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/35 hover:bg-amber-500/25 transition-all shrink-0 cursor-pointer"
                  >
                    Transfer Ownership
                  </button>
                </div>
              </div>
            )}

            {/* Security Toggles */}
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-[#27272A]/70">
                <div>
                  <h4 className="text-xs font-semibold text-white">Require Two-Factor Authentication</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Mandates all organization collaborators configure 2FA on their account.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRequire2FA(!require2FA)}
                  disabled={!isAdminOrOwner}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer disabled:opacity-50 ${
                    require2FA ? 'bg-purple-600' : 'bg-zinc-800'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      require2FA ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-[#27272A]/70">
                <div>
                  <h4 className="text-xs font-semibold text-white">Restricted Member Invitations</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Only organization Owners and Admins can create invitations and add members.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRestrictInvitesToAdmins(!restrictInvitesToAdmins)}
                  disabled={!isAdminOrOwner}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer disabled:opacity-50 ${
                    restrictInvitesToAdmins ? 'bg-purple-600' : 'bg-zinc-800'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      restrictInvitesToAdmins ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-2 text-xs text-zinc-400">
                <span>Token Expiration Standard:</span>
                <span className="font-mono text-zinc-300">7 Days (Standard DevFlow Bearer TTL)</span>
              </div>
            </div>
          </div>
        </SettingsSection>

        {/* ═══════════════════════════════════════════════════════════════════
            5. DANGER ZONE
           ═══════════════════════════════════════════════════════════════════ */}
        {isOwner && (
          <SettingsSection
            id="danger"
            title="Danger Zone"
            description="Irreversible operations that permanently destroy organization data and resources."
            className="border-red-500/30"
          >
            <div className="rounded-2xl border border-red-500/30 bg-[#171A21] p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-red-400">Delete this organization</h4>
                  <p className="text-xs text-zinc-400 mt-1 max-w-lg leading-relaxed">
                    Permanently delete this organization, unlinking all teams, roadmaps, sprint boards, and invitations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors shrink-0 cursor-pointer shadow-md"
                >
                  Delete Organization
                </button>
              </div>
            </div>
          </SettingsSection>
        )}
      </div>

      {/* ─── MODAL: Deactivate / Remove Member Confirmation ─────────────── */}
      <AnimatePresence>
        {memberToRemove && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none"
            onClick={() => !isRemovingMember && setMemberToRemove(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl border border-[#27272A] bg-[#0E0F14] p-5 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400 shrink-0">
                  <UserMinus size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Deactivate Collaborator</h3>
                  <p className="text-xs text-zinc-400">Remove access to this organization</p>
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                Are you sure you want to deactivate <span className="font-semibold text-white">{memberToRemove.user.name}</span>?
                They will lose access to all projects, tasks, and teams under {name}.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMemberToRemove(null)}
                  disabled={isRemovingMember}
                  className="px-3.5 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRemoveMember}
                  disabled={isRemovingMember}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isRemovingMember ? <Loader2 size={13} className="animate-spin" /> : <UserMinus size={13} />}
                  <span>Deactivate Member</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: Secure Ownership Transfer ────────────────────────────── */}
      <AnimatePresence>
        {isTransferModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none"
            onClick={() => !isTransferring && setIsTransferModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#0E0F14] p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Transfer Organization Ownership</h3>
                  <p className="text-xs text-zinc-400">Irreversible administrative action</p>
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                Select an active collaborator to become the new primary owner of <span className="font-semibold text-white">{name}</span>.
                Your role will be converted to Admin.
              </p>

              <form onSubmit={handleTransferOwnership} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Select New Owner <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={selectedNewOwnerId}
                    onChange={(e) => setSelectedNewOwnerId(Number(e.target.value) || '')}
                    className="w-full h-10 px-3 rounded-xl bg-[#14151B] border border-[#27272A] text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="">Choose an active member...</option>
                    {members
                      .filter((m) => !m.isSelf && m.role !== 'OWNER')
                      .map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.user.name} ({m.user.email}) · {m.role}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Type <span className="font-mono text-amber-300">{slug}</span> to confirm
                  </label>
                  <input
                    type="text"
                    required
                    value={transferConfirmationPhrase}
                    onChange={(e) => setTransferConfirmationPhrase(e.target.value)}
                    placeholder={slug}
                    className="w-full h-10 px-3 rounded-xl bg-[#14151B] border border-[#27272A] text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    disabled={isTransferring}
                    className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedNewOwnerId || transferConfirmationPhrase.trim() !== slug || isTransferring}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  >
                    {isTransferring ? <Loader2 size={13} className="animate-spin" /> : <ShieldAlert size={13} />}
                    <span>Confirm Ownership Transfer</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: Delete Organization Confirmation ─────────────────────── */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none"
            onClick={() => !isDeleting && setIsDeleteModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#0E0F14] p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400 shrink-0">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Delete Organization</h3>
                  <p className="text-xs text-red-400">Warning: This action cannot be undone</p>
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                This will permanently delete <span className="font-semibold text-white">{name}</span>.
                All associated members, invitations, activity records, and unlinked project access will be lost.
              </p>

              <form onSubmit={handleDeleteOrganization} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Type <span className="font-mono text-red-400">{slug}</span> to confirm deletion
                  </label>
                  <input
                    type="text"
                    required
                    value={deleteConfirmationPhrase}
                    onChange={(e) => setDeleteConfirmationPhrase(e.target.value)}
                    placeholder={slug}
                    className="w-full h-10 px-3 rounded-xl bg-[#14151B] border border-[#27272A] text-xs text-white font-mono focus:outline-none focus:border-red-400"
                  />
                </div>

                {deleteError && (
                  <p className="text-xs text-red-400 flex items-center gap-1.5">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>{deleteError}</span>
                  </p>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                    disabled={isDeleting}
                    className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={deleteConfirmationPhrase.trim() !== slug || isDeleting}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  >
                    {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    <span>Delete Permanently</span>
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
