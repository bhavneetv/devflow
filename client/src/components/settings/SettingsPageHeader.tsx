import React from 'react';
import { BadgeCheck, Camera, Edit3 } from 'lucide-react';
import { useAccentTheme } from '../../services/accentTheme.service';

interface SettingsPageHeaderProps {
  title: string;
  description: string;
  profileSummary?: {
    avatarUrl: string;
    displayName: string;
    username: string;
    email: string;
    isVerified?: boolean;
    onEditAvatar?: () => void;
    onEditClick?: () => void;
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
    <div className="px-6 sm:px-8 pt-8 pb-6 bg-[#0F1012] border-b border-[#27272A]/70">
      {/* Title & Top Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#F4F4F5] tracking-tight">
            {title}
          </h1>
          <p className="text-xs sm:text-[13px] text-[#A1A1AA] mt-1">
            {description}
          </p>
        </div>
        {action && <div>{action}</div>}
      </div>

      {/* Prominent Profile Summary Banner (Matches Reference Screenshot) */}
      {profileSummary && (
        <div className="flex flex-col items-center justify-center text-center pt-2 pb-2">
          {/* Circular Avatar with Camera overlay on hover */}
          <div className="relative group cursor-pointer mb-3.5">
            <div
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-[#27272A] shadow-xl bg-zinc-900"
              style={{
                boxShadow: `0 0 0 4px ${accentColor}20`,
              }}
            >
              <img
                src={profileSummary.avatarUrl}
                alt={profileSummary.displayName}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>

            {/* Blue Verified Badge (Exact match to screenshot checkmark badge) */}
            {profileSummary.isVerified !== false && (
              <div
                title="Verified Developer Account"
                className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-[#3B82F6] text-white flex items-center justify-center shadow-lg border-2 border-[#0F1012]"
              >
                <BadgeCheck size={14} className="fill-white text-[#3B82F6]" />
              </div>
            )}

            {/* Hover Camera Overlay to change avatar */}
            {profileSummary.onEditAvatar && (
              <button
                type="button"
                onClick={profileSummary.onEditAvatar}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-medium gap-1"
                title="Change profile avatar"
              >
                <Camera size={16} />
              </button>
            )}
          </div>

          {/* Name with Verified Badge */}
          <div className="flex items-center justify-center gap-1.5">
            <h2 className="text-lg sm:text-xl font-bold text-[#F4F4F5] tracking-tight">
              {profileSummary.displayName}
            </h2>
            {profileSummary.isVerified !== false && (
              <span title="Verified" className="text-[#3B82F6] flex-shrink-0">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </span>
            )}
          </div>

          {/* Email / Username */}
          <p className="text-xs sm:text-[13px] text-[#A1A1AA] mt-0.5 font-mono">
            {profileSummary.email}
          </p>

          {/* Quick Edit Action Button if provided */}
          {profileSummary.onEditClick && (
            <button
              type="button"
              onClick={profileSummary.onEditClick}
              className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#27272A] hover:border-zinc-500 bg-[#171A21] hover:bg-[#1E222A] text-xs font-medium text-[#F4F4F5] transition-all"
            >
              <Edit3 size={13} style={{ color: accentColor }} />
              <span>Edit Profile Details</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
