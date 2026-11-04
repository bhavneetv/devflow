import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react';
import { useAccentTheme } from '../../services/accentTheme.service';

interface CustomDatePickerProps {
  value: string; // ISO date 'YYYY-MM-DD' or empty
  onChange: (value: string) => void;
  placeholder?: string;
  minYear?: number;
  maxYear?: number;
  className?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date of birth...',
  minYear = 1940,
  maxYear = new Date().getFullYear(),
  className = '',
}) => {
  const { accentColor } = useAccentTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [activePickerView, setActivePickerView] = useState<'days' | 'month' | 'year'>('days');
  const containerRef = useRef<HTMLDivElement>(null);
  const yearsListRef = useRef<HTMLDivElement>(null);

  // Parse current value or default to young adult year (2000) for Date of Birth ease
  const parseInitialDate = () => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          return { year: y, month: m, day: d };
        }
      }
    }
    return { year: 2000, month: 0, day: 1 };
  };

  const initial = parseInitialDate();
  const [viewYear, setViewYear] = useState<number>(initial.year);
  const [viewMonth, setViewMonth] = useState<number>(initial.month);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActivePickerView('days');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Sync internal view when value changes
  useEffect(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(y) && !isNaN(m)) {
          setViewYear(y);
          setViewMonth(m);
        }
      }
    }
  }, [value]);

  // Scroll active year into view when year picker opens
  useEffect(() => {
    if (activePickerView === 'year' && yearsListRef.current) {
      const selectedYearButton = yearsListRef.current.querySelector<HTMLButtonElement>(`[data-year="${viewYear}"]`);
      if (selectedYearButton) {
        selectedYearButton.scrollIntoView({ block: 'center' });
      }
    }
  }, [activePickerView, viewYear]);

  // Year options descending (latest year first for DOB ease)
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) {
    years.push(y);
  }

  // Format display text
  const formatDisplay = (val: string) => {
    if (!val) return '';
    const parts = val.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return `${d.toString().padStart(2, '0')} ${MONTH_SHORT[m]} ${y}`;
      }
    }
    return val;
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => Math.max(minYear, prev - 1));
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => Math.min(maxYear, prev + 1));
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const formattedMonth = (viewMonth + 1).toString().padStart(2, '0');
    const formattedDay = day.toString().padStart(2, '0');
    const dateStr = `${viewYear}-${formattedMonth}-${formattedDay}`;
    onChange(dateStr);
    setIsOpen(false);
    setActivePickerView('days');
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange('');
  };

  const handlePresetAge = (yearsAgo: number) => {
    const now = new Date();
    const targetYear = now.getFullYear() - yearsAgo;
    const dateStr = `${targetYear}-01-15`;
    setViewYear(targetYear);
    setViewMonth(0);
    onChange(dateStr);
    setIsOpen(false);
    setActivePickerView('days');
  };

  // Days calculations
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  // Selected date components
  let selectedYear: number | null = null;
  let selectedMonth: number | null = null;
  let selectedDay: number | null = null;
  if (value) {
    const parts = value.split('-');
    if (parts.length === 3) {
      selectedYear = parseInt(parts[0], 10);
      selectedMonth = parseInt(parts[1], 10) - 1;
      selectedDay = parseInt(parts[2], 10);
    }
  }

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getFullYear() === viewYear &&
      today.getMonth() === viewMonth &&
      today.getDate() === day
    );
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Input Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setActivePickerView('days');
        }}
        className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 bg-[#111216] border rounded-lg text-xs sm:text-[13px] text-left transition-all outline-none ${
          isOpen
            ? 'border-[#27272A] shadow-md ring-1'
            : 'border-[#27272A] hover:border-zinc-600'
        } cursor-pointer`}
        style={isOpen ? { borderColor: accentColor, boxShadow: `0 0 0 1px ${accentColor}` } : undefined}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 truncate">
          <CalendarIcon
            size={14}
            className="flex-shrink-0 text-zinc-400"
            style={isOpen || value ? { color: accentColor } : undefined}
          />
          {value ? (
            <span className="text-[#F4F4F5] font-medium truncate font-mono">
              {formatDisplay(value)}
            </span>
          ) : (
            <span className="text-[#71717A] truncate font-normal">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Clear date"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </button>

      {/* Floating Dark Popover Calendar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full z-50 p-3.5 bg-[#14161C]/98 backdrop-blur-2xl border border-[#27272A] rounded-xl shadow-2xl w-80 flex flex-col"
          >
            {/* Header: Custom Month & Year Pickers + Navigation Chevrons */}
            <div className="flex items-center justify-between gap-1.5 mb-3 pb-2.5 border-b border-zinc-800/80">
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={activePickerView !== 'days'}
                className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous month"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-1.5 flex-1 justify-center">
                {/* Custom Month Selector Trigger */}
                <button
                  type="button"
                  onClick={() =>
                    setActivePickerView((prev) => (prev === 'month' ? 'days' : 'month'))
                  }
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activePickerView === 'month'
                      ? 'bg-zinc-800 text-white ring-1 ring-zinc-700'
                      : 'bg-[#0E0F13] text-zinc-300 hover:text-white hover:bg-zinc-800/70 border border-[#27272A]'
                  }`}
                  style={activePickerView === 'month' ? { color: accentColor } : undefined}
                >
                  <span>{MONTH_NAMES[viewMonth]}</span>
                  <ChevronDown
                    size={11}
                    className={`transition-transform duration-200 ${
                      activePickerView === 'month' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Custom Year Selector Trigger */}
                <button
                  type="button"
                  onClick={() =>
                    setActivePickerView((prev) => (prev === 'year' ? 'days' : 'year'))
                  }
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold font-mono transition-all cursor-pointer ${
                    activePickerView === 'year'
                      ? 'bg-zinc-800 text-white ring-1 ring-zinc-700'
                      : 'bg-[#0E0F13] text-zinc-300 hover:text-white hover:bg-zinc-800/70 border border-[#27272A]'
                  }`}
                  style={activePickerView === 'year' ? { color: accentColor } : undefined}
                >
                  <span>{viewYear}</span>
                  <ChevronDown
                    size={11}
                    className={`transition-transform duration-200 ${
                      activePickerView === 'year' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                disabled={activePickerView !== 'days'}
                className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* VIEW A: Custom Month Selection Grid (No native OS select) */}
            {activePickerView === 'month' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="grid grid-cols-3 gap-1.5 py-1"
              >
                {MONTH_NAMES.map((mName, idx) => {
                  const isCurMonth = viewMonth === idx;
                  return (
                    <button
                      key={mName}
                      type="button"
                      onClick={() => {
                        setViewMonth(idx);
                        setActivePickerView('days');
                      }}
                      className={`py-2 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        isCurMonth
                          ? 'text-white font-bold shadow-md'
                          : 'text-zinc-300 hover:bg-white/[0.08] hover:text-white'
                      }`}
                      style={
                        isCurMonth
                          ? {
                              backgroundColor: accentColor,
                              boxShadow: `0 2px 8px ${accentColor}60`,
                            }
                          : undefined
                      }
                    >
                      {mName}
                    </button>
                  );
                })}
              </motion.div>
            )}

            {/* VIEW B: Custom Year Selection Grid (No native OS select, scrollable dark grid) */}
            {activePickerView === 'year' && (
              <motion.div
                ref={yearsListRef}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="grid grid-cols-4 gap-1.5 max-h-56 overflow-y-auto pr-1 py-1 scrollbar-thin scrollbar-thumb-zinc-700"
              >
                {years.map((y) => {
                  const isCurYear = viewYear === y;
                  return (
                    <button
                      key={y}
                      data-year={y}
                      type="button"
                      onClick={() => {
                        setViewYear(y);
                        setActivePickerView('days');
                      }}
                      className={`py-1.5 px-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer text-center ${
                        isCurYear
                          ? 'text-white font-bold shadow-md'
                          : 'text-zinc-300 hover:bg-white/[0.08] hover:text-white'
                      }`}
                      style={
                        isCurYear
                          ? {
                              backgroundColor: accentColor,
                              boxShadow: `0 2px 8px ${accentColor}60`,
                            }
                          : undefined
                      }
                    >
                      {y}
                    </button>
                  );
                })}
              </motion.div>
            )}

            {/* VIEW C: Calendar Days Grid */}
            {activePickerView === 'days' && (
              <>
                {/* Days of Week Header */}
                <div className="grid grid-cols-7 gap-1 mb-1 text-center">
                  {DAYS_OF_WEEK.map((d) => (
                    <span key={d} className="text-[10px] font-semibold text-zinc-500 py-0.5">
                      {d}
                    </span>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {/* Padding empty slots */}
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-7 w-7" />
                  ))}

                  {/* Day numbers */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const isSelected =
                      selectedYear === viewYear &&
                      selectedMonth === viewMonth &&
                      selectedDay === dayNum;
                    const today = isToday(dayNum);

                    return (
                      <button
                        key={dayNum}
                        type="button"
                        onClick={() => handleSelectDay(dayNum)}
                        className={`h-7 w-7 rounded-lg text-xs font-mono font-medium flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'text-white font-bold shadow-md'
                            : today
                            ? 'text-white border border-zinc-500 hover:bg-zinc-800'
                            : 'text-zinc-300 hover:bg-white/[0.08] hover:text-white'
                        }`}
                        style={
                          isSelected
                            ? {
                                backgroundColor: accentColor,
                                boxShadow: `0 2px 8px ${accentColor}60`,
                              }
                            : undefined
                        }
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                </div>

                {/* Quick Presets for Date of Birth & Clear */}
                <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handlePresetAge(18)}
                      className="px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    >
                      18 yrs
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetAge(25)}
                      className="px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    >
                      25 yrs
                    </button>
                  </div>

                  {value && (
                    <button
                      type="button"
                      onClick={() => handleClear()}
                      className="text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
