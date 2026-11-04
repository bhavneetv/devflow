import React, { useState } from 'react';
import { AlertOctagon, Trash2, ShieldAlert } from 'lucide-react';

interface DangerZoneProps {
  onConfirmDelete: (confirmationPhrase: string) => Promise<{ success: boolean; error?: string }>;
  onDeactivate: () => Promise<{ success: boolean }>;
}

export const DangerZone: React.FC<DangerZoneProps> = ({
  onConfirmDelete,
  onDeactivate,
}) => {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const REQUIRED_PHRASE = 'DELETE MY ACCOUNT';

  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phrase.trim() !== REQUIRED_PHRASE) {
      setError(`Please type "${REQUIRED_PHRASE}" exactly to confirm.`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await onConfirmDelete(phrase);
      if (!res.success) {
        setError(res.error || 'Failed to delete account.');
      } else {
        window.location.href = '/login';
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateSubmit = async () => {
    try {
      setLoading(true);
      await onDeactivate();
      window.location.href = '/login';
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Deactivate Account Row */}
      <div className="p-4 bg-[#171A21] border border-[#27272A] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xs sm:text-[13px] font-semibold text-[#F4F4F5]">
            Deactivate Account
          </h3>
          <p className="text-[11px] text-[#A1A1AA] mt-1 leading-relaxed max-w-xl">
            Temporarily disable your account. Your profile, projects, and active sessions will be paused until you sign in again.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsDeactivateModalOpen(true)}
          className="px-3.5 py-1.5 rounded-lg border border-amber-500/40 hover:border-amber-500 text-xs font-medium text-amber-400 hover:bg-amber-500/10 transition-colors flex-shrink-0"
        >
          Deactivate Account
        </button>
      </div>

      {/* Permanent Deletion Danger Zone Card */}
      <div className="p-5 bg-red-950/20 border border-red-500/40 rounded-xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 flex-shrink-0">
            <AlertOctagon size={20} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-red-400">
              Permanently Delete Account
            </h3>
            <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
              Once deleted, your account, personal data, task assignments, and configurations will be permanently wiped. This action is irreversible.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => {
              setPhrase('');
              setError(null);
              setIsDeleteModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-lg transition-colors"
          >
            <Trash2 size={14} />
            <span>Delete Account</span>
          </button>
        </div>
      </div>

      {/* Deactivate Confirmation Modal */}
      {isDeactivateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#161619] border border-[#27272A] rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400 font-semibold text-base">
              <ShieldAlert size={20} />
              <span>Deactivate DevFlow Account?</span>
            </div>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Your active credentials will be terminated across all browsers. Your workspaces and assigned tasks will remain intact. You can reactivate anytime by signing back in.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsDeactivateModalOpen(false)}
                disabled={loading}
                className="px-4 py-2 rounded-lg border border-[#27272A] text-xs text-[#A1A1AA] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeactivateSubmit}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
              >
                {loading ? 'Deactivating...' : 'Confirm Deactivation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Modal with Strict Confirmation Phrase */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#161619] border border-red-500/50 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-2.5 text-red-400 font-semibold text-base">
              <AlertOctagon size={20} />
              <span>Confirm Permanent Account Deletion</span>
            </div>

            <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-xl text-xs text-red-200 leading-relaxed">
              Warning: This will immediately delete your account credentials, remove you from all DevFlow workspaces, and destroy your personal settings forever.
            </div>

            <form onSubmit={handleDeleteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Type <span className="font-mono text-red-400 font-bold">{REQUIRED_PHRASE}</span> to proceed:
                </label>
                <input
                  type="text"
                  required
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  placeholder={REQUIRED_PHRASE}
                  className="w-full px-3 py-2 bg-[#111216] border border-[#27272A] focus:border-red-500 rounded-lg text-xs text-white outline-none font-mono tracking-wider"
                />
                {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-[#27272A]">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg border border-[#27272A] text-xs text-[#A1A1AA] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || phrase.trim() !== REQUIRED_PHRASE}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-md transition-all"
                >
                  {loading ? 'Deleting Account...' : 'Permanently Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
