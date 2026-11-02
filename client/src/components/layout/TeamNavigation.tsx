import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, CircleDot, LayoutGrid, Layers, LucideIcon } from 'lucide-react';
import { TeamNavConfig } from '../../config/navigation';
import { cn } from '../../lib/utils';
import { useNavigation } from '../../context/NavigationContext';

interface TeamNavigationProps {
  team: TeamNavConfig;
}

export const TeamNavigation: React.FC<TeamNavigationProps> = ({ team }) => {
  const location = useLocation();
  const { isCollapsed, setIsMobileOpen } = useNavigation();

  const [isTeamExpanded, setIsTeamExpanded] = useState(team.defaultExpanded ?? true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    [`${team.id}-issues`]: true, // Default Issues section expanded to show Active / Backlog
  });

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  if (isCollapsed) {
    return (
      <div className="py-1">
        <div
          className="w-8 h-8 mx-auto rounded flex items-center justify-center text-xs font-bold text-white border border-white/10"
          style={{ backgroundColor: team.color }}
          title={team.name}
        >
          {team.name.charAt(0)}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-1.5 pb-1">
      {/* Team Header Button */}
      <button
        type="button"
        onClick={() => setIsTeamExpanded(!isTeamExpanded)}
        className="w-full flex items-center justify-between px-2.5 py-1 rounded-md text-[13.5px] font-medium text-zinc-200 hover:text-white hover:bg-sidebar-hover transition-colors group"
      >
        <div className="flex items-center gap-2">
          {/* Team Icon / Square Badge matching Linear reference */}
          <div
            className="w-4 h-4 rounded-[4px] flex items-center justify-center text-[10px] font-bold text-white shadow-sm flex-shrink-0"
            style={{ backgroundColor: team.color }}
          >
            {team.name.charAt(0)}
          </div>
          <span className="truncate">{team.name}</span>
        </div>

        <ChevronDown
          size={13}
          className={cn(
            'text-zinc-500 group-hover:text-zinc-300 transition-transform duration-150',
            isTeamExpanded ? '' : '-rotate-90'
          )}
        />
      </button>

      {/* Team Items (Issues, Projects, Views) */}
      {isTeamExpanded && (
        <div className="mt-0.5 space-y-0.5">
          {team.sections.map((section) => {
            const hasSubItems = section.subItems && section.subItems.length > 0;
            const isSectionExpanded = expandedSections[section.id] ?? false;
            const isSectionActive = location.pathname === section.path;
            const SectionIcon = section.icon;

            return (
              <div key={section.id}>
                {hasSubItems ? (
                  // Section with nested items (e.g. Issues -> Active, Backlog)
                  <div>
                    <div className="flex items-center justify-between">
                      <NavLink
                        to={section.path}
                        onClick={() => setIsMobileOpen(false)}
                        className={cn(
                          'flex-1 flex items-center gap-2.5 h-[32px] pl-6 pr-2 rounded-md text-[13px] transition-colors',
                          isSectionActive
                            ? 'bg-sidebar-active text-white font-medium'
                            : 'text-sidebar-text hover:text-white hover:bg-sidebar-hover'
                        )}
                      >
                        <SectionIcon
                          size={15}
                          className={isSectionActive ? 'text-white' : 'text-sidebar-icon'}
                        />
                        <span className="truncate">{section.title}</span>
                      </NavLink>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleSection(section.id);
                        }}
                        className="px-1.5 py-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-sidebar-hover"
                      >
                        <ChevronDown
                          size={12}
                          className={cn(
                            'transition-transform duration-150',
                            isSectionExpanded ? '' : '-rotate-90'
                          )}
                        />
                      </button>
                    </div>

                    {/* Nested Sub-items (Active / Backlog) with Vertical Tree Guide Line */}
                    {isSectionExpanded && (
                      <div className="relative ml-8 pl-3.5 my-0.5 border-l border-[#27272A] space-y-0.5">
                        {section.subItems?.map((sub) => {
                          const isSubActive = location.pathname === sub.path;
                          return (
                            <NavLink
                              key={sub.id}
                              to={sub.path}
                              onClick={() => setIsMobileOpen(false)}
                              className={cn(
                                'flex items-center justify-between h-[30px] px-2 rounded-md text-[12.5px] transition-colors',
                                isSubActive
                                  ? 'bg-sidebar-active text-white font-medium'
                                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-sidebar-hover'
                              )}
                            >
                              <span className="truncate">{sub.title}</span>
                              {sub.badge !== undefined && (
                                <span className="text-[10.5px] text-zinc-500 font-mono">
                                  {sub.badge}
                                </span>
                              )}
                            </NavLink>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  // Simple Section (Projects, Views)
                  <NavLink
                    to={section.path}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-2.5 h-[32px] pl-6 pr-2 rounded-md text-[13px] transition-colors',
                      isSectionActive
                        ? 'bg-sidebar-active text-white font-medium'
                        : 'text-sidebar-text hover:text-white hover:bg-sidebar-hover'
                    )}
                  >
                    <SectionIcon
                      size={15}
                      className={isSectionActive ? 'text-white' : 'text-sidebar-icon'}
                    />
                    <span className="truncate">{section.title}</span>
                  </NavLink>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
