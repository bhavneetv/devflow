import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AccountSettingsLayout } from '../../../components/settings/AccountSettingsLayout';
import { SettingsPageHeader } from '../../../components/settings/SettingsPageHeader';
import { SettingsSectionNav, SettingsCategory } from '../../../components/settings/SettingsSectionNav';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { SettingsRow } from '../../../components/settings/SettingsRow';
import { AnimatedSelect, SelectOption } from '../../../components/settings/AnimatedSelect';
import { CustomDatePicker } from '../../../components/settings/CustomDatePicker';
import { accountSettingsService, UserProfileData } from '../../../services/accountSettings.service';
import { useToast } from '../../../context/ToastContext';
import { useAccentTheme } from '../../../services/accentTheme.service';
import {
  AVATAR_COLORS,
  QUICK_AVATAR_ICONS,
  MORE_AVATAR_ICONS,
  AvatarIconOption,
} from '../../../types/onboarding';
import { AVATAR_ICON_COMPONENTS } from '../../../components/onboarding/StepProfile';
import {
  Globe,
  Lock,
  Github,
  Linkedin,
  CheckCircle2,
  AlertCircle,
  Eye,
  Camera,
  Check,
  X,
  Sparkles,
  Phone,
  Calendar,
  Loader2,
  Smile,
  MoreHorizontal,
  Upload,
} from 'lucide-react';
import { useNavigation } from '../../../context/NavigationContext';
import { cn } from '../../../lib/utils';

const PROFILE_CATEGORIES: SettingsCategory[] = [
  { id: 'personal-information', label: 'Personal Information' },
  { id: 'public-profile', label: 'Public Profile' },
  { id: 'social-links', label: 'Social Links' },
];

const GENDER_OPTIONS: SelectOption[] = [
  { value: 'Female', label: 'Female', icon: '👩' },
  { value: 'Male', label: 'Male', icon: '👨' },
  { value: 'Non-binary', label: 'Non-binary', icon: '🧑' },
  { value: 'Prefer not to say', label: 'Prefer not to say', icon: '🤐' },
  { value: 'Other', label: 'Other', icon: '✨' },
];

const COUNTRY_OPTIONS: SelectOption[] = [
  { value: 'US', label: 'United States', icon: '🇺🇸', sublabel: '+1' },
  { value: 'GB', label: 'United Kingdom', icon: '🇬🇧', sublabel: '+44' },
  { value: 'CA', label: 'Canada', icon: '🇨🇦', sublabel: '+1' },
  { value: 'IN', label: 'India', icon: '🇮🇳', sublabel: '+91' },
  { value: 'DE', label: 'Germany', icon: '🇩🇪', sublabel: '+49' },
  { value: 'FR', label: 'France', icon: '🇫🇷', sublabel: '+33' },
  { value: 'JP', label: 'Japan', icon: '🇯🇵', sublabel: '+81' },
  { value: 'AU', label: 'Australia', icon: '🇦🇺', sublabel: '+61' },
  { value: 'NL', label: 'Netherlands', icon: '🇳🇱', sublabel: '+31' },
  { value: 'SG', label: 'Singapore', icon: '🇸🇬', sublabel: '+65' },
  { value: 'BR', label: 'Brazil', icon: '🇧🇷', sublabel: '+55' },
  { value: 'CH', label: 'Switzerland', icon: '🇨🇭', sublabel: '+41' },
  { value: 'SE', label: 'Sweden', icon: '🇸🇪', sublabel: '+46' },
  { value: 'ES', label: 'Spain', icon: '🇪🇸', sublabel: '+34' },
  { value: 'IT', label: 'Italy', icon: '🇮🇹', sublabel: '+39' },
  { value: 'KR', label: 'South Korea', icon: '🇰🇷', sublabel: '+82' },
  { value: 'IE', label: 'Ireland', icon: '🇮🇪', sublabel: '+353' },
  { value: 'NO', label: 'Norway', icon: '🇳🇴', sublabel: '+47' },
  { value: 'DK', label: 'Denmark', icon: '🇩🇰', sublabel: '+45' },
  { value: 'NZ', label: 'New Zealand', icon: '🇳🇿', sublabel: '+64' },
  { value: 'AT', label: 'Austria', icon: '🇦🇹', sublabel: '+43' },
  { value: 'PL', label: 'Poland', icon: '🇵🇱', sublabel: '+48' },
  { value: 'MX', label: 'Mexico', icon: '🇲🇽', sublabel: '+52' },
  { value: 'ZA', label: 'South Africa', icon: '🇿🇦', sublabel: '+27' },
  { value: 'AE', label: 'United Arab Emirates', icon: '🇦🇪', sublabel: '+971' },
  { value: 'ID', label: 'Indonesia', icon: '🇮🇩', sublabel: '+62' },
  { value: 'PT', label: 'Portugal', icon: '🇵🇹', sublabel: '+351' },
  { value: 'FI', label: 'Finland', icon: '🇫🇮', sublabel: '+358' },
  { value: 'BE', label: 'Belgium', icon: '🇧🇪', sublabel: '+32' },
];

export const ProfileSettingsPage: React.FC = () => {
  const { toast } = useToast();
  const { accentColor } = useAccentTheme();
  const { isCollapsed } = useNavigation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UserProfileData>(() => accountSettingsService.getProfile());
  const [formData, setFormData] = useState<UserProfileData>(profile);
  const [isSaving, setIsSaving] = useState(false);

  // Avatar customization popup
  const [showMoreModal, setShowMoreModal] = useState(false);

  // Username validation state
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'short'>('idle');
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const usernameDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loaded = accountSettingsService.getProfile();
    setProfile(loaded);
    setFormData(loaded);
  }, []);

  // Compute initials for avatar preview
  const initials = formData.displayName
    ?.trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'DF';

  const avatarColor = formData.avatarColor || '#7C3AED';
  const avatarType = formData.avatarType || 'upload';
  const isImageUpload = avatarType === 'upload';

  // Check if current icon is from the "more" popup
  const isCurrentMoreIcon =
    avatarType === 'icon' &&
    MORE_AVATAR_ICONS.some((icon) => icon.id === formData.avatarId);
  const CurrentMoreIconComponent =
    isCurrentMoreIcon && formData.avatarId
      ? AVATAR_ICON_COMPONENTS[formData.avatarId]
      : null;

  // General field change
  const handleChange = (field: keyof UserProfileData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Username input handler with animated loading spinner & availability check
  const handleUsernameChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setFormData((prev) => ({ ...prev, username: clean }));

    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);

    if (clean.length === 0) {
      setUsernameStatus('idle');
      setUsernameMessage(null);
      setIsCheckingUsername(false);
      return;
    }

    if (clean.length < 3) {
      setUsernameStatus('short');
      setUsernameMessage('Username must be at least 3 characters');
      setIsCheckingUsername(false);
      return;
    }

    // Trigger loading spinner
    setIsCheckingUsername(true);
    setUsernameStatus('checking');
    setUsernameMessage('Checking availability...');

    usernameDebounceRef.current = setTimeout(() => {
      setIsCheckingUsername(false);
      const reserved = ['admin', 'root', 'devflow', 'system', 'api', 'support', 'owner', 'bot'];
      if (reserved.includes(clean)) {
        setUsernameStatus('taken');
        setUsernameMessage(`@${clean} is a reserved system handle.`);
      } else {
        setUsernameStatus('available');
        setUsernameMessage(`@${clean} is available!`);
      }
    }, 450);
  };

  // Avatar Selection Handlers matching Onboarding
  const handleSelectInitials = () => {
    setFormData((prev) => ({
      ...prev,
      avatarType: 'initials',
      avatarId: 'initials',
    }));
  };

  const handleSelectIcon = (icon: AvatarIconOption) => {
    setFormData((prev) => ({
      ...prev,
      avatarType: 'icon',
      avatarId: icon.id,
    }));
    setShowMoreModal(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image exceeds 2MB limit. Please choose a smaller file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setFormData((prev) => ({
          ...prev,
          avatarType: 'upload',
          avatarUrl: result,
          avatarId: 'custom_upload',
        }));
        toast.success('Avatar image loaded! Click Save Changes to apply.');
      }
    };
    reader.readAsDataURL(file);
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

  // Render avatar element for preview
  const renderAvatarPreview = (sizeClass: string = 'w-16 h-16') => {
    if (avatarType === 'upload' && formData.avatarUrl) {
      return (
        <img
          src={formData.avatarUrl}
          alt={formData.displayName}
          className={`${sizeClass} rounded-2xl object-cover`}
        />
      );
    }

    if (avatarType === 'icon' && formData.avatarId) {
      const IconComponent = AVATAR_ICON_COMPONENTS[formData.avatarId] || Smile;
      return (
        <div
          className={`${sizeClass} rounded-2xl flex items-center justify-center text-white shadow-md`}
          style={{ backgroundColor: avatarColor }}
        >
          <IconComponent size={28} strokeWidth={2.2} />
        </div>
      );
    }

    // Initials fallback
    return (
      <div
        className={`${sizeClass} rounded-2xl flex items-center justify-center text-white font-mono font-bold text-lg shadow-md`}
        style={{ backgroundColor: avatarColor }}
      >
        {initials}
      </div>
    );
  };

  return (
    <AccountSettingsLayout>
      {/* Page Header with Profile Summary matching Reference Screenshot */}
      <SettingsPageHeader
        title="My Profile"
        description="Manage your personal information and public developer profile."
        profileSummary={{
          avatarNode: renderAvatarPreview('w-full h-full'),
          displayName: formData.displayName,
          username: formData.username,
          email: formData.email,
        }}
      />

      {/* Sticky Horizontal Category Navigation Bar */}
      <SettingsSectionNav categories={PROFILE_CATEGORIES} />

      {/* Scrollable Content Container */}
      <form onSubmit={handleSave} className="px-6 sm:px-8 pb-28 space-y-2">
        {/* ── Category A: Personal Information ───────────────────────────── */}
        <SettingsSection
          id="personal-information"
          title="Personal Details"
          description="Update your personal details, custom avatar, and account identity."
        >
          {/* Profile Picture Customizer (Exact Onboarding UI: Initials, Emojis, 3-dots, Upload & Colors) */}
          <SettingsRow
            label="Profile Avatar"
            description="Choose initials, developer emoji, or upload a custom photo."
          >
            <div className="space-y-4 max-w-lg">
              {/* Row 1: Live Avatar Preview + Avatar Type Selector Row */}
              <div className="flex items-center gap-4">
                {/* Live Avatar Preview */}
                <div className="relative flex-shrink-0">
                  <div
                    className="p-1 rounded-2xl border"
                    style={{
                      borderColor: `${accentColor}50`,
                      boxShadow: `0 0 16px ${accentColor}20`,
                    }}
                  >
                    {renderAvatarPreview('w-14 h-14 sm:w-16 sm:h-16')}
                  </div>
                </div>

                {/* Avatar Type Picker Row (same as onboarding: Initials, 5 Quick Icons, 3 dots, Upload) */}
                <div className="flex items-center gap-2 flex-wrap py-1 px-1">
                  {/* 1. Initials button */}
                  <button
                    type="button"
                    onClick={handleSelectInitials}
                    className={`relative w-8 h-8 rounded-full flex items-center justify-center font-mono text-[11px] font-semibold transition-all group ${
                      avatarType === 'initials'
                        ? 'ring-2 ring-offset-2 ring-offset-[#0C0D10] shadow-md scale-105'
                        : 'border border-white/[0.08] hover:scale-105 bg-[#17181D]'
                    }`}
                    style={{
                      backgroundColor: avatarType === 'initials' ? avatarColor : '#17181D',
                      color: avatarType === 'initials' ? '#FFFFFF' : '#A1A1AA',
                      borderColor: avatarType === 'initials' ? avatarColor : undefined,
                    }}
                    title="Use initials avatar"
                  >
                    {initials}
                    {avatarType === 'initials' && (
                      <div
                        className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center text-white text-[7px] shadow"
                        style={{ backgroundColor: accentColor }}
                      >
                        <Check size={8} strokeWidth={3} />
                      </div>
                    )}
                  </button>

                  {/* 2. 5 Quick Icons */}
                  {QUICK_AVATAR_ICONS.map((icon) => {
                    const isSelected = avatarType === 'icon' && formData.avatarId === icon.id;
                    const IconComponent = AVATAR_ICON_COMPONENTS[icon.id] || Smile;

                    return (
                      <button
                        key={icon.id}
                        type="button"
                        onClick={() => handleSelectIcon(icon)}
                        className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all group ${
                          isSelected
                            ? 'ring-2 ring-offset-2 ring-offset-[#0C0D10] shadow-md scale-105'
                            : 'border border-white/[0.08] hover:scale-105 bg-[#17181D]'
                        }`}
                        style={{
                          backgroundColor: isSelected ? avatarColor : '#17181D',
                          color: isSelected ? '#FFFFFF' : '#A1A1AA',
                          borderColor: isSelected ? avatarColor : undefined,
                        }}
                        title={icon.name}
                      >
                        <IconComponent size={14} strokeWidth={2.2} />
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

                  {/* 3. 3-Dots Button ('More' Emojis Popup) */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowMoreModal((prev) => !prev)}
                      className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all group ${
                        isCurrentMoreIcon
                          ? 'ring-2 ring-offset-2 ring-offset-[#0C0D10] shadow-md scale-105'
                          : 'border border-white/[0.08] hover:scale-105 bg-[#17181D] text-zinc-400 hover:text-white'
                      }`}
                      style={{
                        backgroundColor: isCurrentMoreIcon ? avatarColor : '#17181D',
                        color: isCurrentMoreIcon ? '#FFFFFF' : undefined,
                        borderColor: isCurrentMoreIcon ? avatarColor : undefined,
                      }}
                      title="More developer emoji icons"
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

                    {/* Popover Emoji Grid Modal */}
                    <AnimatePresence>
                      {showMoreModal && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: 10 }}
                          transition={{ duration: 0.18 }}
                          className="absolute left-0 bottom-11 z-50 p-3 rounded-2xl bg-[#17181D] border border-[#27272A] shadow-2xl w-68 sm:w-72 backdrop-blur-xl"
                        >
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.08]">
                            <span className="text-[11.5px] font-medium text-white flex items-center gap-1.5">
                              <Sparkles size={12} style={{ color: accentColor }} />
                              <span>Choose Emoji ({MORE_AVATAR_ICONS.length})</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowMoreModal(false)}
                              className="text-zinc-500 hover:text-white p-0.5 rounded transition-colors"
                            >
                              <X size={13} />
                            </button>
                          </div>

                          <div className="grid grid-cols-6 gap-1.5 max-h-52 overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-zinc-700">
                            {MORE_AVATAR_ICONS.map((icon) => {
                              const IconComponent = AVATAR_ICON_COMPONENTS[icon.id] || Sparkles;
                              const isSelected = avatarType === 'icon' && formData.avatarId === icon.id;

                              return (
                                <button
                                  key={icon.id}
                                  type="button"
                                  onClick={() => handleSelectIcon(icon)}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                    isSelected
                                      ? 'text-zinc-950 font-bold scale-105 shadow'
                                      : 'hover:bg-white/[0.08] text-zinc-300 hover:text-white'
                                  }`}
                                  style={isSelected ? { backgroundColor: accentColor } : undefined}
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

                  {/* 4. Upload Image Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all overflow-hidden ${
                      isImageUpload
                        ? 'ring-2 ring-offset-2 ring-offset-[#0C0D10] border-0 scale-105'
                        : 'border border-dashed border-white/[0.2] hover:border-white/50 bg-[#17181D] text-zinc-400 hover:text-white hover:scale-105'
                    }`}
                    title={isImageUpload ? 'Click to change photo' : 'Upload custom picture'}
                  >
                    {isImageUpload && formData.avatarUrl ? (
                      <img
                        src={formData.avatarUrl}
                        alt="Uploaded avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Upload size={13} />
                    )}
                    {isImageUpload && (
                      <div
                        className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center text-white text-[7px] shadow"
                        style={{ backgroundColor: accentColor }}
                      >
                        <Check size={8} strokeWidth={3} />
                      </div>
                    )}
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp, image/svg+xml"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>

              {/* Row 2: Avatar Color Palette (Visible when initials or icon is chosen) */}
              <AnimatePresence>
                {!isImageUpload && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="pt-2 border-t border-[#27272A]/70"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-medium text-zinc-300">
                        Avatar background color
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400">
                        {AVATAR_COLORS.find(
                          (c) => c.hex.toLowerCase() === avatarColor.toLowerCase()
                        )?.name || 'Custom'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap py-1">
                      {AVATAR_COLORS.map((color) => {
                        const isSelected = avatarColor.toLowerCase() === color.hex.toLowerCase();
                        return (
                          <button
                            key={color.id}
                            type="button"
                            onClick={() => handleChange('avatarColor', color.hex)}
                            className={`relative w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                              isSelected
                                ? 'scale-120 ring-2 ring-offset-2 ring-offset-[#0C0D10]'
                                : 'hover:scale-110 opacity-80 hover:opacity-100'
                            }`}
                            style={{
                              backgroundColor: color.hex,
                              borderColor: isSelected ? '#ffffff' : color.borderHex,
                            }}
                            title={color.name}
                          >
                            {isSelected && (
                              <Check
                                size={10}
                                strokeWidth={3}
                                className="text-white drop-shadow-sm"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
              className="w-full max-w-md px-3.5 py-2.5 bg-[#111216] border border-[#27272A] focus:border-[var(--settings-accent)] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] outline-none transition-colors"
              placeholder="e.g. Emily Johnson"
            />
          </SettingsRow>

          {/* Username with animated loading spinner & availability indicator */}
          <SettingsRow
            label="Username"
            required
            description="Unique developer handle across DevFlow."
          >
            <div className="max-w-md space-y-1.5">
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-xs text-[#71717A] font-mono">@</span>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={30}
                  value={formData.username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className="w-full pl-8 pr-10 py-2.5 bg-[#111216] border border-[#27272A] focus:border-[var(--settings-accent)] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] font-mono outline-none transition-colors"
                  placeholder="username"
                />

                {/* Right-side Indicator: Spinner / Available / Taken */}
                <div className="absolute right-3 flex items-center justify-center pointer-events-none">
                  {isCheckingUsername ? (
                    <Loader2 size={15} className="animate-spin text-zinc-400" />
                  ) : usernameStatus === 'available' ? (
                    <CheckCircle2 size={15} className="text-emerald-400" />
                  ) : usernameStatus === 'taken' || usernameStatus === 'short' ? (
                    <AlertCircle size={15} className="text-red-400" />
                  ) : null}
                </div>
              </div>

              {/* Dynamic status feedback text */}
              {usernameMessage && (
                <p
                  className={`text-[11px] font-medium flex items-center gap-1 ${
                    usernameStatus === 'available'
                      ? 'text-emerald-400'
                      : usernameStatus === 'checking'
                      ? 'text-zinc-400'
                      : 'text-red-400'
                  }`}
                >
                  {usernameMessage}
                </p>
              )}
              {!usernameMessage && (
                <p className="text-[11px] text-[#71717A]">
                  Letters, numbers, and underscores only.
                </p>
              )}
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
                className="w-full px-3.5 py-2.5 bg-[#161619] border border-[#27272A] rounded-lg text-xs sm:text-[13px] text-zinc-300 font-mono outline-none cursor-not-allowed opacity-90"
              />
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                <CheckCircle2 size={12} />
                <span>Verified</span>
              </span>
            </div>
          </SettingsRow>

          {/* Date of Birth (DOB) - Custom Dark Popover Picker */}
          <SettingsRow label="Date of Birth" description="Account birthdate for verification.">
            <div className="max-w-md">
              <CustomDatePicker
                value={formData.dateOfBirth || ''}
                onChange={(val) => handleChange('dateOfBirth', val)}
                placeholder="Select date of birth..."
              />
            </div>
          </SettingsRow>

          {/* Gender (Animated Select Dropdown with Search & Blur) */}
          <SettingsRow label="Gender" description="Gender identity.">
            <div className="max-w-md">
              <AnimatedSelect
                value={formData.gender || 'Female'}
                onChange={(val) => handleChange('gender', val)}
                options={GENDER_OPTIONS}
                placeholder="Select gender..."
                searchPlaceholder="Search gender..."
                accentColor={accentColor}
              />
            </div>
          </SettingsRow>

          {/* Country with Flags (Animated Select Dropdown with Search & Blur) */}
          <SettingsRow label="Country" description="Residence country with flag identifier.">
            <div className="max-w-md">
              <AnimatedSelect
                value={formData.country || 'US'}
                onChange={(val) => handleChange('country', val)}
                options={COUNTRY_OPTIONS}
                placeholder="Select country..."
                searchPlaceholder="Search country or dial code..."
                accentColor={accentColor}
              />
            </div>
          </SettingsRow>

          {/* Phone Number */}
          <SettingsRow label="Phone Number" description="Used for urgent security notifications.">
            <div className="max-w-md relative flex items-center">
              <span className="absolute left-3.5 text-[#71717A]">
                <Phone size={14} />
              </span>
              <input
                type="tel"
                value={formData.phoneNumber || ''}
                onChange={(e) => handleChange('phoneNumber', e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#111216] border border-[#27272A] focus:border-[var(--settings-accent)] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] font-mono outline-none transition-colors"
                placeholder="(213) 555-1234"
              />
            </div>
          </SettingsRow>

          {/* Job Title */}
          <SettingsRow label="Job Title" description="Your professional role or title.">
            <input
              type="text"
              value={formData.jobTitle || ''}
              onChange={(e) => handleChange('jobTitle', e.target.value)}
              className="w-full max-w-md px-3.5 py-2.5 bg-[#111216] border border-[#27272A] focus:border-[var(--settings-accent)] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] outline-none transition-colors"
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
                className="w-full px-3.5 py-2.5 bg-[#111216] border border-[#27272A] focus:border-[var(--settings-accent)] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] outline-none resize-none transition-colors"
                placeholder="Tell teammates a little about what you work on..."
              />
              <div className="text-right text-[11px] text-[#71717A] mt-1">
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
          {/* Public / Private Profile Visibility Switcher */}
          <SettingsRow
            label="Profile Visibility"
            description="Choose whether your developer profile is visible to team members or private."
          >
            <div className="max-w-md space-y-3">
              {/* Interactive Segmented Dual-Card Switcher with Smooth Sliding Glider */}
              <div className="grid grid-cols-2 gap-2.5 p-1 bg-[#0E0F13] border border-[#27272A] rounded-xl relative">
                {/* Option 1: Public Profile */}
                <button
                  type="button"
                  onClick={() => handleChange('isPublicProfile', true)}
                  className={`relative flex flex-col items-start p-3 rounded-lg text-left transition-all cursor-pointer z-10 ${
                    formData.isPublicProfile
                      ? 'text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {formData.isPublicProfile && (
                    <motion.div
                      layoutId="profileVisibilityGlider"
                      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                      className="absolute inset-0 bg-gradient-to-br from-[#1A1D26] to-[#12141A] border rounded-lg shadow-lg"
                      style={{
                        borderColor: `${accentColor}70`,
                        boxShadow: `0 0 16px ${accentColor}25`,
                      }}
                    />
                  )}
                  <div className="relative z-10 flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                        style={{
                          backgroundColor: formData.isPublicProfile ? `${accentColor}25` : '#181A20',
                          color: formData.isPublicProfile ? accentColor : '#A1A1AA',
                        }}
                      >
                        <Globe size={15} />
                      </div>
                      <span className="text-xs font-bold text-white">Public</span>
                    </div>
                    {formData.isPublicProfile && (
                      <span
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ backgroundColor: accentColor }}
                      />
                    )}
                  </div>
                  <p className="relative z-10 text-[11px] text-zinc-400 leading-snug mt-1">
                    Visible to all members across workspace.
                  </p>
                </button>

                {/* Option 2: Private Profile */}
                <button
                  type="button"
                  onClick={() => handleChange('isPublicProfile', false)}
                  className={`relative flex flex-col items-start p-3 rounded-lg text-left transition-all cursor-pointer z-10 ${
                    !formData.isPublicProfile
                      ? 'text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {!formData.isPublicProfile && (
                    <motion.div
                      layoutId="profileVisibilityGlider"
                      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                      className="absolute inset-0 bg-gradient-to-br from-[#1A1D26] to-[#12141A] border rounded-lg shadow-lg"
                      style={{
                        borderColor: `${accentColor}70`,
                        boxShadow: `0 0 16px ${accentColor}25`,
                      }}
                    />
                  )}
                  <div className="relative z-10 flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                        style={{
                          backgroundColor: !formData.isPublicProfile ? `${accentColor}25` : '#181A20',
                          color: !formData.isPublicProfile ? accentColor : '#A1A1AA',
                        }}
                      >
                        <Lock size={15} />
                      </div>
                      <span className="text-xs font-bold text-white">Private</span>
                    </div>
                    {!formData.isPublicProfile && (
                      <span
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ backgroundColor: accentColor }}
                      />
                    )}
                  </div>
                  <p className="relative z-10 text-[11px] text-zinc-400 leading-snug mt-1">
                    Hidden from teammate directory.
                  </p>
                </button>
              </div>

              {/* Status explanation badge */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={formData.isPublicProfile ? 'public-badge' : 'private-badge'}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${
                    formData.isPublicProfile
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                  }`}
                >
                  {formData.isPublicProfile ? (
                    <>
                      <Globe size={13} className="text-emerald-400 flex-shrink-0" />
                      <span>Profile is publicly indexed across DevFlow workspace teammates.</span>
                    </>
                  ) : (
                    <>
                      <Lock size={13} className="text-amber-400 flex-shrink-0" />
                      <span>Profile card is hidden from directory and non-admin members.</span>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </SettingsRow>

          {/* Live Card Preview */}
          <div className="pt-2">
            <div className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Eye size={13} style={{ color: accentColor }} />
              <span>Teammate View Preview</span>
            </div>

            <div className="p-5 bg-[#171A21] border border-[#27272A] rounded-2xl max-w-md shadow-xl space-y-4">
              <div className="flex items-start gap-3.5">
                <div
                  className="w-12 h-12 rounded-2xl overflow-hidden border flex-shrink-0 flex items-center justify-center"
                  style={{
                    borderColor: `${accentColor}80`,
                    boxShadow: `0 0 0 2px ${accentColor}25`,
                  }}
                >
                  {renderAvatarPreview('w-full h-full')}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-[#F4F4F5] truncate">
                      {formData.displayName || 'Developer Name'}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono" style={{ color: accentColor }}>
                    @{formData.username || 'username'}
                  </div>
                  <div className="text-xs text-[#A1A1AA] mt-0.5">
                    {formData.jobTitle || 'Developer'} • {formData.country || 'Remote'}
                  </div>
                </div>
              </div>

              {formData.bio && (
                <p className="text-xs text-zinc-300 leading-relaxed border-t border-[#27272A]/70 pt-3">
                  "{formData.bio}"
                </p>
              )}

              <div className="flex items-center gap-2 pt-1 border-t border-[#27272A]/70">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
                  style={{
                    backgroundColor: `${accentColor}20`,
                    color: accentColor,
                    borderColor: `${accentColor}40`,
                  }}
                >
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
              <span className="absolute left-3.5 text-[#A1A1AA]">
                <Github size={15} />
              </span>
              <input
                type="url"
                value={formData.githubUrl || ''}
                onChange={(e) => handleChange('githubUrl', e.target.value)}
                placeholder="https://github.com/username"
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#111216] border border-[#27272A] focus:border-[var(--settings-accent)] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] outline-none transition-colors"
              />
            </div>
          </SettingsRow>

          {/* LinkedIn URL */}
          <SettingsRow
            label="LinkedIn Profile"
            description="Professional profile network URL."
          >
            <div className="max-w-md relative flex items-center">
              <span className="absolute left-3.5 text-[#A1A1AA]">
                <Linkedin size={15} />
              </span>
              <input
                type="url"
                value={formData.linkedinUrl || ''}
                onChange={(e) => handleChange('linkedinUrl', e.target.value)}
                placeholder="https://linkedin.com/in/username"
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#111216] border border-[#27272A] focus:border-[var(--settings-accent)] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] outline-none transition-colors"
              />
            </div>
          </SettingsRow>

          {/* Personal Website */}
          <SettingsRow
            label="Personal Website"
            description="Blog, portfolio, or personal website."
          >
            <div className="max-w-md relative flex items-center">
              <span className="absolute left-3.5 text-[#A1A1AA]">
                <Globe size={15} />
              </span>
              <input
                type="url"
                value={formData.websiteUrl || ''}
                onChange={(e) => handleChange('websiteUrl', e.target.value)}
                placeholder="https://yourwebsite.com"
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#111216] border border-[#27272A] focus:border-[var(--settings-accent)] rounded-lg text-xs sm:text-[13px] text-[#F4F4F5] outline-none transition-colors"
              />
            </div>
          </SettingsRow>
        </SettingsSection>

        {/* ── Fixed Bottom Actions Bar ───────────────────────────────────── */}
        <div
          className={cn(
            'fixed bottom-0 right-0 z-40 bg-[#0D0F14]/95 backdrop-blur-xl border-t border-[#27272A] px-6 sm:px-8 py-3.5 flex items-center justify-between shadow-[0_-8px_30px_rgba(0,0,0,0.7)] transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]',
            isCollapsed ? 'left-0 md:left-[60px]' : 'left-0 md:left-[250px]'
          )}
        >
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
            <span className="hidden sm:inline">Profile Settings</span>
            <span className="text-zinc-600 hidden sm:inline">•</span>
            <span className="text-zinc-500 text-[11px]">Save changes to update workspace identity</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg border border-[#27272A] hover:border-zinc-500 text-xs font-semibold text-[#A1A1AA] hover:text-white bg-[#14161C] hover:bg-[#1A1C23] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-lg text-black font-bold text-xs shadow-lg transition-all disabled:opacity-50 cursor-pointer hover:brightness-110 active:scale-[0.98]"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 4px 14px ${accentColor}40`,
              }}
            >
              {isSaving ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </AccountSettingsLayout>
  );
};
