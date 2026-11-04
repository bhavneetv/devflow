import React from 'react';
import { Camera } from 'lucide-react';
import { useAccentTheme } from '../../services/accentTheme.service';

interface SettingsPageHeaderProps {
  title: string;
  description: string;
  profileSummary?: {
    avatarUrl?: string;
    avatarNode?: React.ReactNode;
    displayName: string;
    username: string;
    email: string;
    isVerified?: boolean;
    onEditAvatar?: () => void;
  };
  action?: React.ReactNode;
}

export const SettingsPageHeader: React.FC<SettingsPageHeaderProps> = ({
  title,
  description,
  profileSummary,
  action,
}) => {
  const { accentColor } = useAccentTheme();

  return (
    <div className={`px-6 sm:px-8 pt-6 sm:pt-8 ${profileSummary ? 'pb-6' : 'pb-6 sm:pb-8'} bg-[#0D0F14] border-b border-[#27272A]/70`}>
      {/* Title & Top Description */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${profileSummary ? 'mb-6' : ''}`}>
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-[32px] font-extrabold text-[#FFFFFF] tracking-tight leading-tight">
            {title}
          </h1>
          <p className="text-sm sm:text-[14.5px] text-[#A1A1AA] mt-1.5 leading-relaxed">
            {description}
          </p>
        </div>
        {action && <div>{action}</div>}
      </div>

      {/* Prominent Profile Summary Banner with Square-Type Card Background */}
      {profileSummary && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#161820] to-[#111217] border border-[#27272A] p-6 sm:p-7 shadow-lg flex flex-col items-center justify-center text-center">
          {/* Subtle decorative square grid background */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }}
          />

          {/* Avatar with square-type background & camera overlay */}
          <div className="relative group cursor-pointer mb-3.5 z-10">
            <div
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-[#27272A] shadow-xl bg-zinc-900 transition-all duration-300 flex items-center justify-center"
              style={{
                boxShadow: `0 0 0 3px ${accentColor}25, 0 8px 24px rgba(0,0,0,0.5)`,
              }}
            >
              {profileSummary.avatarNode ? (
                profileSummary.avatarNode
              ) : (
                <img
                  src={profileSummary.avatarUrl}
                  alt={profileSummary.displayName}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}
            </div>

            {/* Hover Camera Overlay to change avatar */}
            {profileSummary.onEditAvatar && (
              <button
                type="button"
                onClick={profileSummary.onEditAvatar}
                className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-medium gap-1"
                title="Change profile avatar"
              >
                <Camera size={18} />
              </button>
            )}
          </div>

          {/* Name (check mark removed) */}
          <div className="z-10">
            <h2 className="text-xl sm:text-2xl font-bold text-[#F4F4F5] tracking-tight">
              {profileSummary.displayName}
            </h2>
          </div>

          {/* Email / Username */}
          <p className="text-xs sm:text-[13px] text-[#A1A1AA] mt-1 font-mono z-10">
            {profileSummary.email}
          </p>
        </div>
      )}
    </div>
  );
};
