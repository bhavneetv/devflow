import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Building2, CheckCircle2, AlertCircle, Shield, ArrowRight, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { useToast } from '../context/ToastContext';
import { organizationService } from '../services/organization.service';
import { useAccentTheme } from '../services/accentTheme.service';

export const OrgInviteAcceptPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { refreshOrganizations, switchOrganization } = useOrganization();
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successOrg, setSuccessOrg] = useState<any | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
      setIsLoading(false);
      return;
    }

    if (!authLoading && !isAuthenticated) {
      // Store pending token in session storage
      try { sessionStorage.setItem('pending_org_invite_token', token); } catch {}
      setIsLoading(false);
    } else if (!authLoading && isAuthenticated) {
      setIsLoading(false);
    }
  }, [token, isAuthenticated, authLoading]);

  const handleAcceptInvite = async () => {
    if (!token) return;
    setIsJoining(true);
    setError(null);
    try {
      const res = await organizationService.joinOrganization(token);
      if (res.success && res.data) {
        setSuccessOrg(res.data.organization);
        toast.success('Joined Organization!', `You are now a member of ${res.data.organization.name}`);
        await refreshOrganizations();
        setTimeout(() => {
          navigate(`/organizations/${res.data!.organization.slug}/overview`);
        }, 1200);
      } else {
        setError(res.error || 'Failed to accept invitation');
      }
    } catch (err: any) {
      setError(err.message || 'Error processing invitation');
    } finally {
      setIsJoining(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#08090B] flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: `${accentColor} transparent ${accentColor} ${accentColor}` }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090B] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
      <div className="max-w-md w-full bg-[#171A21] border border-[#27272A] rounded-3xl p-8 shadow-2xl space-y-6">
        <div
          className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl"
          style={{ backgroundColor: accentColor }}
        >
          <Building2 size={32} />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            Organization Invitation
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            You have been invited to collaborate in an organization workspace on DevFlow.
          </p>
        </div>

        {!isAuthenticated ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 text-left">
              Please sign in or create a DevFlow account to accept this invitation.
            </div>
            <Link
              to="/login"
              className="w-full py-3 px-4 rounded-xl text-xs font-semibold text-white shadow-lg flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: accentColor }}
            >
              <LogIn size={15} />
              <span>Sign In to Accept</span>
            </Link>
          </div>
        ) : successOrg ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>Invitation accepted! Redirecting to {successOrg.name}...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2 text-left">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleAcceptInvite}
              disabled={isJoining}
              className="w-full py-3 px-4 rounded-xl text-xs font-semibold text-white shadow-lg flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: accentColor }}
            >
              {isJoining ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowRight size={15} />
              )}
              <span>{isJoining ? 'Joining organization...' : 'Accept & Join Workspace'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
