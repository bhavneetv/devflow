import React, { useEffect, useState, useRef } from 'react';
import { useAccentTheme } from '../../services/accentTheme.service';

export interface SettingsCategory {
  id: string;
  label: string;
  badge?: string | number;
}

interface SettingsSectionNavProps {
  categories: SettingsCategory[];
  activeCategory?: string;
  onSelectCategory?: (id: string) => void;
  className?: string;
}

export const SettingsSectionNav: React.FC<SettingsSectionNavProps> = ({
  categories,
  activeCategory: controlledActive,
  onSelectCategory,
  className = '',
}) => {
  const { accentColor } = useAccentTheme();
  const [internalActive, setInternalActive] = useState<string>(categories[0]?.id || '');
  const activeId = controlledActive || internalActive;
  const isClickingRef = useRef(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // IntersectionObserver to detect which section is currently in view
  useEffect(() => {
    if (!categories.length) return;

    const observerCallback: IntersectionObserverCallback = (entries) => {
      if (isClickingRef.current) return; // Don't override active tab while scrolling due to click

      // Find the first intersecting entry from top to bottom
      const visibleEntries = entries.filter((e) => e.isIntersecting);
      if (visibleEntries.length > 0) {
        // Sort by bounding client top to pick the topmost visible
        visibleEntries.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const topSectionId = visibleEntries[0].target.id;
        if (topSectionId) {
          setInternalActive(topSectionId);
          onSelectCategory?.(topSectionId);
        }
      }
    };

    const observer = new IntersectionObserver(observerCallback, {
      rootMargin: '-80px 0px -60% 0px', // Trigger when section hits upper third of viewport
      threshold: [0, 0.1, 0.25],
    });

    categories.forEach((cat) => {
      const el = document.getElementById(cat.id);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    };
  }, [categories, onSelectCategory]);

  const scrollToSection = (id: string) => {
    setInternalActive(id);
    onSelectCategory?.(id);

    const targetEl = document.getElementById(id);
    if (!targetEl) return;

    isClickingRef.current = true;
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => {
      isClickingRef.current = false;
    }, 700);
  };

  return (
    <div
      className={`sticky top-0 z-20 bg-[#0F1012]/95 backdrop-blur-md border-b border-[#27272A] px-6 sm:px-8 py-0 transition-colors ${className}`}
    >
      <div
        role="tablist"
        aria-label="Settings categories"
        className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar -mb-px"
      >
        {categories.map((cat) => {
          const isActive = activeId === cat.id;
          return (
            <button
              key={cat.id}
              role="tab"
              id={`tab-${cat.id}`}
              aria-controls={cat.id}
              aria-selected={isActive}
              onClick={() => scrollToSection(cat.id)}
              className={`group relative flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-[13px] font-medium whitespace-nowrap transition-colors duration-150 outline-none rounded-t-md ${
                isActive
                  ? 'text-[#F4F4F5] font-semibold'
                  : 'text-[#A1A1AA] hover:text-[#E4E4E7]'
              }`}
            >
              <span>{cat.label}</span>

              {cat.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono leading-none ${
                    !isActive ? 'bg-zinc-800 text-zinc-400 group-hover:text-zinc-300' : ''
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundColor: `${accentColor}25`,
                          color: accentColor,
                        }
                      : undefined
                  }
                >
                  {cat.badge}
                </span>
              )}

              {/* Active Underline Highlight with user's selected accent color */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full animate-in fade-in duration-200"
                  style={{
                    backgroundColor: accentColor,
                    boxShadow: `0 0 12px ${accentColor}80`,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
