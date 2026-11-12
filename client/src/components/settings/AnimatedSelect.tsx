import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, Check, X, Plus } from 'lucide-react';

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
  dropdownAlign?: 'left' | 'right';
  dropdownMinWidth?: string;
  hideSublabelInTrigger?: boolean;
  emptyMessage?: string;
  footerAction?: {
    label: string;
    onClick: () => void;
  };
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
  dropdownAlign = 'left',
  dropdownMinWidth = 'w-full sm:min-w-[270px]',
  hideSublabelInTrigger = false,
  emptyMessage = 'No matching options found',
  footerAction,
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
                  <div className="flex items-center justify-center shrink-0">
                    {selectedOption.icon}
                  </div>
                )}
                <span className="text-[#F4F4F5] font-medium truncate">
                  {selectedOption.label}
                </span>
                {selectedOption.sublabel && !hideSublabelInTrigger && (
                  <span className="text-zinc-500 text-[11px] font-mono truncate hidden sm:inline">
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
            className={`absolute ${
              dropdownAlign === 'right' ? 'right-0' : 'left-0'
            } top-full z-[9985] p-2 bg-[#14161C]/98 backdrop-blur-xl border border-[#27272A] rounded-xl shadow-2xl overflow-hidden max-h-80 flex flex-col ${
              dropdownMinWidth || 'w-full sm:min-w-[270px]'
            }`}
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
            <div className="overflow-y-auto space-y-0.5 pr-1 scrollbar-thin scrollbar-thumb-zinc-700 max-h-64">
              {filteredOptions.length === 0 ? (
                <div className="py-4 px-2 text-center text-xs text-[#71717A]">
                  {emptyMessage}
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
                      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        {opt.icon && (
                          <motion.div
                            animate={isBeingSelected ? { scale: [1, 1.2, 1], y: [0, -2, 0] } : {}}
                            transition={{ duration: 0.1 }}
                            className="flex items-center justify-center shrink-0"
                          >
                            {opt.icon}
                          </motion.div>
                        )}
                        <span className="font-semibold text-white truncate shrink-0">
                          {opt.label}
                        </span>
                        {opt.sublabel && (
                          <span className="text-[10px] font-mono text-zinc-400 truncate ml-1">
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
            {footerAction && (
              <div className="mt-1.5 pt-1.5 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setSearchQuery('');
                    footerAction.onClick();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer hover:bg-white/[0.06]"
                  style={{ color: accentColor }}
                >
                  <Plus size={13} />
                  <span>{footerAction.label}</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export interface AnimatedMultiSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  accentColor?: string;
  className?: string;
  disabled?: boolean;
  dropdownAlign?: 'left' | 'right';
  dropdownMinWidth?: string;
  allowCustom?: boolean;
  onAddCustom?: (val: string) => void;
}

export const AnimatedMultiSelect: React.FC<AnimatedMultiSelectProps> = ({
  values,
  onChange,
  options,
  placeholder = 'Select options...',
  searchPlaceholder = 'Search or add...',
  accentColor = '#8B5CF6',
  className = '',
  disabled = false,
  dropdownAlign = 'left',
  dropdownMinWidth = 'w-full sm:min-w-[270px]',
  allowCustom = false,
  onAddCustom,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const handleToggle = (optValue: string) => {
    if (values.includes(optValue)) {
      onChange(values.filter((v) => v !== optValue));
    } else {
      onChange([...values, optValue]);
    }
  };

  const handleAddCustom = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    if (!values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    if (onAddCustom) {
      onAddCustom(trimmed);
    }
    setSearchQuery('');
  };

  const isCustomCandidate =
    allowCustom &&
    searchQuery.trim().length > 0 &&
    !options.some((o) => o.label.toLowerCase() === searchQuery.trim().toLowerCase());

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full min-h-[40px] flex items-center justify-between gap-2.5 px-3.5 py-2 bg-[#111216] border rounded-lg text-xs sm:text-[13px] text-left transition-all outline-none ${
          isOpen
            ? 'border-[#27272A] shadow-md ring-1'
            : 'border-[#27272A] hover:border-zinc-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        style={isOpen ? { borderColor: accentColor, boxShadow: `0 0 0 1px ${accentColor}` } : undefined}
      >
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          {values.length === 0 ? (
            <span className="text-[#71717A] truncate font-normal">
              {placeholder}
            </span>
          ) : (
            values.map((val) => {
              const opt = options.find((o) => o.value === val);
              const label = opt ? opt.label : val;
              return (
                <span
                  key={val}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border"
                  style={{
                    backgroundColor: `${accentColor}18`,
                    borderColor: `${accentColor}35`,
                    color: '#FFFFFF',
                  }}
                >
                  <span className="truncate max-w-[120px]">{label}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(values.filter((v) => v !== val));
                    }}
                    className="hover:opacity-75 p-0.5 cursor-pointer ml-0.5"
                  >
                    <X size={10} />
                  </span>
                </span>
              );
            })
          )}
        </div>

        <ChevronDown
          size={14}
          className={`text-[#71717A] flex-shrink-0 transition-transform duration-250 ${
            isOpen ? 'rotate-180' : ''
          }`}
          style={isOpen ? { color: accentColor } : undefined}
        />
      </button>

      {/* Floating Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute ${
              dropdownAlign === 'right' ? 'right-0' : 'left-0'
            } top-full z-[9985] p-2 bg-[#14161C]/98 backdrop-blur-xl border border-[#27272A] rounded-xl shadow-2xl overflow-hidden max-h-80 flex flex-col ${
              dropdownMinWidth || 'w-full sm:min-w-[270px]'
            }`}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (isCustomCandidate) {
                      handleAddCustom();
                    }
                  }
                }}
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

            {/* Add Custom Button */}
            {isCustomCandidate && (
              <button
                type="button"
                onClick={handleAddCustom}
                className="w-full mb-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer"
                style={{
                  backgroundColor: `${accentColor}18`,
                  color: '#FFFFFF',
                }}
              >
                <Plus size={12} style={{ color: accentColor }} />
                <span>Add "{searchQuery.trim()}"</span>
              </button>
            )}

            {/* Options List */}
            <div className="overflow-y-auto space-y-0.5 pr-1 scrollbar-thin scrollbar-thumb-zinc-700 max-h-56">
              {filteredOptions.length === 0 && !isCustomCandidate ? (
                <div className="py-4 text-center text-xs text-[#71717A]">
                  No matching options found
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = values.includes(opt.value);

                  return (
                    <motion.button
                      key={opt.value}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleToggle(opt.value)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs sm:text-[12.5px] text-left transition-all ${
                        isSelected
                          ? 'font-medium'
                          : 'text-[#D4D4D8] hover:bg-white/[0.06] hover:text-white'
                      }`}
                      style={
                        isSelected
                          ? {
                              backgroundColor: `${accentColor}18`,
                              color: '#FFFFFF',
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        <div
                          className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors"
                          style={
                            isSelected
                              ? {
                                  backgroundColor: accentColor,
                                  borderColor: accentColor,
                                  color: '#FFFFFF',
                                }
                              : {
                                  borderColor: '#3F3F46',
                                  backgroundColor: '#18181B',
                                }
                          }
                        >
                          {isSelected && <Check size={11} strokeWidth={3} />}
                        </div>

                        {opt.icon && (
                          <div className="flex items-center justify-center shrink-0">
                            {opt.icon}
                          </div>
                        )}
                        <span className="font-semibold text-white truncate shrink-0">
                          {opt.label}
                        </span>
                        {opt.sublabel && (
                          <span className="text-[10px] font-mono text-zinc-400 truncate ml-1">
                            {opt.sublabel}
                          </span>
                        )}
                      </div>
                    </motion.button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="pt-2 mt-1 border-t border-white/[0.08] flex items-center justify-between text-[11px] px-1">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-zinc-400 hover:text-white cursor-pointer transition-colors"
              >
                Clear all
              </button>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 font-mono text-[10.5px]">
                  {values.length} selected
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-2.5 py-1 rounded-lg text-white font-semibold cursor-pointer shadow-sm hover:brightness-110 active:scale-95 transition-all text-xs"
                  style={{ backgroundColor: accentColor }}
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
