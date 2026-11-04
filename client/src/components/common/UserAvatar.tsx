import React, { useState } from 'react';
import { Smile } from 'lucide-react';
import { AVATAR_ICON_COMPONENTS } from '../onboarding/StepProfile';
import { cn } from '../../lib/utils';

export interface UserAvatarProps {
  user?: {
    name?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    avatarType?: string | null;
    avatarId?: string | null;
    avatarColor?: string | null;
  } | null;
  name?: string;
  avatarUrl?: string | null;
  avatarType?: string | null;
  avatarId?: string | null;
  avatarColor?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  rounded?: 'full' | 'md' | 'lg' | 'xl' | '2xl';
}

const SIZE_CONFIGS = {
  xs: { box: 'w-5 h-5 text-[9px]', iconSize: 10, imgSize: 20 },
  sm: { box: 'w-7 h-7 text-[11px]', iconSize: 14, imgSize: 28 },
  md: { box: 'w-9 h-9 text-xs', iconSize: 18, imgSize: 36 },
  lg: { box: 'w-12 h-12 text-sm', iconSize: 24, imgSize: 48 },
  xl: { box: 'w-16 h-16 text-lg', iconSize: 30, imgSize: 64 },
};

const ROUNDED_CONFIGS = {
  full: 'rounded-full',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  name: explicitName,
  avatarUrl: explicitAvatarUrl,
  avatarType: explicitAvatarType,
  avatarId: explicitAvatarId,
  avatarColor: explicitAvatarColor,
  size = 'sm',
  className = '',
  rounded = 'full',
}) => {
  const [imageError, setImageError] = useState(false);

  const displayName = explicitName || user?.displayName || user?.name || 'Developer';
  const avatarUrl = explicitAvatarUrl !== undefined ? explicitAvatarUrl : user?.avatarUrl;
  const avatarType = explicitAvatarType || user?.avatarType || 'initials';
  const avatarId = explicitAvatarId !== undefined ? explicitAvatarId : user?.avatarId;
  const avatarColor = explicitAvatarColor || user?.avatarColor || '#8B5CF6';

  const sizeCfg = SIZE_CONFIGS[size] || SIZE_CONFIGS.sm;
  const roundedClass = ROUNDED_CONFIGS[rounded] || 'rounded-full';

  // Compute initials
  const initials = displayName
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'DF';

  // 1. Uploaded picture
  if (avatarType === 'upload' && avatarUrl && !imageError) {
    return (
      <div
        className={cn(
          'relative overflow-hidden flex-shrink-0 flex items-center justify-center border border-white/10 select-none',
          sizeCfg.box,
          roundedClass,
          className
        )}
      >
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  // 2. Developer Emoji Icon
  if (avatarType === 'icon' && avatarId) {
    const IconComponent = AVATAR_ICON_COMPONENTS[avatarId] || Smile;
    return (
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center text-white select-none transition-transform shadow-sm',
          sizeCfg.box,
          roundedClass,
          className
        )}
        style={{ backgroundColor: avatarColor }}
        title={displayName}
      >
        <IconComponent size={sizeCfg.iconSize} strokeWidth={2.2} />
      </div>
    );
  }

  // 3. Initials
  return (
    <div
      className={cn(
        'flex-shrink-0 flex items-center justify-center text-white font-mono font-bold select-none tracking-tight shadow-sm',
        sizeCfg.box,
        roundedClass,
        className
      )}
      style={{ backgroundColor: avatarColor }}
      title={displayName}
    >
      {initials}
    </div>
  );
};
