import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Minus } from 'lucide-react';

export interface CustomCheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  accentColor?: string;
  size?: 'sm' | 'md';
  label?: React.ReactNode;
  sublabel?: string;
  className?: string;
  stopPropagation?: boolean;
  id?: string;
  name?: string;
  'aria-label'?: string;
  title?: string;
}

export const CustomCheckbox: React.FC<CustomCheckboxProps> = ({
  checked = false,
  indeterminate = false,
  onChange,
  disabled = false,
  accentColor = '#10B981',
  size = 'md',
  label,
  sublabel,
  className = '',
  stopPropagation = false,
  id,
  name,
  'aria-label': ariaLabel,
  title,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate]);

  const isActive = checked || indeterminate;

  const boxSizeClasses = size === 'sm' ? 'w-3.5 h-3.5 rounded-[4px]' : 'w-4 h-4 rounded-[5px]';
  const iconSize = size === 'sm' ? 10 : 11;

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
    }
    if (disabled) return;
    onChange?.(!checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (stopPropagation) {
        e.stopPropagation();
      }
      onChange?.(!checked);
    }
  };

  const checkboxBox = (
    <div
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={ariaLabel || (typeof label === 'string' ? label : undefined)}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      title={title}
      style={{
        backgroundColor: isActive ? accentColor : '#0E1015',
        borderColor: isActive ? accentColor : '#2E313D',
        boxShadow: isActive ? `0 0 8px ${accentColor}30` : undefined,
      }}
      className={`relative inline-flex items-center justify-center shrink-0 border transition-all duration-150 outline-none select-none ${boxSizeClasses} ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'cursor-pointer hover:border-zinc-400 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111216]'
      }`}
    >
      <input
        ref={inputRef}
        type="checkbox"
        id={id}
        name={name}
        checked={checked}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          if (stopPropagation) {
            e.stopPropagation();
          }
          onChange?.(e.target.checked);
        }}
        className="sr-only"
      />

      <AnimatePresence mode="wait">
        {indeterminate ? (
          <motion.div
            key="indeterminate"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-center text-white"
          >
            <Minus size={iconSize} strokeWidth={3.2} />
          </motion.div>
        ) : checked ? (
          <motion.div
            key="checked"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-center text-white"
          >
            <Check size={iconSize} strokeWidth={3.2} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );

  if (!label && !sublabel) {
    return checkboxBox;
  }

  return (
    <label
      onClick={(e) => {
        if (stopPropagation) {
          e.stopPropagation();
        }
      }}
      className={`inline-flex items-center gap-2 select-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      {checkboxBox}
      <div className="flex flex-col">
        {label && (
          <span className="text-xs text-zinc-300 hover:text-white transition-colors">
            {label}
          </span>
        )}
        {sublabel && (
          <span className="text-[10px] font-mono text-zinc-500">
            {sublabel}
          </span>
        )}
      </div>
    </label>
  );
};

export default CustomCheckbox;

