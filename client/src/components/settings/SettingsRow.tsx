import React from 'react';

interface SettingsRowProps {
  label: string;
  description?: string;
  children?: React.ReactNode;
  value?: React.ReactNode;
  action?: React.ReactNode;
  required?: boolean;
  className?: string;
  horizontal?: boolean;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  label,
  description,
  children,
  value,
  action,
  required,
  className = '',
  horizontal = true,
}) => {
  return (
    <div
      className={`py-3.5 border-b border-[#27272A]/50 last:border-b-0 transition-colors ${
        horizontal
          ? 'grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-6 items-center'
          : 'space-y-2'
      } ${className}`}
    >
      {/* Label Column (approx 4 of 12 cols on desktop) */}
      <div className={horizontal ? 'md:col-span-4' : ''}>
        <label className="text-xs sm:text-[13px] font-medium text-[#A1A1AA] flex items-center gap-1">
          <span>{label}</span>
          {required && <span className="text-red-400">*</span>}
        </label>
        {description && (
          <p className="text-[11px] text-[#71717A] mt-0.5 leading-normal">
            {description}
          </p>
        )}
      </div>

      {/* Value / Input Column (approx 8 of 12 cols on desktop) */}
      <div
        className={`${
          horizontal ? 'md:col-span-8' : ''
        } flex items-center justify-between gap-3 min-w-0`}
      >
        <div className="flex-1 min-w-0">
          {children ? (
            children
          ) : (
            <div className="text-xs sm:text-[13px] text-[#F4F4F5] font-normal truncate">
              {value || <span className="text-[#71717A] italic">Not set</span>}
            </div>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
};
