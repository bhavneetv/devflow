import React from 'react';
import {
  Check,
  User,
  Rocket,
  Building2,
  Layers,
  Globe,
  GraduationCap,
  LucideIcon,
} from 'lucide-react';
import {
  OnboardingData,
  WORKSPACE_TYPES,
  WorkspaceTypeOption,
} from '../../types/onboarding';

interface StepGoalsProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
}

const WORKSPACE_ICONS: Record<string, LucideIcon> = {
  User,
  Rocket,
  Building2,
  Layers,
  Globe,
  GraduationCap,
};

export const StepGoals: React.FC<StepGoalsProps> = ({ data, onChange }) => {
  const handleSelectWorkspaceType = (item: WorkspaceTypeOption) => {
    onChange({ workspaceType: item.id });
  };

  return (
    <div className="w-full flex flex-col gap-6 select-none">
      {/* Heading */}
      <div>
        <h1 className="text-[22px] sm:text-[25px] font-semibold text-white tracking-tight leading-snug">
          What brings you to DevFlow?
        </h1>
        <p className="mt-1 text-[13px] text-zinc-400">
          We'll personalize your workspace around your team's needs.
        </p>
      </div>

      {/* Workspace Type Cards in a clean, spacious 3-column grid */}
      <div className="flex flex-col gap-2.5">
        <label className="text-[12px] font-medium text-zinc-300">
          How will you use DevFlow?
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {WORKSPACE_TYPES.map((type) => {
            const isSelected = data.workspaceType === type.id;
            const IconComponent = WORKSPACE_ICONS[type.iconName] || User;

            return (
              <button
                key={type.id}
                type="button"
                onClick={() => handleSelectWorkspaceType(type)}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all group ${
                  isSelected
                    ? 'bg-[#17181D] shadow-lg scale-[1.01]'
                    : 'bg-[#111216]/80 hover:bg-[#17181D] border-[#27272A]/80 hover:border-zinc-700'
                }`}
                style={{
                  borderColor: isSelected ? data.accentColor : undefined,
                }}
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                    style={{
                      backgroundColor: isSelected
                        ? `${data.accentColor}25`
                        : 'rgba(255,255,255,0.04)',
                      color: isSelected ? data.accentColor : '#A1A1AA',
                    }}
                  >
                    <IconComponent size={16} />
                  </div>
                  {isSelected && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-zinc-950 shadow"
                      style={{ backgroundColor: data.accentColor }}
                    >
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[13.5px] font-semibold text-white tracking-tight">
                    {type.title}
                  </p>
                  <p className="text-[11.5px] text-zinc-400 mt-1 leading-relaxed">
                    {type.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
