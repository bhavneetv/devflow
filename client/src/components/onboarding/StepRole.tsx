import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Check,
  Code,
  Layout,
  Server,
  Layers,
  Compass,
  Users,
  Kanban,
  CheckCircle2,
  Terminal,
  Palette,
  Briefcase,
  GraduationCap,
  Laptop,
  Sparkles,
  X,
  LucideIcon,
} from 'lucide-react';
import { OnboardingData, ROLE_OPTIONS, RoleOption } from '../../types/onboarding';

interface StepRoleProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
}

// Map icon name string to actual Lucide component
const ICON_MAP: Record<string, LucideIcon> = {
  Code,
  Layout,
  Server,
  Layers,
  Compass,
  Users,
  Kanban,
  CheckCircle2,
  Terminal,
  Palette,
  Briefcase,
  GraduationCap,
  Laptop,
  Sparkles,
};

export const StepRole: React.FC<StepRoleProps> = ({ data, onChange }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Extract first name for personalized greeting
  const firstName = data.displayName?.trim().split(' ')[0] || 'Developer';

  const filteredRoles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return ROLE_OPTIONS;
    return ROLE_OPTIONS.filter(
      (role) =>
        role.title.toLowerCase().includes(q) ||
        role.category.toLowerCase().includes(q) ||
        role.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleSelectRole = (role: RoleOption) => {
    onChange({ role: role.title });
  };

  return (
    <div className="w-full flex flex-col gap-3.5 select-none">
      {/* Heading */}
      <div>
        <h1 className="text-[22px] sm:text-[25px] font-semibold text-white tracking-tight leading-snug">
          Hi, {firstName}!
        </h1>
        <p className="mt-1 text-[13px] text-zinc-400">
          Let's tailor DevFlow to the way you work.
        </p>
      </div>

      {/* Role search bar */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="role-search"
          className="text-[12px] font-medium text-zinc-300"
        >
          What's your role?
        </label>
        <div className="relative flex items-center">
          <Search
            size={14}
            className="absolute left-3 text-zinc-400 pointer-events-none"
          />
          <input
            id="role-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search roles (e.g. Frontend, DevOps, Full-Stack, Manager)..."
            className="w-full h-10 pl-9 pr-8 rounded-lg bg-[#111216] border border-[#27272A] text-[13px] text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 p-1 text-zinc-400 hover:text-white rounded transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Role Options Grid - generous all-around padding (p-2 sm:p-2.5) so borders & colors are never cut off */}
      <div
        role="listbox"
        aria-label="Developer roles"
        className="max-h-[315px] sm:max-h-[340px] overflow-y-auto p-2 sm:p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-3 focus:outline-none scrollbar-thin scrollbar-thumb-zinc-800"
      >
        <AnimatePresence mode="popLayout">
          {filteredRoles.length > 0 ? (
            filteredRoles.map((role) => {
              const isSelected = data.role === role.title;
              const IconComponent = ICON_MAP[role.iconName] || Code;

              return (
                <button
                  key={role.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectRole(role)}
                  className={`p-3.5 sm:p-4 rounded-xl border text-left flex items-start gap-3 transition-all duration-150 group ${
                    isSelected
                      ? 'bg-[#17181D] shadow-md'
                      : 'bg-[#111216]/75 hover:bg-[#17181D] hover:border-zinc-700'
                  }`}
                  style={{
                    borderColor: isSelected ? data.accentColor : '#27272A',
                    boxShadow: isSelected
                      ? `0 0 0 1px ${data.accentColor}, 0 4px 16px ${data.accentColor}25`
                      : 'none',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      backgroundColor: isSelected
                        ? `${data.accentColor}25`
                        : 'rgba(255,255,255,0.04)',
                      color: isSelected ? data.accentColor : '#A1A1AA',
                    }}
                  >
                    <IconComponent size={15} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-semibold text-white leading-snug break-words">
                        {role.title}
                      </p>
                      {isSelected && (
                        <Check
                          size={13}
                          strokeWidth={2.5}
                          style={{ color: data.accentColor }}
                          className="shrink-0 ml-1.5"
                        />
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">
                      {role.description}
                    </p>
                  </div>
                </button>
              );
            })
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="col-span-full py-10 text-center flex flex-col items-center justify-center"
            >
              <p className="text-[13px] text-zinc-400">
                No roles found matching "{searchQuery}"
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 text-[12px] font-medium text-[#A78BFA] hover:underline"
              >
                Clear search filter
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
