import React, { useState, useEffect } from 'react';
import { AccountSettingsLayout } from '../../../components/settings/AccountSettingsLayout';
import { SettingsPageHeader } from '../../../components/settings/SettingsPageHeader';
import { SettingsSectionNav, SettingsCategory } from '../../../components/settings/SettingsSectionNav';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { SettingsRow } from '../../../components/settings/SettingsRow';
import { ProfileAvatarEditor } from '../../../components/settings/ProfileAvatarEditor';
import { accountSettingsService, UserProfileData } from '../../../services/accountSettings.service';
import { useToast } from '../../../context/ToastContext';
import {
  Globe,
  Github,
  Linkedin,
  CheckCircle2,
  Eye,
  Camera,
  Check,
  Sparkles,
} from 'lucide-react';

const PROFILE_CATEGORIES: SettingsCategory[] = [
  { id: 'personal-information', label: 'Personal Information' },
  { id: 'public-profile', label: 'Public Profile' },
  { id: 'social-links', label: 'Social Links' },
];

export const ProfileSettingsPage: React.FC = () => {
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfileData>(() => accountSettingsService.getProfile());
  const [formData, setFormData] = useState<UserProfileData>(profile);
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const loaded = accountSettingsService.getProfile();
    setProfile(loaded);
    setFormData(loaded);
  }, []);

  // Form field change handler
  const handleChange = (field: keyof UserProfileData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (field === 'username') {
      const clean = String(value).toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (clean.length >= 3) {
        setUsernameAvailable(true);
      } else {
        setUsernameAvailable(false);
      }
    }
  };

  const handleAvatarSaved = (newAvatarUrl: string) => {
    setFormData((prev) => ({ ...prev, avatarUrl: newAvatarUrl }));
    handleChange('avatarUrl', newAvatarUrl);
    toast.info('Avatar updated! Click Save Changes to apply.');
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.displayName.trim()) {
      toast.error('Display name is required.');
      return;
    }

    try {
      setIsSaving(true);
      const updated = await accountSettingsService.updateProfile(formData);
      setProfile(updated);
      setFormData(updated);
      toast.success('Profile changes saved successfully!');
    } catch {
      toast.error('Failed to save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(profile);
    toast.info('Changes discarded.');
  };

  return (
    <AccountSettingsLayout>
      {/* Page Header with Profile Summary matching Reference Screenshot */}
      <SettingsPageHeader
        title="My Profile"
        description="Manage your personal information and public developer profile."
        profileSummary={{
          avatarUrl: formData.avatarUrl,
          displayName: formData.displayName,
          username: formData.username,
          email: formData.email,
          isVerified: formData.isEmailVerified,
          onEditAvatar: () => setIsAvatarEditorOpen(true),
          onEditClick: () => {
            const el = document.getElementById('personal-information');
            el?.scrollIntoView({ behavior: 'smooth' });
          },
        }}
      />

      {/* Sticky Horizontal Category Navigation Bar */}
      <SettingsSectionNav categories={PROFILE_CATEGORIES} />

      {/* Scrollable Content Container */}
      <form onSubmit={handleSave} className="px-6 sm:px-8 pb-16 space-y-2">
        {/* ── Category A: Personal Information ───────────────────────────── */}
        <SettingsSection
          id="personal-information"
          title="Personal Details"
          description="Update your personal details, profile picture, and account identity."
        >
          {/* Profile Picture Row */}
          <SettingsRow
            label="Profile Picture"
            description="JPG, PNG, or WebP. Max size 3MB."
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full overflow-hidden border border-[#27272A] bg-zinc-900 flex-shrink-0">
                <img
                  src={formData.avatarUrl}
                  alt={formData.displayName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAvatarEditorOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#27272A] hover:border-[#A78BFA] bg-[#171A21] hover:bg-[#1E222A] text-xs font-medium text-[#F4F4F5] transition-all"
                >
                  <Camera size={13} className="text-[#A78BFA]" />
                  <span>Change Avatar</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleChange(
                      'avatarUrl',
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'
                    )
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-transparent hover:border-[#27272A] text-xs text-[#71717A] hover:text-[#A1A1AA] transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </SettingsRow>

          {/* Full Name / Display Name */}
          <SettingsRow label="Full Name" required description="Your public display name.">
            <input
              type="text"
              required
              maxLength={50}
              value={formData.displayName}
              onChange={(e) => handleChange('displayName', e.target.value)}
              className="w-full max-w-md px-3 py-2 bg-[#111216] border border-[#27272A] focus:border-[#A78BFA] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] outline-none transition-colors"
              placeholder="e.g. Emily Johnson"
            />
          </SettingsRow>

          {/* Username */}
          <SettingsRow
            label="Username"
            required
            description="Unique developer handle across DevFlow."
          >
            <div className="max-w-md">
              <div className="relative flex items-center">
                <span className="absolute left-3 text-xs text-[#71717A] font-mono">@</span>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={30}
                  value={formData.username}
                  onChange={(e) =>
                    handleChange(
                      'username',
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                    )
                  }
                  className="w-full pl-7 pr-10 py-2 bg-[#111216] border border-[#27272A] focus:border-[#A78BFA] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] font-mono outline-none transition-colors"
                  placeholder="username"
                />
                {usernameAvailable && (
                  <span
                    title="Username is available"
                    className="absolute right-3 text-emerald-400"
                  >
                    <Check size={14} />
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#71717A] mt-1">
                Letters, numbers, and underscores only.
              </p>
            </div>
          </SettingsRow>

          {/* Email Address */}
          <SettingsRow
            label="Email Address"
            description="Primary communication and security notifications."
          >
            <div className="flex items-center gap-2 max-w-md">
              <input
                type="email"
                readOnly
                value={formData.email}
                className="w-full px-3 py-2 bg-[#161619] border border-[#27272A] rounded-lg text-xs sm:text-[13px] text-zinc-300 font-mono outline-none cursor-not-allowed opacity-90"
              />
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                <CheckCircle2 size={12} />
                <span>Verified</span>
              </span>
            </div>
          </SettingsRow>

          {/* Date of Birth (Matches Reference Screenshot) */}
          <SettingsRow label="Date of Birth" description="Account verification date.">
            <input
              type="text"
              value={formData.dateOfBirth || 'January 1, 1987'}
              onChange={(e) => handleChange('dateOfBirth', e.target.value)}
              className="w-full max-w-md px-3 py-2 bg-[#111216] border border-[#27272A] focus:border-[#A78BFA] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] outline-none transition-colors"
              placeholder="e.g. January 1, 1987"
            />
          </SettingsRow>

          {/* Gender (Matches Reference Screenshot) */}
          <SettingsRow label="Gender" description="Gender identity.">
            <select
              value={formData.gender || 'Female'}
              onChange={(e) => handleChange('gender', e.target.value)}
              className="w-full max-w-md px-3 py-2 bg-[#111216] border border-[#27272A] focus:border-[#A78BFA] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] outline-none transition-colors"
            >
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </SettingsRow>

          {/* Nationality (Matches Reference Screenshot) */}
          <SettingsRow label="Nationality" description="Citizenship or residency.">
            <input
              type="text"
              value={formData.nationality || 'American'}
              onChange={(e) => handleChange('nationality', e.target.value)}
              className="w-full max-w-md px-3 py-2 bg-[#111216] border border-[#27272A] focus:border-[#A78BFA] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] outline-none transition-colors"
              placeholder="e.g. American"
            />
          </SettingsRow>

          {/* Address / Location (Matches Reference Screenshot) */}
          <SettingsRow label="Address / Region" description="City, state, or country.">
            <div className="max-w-md relative flex items-center">
              <span className="absolute left-3 text-sm">🇺🇸</span>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#111216] border border-[#27272A] focus:border-[#A78BFA] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] outline-none transition-colors"
                placeholder="e.g. California - United States"
              />
            </div>
          </SettingsRow>

          {/* Phone Number (Matches Reference Screenshot) */}
          <SettingsRow label="Phone Number" description="Used for urgent security alerts.">
            <input
              type="tel"
              value={formData.phoneNumber || '(213) 555-1234'}
              onChange={(e) => handleChange('phoneNumber', e.target.value)}
              className="w-full max-w-md px-3 py-2 bg-[#111216] border border-[#27272A] focus:border-[#A78BFA] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] font-mono outline-none transition-colors"
              placeholder="(213) 555-1234"
            />
          </SettingsRow>

          {/* Job Title */}
          <SettingsRow label="Job Title" description="Your professional role or title.">
            <input
              type="text"
              value={formData.jobTitle}
              onChange={(e) => handleChange('jobTitle', e.target.value)}
              className="w-full max-w-md px-3 py-2 bg-[#111216] border border-[#27272A] focus:border-[#A78BFA] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] outline-none transition-colors"
              placeholder="e.g. Senior Staff Engineer"
            />
          </SettingsRow>

          {/* Bio */}
          <SettingsRow
            label="Bio"
            description="Brief summary of your background and technical interests."
          >
            <div className="max-w-md">
              <textarea
                rows={3}
                maxLength={160}
                value={formData.bio}
                onChange={(e) => handleChange('bio', e.target.value)}
                className="w-full px-3 py-2 bg-[#111216] border border-[#27272A] focus:border-[#A78BFA] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] outline-none resize-none transition-colors"
                placeholder="Tell teammates a little about what you work on..."
              />
              <div className="text-right text-[11px] text-[#71717A]">
                {formData.bio.length} / 160 characters
              </div>
            </div>
          </SettingsRow>
        </SettingsSection>

        {/* ── Category B: Public Profile ─────────────────────────────────── */}
        <SettingsSection
          id="public-profile"
          title="Public Profile & Visibility"
          description="Control how your profile appears to other DevFlow workspace members."
        >
          {/* Public Profile Visibility Toggle */}
          <SettingsRow
            label="Profile Visibility"
            description="Allow teammates and workspace members to see your profile card."
          >
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isPublicProfile}
                onChange={(e) => handleChange('isPublicProfile', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#A78BFA]" />
              <span className="ml-3 text-xs text-zinc-300">
                {formData.isPublicProfile ? 'Public to Workspace' : 'Hidden / Private'}
              </span>
            </label>
          </SettingsRow>

          {/* Live Card Preview */}
          <div className="pt-2">
            <div className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Eye size={13} className="text-[#A78BFA]" />
              <span>Teammate View Preview</span>
            </div>

            <div className="p-5 bg-[#171A21] border border-[#27272A] rounded-2xl max-w-md shadow-xl space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-full overflow-hidden border border-[#A78BFA]/40 ring-2 ring-[#A78BFA]/10 flex-shrink-0">
                  <img
                    src={formData.avatarUrl}
                    alt={formData.displayName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-[#F4F4F5] truncate">
                      {formData.displayName || 'Developer Name'}
                    </span>
                    <span className="text-[#3B82F6]">
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-[#A78BFA]">
                    @{formData.username || 'username'}
                  </div>
                  <div className="text-xs text-[#A1A1AA] mt-0.5">
                    {formData.jobTitle || 'Developer'} • {formData.location || 'Remote'}
                  </div>
                </div>
              </div>

              {formData.bio && (
                <p className="text-xs text-zinc-300 leading-relaxed border-t border-[#27272A]/70 pt-3">
                  "{formData.bio}"
                </p>
              )}

              <div className="flex items-center gap-2 pt-1 border-t border-[#27272A]/70">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#A78BFA]/15 text-[#C4B5FD] border border-[#A78BFA]/30">
                  <Sparkles size={10} />
                  <span>Verified Member</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span>Available for Reviews</span>
                </span>
              </div>
            </div>
          </div>
        </SettingsSection>

        {/* ── Category C: Social Links ───────────────────────────────────── */}
        <SettingsSection
          id="social-links"
          title="Social & Professional Links"
          description="Link your public portfolio, GitHub profile, and LinkedIn identity."
        >
          {/* GitHub URL */}
          <SettingsRow
            label="GitHub Profile"
            description="Your public GitHub profile URL."
          >
            <div className="max-w-md relative flex items-center">
              <span className="absolute left-3 text-[#A1A1AA]">
                <Github size={15} />
              </span>
              <input
                type="url"
                value={formData.githubUrl || ''}
                onChange={(e) => handleChange('githubUrl', e.target.value)}
                placeholder="https://github.com/username"
                className="w-full pl-9 pr-3 py-2 bg-[#111216] border border-[#27272A] focus:border-[#A78BFA] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] outline-none transition-colors"
              />
            </div>
          </SettingsRow>

          {/* LinkedIn URL */}
          <SettingsRow
            label="LinkedIn Profile"
            description="Professional profile network URL."
          >
            <div className="max-w-md relative flex items-center">
              <span className="absolute left-3 text-[#A1A1AA]">
                <Linkedin size={15} />
              </span>
              <input
                type="url"
                value={formData.linkedinUrl || ''}
                onChange={(e) => handleChange('linkedinUrl', e.target.value)}
                placeholder="https://linkedin.com/in/username"
                className="w-full pl-9 pr-3 py-2 bg-[#111216] border border-[#27272A] focus:border-[#A78BFA] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] outline-none transition-colors"
              />
            </div>
          </SettingsRow>

          {/* Personal Website */}
          <SettingsRow
            label="Personal Website"
            description="Blog, portfolio, or personal website."
          >
            <div className="max-w-md relative flex items-center">
              <span className="absolute left-3 text-[#A1A1AA]">
                <Globe size={15} />
              </span>
              <input
                type="url"
                value={formData.websiteUrl || ''}
                onChange={(e) => handleChange('websiteUrl', e.target.value)}
                placeholder="https://yourwebsite.com"
                className="w-full pl-9 pr-3 py-2 bg-[#111216] border border-[#27272A] focus:border-[#A78BFA] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] outline-none transition-colors"
              />
            </div>
          </SettingsRow>
        </SettingsSection>

        {/* ── Form Actions Bar ───────────────────────────────────────────── */}
        <div className="pt-6 flex items-center justify-end gap-3 sticky bottom-0 bg-[#0F1012]/90 backdrop-blur py-4 border-t border-[#27272A]">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg border border-[#27272A] hover:border-zinc-500 text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 rounded-lg bg-[#A78BFA] hover:bg-[#9061F9] text-black font-semibold text-xs shadow-lg transition-all disabled:opacity-50"
          >
            {isSaving ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Profile Avatar Selection & Upload Modal */}
      <ProfileAvatarEditor
        isOpen={isAvatarEditorOpen}
        onClose={() => setIsAvatarEditorOpen(false)}
        currentAvatar={formData.avatarUrl}
        onSaveAvatar={handleAvatarSaved}
      />
    </AccountSettingsLayout>
  );
};
