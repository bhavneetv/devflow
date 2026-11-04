import React, { useState } from 'react';
import {
  GitBranch,
  CheckCircle2,
  AlertCircle,
  Unlink,
  Link as LinkIcon,
} from 'lucide-react';
import { ConnectedAccount } from '../../services/accountSettings.service';
import { useAccentTheme } from '../../services/accentTheme.service';

interface ConnectedAccountCardProps {
  account: ConnectedAccount;
  onToggle: (id: string, shouldConnect: boolean) => Promise<void>;
}

export const ConnectedAccountCard: React.FC<ConnectedAccountCardProps> = ({
  account,
  onToggle,
}) => {
  const { accentColor } = useAccentTheme();
  const [loading, setLoading] = useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);

  const handleAction = async () => {
    if (account.isConnected) {
      setShowConfirmDisconnect(true);
    } else {
      try {
        setLoading(true);
        await onToggle(account.id, true);
      } finally {
        setLoading(false);
      }
    }
  };

  const confirmDisconnect = async () => {
    try {
      setLoading(true);
      await onToggle(account.id, false);
      setShowConfirmDisconnect(false);
    } finally {
      setLoading(false);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'github':
        return (
          <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
        );
      case 'google':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5c1.54 0 2.9.54 3.98 1.58l2.96-2.96C17.14 1.94 14.77 1 12 1 7.42 1 3.52 3.58 1.63 7.33l3.52 2.73C6.01 7.15 8.77 5 12 5z" />
            <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.72 2.88c2.18-2.01 3.7-4.98 3.7-8.7z" />
            <path fill="#FBBC05" d="M5.15 14.94c-.25-.74-.39-1.53-.39-2.35 0-.82.14-1.61.39-2.35L1.63 7.51C.59 9.58 0 11.9 0 14.35s.59 4.77 1.63 6.84l3.52-2.73z" />
            <path fill="#34A853" d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.72-2.88c-1.07.72-2.45 1.15-4.21 1.15-3.23 0-5.99-2.15-6.85-5.06L1.63 16.03C3.52 19.78 7.42 23 12 23z" />
          </svg>
        );
      case 'gitlab':
        return (
          <svg className="w-5 h-5 fill-current text-orange-500" viewBox="0 0 24 24">
            <path d="M23.6 9.57l-.03-.09-3.48-8.9a.9.9 0 0 0-.34-.41.92.92 0 0 0-.53-.1.92.92 0 0 0-.5.23.94.94 0 0 0-.25.46L16.2 7.8H7.8L5.53.76a.94.94 0 0 0-.25-.46.92.92 0 0 0-.5-.23.92.92 0 0 0-.53.1.9.9 0 0 0-.34.41L.43 9.48l-.03.09a5.96 5.96 0 0 0 2.14 6.81l9.46 6.88 9.46-6.88a5.96 5.96 0 0 0 2.14-6.81z" />
          </svg>
        );
      default:
        return <GitBranch size={20} style={{ color: accentColor }} />;
    }
  };

  return (
    <div className="p-4 bg-[#111216] border border-[#27272A] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-zinc-700">
      <div className="flex items-start gap-3.5 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-[#171A21] border border-[#27272A] flex items-center justify-center flex-shrink-0">
          {getProviderIcon(account.provider)}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xs sm:text-[13px] font-semibold text-[#F4F4F5]">
              {account.name}
            </h3>

            {account.isConnected ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 size={11} />
                <span>Connected</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                Not Connected
              </span>
            )}
          </div>

          <p className="text-[11px] text-[#A1A1AA] mt-1 leading-relaxed">
            {account.scopeDescription}
          </p>

          {account.isConnected && account.connectedIdentifier && (
            <div className="text-[11px] font-mono mt-1.5 flex items-center gap-2" style={{ color: accentColor }}>
              <span>Account: @{account.connectedIdentifier}</span>
              {account.connectedAt && (
                <span className="text-[10px] text-zinc-500">• {account.connectedAt}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 sm:self-center">
        {account.isConnected ? (
          <button
            type="button"
            onClick={handleAction}
            disabled={loading}
            className="w-full sm:w-auto px-3 py-1.5 rounded-lg border border-[#27272A] hover:border-red-500/40 text-xs font-medium text-[#A1A1AA] hover:text-red-400 hover:bg-red-500/10 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Unlink size={13} />
            <span>{loading ? 'Disconnecting...' : 'Disconnect'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleAction}
            disabled={loading}
            className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-[#1A1D24] hover:bg-[#222630] border border-[#27272A] hover:border-zinc-500 text-xs font-medium text-[#F4F4F5] transition-all inline-flex items-center justify-center gap-1.5"
          >
            <LinkIcon size={13} style={{ color: accentColor }} />
            <span>{loading ? 'Connecting...' : `Connect ${account.name}`}</span>
          </button>
        )}
      </div>

      {/* Disconnect Warning Modal */}
      {showConfirmDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-[#161619] border border-[#27272A] rounded-xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-amber-400 font-semibold text-sm">
              <AlertCircle size={18} />
              <span>Disconnect {account.name}?</span>
            </div>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              DevFlow will lose synchronization with your repositories and OAuth single sign-on access. You can reconnect anytime.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmDisconnect(false)}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg border border-[#27272A] text-xs text-[#A1A1AA] hover:text-white"
              >
                Keep Connected
              </button>
              <button
                type="button"
                onClick={confirmDisconnect}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                {loading ? 'Disconnecting...' : 'Disconnect Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
