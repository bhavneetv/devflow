import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { CodePipelineLoader } from './CodePipelineLoader';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  isSuccess?: boolean;
  children: React.ReactNode;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading = false,
  isSuccess = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={disabled || isLoading || isSuccess}
      className={`relative w-full h-[40px] rounded-lg font-medium text-[13.5px] flex items-center justify-center transition-all duration-200 select-none group outline-none overflow-hidden ${
        isSuccess
          ? 'bg-[#4ADE80] text-[#0C0D12] font-semibold shadow-[0_0_20px_rgba(74,222,128,0.3)]'
          : isLoading
          ? 'bg-[#6D28D9] text-white cursor-wait shadow-[0_0_24px_rgba(124,58,237,0.45)]'
          : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-medium shadow-[0_4px_16px_rgba(124,58,237,0.3)] hover:shadow-[0_6px_20px_rgba(124,58,237,0.4)] focus-visible:ring-2 focus-visible:ring-[#A78BFA]/50 active:scale-[0.99]'
      } ${disabled && !isLoading ? 'opacity-50 cursor-not-allowed hover:bg-[#7C3AED] hover:shadow-none' : ''} ${className}`}
    >
      {/* Light shimmer effect during loading */}
      {isLoading && <div className="btn-shimmer" />}

      {isLoading ? (
        <CodePipelineLoader />
      ) : isSuccess ? (
        <div className="flex items-center gap-1.5 font-semibold text-[#0C0D12] animate-in fade-in zoom-in-95 duration-150">
          <Check size={16} strokeWidth={2.5} />
          <span>Authenticated</span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 w-full">
          <span>{children}</span>
          <ArrowRight
            size={15}
            className="transition-transform duration-200 group-hover:translate-x-1"
          />
        </div>
      )}
    </button>
  );
};
