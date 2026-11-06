import React from 'react';
import { Building2, Sparkles } from 'lucide-react';
import { AVATAR_ICON_COMPONENTS } from '../onboarding/StepProfile';

export interface OrgAvatarDetails {
  type: 'icon' | 'initials' | 'image';
  iconId: string;
  color: string;
  initials: string;
  url: string | null;
}

export function getOrgInitials(name?: string | null): string {
  if (!name) return 'ORG';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'O';
}

export function parseOrgAvatar(logoUrl?: string | null, name?: string): OrgAvatarDetails {
  const fallbackInitials = getOrgInitials(name);
  if (!logoUrl) {
    return {
      type: 'initials',
      color: '#7C3AED',
      iconId: 'sparkles',
      initials: fallbackInitials,
      url: null,
    };
  }

  // 1. Icon format: icon:iconId:#hexColor
  if (logoUrl.startsWith('icon:')) {
    const parts = logoUrl.split(':');
    const iconId = parts[1] || 'sparkles';
    const color = parts[2] || '#7C3AED';
    return {
      type: 'icon',
      iconId,
      color,
      initials: fallbackInitials,
      url: null,
    };
  }

  // 2. Initials format: initials:#hexColor or initials:XX:#hexColor
  if (logoUrl.startsWith('initials:')) {
    const parts = logoUrl.split(':');
    const color = parts[parts.length - 1] || '#7C3AED';
    const initials = parts.length > 2 ? parts[1].toUpperCase() : fallbackInitials;
    return {
      type: 'initials',
      color,
      iconId: 'sparkles',
      initials,
      url: null,
    };
  }

  // 3. Direct Image URL
  if (
    logoUrl.startsWith('http://') ||
    logoUrl.startsWith('https://') ||
    logoUrl.startsWith('data:image/') ||
    logoUrl.startsWith('/')
  ) {
    return {
      type: 'image',
      url: logoUrl,
      color: '#7C3AED',
      iconId: 'sparkles',
      initials: fallbackInitials,
    };
  }

  // Fallback
  return {
    type: 'initials',
    color: '#7C3AED',
    iconId: 'sparkles',
    initials: fallbackInitials,
    url: null,
  };
}

export const OrgAvatar: React.FC<{
  name: string;
  logoUrl?: string | null;
  className?: string;
  iconSize?: number;
  roundedClassName?: string;
  fontSize?: number;
}> = ({
  name,
  logoUrl,
  className = 'w-6 h-6',
  iconSize = 13,
  roundedClassName = 'rounded-md',
  fontSize,
}) => {
  const [imageError, setImageError] = React.useState(false);
  const avatar = parseOrgAvatar(logoUrl, name);

  if (avatar.type === 'image' && avatar.url && !imageError) {
    return (
      <img
        src={avatar.url}
        alt={name}
        className={`${className} ${roundedClassName} object-cover border border-white/10 shrink-0 shadow-sm`}
        onError={() => setImageError(true)}
      />
    );
  }

  if (avatar.type === 'icon' && avatar.iconId) {
    const IconComponent = AVATAR_ICON_COMPONENTS[avatar.iconId] || Building2;
    return (
      <div
        className={`${className} ${roundedClassName} flex items-center justify-center text-white shrink-0 shadow-sm border border-white/15`}
        style={{
          backgroundColor: avatar.color || '#7C3AED',
          boxShadow: `0 2px 10px ${avatar.color || '#7C3AED'}40`,
        }}
        title={name}
      >
        <IconComponent size={iconSize} strokeWidth={2.2} />
      </div>
    );
  }

  return (
    <div
      className={`${className} ${roundedClassName} flex items-center justify-center text-white font-mono font-bold shrink-0 shadow-sm border border-white/15 select-none`}
      style={{
        backgroundColor: avatar.color || '#7C3AED',
        fontSize: fontSize || Math.max(Math.round(iconSize * 0.85), 10),
        boxShadow: `0 2px 10px ${avatar.color || '#7C3AED'}40`,
      }}
      title={name}
    >
      {avatar.initials}
    </div>
  );
};

