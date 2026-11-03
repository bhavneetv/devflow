import React from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  GitCommit,
  CheckCircle2,
  Smile,
  Shield,
  Layers,
} from 'lucide-react';
import { OnboardingData, AVATAR_COLORS, ACCENT_COLORS } from '../../types/onboarding';
import { AVATAR_ICON_COMPONENTS } from './StepProfile';

interface ProfilePreviewProps {
  data: OnboardingData;
}

export const ProfilePreview: React.FC<ProfilePreviewProps> = ({ data }) => {
  const accent = data.accentColor || '#8B5CF6';
  const avatarColor = data.avatarColor || '#7C3AED';
  const displayName = data.displayName?.trim() || 'Alex Rivers';
  const handleName = data.username?.trim() || displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'DF';

  const isUpload = data.avatarType === 'upload' && data.avatarUrl;
  const isIcon = data.avatarType === 'icon' && data.avatarId;
  const IconComponent = isIcon ? AVATAR_ICON_COMPONENTS[data.avatarId || 'smile'] || Smile : null;

  const currentAvatarColorName =
    AVATAR_COLORS.find((c) => c.hex.toLowerCase() === avatarColor.toLowerCase())?.name || 'Custom';
  const currentAccentName =
    ACCENT_COLORS.find((c) => c.hex.toLowerCase() === accent.toLowerCase())?.name || 'Custom';

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[#101116] relative overflow-hidden select-none">
      {/* Background dot matrix */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Ambient background glow matching accent */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-25 transition-colors duration-700"
        style={{ backgroundColor: accent }}
      />
      <div
        className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-15 transition-colors duration-700"
        style={{ backgroundColor: avatarColor }}
      />

      {/* Main Developer Identity Card */}
      <div
        className="w-full max-w-[390px] rounded-2xl bg-[#17181D]/90 backdrop-blur-md border border-white/[0.08] shadow-2xl p-6 relative z-10 flex flex-col items-center text-center"
      >
        {/* Card Header Tag */}
        <div className="w-full flex items-center justify-between pb-4 mb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: accent }}
            />
            <span>IDENTITY PASSPORT</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-zinc-300">
            DevFlow Core
          </span>
        </div>

        {/* Live Profile Avatar Showcase */}
        <div
          className="relative my-2"
        >
          <div
            className="w-24 h-24 rounded-2xl flex items-center justify-center shadow-xl overflow-hidden border-2 transition-all duration-300 relative"
            style={{
              borderColor: accent,
              backgroundColor: isUpload ? '#111216' : avatarColor,
              boxShadow: `0 8px 24px ${avatarColor}33`,
            }}
          >
            {isUpload ? (
              <img
                src={data.avatarUrl!}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : isIcon && IconComponent ? (
              <IconComponent size={42} strokeWidth={2.2} className="text-white" />
            ) : (
              <span className="font-mono text-2xl font-bold text-white tracking-wider">
                {initials}
              </span>
            )}
          </div>

          {/* Online badge */}
          <div
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-[#17181D] flex items-center justify-center text-[10px] text-zinc-950 shadow"
            style={{ backgroundColor: accent }}
          >
            <CheckCircle2 size={13} className="text-white" strokeWidth={3} />
          </div>
        </div>

        {/* Live Name & Username below Avatar */}
        <div className="mt-3 w-full">
          <h2 className="text-[19px] font-bold text-white tracking-tight truncate leading-tight">
            {displayName}
          </h2>
          <p className="text-[12px] font-mono text-zinc-400 mt-0.5">
            @{handleName || 'alexrivers'}
          </p>
        </div>

        {/* Color Indicators Row */}
        <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
          {!isUpload && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono text-zinc-300">
              <span
                className="w-2.5 h-2.5 rounded-full border border-white/20"
                style={{ backgroundColor: avatarColor }}
              />
              <span>Avatar: {currentAvatarColorName}</span>
            </div>
          )}

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono text-zinc-300">
            <span
              className="w-2.5 h-2.5 rounded-full border border-white/20"
              style={{ backgroundColor: accent }}
            />
            <span>Accent: {currentAccentName}</span>
          </div>
        </div>

        {/* Live In-App Identity Demonstrations */}
        <div className="w-full mt-5 pt-4 border-t border-white/[0.06] flex flex-col gap-2.5 text-left">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            Live Platform Representation
          </span>

          {/* Sample 1: Activity Feed Commit */}
          <div className="p-2.5 rounded-lg bg-[#111216] border border-white/[0.06] flex items-center gap-2.5">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden"
              style={{
                backgroundColor: isUpload ? '#111216' : avatarColor,
              }}
            >
              {isUpload ? (
                <img src={data.avatarUrl!} alt="" className="w-full h-full object-cover" />
              ) : isIcon && IconComponent ? (
                <IconComponent size={13} className="text-white" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-medium text-zinc-200 truncate">
                <span className="text-white font-semibold">{displayName}</span> pushed 3 commits
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                <GitCommit size={10} style={{ color: accent }} />
                <span>main · 2m ago</span>
              </div>
            </div>
          </div>

          {/* Sample 2: Assigned Task Ticket */}
          <div className="p-2.5 rounded-lg bg-[#111216] border border-white/[0.06] flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <span className="text-[10px] font-mono text-zinc-500">DEV-108</span>
              <p className="text-[11.5px] font-medium text-zinc-300 truncate">
                Configure build automation pipeline
              </p>
            </div>
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0 overflow-hidden border"
              style={{
                borderColor: accent,
                backgroundColor: isUpload ? '#111216' : avatarColor,
              }}
              title={displayName}
            >
              {isUpload ? (
                <img src={data.avatarUrl!} alt="" className="w-full h-full object-cover" />
              ) : isIcon && IconComponent ? (
                <IconComponent size={11} className="text-white" />
              ) : (
                initials
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
