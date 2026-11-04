import React, { useEffect, useState, useRef } from 'react';
import { useAccentTheme } from '../../services/accentTheme.service';
import { cn } from '../../lib/utils';

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
  const navRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver to detect which section is currently in view
  useEffect(() => {
    if (!categories.length) return;

    const mainContainer = document.querySelector('main');

    const observerCallback: IntersectionObserverCallback = (entries) => {
      if (isClickingRef.current) return; // Don't override active tab while scrolling due to click

      // Find visible entries
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
      root: mainContainer || null,
      rootMargin: '-60px 0px -40% 0px',
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

    const mainEl = targetEl.closest('main') || document.querySelector('main');
    if (mainEl) {
      isClickingRef.current = true;
      const navEl = navRef.current;
      const navHeight = navEl ? navEl.offsetHeight : 54;
      const targetRect = targetEl.getBoundingClientRect();
      const mainRect = mainEl.getBoundingClientRect();
      // Scroll with safe offset so the section heading h2 is cleanly visible below the sticky nav
      const targetOffsetTop = targetRect.top - mainRect.top + mainEl.scrollTop - navHeight - 16;

      mainEl.scrollTo({
        top: Math.max(0, targetOffsetTop),
        behavior: 'smooth',
      });

      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = setTimeout(() => {
        isClickingRef.current = false;
      }, 600);
    } else {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      ref={navRef}
      className={cn(
        'sticky top-0 z-20 bg-[#0D0F14]/95 backdrop-blur-md border-b border-[#27272A] px-6 sm:px-8 py-0 shadow-sm transition-colors',
        className
      )}
    >
      <div
        role="tablist"
        aria-label="Settings categories"
        className="flex items-center gap-1 sm:gap-3 overflow-x-auto no-scrollbar -mb-px"
      >
        {categories.map((cat) => {
          const isActive = activeId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              id={`tab-${cat.id}`}
              aria-controls={cat.id}
              aria-selected={isActive}
              onClick={() => scrollToSection(cat.id)}
              className={`group relative flex items-center gap-2.5 py-4 px-3 sm:px-4 text-[15px] sm:text-base font-bold whitespace-nowrap transition-colors duration-150 outline-none rounded-t-md cursor-pointer ${
                isActive
                  ? 'text-[#FFFFFF]'
                  : 'text-[#A1A1AA] hover:text-[#E4E4E7]'
              }`}
            >
              <span>{cat.label}</span>

              {cat.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none ${
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
                  className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full animate-in fade-in duration-200"
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
