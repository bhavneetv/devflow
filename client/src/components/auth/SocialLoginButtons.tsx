import React from 'react';

interface SocialLoginButtonsProps {
  onGitHubClick: () => void;
  onGoogleClick: () => void;
  isLoading?: boolean;
  activeProvider?: 'github' | 'google' | null;
}

export const SocialLoginButtons: React.FC<SocialLoginButtonsProps> = ({
  onGitHubClick,
  onGoogleClick,
  isLoading = false,
  activeProvider = null,
}) => {
  return (
    <div className="space-y-2 w-full">
      {/* GitHub Button */}
      <button
        type="button"
        onClick={onGitHubClick}
        disabled={isLoading}
        className="w-full h-[38px] rounded-lg bg-[#14151D] hover:bg-[#1C1E28] border border-white/[0.08] hover:border-white/[0.16] text-zinc-200 text-[13px] font-medium flex items-center justify-center gap-2.5 transition-all duration-150 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed group focus-visible:ring-2 focus-visible:ring-[#A78BFA]/30 outline-none shadow-sm"
      >
        {activeProvider === 'github' ? (
          <div className="w-3.5 h-3.5 rounded-full border-2 border-zinc-500 border-t-white animate-spin" />
        ) : (
          <svg
            className="w-4 h-4 fill-current text-white group-hover:scale-105 transition-transform"
            viewBox="0 0 24 24"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            />
          </svg>
        )}
        <span>Continue with GitHub</span>
      </button>

      {/* Google Button */}
      <button
        type="button"
        onClick={onGoogleClick}
        disabled={isLoading}
        className="w-full h-[38px] rounded-lg bg-[#14151D] hover:bg-[#1C1E28] border border-white/[0.08] hover:border-white/[0.16] text-zinc-200 text-[13px] font-medium flex items-center justify-center gap-2.5 transition-all duration-150 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed group focus-visible:ring-2 focus-visible:ring-[#A78BFA]/30 outline-none shadow-sm"
      >
        {activeProvider === 'google' ? (
          <div className="w-3.5 h-3.5 rounded-full border-2 border-zinc-500 border-t-white animate-spin" />
        ) : (
          <svg className="w-3.5 h-3.5 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
            />
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
            />
            <path
              fill="#FBBC05"
              d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.1-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 12s.7 2.3 1.9 4.7l3.7-2.9z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.4 7.5 23 12 23z"
            />
          </svg>
        )}
        <span>Continue with Google</span>
      </button>

      {/* Divider */}
      <div className="relative py-1.5 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/[0.08]" />
        </div>
        <div className="relative bg-[#0C0D12] px-2.5">
          <span className="text-[10px] font-semibold text-zinc-500 tracking-wider uppercase">
            OR CONTINUE WITH EMAIL
          </span>
        </div>
      </div>
    </div>
  );
};
