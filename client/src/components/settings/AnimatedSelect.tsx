import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, Check, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: string | React.ReactNode;
  sublabel?: string;
}

interface AnimatedSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  accentColor?: string;
  className?: string;
  disabled?: boolean;
}

export const AnimatedSelect: React.FC<AnimatedSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  accentColor = '#8B5CF6',
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [animatingValue, setAnimatingValue] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const filteredOptions = options.filter((opt) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      opt.label.toLowerCase().includes(query) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(query)) ||
      opt.value.toLowerCase().includes(query)
    );
  });

  const handleSelect = (optValue: string) => {
    setAnimatingValue(optValue);
    onChange(optValue);
    setTimeout(() => {
      setIsOpen(false);
      setSearchQuery('');
      setAnimatingValue(null);
    }, 160);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 bg-[#111216] border rounded-lg text-xs sm:text-[13px] text-left transition-all outline-none ${
          isOpen
            ? 'border-[#27272A] shadow-md ring-1'
            : 'border-[#27272A] hover:border-zinc-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        style={isOpen ? { borderColor: accentColor, boxShadow: `0 0 0 1px ${accentColor}` } : undefined}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="popLayout">
            {selectedOption ? (
              <motion.div
                key={selectedOption.value}
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-2 truncate"
              >
                {selectedOption.icon && (
                  <span className="flex-shrink-0 text-base leading-none">
                    {selectedOption.icon}
                  </span>
                )}
                <span className="text-[#F4F4F5] font-medium truncate">
                  {selectedOption.label}
                </span>
                {selectedOption.sublabel && (
                  <span className="text-zinc-500 text-[11px] font-mono truncate">
                    ({selectedOption.sublabel})
                  </span>
                )}
              </motion.div>
            ) : (
              <span className="text-[#71717A] truncate font-normal">
                {placeholder}
              </span>
            )}
          </AnimatePresence>
        </div>

        <ChevronDown
          size={14}
          className={`text-[#71717A] flex-shrink-0 transition-transform duration-250 ${
            isOpen ? 'rotate-180' : ''
          }`}
          style={isOpen ? { color: accentColor } : undefined}
        />
      </button>

      {/* Floating Animated Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 right-0 top-full z-50 p-2 bg-[#14161C]/95 backdrop-blur-xl border border-[#27272A] rounded-xl shadow-2xl overflow-hidden max-h-72 flex flex-col"
          >
            {/* Search Input Bar */}
            <div className="relative mb-2 flex items-center">
              <Search
                size={13}
                className="absolute left-2.5 text-[#71717A] pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 bg-[#0C0D10] border border-[#27272A] rounded-lg text-xs text-[#F4F4F5] placeholder-[#71717A] outline-none transition-colors"
                style={{
                  outlineColor: accentColor,
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-zinc-500 hover:text-white p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Options List */}
            <div className="overflow-y-auto space-y-0.5 pr-1 scrollbar-thin scrollbar-thumb-zinc-700 max-h-52">
              {filteredOptions.length === 0 ? (
                <div className="py-4 text-center text-xs text-[#71717A]">
                  No matching options found
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  const isBeingSelected = animatingValue === opt.value;

                  return (
                    <motion.button
                      key={opt.value}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs sm:text-[12.5px] text-left transition-all ${
                        isSelected
                          ? 'font-medium'
                          : 'text-[#D4D4D8] hover:bg-white/[0.06] hover:text-white'
                      }`}
                      style={
                        isSelected
                          ? {
                              backgroundColor: `${accentColor}20`,
                              color: '#FFFFFF',
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        {opt.icon && (
                          <motion.span
                            animate={isBeingSelected ? { scale: [1, 1.2, 1], y: [0, -2, 0] } : {}}
                            transition={{ duration: 0.1 }}
                            className="text-base leading-none flex-shrink-0"
                          >
                            {opt.icon}
                          </motion.span>
                        )}
                        <motion.span
                          animate={isBeingSelected ? { x: [0, 3, 0] } : {}}
                          transition={{ duration: 0.1 }}
                          className="truncate"
                        >
                          {opt.label}
                        </motion.span>
                        {opt.sublabel && (
                          <span className="text-[10.5px] font-mono text-zinc-500 truncate">
                            {opt.sublabel}
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <Check
                          size={13}
                          strokeWidth={2.5}
                          className="flex-shrink-0"
                          style={{ color: accentColor }}
                        />
                      )}
                    </motion.button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
