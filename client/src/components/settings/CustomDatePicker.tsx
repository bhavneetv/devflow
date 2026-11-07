import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useAccentTheme } from '../../services/accentTheme.service';

export interface CustomDatePickerProps {
  value: string; // ISO date 'YYYY-MM-DD' or empty
  onChange: (value: string) => void;
  placeholder?: string;
  minYear?: number;
  maxYear?: number;
  className?: string;
  presetMode?: 'dob' | 'start' | 'end' | 'general' | 'none';
  align?: 'left' | 'right';
  showQuarterTab?: boolean;
  dropUp?: boolean;
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

interface QuarterInfo {
  id: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  label: string;
  monthsRange: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
}

const QUARTERS: QuarterInfo[] = [
  {
    id: 'Q1',
    label: 'Q1',
    monthsRange: 'Jan 01 – Mar 31',
    startMonth: 0,
    startDay: 1,
    endMonth: 2,
    endDay: 31,
  },
  {
    id: 'Q2',
    label: 'Q2',
    monthsRange: 'Apr 01 – Jun 30',
    startMonth: 3,
    startDay: 1,
    endMonth: 5,
    endDay: 30,
  },
  {
    id: 'Q3',
    label: 'Q3',
    monthsRange: 'Jul 01 – Sep 30',
    startMonth: 6,
    startDay: 1,
    endMonth: 8,
    endDay: 30,
  },
  {
    id: 'Q4',
    label: 'Q4',
    monthsRange: 'Oct 01 – Dec 31',
    startMonth: 9,
    startDay: 1,
    endMonth: 11,
    endDay: 31,
  },
];

// Helper to format ISO YYYY-MM-DD
function formatIsoDate(year: number, monthIndex: number, day: number): string {
  const m = (monthIndex + 1).toString().padStart(2, '0');
  const d = day.toString().padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date...',
  minYear: customMinYear,
  maxYear: customMaxYear,
  className = '',
  presetMode,
  align = 'left',
  showQuarterTab = true,
  dropUp,
}) => {
  const { accentColor } = useAccentTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [activePickerView, setActivePickerView] = useState<'days' | 'month' | 'quarter' | 'year'>('days');
  const [internalDropUp, setInternalDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const yearsListRef = useRef<HTMLDivElement>(null);

  const isDropUp = dropUp !== undefined ? dropUp : internalDropUp;

  // Determine effective preset mode
  const effectivePresetMode = useMemo<'dob' | 'start' | 'end' | 'general' | 'none'>(() => {
    if (presetMode) return presetMode;
    const lowerP = (placeholder || '').toLowerCase();
    if (lowerP.includes('birth') || lowerP.includes('dob')) return 'dob';
    if (lowerP.includes('start') || lowerP.includes('begin')) return 'start';
    if (lowerP.includes('end') || lowerP.includes('due') || lowerP.includes('deadline')) return 'end';
    return 'general';
  }, [presetMode, placeholder]);

  const currentYear = new Date().getFullYear();
  const minYear = customMinYear !== undefined ? customMinYear : effectivePresetMode === 'dob' ? 1940 : currentYear - 5;
  const maxYear = customMaxYear !== undefined ? customMaxYear : effectivePresetMode === 'dob' ? currentYear : currentYear + 10;

  // Parse initial date
  const parseDate = (dateStr: string) => {
    if (dateStr) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          return { year: y, month: m, day: d };
        }
      }
    }
    const defaultYear = effectivePresetMode === 'dob' ? 2000 : currentYear;
    return { year: defaultYear, month: new Date().getMonth(), day: new Date().getDate() };
  };

  const initial = parseDate(value);
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

  // Year options descending if DOB, ascending if project planning
  const years: number[] = useMemo(() => {
    const list: number[] = [];
    if (effectivePresetMode === 'dob') {
      for (let y = maxYear; y >= minYear; y--) {
        list.push(y);
      }
    } else {
      for (let y = minYear; y <= maxYear; y++) {
        list.push(y);
      }
    }
    return list;
  }, [minYear, maxYear, effectivePresetMode]);

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

  const handlePrev = () => {
    if (activePickerView === 'days') {
      if (viewMonth === 0) {
        setViewMonth(11);
        setViewYear((prev) => Math.max(minYear, prev - 1));
      } else {
        setViewMonth((prev) => prev - 1);
      }
    } else {
      setViewYear((prev) => Math.max(minYear, prev - 1));
    }
  };

  const handleNext = () => {
    if (activePickerView === 'days') {
      if (viewMonth === 11) {
        setViewMonth(0);
        setViewYear((prev) => Math.min(maxYear, prev + 1));
      } else {
        setViewMonth((prev) => prev + 1);
      }
    } else {
      setViewYear((prev) => Math.min(maxYear, prev + 1));
    }
  };

  const handleSelectDay = (day: number) => {
    const dateStr = formatIsoDate(viewYear, viewMonth, day);
    onChange(dateStr);
    setIsOpen(false);
    setActivePickerView('days');
  };

  const handleSelectMonth = (monthIdx: number) => {
    setViewMonth(monthIdx);
    if (effectivePresetMode === 'end') {
      // Pick last day of that month
      const lastDay = new Date(viewYear, monthIdx + 1, 0).getDate();
      onChange(formatIsoDate(viewYear, monthIdx, lastDay));
      setIsOpen(false);
      setActivePickerView('days');
    } else {
      // Switch to days view for that month
      setActivePickerView('days');
    }
  };

  const handleSelectQuarter = (q: QuarterInfo) => {
    if (effectivePresetMode === 'end') {
      const dateStr = formatIsoDate(viewYear, q.endMonth, q.endDay);
      setViewMonth(q.endMonth);
      onChange(dateStr);
    } else {
      const dateStr = formatIsoDate(viewYear, q.startMonth, q.startDay);
      setViewMonth(q.startMonth);
      onChange(dateStr);
    }
    setIsOpen(false);
    setActivePickerView('days');
  };

  const handleSelectYear = (year: number) => {
    setViewYear(year);
    setActivePickerView('days');
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange('');
  };

  // Quick Preset Handlers
  const handleApplyPreset = (targetDate: Date) => {
    const y = targetDate.getFullYear();
    const m = targetDate.getMonth();
    const d = targetDate.getDate();
    setViewYear(y);
    setViewMonth(m);
    onChange(formatIsoDate(y, m, d));
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

  // Current quarter of view
  const currentQuarterId = useMemo(() => {
    if (viewMonth <= 2) return 'Q1';
    if (viewMonth <= 5) return 'Q2';
    if (viewMonth <= 8) return 'Q3';
    return 'Q4';
  }, [viewMonth]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Input Trigger */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow < 340 && rect.top > 340) {
              setInternalDropUp(true);
            } else {
              setInternalDropUp(false);
            }
          }
          setIsOpen((prev) => !prev);
          setActivePickerView('days');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isOpen && containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              if (spaceBelow < 340 && rect.top > 340) {
                setInternalDropUp(true);
              } else {
                setInternalDropUp(false);
              }
            }
            setIsOpen((prev) => !prev);
            setActivePickerView('days');
          }
        }}
        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 bg-[#111216] border rounded-xl text-xs sm:text-[13px] text-left transition-all outline-none ${
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
              <X size={12} />
            </button>
          )}
          <ChevronDown
            size={13}
            className={`text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            style={isOpen ? { color: accentColor } : undefined}
          />
        </div>
      </div>

      {/* Floating Dark Popover Calendar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: isDropUp ? 8 : -8, scale: 0.97 }}
            animate={{ opacity: 1, y: isDropUp ? -4 : 4, scale: 1 }}
            exit={{ opacity: 0, y: isDropUp ? 8 : -8, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} ${
              isDropUp ? 'bottom-full mb-2' : 'top-full mt-1.5'
            } z-[70] p-3 bg-[#14161C]/98 backdrop-blur-2xl border border-[#27272A] rounded-2xl shadow-2xl w-[310px] sm:w-[320px] flex flex-col`}
          >
            {/* View Mode Switcher Pills: Date | Month | Quarter | Year */}
            <div className="flex items-center justify-between gap-1 p-1 bg-[#0C0D10] border border-[#27272A] rounded-xl mb-2.5">
              <button
                type="button"
                onClick={() => setActivePickerView('days')}
                className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  activePickerView === 'days'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
                style={activePickerView === 'days' ? { color: accentColor } : undefined}
              >
                Date
              </button>
              <button
                type="button"
                onClick={() => setActivePickerView('month')}
                className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  activePickerView === 'month'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
                style={activePickerView === 'month' ? { color: accentColor } : undefined}
              >
                Month
              </button>
              {showQuarterTab && effectivePresetMode !== 'dob' && (
                <button
                  type="button"
                  onClick={() => setActivePickerView('quarter')}
                  className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    activePickerView === 'quarter'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  style={activePickerView === 'quarter' ? { color: accentColor } : undefined}
                >
                  Quarter
                </button>
              )}
              <button
                type="button"
                onClick={() => setActivePickerView('year')}
                className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  activePickerView === 'year'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
                style={activePickerView === 'year' ? { color: accentColor } : undefined}
              >
                Year
              </button>
            </div>

            {/* Header: Month & Year Label + Chevrons */}
            <div className="flex items-center justify-between gap-1.5 mb-2.5 pb-2 border-b border-zinc-800/80">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Previous"
              >
                <ChevronLeft size={15} />
              </button>

              <div className="flex items-center gap-1.5 justify-center">
                <span className="text-xs font-bold text-white tracking-wide">
                  {activePickerView === 'days' ? `${MONTH_NAMES[viewMonth]} ` : ''}
                  <span className="font-mono text-zinc-300">{viewYear}</span>
                </span>
                {activePickerView === 'days' && (
                  <span
                    className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tracking-wider uppercase border"
                    style={{
                      backgroundColor: `${accentColor}18`,
                      borderColor: `${accentColor}35`,
                      color: accentColor,
                    }}
                  >
                    {currentQuarterId}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Next"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            {/* VIEW A: Custom Month Selection Grid */}
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
                      onClick={() => handleSelectMonth(idx)}
                      className={`py-2 px-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer text-center ${
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

            {/* VIEW B: Quarter Selection Grid (Q1, Q2, Q3, Q4) */}
            {activePickerView === 'quarter' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="grid grid-cols-2 gap-2 py-1"
              >
                {QUARTERS.map((q) => {
                  const isCurrentQtr = currentQuarterId === q.id;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => handleSelectQuarter(q)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isCurrentQtr
                          ? 'border-transparent shadow-lg text-white'
                          : 'border-[#27272A] bg-[#0E1015] hover:border-zinc-600 text-zinc-300'
                      }`}
                      style={
                        isCurrentQtr
                          ? {
                              backgroundColor: `${accentColor}25`,
                              borderColor: `${accentColor}70`,
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold font-mono tracking-tight text-white">
                          {q.label} {viewYear}
                        </span>
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: isCurrentQtr ? accentColor : '#3F3F46' }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {q.monthsRange}
                      </span>
                      <span className="text-[9px] text-zinc-500 mt-1 uppercase font-semibold">
                        {effectivePresetMode === 'end' ? 'Selects End Date' : 'Selects Start Date'}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            )}

            {/* VIEW C: Custom Year Selection Grid */}
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
                      onClick={() => handleSelectYear(y)}
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

            {/* VIEW D: Calendar Days Grid */}
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
              </>
            )}

            {/* Quick Preset Buttons Bar */}
            {effectivePresetMode !== 'none' && (
              <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] gap-1 flex-wrap">
                <div className="flex items-center gap-1 flex-wrap">
                  {effectivePresetMode === 'start' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset(new Date())}
                        className="px-2 py-0.5 rounded-md bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          handleApplyPreset(new Date(now.getFullYear(), now.getMonth(), 1));
                        }}
                        className="px-2 py-0.5 rounded-md bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      >
                        Start of Mo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
                          handleApplyPreset(new Date(now.getFullYear(), qStartMonth, 1));
                        }}
                        className="px-2 py-0.5 rounded-md bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      >
                        Start of Qtr
                      </button>
                    </>
                  )}

                  {effectivePresetMode === 'end' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 14);
                          handleApplyPreset(d);
                        }}
                        className="px-2 py-0.5 rounded-md bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      >
                        +2 Wks
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setMonth(d.getMonth() + 1);
                          handleApplyPreset(d);
                        }}
                        className="px-2 py-0.5 rounded-md bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      >
                        Next Month
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setMonth(d.getMonth() + 3);
                          handleApplyPreset(d);
                        }}
                        className="px-2 py-0.5 rounded-md bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      >
                        3 Months
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const qEndMonth = Math.floor(now.getMonth() / 3) * 3 + 2;
                          const lastDay = new Date(now.getFullYear(), qEndMonth + 1, 0).getDate();
                          handleApplyPreset(new Date(now.getFullYear(), qEndMonth, lastDay));
                        }}
                        className="px-2 py-0.5 rounded-md bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      >
                        End of Qtr
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          handleApplyPreset(new Date(now.getFullYear(), 11, 31));
                        }}
                        className="px-2 py-0.5 rounded-md bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      >
                        End of Year
                      </button>
                    </>
                  )}

                  {effectivePresetMode === 'dob' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          handleApplyPreset(new Date(now.getFullYear() - 18, 0, 15));
                        }}
                        className="px-2 py-0.5 rounded-md bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      >
                        18 yrs
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          handleApplyPreset(new Date(now.getFullYear() - 25, 0, 15));
                        }}
                        className="px-2 py-0.5 rounded-md bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      >
                        25 yrs
                      </button>
                    </>
                  )}

                  {effectivePresetMode === 'general' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset(new Date())}
                        className="px-2 py-0.5 rounded-md bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 7);
                          handleApplyPreset(d);
                        }}
                        className="px-2 py-0.5 rounded-md bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      >
                        +1 Wk
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setMonth(d.getMonth() + 1);
                          handleApplyPreset(d);
                        }}
                        className="px-2 py-0.5 rounded-md bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      >
                        +1 Mo
                      </button>
                    </>
                  )}
                </div>

                {value && (
                  <button
                    type="button"
                    onClick={() => handleClear()}
                    className="text-zinc-400 hover:text-red-400 transition-colors cursor-pointer font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
