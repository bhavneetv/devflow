import React, { useState } from 'react';
import { Eye, EyeOff, LucideIcon } from 'lucide-react';

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: LucideIcon;
  error?: string;
  isPassword?: boolean;
  labelRightSlot?: React.ReactNode;
}

export const AuthInput: React.FC<AuthInputProps> = ({
  label,
  icon: Icon,
  error,
  isPassword = false,
  labelRightSlot,
  id,
  className = '',
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || `auth-input-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="space-y-1.5 w-full text-left">
      <div className="flex items-center justify-between">
        <label
          htmlFor={inputId}
          className="text-[12.5px] font-medium text-zinc-200 tracking-tight select-none"
        >
          {label}
        </label>
        {labelRightSlot}
      </div>

      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
            <Icon size={16} />
          </div>
        )}

        <input
          id={inputId}
          type={isPassword ? (showPassword ? 'text' : 'password') : props.type || 'text'}
          className={`w-full h-[38px] rounded-lg bg-[#14151D] border text-[13px] text-white placeholder-zinc-500 transition-all duration-150 outline-none ${
            Icon ? 'pl-9' : 'pl-3'
          } ${isPassword ? 'pr-9' : 'pr-3'} ${
            error
              ? 'border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/20'
              : 'border-white/[0.08] hover:border-white/[0.18] focus:border-[#A78BFA] focus:ring-2 focus:ring-[#A78BFA]/20'
          } ${className}`}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
            title={showPassword ? 'Hide password' : 'Show password'}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>

      {/* Inline error display */}
      <div
        className={`transition-all duration-150 overflow-hidden ${
          error ? 'max-h-8 opacity-100 mt-1' : 'max-h-0 opacity-0 mt-0'
        }`}
      >
        <p className="text-[11.5px] font-medium text-red-400 flex items-center gap-1.5 leading-tight">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
          <span>{error}</span>
        </p>
      </div>
    </div>
  );
};
