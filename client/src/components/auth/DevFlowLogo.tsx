import React from 'react';

interface DevFlowLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const DevFlowLogo: React.FC<DevFlowLogoProps> = ({ className = '', size = 'md' }) => {
  const iconSize = size === 'sm' ? 20 : size === 'lg' ? 28 : 24;
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-[15.5px]';

  return (
    <div className={`inline-flex items-center gap-2.5 group cursor-pointer select-none ${className}`}>
      {/* Geometric Connected-Node Workflow Icon */}
      <div className="relative flex items-center justify-center p-1.5 rounded-xl bg-[#171822] border border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.5)] group-hover:border-[#A78BFA]/50 group-hover:shadow-[0_0_12px_rgba(167,139,250,0.25)] transition-all duration-200">
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="transition-transform duration-200 group-hover:scale-105"
        >
          {/* Main vertical pipeline */}
          <path
            d="M6 5V19"
            stroke="#52525B"
            strokeWidth="2"
            strokeLinecap="round"
            className="group-hover:stroke-zinc-400 transition-colors"
          />
          {/* Curved branch flowing to release node */}
          <path
            d="M6 12C10 12 13 8 18 8"
            stroke="#A78BFA"
            strokeWidth="2"
            strokeLinecap="round"
            className="group-hover:stroke-[#B7A1FF] transition-colors"
          />
          {/* Origin Node */}
          <circle cx="6" cy="5" r="2.5" fill="#F4F4F5" />
          {/* Split Node */}
          <circle cx="6" cy="12" r="2.5" fill="#A78BFA" />
          {/* Lower Trunk Node */}
          <circle cx="6" cy="19" r="2.5" fill="#52525B" />
          {/* Feature/Deploy Node */}
          <circle
            cx="18"
            cy="8"
            r="3"
            fill="#4ADE80"
          />
        </svg>
      </div>

      {/* Brand Wordmark */}
      <div className="flex items-center tracking-tight">
        <span className={`font-semibold ${textSize} text-white group-hover:text-zinc-100 transition-colors`}>
          Dev
        </span>
        <span className={`font-semibold ${textSize} text-[#A78BFA] group-hover:text-[#B7A1FF] transition-colors`}>
          Flow
        </span>
      </div>
    </div>
  );
};
