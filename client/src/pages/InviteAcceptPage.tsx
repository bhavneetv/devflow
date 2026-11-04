import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, CheckCircle2, XCircle, Loader2, AlertCircle, Clock, Shield, ArrowRight, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { teamService } from '../services/team.service';
import type { InvitationPreview, TeamMemberRole } from '../types/team';
import { ROLE_LABELS, ROLE_COLORS } from '../types/team';

function getAvatarBg(str: string): string {
  const colors = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#BE185D'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

type PageState = 'loading' | 'valid' | 'invalid' | 'expired' | 'already_used' | 'email_mismatch' | 'accepted' | 'declined';

export const InviteAcceptPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setPageState('invalid');
      return;
    }
    validateInvitation();
  }, [token]);

  const validateInvitation = async () => {
    if (!token) return;
    setPageState('loading');
    const res = await teamService.getInvitationByToken(token);
    if (res.success && res.data) {
      setInvitation(res.data);
      setPageState('valid');
    } else if (res.status === 'EXPIRED') {
      setPageState('expired');
    } else if (res.status === 'ACCEPTED' || res.status === 'DECLINED' || res.status === 'CANCELLED') {
      setPageState('already_used');
      setErrorMessage(res.error || 'This invitation has already been processed.');
    } else {
      setPageState('invalid');
      setErrorMessage(res.error || 'Invalid invitation link.');
    }
  };

  const handleAccept = async () => {
    if (!token || !isAuthenticated) return;

    // Check email match
    if (invitation && user?.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()) {
      setPageState('email_mismatch');
      return;
    }

    setActionLoading(true);
    const res = await teamService.acceptInvitation(token);
    setActionLoading(false);

    if (res.success) {
      setPageState('accepted');
      toast.success('Welcome to the team! 🎉', 'You have successfully joined.');
      setTimeout(() => {
        navigate('/teams', { replace: true });
      }, 2500);
    } else {
      toast.error('Could not accept invitation', res.error);
      setErrorMessage(res.error || 'Failed to accept invitation');
    }
  };

  const handleDecline = async () => {
    if (!token || !isAuthenticated) return;
    setActionLoading(true);
    const res = await teamService.declineInvitation(token);
    setActionLoading(false);
    if (res.success) {
      setPageState('declined');
    } else {
      toast.error('Could not decline', res.error);
    }
  };

  const roleColors = invitation ? ROLE_COLORS[invitation.assignedRole as TeamMemberRole] : null;

  return (
    <div className="min-h-screen bg-[#08090B] flex items-center justify-center p-4 text-zinc-100">
      {/* Background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[#8B5CF6] opacity-[0.03] blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#8B5CF6] flex items-center justify-center">
              <Users size={14} className="text-white" />
            </div>
            <span className="text-[14px] font-semibold text-white">DevFlow</span>
          </div>
        </div>

        <div className="bg-[#0C0D10] border border-[#27272A] rounded-2xl shadow-2xl overflow-hidden">
          <AnimatePresence mode="wait">
            {/* Loading */}
            {pageState === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-10 flex flex-col items-center gap-3"
              >
                <Loader2 size={28} className="text-[#A78BFA] animate-spin" />
                <p className="text-[13px] text-zinc-400">Validating invitation...</p>
              </motion.div>
            )}

            {/* Valid invitation */}
            {pageState === 'valid' && invitation && (
              <motion.div
                key="valid"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Team header */}
                <div
                  className="p-6 border-b border-[#27272A] flex flex-col items-center gap-3 text-center"
                  style={{ background: `linear-gradient(to bottom, ${invitation.team.color}08, transparent)` }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-lg"
                    style={{ backgroundColor: invitation.team.color }}
                  >
                    {invitation.team.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h1 className="text-[18px] font-bold text-white">You're invited!</h1>
                    <p className="text-[13px] text-zinc-400 mt-1">
                      <span className="text-zinc-300 font-medium">{invitation.invitedBy.name}</span> invited you to join
                    </p>
                    <p className="text-[16px] font-semibold text-white mt-0.5">{invitation.team.name}</p>
                    {invitation.team.description && (
                      <p className="text-[12px] text-zinc-500 mt-1">{invitation.team.description}</p>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="p-5 space-y-4">
                  {/* Role */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#111216] border border-[#27272A]">
                    <div className="flex items-center gap-2 text-zinc-400 text-[12px]">
                      <Shield size={13} />
                      <span>Your role</span>
                    </div>
                    <span
                      className="text-[12px] font-medium px-2.5 py-1 rounded-lg"
                      style={{ backgroundColor: roleColors?.bg, color: roleColors?.text, border: `1px solid ${roleColors?.border}` }}
                    >
                      {ROLE_LABELS[invitation.assignedRole as TeamMemberRole]}
                    </span>
                  </div>

                  {/* Invited email */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#111216] border border-[#27272A]">
                    <div className="flex items-center gap-2 text-zinc-400 text-[12px]">
                      <span>Invited to</span>
                    </div>
                    <span className="text-[12px] text-zinc-300 font-mono">{invitation.invitedEmail}</span>
                  </div>

                  {/* Expiry */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#111216] border border-[#27272A]">
                    <div className="flex items-center gap-2 text-zinc-400 text-[12px]">
                      <Clock size={13} />
                      <span>Expires</span>
                    </div>
                    <span className="text-[12px] text-zinc-300">
                      {new Date(invitation.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Auth check */}
                  {!isAuthenticated ? (
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-xl bg-[#FBBF2410] border border-[#FBBF2425] text-[12px] text-[#FBBF24] flex items-center gap-2">
                        <AlertCircle size={13} />
                        You need to be logged in with <strong>{invitation.invitedEmail}</strong> to accept this invitation.
                      </div>
                      <Link
                        to={`/login?redirect=/invite/${token}`}
                        className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-[#8B5CF6] hover:brightness-110 text-[#0A0B10] text-[13px] font-semibold transition-all shadow-md"
                        style={{ boxShadow: '0 3px 14px #8B5CF630' }}
                      >
                        <LogIn size={14} />
                        Sign in to continue
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  ) : user?.email.toLowerCase() !== invitation.invitedEmail.toLowerCase() ? (
                    <div className="p-3.5 rounded-xl bg-[#F8717110] border border-[#F8717130] text-[12px] text-[#F87171] flex items-start gap-2">
                      <AlertCircle size={13} className="mt-0.5 shrink-0" />
                      <span>
                        You're signed in as <strong>{user?.email}</strong>, but this invitation is for <strong>{invitation.invitedEmail}</strong>. Please sign in with the correct account.
                      </span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleDecline}
                        disabled={actionLoading}
                        className="flex-1 h-10 rounded-xl border border-[#27272A] text-zinc-400 hover:text-white hover:bg-white/[0.04] text-[13px] font-medium transition-all disabled:opacity-50"
                      >
                        Decline
                      </button>
                      <button
                        onClick={handleAccept}
                        disabled={actionLoading}
                        className="flex-1 h-10 rounded-xl bg-[#8B5CF6] hover:brightness-110 text-[#0A0B10] text-[13px] font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md"
                        style={{ boxShadow: '0 3px 14px #8B5CF630' }}
                      >
                        {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        {actionLoading ? 'Joining...' : 'Accept Invitation'}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Accepted */}
            {pageState === 'accepted' && (
              <motion.div
                key="accepted"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-10 flex flex-col items-center gap-4 text-center"
              >
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="w-16 h-16 rounded-full bg-[#4ADE8020] border border-[#4ADE8040] flex items-center justify-center"
                >
                  <CheckCircle2 size={30} className="text-[#4ADE80]" />
                </motion.div>
                <div>
                  <h2 className="text-[18px] font-bold text-white">You're in! 🎉</h2>
                  <p className="text-[13px] text-zinc-400 mt-1">You've joined the team. Redirecting you now...</p>
                </div>
                <Loader2 size={16} className="text-zinc-500 animate-spin" />
              </motion.div>
            )}

            {/* Declined */}
            {pageState === 'declined' && (
              <motion.div
                key="declined"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-10 flex flex-col items-center gap-4 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center">
                  <XCircle size={26} className="text-zinc-400" />
                </div>
                <div>
                  <h2 className="text-[16px] font-semibold text-white">Invitation declined</h2>
                  <p className="text-[12px] text-zinc-500 mt-1">You can always ask for a new invitation link.</p>
                </div>
                <Link to="/" className="text-[12px] text-[#A78BFA] hover:underline">Go to dashboard</Link>
              </motion.div>
            )}

            {/* Expired */}
            {pageState === 'expired' && (
              <motion.div
                key="expired"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-10 flex flex-col items-center gap-4 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-[#FBBF2410] border border-[#FBBF2430] flex items-center justify-center">
                  <Clock size={26} className="text-[#FBBF24]" />
                </div>
                <div>
                  <h2 className="text-[16px] font-semibold text-white">Invitation expired</h2>
                  <p className="text-[12px] text-zinc-500 mt-1">This invitation link is no longer valid. Please ask the team owner to send you a fresh invite.</p>
                </div>
                <Link to="/" className="text-[12px] text-[#A78BFA] hover:underline">Go to dashboard</Link>
              </motion.div>
            )}

            {/* Already used / cancelled */}
            {pageState === 'already_used' && (
              <motion.div
                key="used"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-10 flex flex-col items-center gap-4 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center">
                  <AlertCircle size={26} className="text-zinc-400" />
                </div>
                <div>
                  <h2 className="text-[16px] font-semibold text-white">Invitation unavailable</h2>
                  <p className="text-[12px] text-zinc-500 mt-1">{errorMessage}</p>
                </div>
                <Link to="/" className="text-[12px] text-[#A78BFA] hover:underline">Go to dashboard</Link>
              </motion.div>
            )}

            {/* Invalid */}
            {pageState === 'invalid' && (
              <motion.div
                key="invalid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-10 flex flex-col items-center gap-4 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <XCircle size={26} className="text-red-400" />
                </div>
                <div>
                  <h2 className="text-[16px] font-semibold text-white">Invalid invitation</h2>
                  <p className="text-[12px] text-zinc-500 mt-1">{errorMessage || 'This invitation link is invalid or does not exist.'}</p>
                </div>
                <Link to="/" className="text-[12px] text-[#A78BFA] hover:underline">Go to dashboard</Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-[11px] text-zinc-600 mt-5">
          DevFlow · Team Collaboration Platform
        </p>
      </motion.div>
    </div>
  );
};

