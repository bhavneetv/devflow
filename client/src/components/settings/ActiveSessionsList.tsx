import React, { useState } from 'react';
import {
  Laptop,
  Smartphone,
  Globe,
  Trash2,
  LogOut,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { ActiveSession } from '../../services/accountSettings.service';

interface ActiveSessionsListProps {
  sessions: ActiveSession[];
  onRevokeSession: (sessionId: string) => Promise<void>;
  onRevokeOtherSessions: () => Promise<void>;
}

export const ActiveSessionsList: React.FC<ActiveSessionsListProps> = ({
  sessions,
  onRevokeSession,
  onRevokeOtherSessions,
}) => {
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [confirmRevokeOthers, setConfirmRevokeOthers] = useState(false);
  const [loading, setLoading] = useState(false);

  const getDeviceIcon = (device: string, os: string) => {
    if (os.toLowerCase().includes('ios') || os.toLowerCase().includes('android') || device.toLowerCase().includes('phone')) {
      return <Smartphone size={16} className="text-[#A78BFA]" />;
    }
    if (device.toLowerCase().includes('macbook') || device.toLowerCase().includes('laptop') || device.toLowerCase().includes('workstation')) {
      return <Laptop size={16} className="text-[#A78BFA]" />;
    }
    return <Globe size={16} className="text-[#A78BFA]" />;
  };

  const handleRevokeSingle = async (id: string) => {
    try {
      setLoading(true);
      await onRevokeSession(id);
      setConfirmRevokeId(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAllOthers = async () => {
    try {
      setLoading(true);
      await onRevokeOtherSessions();
      setConfirmRevokeOthers(false);
    } finally {
      setLoading(false);
    }
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="space-y-4">
      {/* Sessions Card Header & Global Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#171A21] border border-[#27272A] rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#A78BFA]/10 border border-[#A78BFA]/20 flex items-center justify-center text-[#A78BFA]">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="text-xs sm:text-[13px] font-semibold text-[#F4F4F5]">
              Active Sessions ({sessions.length})
            </div>
            <p className="text-[11px] text-[#A1A1AA]">
              Devices currently signed in to your DevFlow account
            </p>
          </div>
        </div>

        {otherSessionsCount > 0 && (
          <button
            type="button"
            onClick={() => setConfirmRevokeOthers(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 hover:border-red-500/60 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors"
          >
            <LogOut size={13} />
            <span>Sign Out Other Sessions ({otherSessionsCount})</span>
          </button>
        )}
      </div>

      {/* Session Items List */}
      <div className="divide-y divide-[#27272A]/60 border border-[#27272A] bg-[#111216] rounded-xl overflow-hidden">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
          >
            {/* Device info */}
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                {getDeviceIcon(session.device, session.os)}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-[13px] font-medium text-[#F4F4F5]">
                    {session.device}
                  </span>

                  {session.isCurrent ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Current Session
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#71717A]">
                      • {session.lastActive}
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-[#A1A1AA] flex items-center gap-2 mt-0.5 flex-wrap">
                  <span>{session.browser}</span>
                  <span>•</span>
                  <span>{session.os}</span>
                  <span>•</span>
                  <span>{session.location}</span>
                </div>

                <div className="text-[10px] font-mono text-[#71717A] mt-1">
                  IP: {session.ipAddress} • Signed in {session.createdAt}
                </div>
              </div>
            </div>

            {/* Revoke button (for non-current sessions) */}
            {!session.isCurrent && (
              <div className="sm:self-center flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmRevokeId(session.id)}
                  className="px-2.5 py-1.5 rounded border border-[#27272A] hover:border-red-500/40 text-xs text-[#A1A1AA] hover:text-red-400 hover:bg-red-500/10 transition-colors inline-flex items-center gap-1.5"
                  title="Revoke session token"
                >
                  <Trash2 size={13} />
                  <span>Revoke</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Confirmation Modal for Single Session */}
      {confirmRevokeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-[#161619] border border-[#27272A] rounded-xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-amber-400 font-semibold text-sm">
              <AlertTriangle size={18} />
              <span>Revoke Active Session?</span>
            </div>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              This device will be immediately signed out and will require full re-authentication to access DevFlow.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRevokeId(null)}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg border border-[#27272A] text-xs text-[#A1A1AA] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRevokeSingle(confirmRevokeId)}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                {loading ? 'Revoking...' : 'Yes, Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for All Other Sessions */}
      {confirmRevokeOthers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#161619] border border-[#27272A] rounded-xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-red-400 font-semibold text-sm">
              <AlertTriangle size={18} />
              <span>Sign out all other sessions?</span>
            </div>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              All active sessions except this current browser will be terminated immediately. You will need to sign in again on all other computers and phones.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRevokeOthers(false)}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg border border-[#27272A] text-xs text-[#A1A1AA] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevokeAllOthers}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                {loading ? 'Signing out...' : 'Sign Out All Others'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
