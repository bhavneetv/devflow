import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smile,
  Code2,
  Bug,
  Terminal,
  Zap,
  MoreHorizontal,
  Upload,
  Check,
  X,
  Rocket,
  Cpu,
  Layers,
  Compass,
  Shield,
  Flame,
  GitBranch,
  Database,
  Glasses,
  Coffee,
  Heart,
  Bot,
  Gamepad2,
  Atom,
  Cloud,
  Key,
  Globe,
  Sparkles,
  Laptop,
  Fingerprint,
  Feather,
  Ghost,
  Moon,
  Sun,
  Activity,
  Wifi,
  Package,
  Wrench,
  LucideIcon,
  AtSign,
} from 'lucide-react';
import {
  OnboardingData,
  AVATAR_COLORS,
  ACCENT_COLORS,
  QUICK_AVATAR_ICONS,
  MORE_AVATAR_ICONS,
  AvatarIconOption,
} from '../../types/onboarding';
import { useToast } from '../../context/ToastContext';
import { saveAccentColor } from '../../services/accentTheme.service';
import { accountSettingsService } from '../../services/accountSettings.service';

interface StepProfileProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
  error?: string;
  usernameError?: string;
  isCheckingUsername?: boolean;
}

// Master icon lookup for avatars (5 quick icons + 28 popup emojis)
export const AVATAR_ICON_COMPONENTS: Record<string, LucideIcon> = {
  smile: Smile,
  code: Code2,
  bug: Bug,
  terminal: Terminal,
  zap: Zap,
  rocket: Rocket,
  cpu: Cpu,
  layers: Layers,
  compass: Compass,
  shield: Shield,
  flame: Flame,
  'git-branch': GitBranch,
  database: Database,
  glasses: Glasses,
  coffee: Coffee,
  heart: Heart,
  bot: Bot,
  gamepad: Gamepad2,
  atom: Atom,
  cloud: Cloud,
  key: Key,
  globe: Globe,
  sparkles: Sparkles,
  laptop: Laptop,
  fingerprint: Fingerprint,
  feather: Feather,
  ghost: Ghost,
  moon: Moon,
  sun: Sun,
  activity: Activity,
  wifi: Wifi,
  package: Package,
  wrench: Wrench,
};

export const StepProfile: React.FC<StepProfileProps> = ({
  data,
  onChange,
  error,
  usernameError,
  isCheckingUsername,
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [hasManualUsername, setHasManualUsername] = useState(false);
  const [localChecking, setLocalChecking] = useState(false);
  const [localStatus, setLocalStatus] = useState<'idle' | 'available' | 'taken'>('idle');
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const checkAvailability = (username: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const clean = username.trim().toLowerCase().replace(/^@+/, '');
    if (!clean || clean.length < 3) {
      setLocalStatus('idle');
      setLocalMessage(null);
      setLocalChecking(false);
      return;
    }

    setLocalChecking(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await accountSettingsService.checkUsernameAvailability(clean);
        setLocalChecking(false);
        if (res.available) {
          setLocalStatus('available');
          setLocalMessage(`@${clean} is available`);
        } else {
          setLocalStatus('taken');
          setLocalMessage(res.message || `@${clean} is already taken`);
        }
      } catch {
        setLocalChecking(false);
        setLocalStatus('idle');
      }
    }, 350);
  };

  const initials = data.displayName
    ?.trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'DF';

  const avatarColor = data.avatarColor || '#7C3AED';
  const isImageUpload = data.avatarType === 'upload';

  // Handle display name typing with automatic username generation
  const handleNameChange = (name: string) => {
    const updates: Partial<OnboardingData> = { displayName: name };
    if (!hasManualUsername) {
      const autoHandle = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      updates.username = autoHandle;
      checkAvailability(autoHandle);
    }
    onChange(updates);
  };

  // Handle manual username typing
  const handleUsernameChange = (val: string) => {
    setHasManualUsername(true);
    // clean username characters
    const clean = val.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    onChange({ username: clean });
    checkAvailability(clean);
  };

  // Handle image upload with 2MB constraint and custom toast
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 2MB (2 * 1024 * 1024 bytes)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(
        'Image file is too large',
        'Maximum file size is 2MB. Please upload a smaller image file.'
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        onChange({
          avatarType: 'upload',
          avatarUrl: result,
          avatarId: 'custom_upload',
        });
        toast.success('Avatar uploaded', 'Your profile image has been updated.');
      }
    };
    reader.onerror = () => {
      toast.error('Upload failed', 'Failed to read the selected image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleSelectIcon = (icon: AvatarIconOption) => {
    onChange({
      avatarType: 'icon',
      avatarId: icon.id,
      avatarUrl: null,
    });
    setShowMoreModal(false);
  };

  const handleSelectInitials = () => {
    onChange({
      avatarType: 'initials',
      avatarId: 'initials',
      avatarUrl: null,
    });
  };

  // Dispatch exact circle center coordinates for the magical color wave
  const handleAccentClick = (e: React.MouseEvent<HTMLButtonElement>, hex: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    window.dispatchEvent(
      new CustomEvent('accent-color-wave', {
        detail: { color: hex, x: centerX, y: centerY },
      })
    );
    saveAccentColor(hex);
    onChange({ accentColor: hex });
  };

  // Check if current icon is one of the "more" icons
  const isCurrentMoreIcon =
    data.avatarType === 'icon' &&
    MORE_AVATAR_ICONS.some((icon) => icon.id === data.avatarId);

  const CurrentMoreIconComponent =
    isCurrentMoreIcon && data.avatarId
      ? AVATAR_ICON_COMPONENTS[data.avatarId]
      : null;

  return (
    <div className="w-full flex flex-col gap-3.5 select-none">
      {/* Step Heading */}
      <div>
        <h1 className="text-[21px] sm:text-[23px] font-semibold text-white tracking-tight leading-snug">
          Make yourself at home
        </h1>
        <p className="mt-0.5 text-[12.5px] text-zinc-400">
          Let's personalize your DevFlow workspace identity.
        </p>
      </div>

      {/* 1. Full-width Name Row */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="display-name"
          className="text-[11.5px] font-medium text-zinc-300"
        >
          What should we call you?
        </label>
        <input
          id="display-name"
          type="text"
          maxLength={40}
          value={data.displayName}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. Alex Rivers"
          className={`w-full h-9 px-3 rounded-lg bg-[#111216] border text-[12.5px] text-white placeholder-zinc-500 transition-colors focus:outline-none focus:ring-1 ${
            error
              ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500'
              : 'border-[#27272A] focus:border-zinc-400 focus:ring-zinc-400'
          }`}
        />
        {error && (
          <span className="text-[10.5px] text-red-400 leading-tight">{error}</span>
        )}
      </div>

      {/* 2. Full-width Username on NEXT LINE */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label
            htmlFor="username"
            className="text-[11.5px] font-medium text-zinc-300 shrink-0"
          >
            Username
          </label>
          <span className="text-[10.5px] font-mono text-zinc-500 shrink-0">Auto-filled handle</span>
        </div>
        <div className="relative flex items-center">
          <AtSign size={13} className="absolute left-2.5 text-zinc-500 pointer-events-none" />
          <input
            id="username"
            type="text"
            maxLength={24}
            value={data.username || ''}
            onChange={(e) => handleUsernameChange(e.target.value)}
            placeholder="alexrivers"
            className={`w-full h-9 pl-7 pr-8 rounded-lg bg-[#111216] border text-[12.5px] font-mono text-white placeholder-zinc-500 transition-colors focus:outline-none focus:ring-1 ${
              usernameError || localStatus === 'taken'
                ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500'
                : localStatus === 'available'
                ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500'
                : 'border-[#27272A] focus:border-zinc-400 focus:ring-zinc-400'
            }`}
          />
          <div className="absolute right-2.5 flex items-center">
            {isCheckingUsername || localChecking ? (
              <div className="w-3.5 h-3.5 border-2 border-[#A78BFA] border-t-transparent rounded-full animate-spin" />
            ) : localStatus === 'available' && !usernameError ? (
              <Check size={14} className="text-emerald-400" />
            ) : null}
          </div>
        </div>
        {(usernameError || (localStatus === 'taken' && localMessage)) && (
          <span className="text-[10.5px] text-red-400 leading-tight">
            {usernameError || localMessage}
          </span>
        )}
        {!usernameError && localStatus === 'available' && localMessage && (
          <span className="text-[10.5px] text-emerald-400 leading-tight">
            {localMessage}
          </span>
        )}
      </div>

      {/* 2. Avatar Selection Row: Small & Round Icons */}
      <div className="flex flex-col gap-1.5 pt-0.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="text-[11.5px] font-medium text-zinc-300 shrink-0">
            Choose your avatar
          </label>
          <span className="text-[10.5px] font-mono text-zinc-500 shrink-0">
            Initials · Icons · Photo
          </span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap py-2 px-1.5 overflow-visible">
          {/* Order 1: Text Initials (Round and Small) */}
          <button
            type="button"
            onClick={handleSelectInitials}
            className={`relative w-8 h-8 rounded-full flex items-center justify-center font-mono text-[11px] font-semibold transition-all group ${
              data.avatarType === 'initials'
                ? 'ring-2 ring-offset-2 ring-offset-[#0C0D10] shadow-md scale-105'
                : 'border border-white/[0.08] hover:scale-105 bg-[#17181D]'
            }`}
            style={{
              backgroundColor: data.avatarType === 'initials' ? avatarColor : '#17181D',
              color: data.avatarType === 'initials' ? '#FFFFFF' : '#A1A1AA',
              borderColor: data.avatarType === 'initials' ? avatarColor : undefined,
            }}
            title="Use initials"
          >
            {initials}
            {data.avatarType === 'initials' && (
              <div
                className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center text-white text-[7px] shadow"
                style={{ backgroundColor: data.accentColor }}
              >
                <Check size={8} strokeWidth={3} />
              </div>
            )}
          </button>

          {/* Order 2: 5 Quick Icons (Round and Small) */}
          {QUICK_AVATAR_ICONS.map((icon) => {
            const isSelected =
              data.avatarType === 'icon' && data.avatarId === icon.id;
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
                    style={{ backgroundColor: data.accentColor }}
                  >
                    <Check size={8} strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}

          {/* Order 3: 'More' Icon Button (Round and Small) */}
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
                  style={{ backgroundColor: data.accentColor }}
                >
                  <Check size={8} strokeWidth={3} />
                </div>
              )}
            </button>

            {/* Emoji-like Popover Modal with Scrollbar and 28 developer emojis */}
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
                      <Sparkles size={12} className="text-[#A78BFA]" />
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
                      const isSelected =
                        data.avatarType === 'icon' && data.avatarId === icon.id;

                      return (
                        <button
                          key={icon.id}
                          type="button"
                          onClick={() => handleSelectIcon(icon)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
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

          {/* Order 4: At last Image Upload (Round and Small) */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all overflow-hidden ${
              isImageUpload
                ? 'ring-2 ring-offset-2 ring-offset-[#0C0D10] border-0 scale-105'
                : 'border border-dashed border-white/[0.2] hover:border-white/50 bg-[#17181D] text-zinc-400 hover:text-white hover:scale-105'
            }`}
            style={{
              borderColor: isImageUpload ? data.accentColor : undefined,
            }}
            title={isImageUpload ? 'Click to change photo' : 'Upload custom picture'}
          >
            {isImageUpload && data.avatarUrl ? (
              <img
                src={data.avatarUrl}
                alt="Uploaded avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <Upload size={13} />
            )}
            {isImageUpload && (
              <div
                className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center text-white text-[7px] shadow"
                style={{ backgroundColor: data.accentColor }}
              >
                <Check size={8} strokeWidth={3} />
              </div>
            )}
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp, image/svg+xml"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {/* 3. Avatar Color: ONLY shown if user chooses icon or text initials! When upload, hide it! */}
      <AnimatePresence>
        {!isImageUpload && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-1 overflow-visible"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-[11.5px] font-medium text-zinc-300 shrink-0">
                Avatar color
              </label>
              <span className="text-[10.5px] font-mono text-zinc-400 shrink-0">
                {AVATAR_COLORS.find(
                  (c) => c.hex.toLowerCase() === avatarColor.toLowerCase()
                )?.name || 'Custom'}
              </span>
            </div>

            {/* Ample vertical & horizontal clearance (py-2 px-1.5) so selection ring is never cut off */}
            <div className="flex items-center gap-2.5 flex-wrap py-2 px-1.5 overflow-visible">
              {AVATAR_COLORS.map((color) => {
                const isSelected =
                  avatarColor.toLowerCase() === color.hex.toLowerCase();
                return (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => onChange({ avatarColor: color.hex })}
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

      {/* 4. Accent Color Row: Spacious layout, ample padding to prevent ring clipping */}
      <div className="flex flex-col gap-1 pt-1.5 border-t border-white/[0.06]">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="text-[11.5px] font-medium text-zinc-300 shrink-0">
            Workspace accent color
          </label>
          <span className="text-[10.5px] font-mono text-zinc-400 shrink-0">
            {ACCENT_COLORS.find(
              (c) => c.hex.toLowerCase() === data.accentColor.toLowerCase()
            )?.name || 'Custom'}
          </span>
        </div>

        {/* Spacious color row with vertical and horizontal clearance preventing clipping */}
        <div className="flex items-center gap-3.5 flex-wrap py-2 px-1.5 overflow-visible">
          {ACCENT_COLORS.map((color) => {
            const isSelected =
              data.accentColor.toLowerCase() === color.hex.toLowerCase();
            return (
              <button
                key={color.id}
                type="button"
                onClick={(e) => handleAccentClick(e, color.hex)}
                className={`relative w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  isSelected
                    ? 'scale-115 ring-2 ring-offset-2 ring-offset-[#0C0D10]'
                    : 'hover:scale-110 opacity-85 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: color.hex,
                  borderColor: isSelected ? '#ffffff' : color.borderHex,
                }}
                title={color.name}
              >
                {/* Expanding aura ripple on select */}
                {isSelected && (
                  <motion.span
                    key={`ripple-${color.hex}`}
                    initial={{ scale: 0.8, opacity: 0.9 }}
                    animate={{ scale: 2.7, opacity: 0 }}
                    transition={{ duration: 0.65, ease: 'easeOut' }}
                    className="absolute inset-0 rounded-full border pointer-events-none"
                    style={{ borderColor: color.hex }}
                  />
                )}
                {isSelected && (
                  <Check
                    size={11}
                    strokeWidth={3}
                    className="text-zinc-950 drop-shadow-sm"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
