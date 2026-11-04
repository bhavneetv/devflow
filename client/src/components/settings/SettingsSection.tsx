import React from 'react';

interface SettingsSectionProps {
  id: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  id,
  title,
  description,
  action,
  children,
  className = '',
}) => {
  return (
    <section
      id={id}
      aria-labelledby={`heading-${id}`}
      className={`scroll-mt-28 pt-8 pb-10 border-b border-[#27272A]/80 last:border-b-0 space-y-6 ${className}`}
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2
            id={`heading-${id}`}
            className="text-xl sm:text-2xl font-extrabold text-[#FFFFFF] tracking-tight"
          >
            {title}
          </h2>
          {description && (
            <p className="text-xs sm:text-[13px] text-[#A1A1AA] mt-1 leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>

      {/* Section Content */}
      <div className="space-y-4">{children}</div>
    </section>
  );
};
