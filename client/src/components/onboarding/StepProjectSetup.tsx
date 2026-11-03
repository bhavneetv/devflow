import React from 'react';
import {
  User,
  Users,
  Users2,
  Building,
  Check,
  LucideIcon,
} from 'lucide-react';
import {
  OnboardingData,
  TEAM_SIZES,
  TeamSizeOption,
} from '../../types/onboarding';

interface StepProjectSetupProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
}

const TEAM_ICONS: Record<string, LucideIcon> = {
  User,
  Users,
  Users2,
  Building,
};

export const StepProjectSetup: React.FC<StepProjectSetupProps> = ({
  data,
  onChange,
}) => {
  const handleSelectTeamSize = (team: TeamSizeOption) => {
    onChange({ teamSizePreference: team.id });
  };

  return (
    <div className="w-full flex flex-col gap-6 select-none">
      {/* Heading */}
      <div>
        <h1 className="text-[22px] sm:text-[25px] font-semibold text-white tracking-tight leading-snug">
          Who will you work with?
        </h1>
        <p className="mt-1 text-[13px] text-zinc-400">
          We'll optimize your workspace, permissions, and team cadence accordingly.
        </p>
      </div>

      {/* Team Size Selection Cards - Spacious 2x2 grid filling width cleanly */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TEAM_SIZES.map((size) => {
          const isSelected = data.teamSizePreference === size.id;
          const IconComponent = TEAM_ICONS[size.iconName] || Users;

          return (
            <button
              key={size.id}
              type="button"
              onClick={() => handleSelectTeamSize(size)}
              className={`p-5 rounded-2xl border text-left flex flex-col justify-between transition-all group ${
                isSelected
                  ? 'bg-[#17181D] shadow-xl scale-[1.01]'
                  : 'bg-[#111216]/80 hover:bg-[#17181D] border-[#27272A]/80 hover:border-zinc-700'
              }`}
              style={{
                borderColor: isSelected ? data.accentColor : undefined,
              }}
            >
              <div className="flex items-center justify-between mb-4 w-full">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                  style={{
                    backgroundColor: isSelected
                      ? `${data.accentColor}25`
                      : 'rgba(255,255,255,0.04)',
                    color: isSelected ? data.accentColor : '#A1A1AA',
                  }}
                >
                  <IconComponent size={18} />
                </div>
                {isSelected && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-zinc-950 shadow"
                    style={{ backgroundColor: data.accentColor }}
                  >
                    <Check size={14} strokeWidth={3} />
                  </div>
                )}
              </div>
              <div>
                <p className="text-[14.5px] font-semibold text-white tracking-tight leading-snug">
                  {size.title}
                </p>
                <p className="text-[12px] text-zinc-400 mt-1.5 leading-relaxed">
                  {size.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
