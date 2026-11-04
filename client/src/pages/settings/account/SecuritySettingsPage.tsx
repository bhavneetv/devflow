import React, { useState, useEffect } from 'react';
import { AccountSettingsLayout } from '../../../components/settings/AccountSettingsLayout';
import { SettingsPageHeader } from '../../../components/settings/SettingsPageHeader';
import { SettingsSectionNav, SettingsCategory } from '../../../components/settings/SettingsSectionNav';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { SettingsRow } from '../../../components/settings/SettingsRow';
import { ActiveSessionsList } from '../../../components/settings/ActiveSessionsList';
import {
  accountSettingsService,
  ActiveSession,
  LoginActivityEvent,
} from '../../../services/accountSettings.service';
import { useToast } from '../../../context/ToastContext';
import { useAccentTheme } from '../../../services/accentTheme.service';
import {
  Key,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  QrCode,
  Smartphone,
  Lock,
  History,
  AlertCircle,
} from 'lucide-react';

const SECURITY_CATEGORIES: SettingsCategory[] = [
  { id: 'authentication', label: 'Authentication' },
  { id: 'active-sessions', label: 'Active Sessions' },
  { id: 'login-activity', label: 'Login Activity' },
];

export const SecuritySettingsPage: React.FC = () => {
  const { toast } = useToast();
  const { accentColor } = useAccentTheme();
  const [securitySettings, setSecuritySettings] = useState(() =>
    accountSettingsService.getSecuritySettings()
  );
  const [sessions, setSessions] = useState<ActiveSession[]>(() =>
    accountSettingsService.getActiveSessions()
  );
  const [activity, setActivity] = useState<LoginActivityEvent[]>(() =>
    accountSettingsService.getLoginActivity()
  );

  // Change Password Form State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // 2FA Modal State
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  useEffect(() => {
    setSecuritySettings(accountSettingsService.getSecuritySettings());
    setSessions(accountSettingsService.getActiveSessions());
    setActivity(accountSettingsService.getLoginActivity());
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    try {
      setPasswordLoading(true);
      const res = await accountSettingsService.changePassword(currentPassword, newPassword);
      if (!res.success) {
        setPasswordError(res.error || 'Failed to update password.');
      } else {
        setSecuritySettings(accountSettingsService.getSecuritySettings());
        setActivity(accountSettingsService.getLoginActivity());
        setIsChangingPassword(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        toast.success('Password updated successfully!');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleToggle2FA = async () => {
    try {
      setTwoFactorLoading(true);
      const nextState = !securitySettings.is2FAEnabled;
      const res = await accountSettingsService.toggle2FA(nextState);
      setSecuritySettings((prev) => ({ ...prev, is2FAEnabled: res.is2FAEnabled }));
      setActivity(accountSettingsService.getLoginActivity());
      setIs2FAModalOpen(false);
      setTwoFactorCode('');
      if (res.is2FAEnabled) {
        toast.success('Two-factor authentication enabled successfully!');
      } else {
        toast.info('Two-factor authentication disabled.');
      }
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    const updated = await accountSettingsService.revokeSession(sessionId);
    setSessions(updated);
    setActivity(accountSettingsService.getLoginActivity());
    toast.info('Session revoked successfully.');
  };

  const handleRevokeOtherSessions = async () => {
    const updated = await accountSettingsService.revokeOtherSessions();
    setSessions(updated);
    setActivity(accountSettingsService.getLoginActivity());
    toast.success('Signed out of all other sessions.');
  };

  return (
    <AccountSettingsLayout>
      <SettingsPageHeader
        title="Security & Access"
        description="Protect your account and manage how you sign in to DevFlow."
      />

      <SettingsSectionNav categories={SECURITY_CATEGORIES} />

      <div className="px-6 sm:px-8 pb-16 space-y-2">
        {/* ── Category A: Authentication ─────────────────────────────────── */}
        <SettingsSection
          id="authentication"
          title="Sign-in & Authentication"
          description="Manage your account password, two-factor authentication, and login credentials."
        >
          {/* Password Settings Row */}
          <SettingsRow
            label="Account Password"
            description={
              securitySettings.hasPassword
                ? `Last modified ${securitySettings.lastPasswordChange}`
                : 'No master password set.'
            }
            action={
              !isChangingPassword && (
                <button
                  type="button"
                  onClick={() => setIsChangingPassword(true)}
                  className="px-3 py-1.5 rounded-lg border border-[#27272A] hover:border-[#A78BFA] bg-[#171A21] hover:bg-[#1E222A] text-xs font-medium text-[#F4F4F5] transition-colors"
                >
                  Change Password
                </button>
              )
            }
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[#A1A1AA] tracking-widest">
                ••••••••••••••••
              </span>
              <span className="text-[11px] text-[#71717A]">(Strong)</span>
            </div>
          </SettingsRow>

          {/* Change Password Inline Expandable Form */}
          {isChangingPassword && (
            <div className="p-4 bg-[#111216] border border-[#27272A] rounded-xl space-y-4 animate-in fade-in">
              <div className="text-xs font-semibold text-[#F4F4F5] flex items-center gap-2">
                <Lock size={14} style={{ color: accentColor }} />
                <span>Change Account Password</span>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-3 max-w-md">
                {/* Current Password */}
                <div>
                  <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-9 bg-[#161619] border border-[#27272A] focus:border-[var(--settings-accent)] rounded-lg text-xs text-white outline-none"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300"
                    >
                      {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                    New Password (min 8 chars)
                  </label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-9 bg-[#161619] border border-[#27272A] focus:border-[var(--settings-accent)] rounded-lg text-xs text-white outline-none"
                      placeholder="Enter strong new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300"
                    >
                      {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-9 bg-[#161619] border border-[#27272A] focus:border-[var(--settings-accent)] rounded-lg text-xs text-white outline-none"
                      placeholder="Repeat new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300"
                    >
                      {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {passwordError && (
                  <p className="text-[11px] text-red-400">{passwordError}</p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="px-3.5 py-1.5 rounded-lg text-black font-semibold text-xs transition-colors"
                    style={{
                      backgroundColor: accentColor,
                      boxShadow: `0 2px 10px ${accentColor}40`,
                    }}
                  >
                    {passwordLoading ? 'Updating...' : 'Update Password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangingPassword(false);
                      setPasswordError(null);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[#27272A] text-xs text-[#A1A1AA] hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Two-Factor Authentication (2FA) Row */}
          <SettingsRow
            label="Two-Factor Authentication (2FA)"
            description="Add an extra layer of security using an authenticator app (TOTP)."
            action={
              <button
                type="button"
                onClick={() => setIs2FAModalOpen(true)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  securitySettings.is2FAEnabled
                    ? 'border-[#27272A] hover:border-red-500/40 text-red-400 hover:bg-red-500/10'
                    : 'border-[#27272A] hover:border-[#A78BFA] bg-[#171A21] hover:bg-[#1E222A] text-[#F4F4F5]'
                }`}
              >
                {securitySettings.is2FAEnabled ? 'Disable 2FA' : 'Enable 2FA'}
              </button>
            }
          >
            <div>
              {securitySettings.is2FAEnabled ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 size={13} />
                  <span>Enabled (Authenticator App)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                  <span>Disabled</span>
                </span>
              )}
            </div>
          </SettingsRow>

          {/* Connected Login Methods Overview */}
          <SettingsRow
            label="Configured Login Methods"
            description="Methods enabled to verify your identity on sign in."
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 font-medium">
                Email + Password
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 font-medium">
                Google Workspace
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 font-medium">
                GitHub OAuth
              </span>
            </div>
          </SettingsRow>
        </SettingsSection>

        {/* ── Category B: Active Sessions ────────────────────────────────── */}
        <SettingsSection
          id="active-sessions"
          title="Active Sessions"
          description="Manage active logins and revoke access from unrecognized browsers or devices."
        >
          <ActiveSessionsList
            sessions={sessions}
            onRevokeSession={handleRevokeSession}
            onRevokeOtherSessions={handleRevokeOtherSessions}
          />
        </SettingsSection>

        {/* ── Category C: Login Activity ─────────────────────────────────── */}
        <SettingsSection
          id="login-activity"
          title="Recent Security Events"
          description="Audit trail of recent login attempts, credential modifications, and session changes."
        >
          {activity.length === 0 ? (
            <div className="p-8 text-center bg-[#111216] border border-[#27272A] rounded-xl text-xs text-[#71717A]">
              No security events recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-[#27272A]/50 border border-[#27272A] bg-[#111216] rounded-xl overflow-hidden">
              {activity.map((event) => (
                <div
                  key={event.id}
                  className="p-3.5 flex items-start justify-between gap-3 hover:bg-white/[0.01] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-md bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <History size={14} className="text-[#A78BFA]" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-[13px] font-medium text-[#F4F4F5]">
                        {event.title}
                      </div>
                      <p className="text-[11px] text-[#A1A1AA] mt-0.5">
                        {event.description}
                      </p>
                      <div className="text-[10px] font-mono text-[#71717A] mt-1">
                        IP: {event.ipAddress} • {event.location}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                        event.status === 'SUCCESS'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : event.status === 'FAILED'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {event.status}
                    </span>
                    <div className="text-[10px] text-[#71717A] mt-1 font-mono">
                      {event.timestamp}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SettingsSection>
      </div>

      {/* 2FA Enrollment / Management Modal */}
      {is2FAModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#161619] border border-[#27272A] rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-2.5 text-[#F4F4F5] font-semibold text-base">
              <Smartphone size={20} style={{ color: accentColor }} />
              <span>
                {securitySettings.is2FAEnabled
                  ? 'Disable Two-Factor Authentication'
                  : 'Enroll Authenticator App (2FA)'}
              </span>
            </div>

            {!securitySettings.is2FAEnabled ? (
              <div className="space-y-4 text-xs text-[#A1A1AA]">
                <p>
                  Scan the QR code with your authenticator app (Google Authenticator, 1Password, or Authy), then enter the 6-digit verification code below.
                </p>

                {/* QR Code Demo Box */}
                <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow">
                  <div className="w-36 h-36 bg-zinc-900 rounded-lg flex items-center justify-center text-white p-2">
                    <QrCode size={120} className="text-white" />
                  </div>
                  <span className="text-[10px] font-mono text-zinc-600 mt-2">
                    KEY: DEVFLOW-J4K2-90LA-PR26
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#F4F4F5] mb-1">
                    6-digit Verification Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full text-center tracking-[0.5em] text-lg font-mono py-2 bg-[#111216] border border-[#27272A] focus:border-[var(--settings-accent)] rounded-lg text-white outline-none"
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Disabling 2FA will remove the extra security check when logging in. You can re-enable it at any time.
              </p>
            )}

            <div className="flex justify-end gap-2.5 pt-2 border-t border-[#27272A]">
              <button
                type="button"
                onClick={() => setIs2FAModalOpen(false)}
                disabled={twoFactorLoading}
                className="px-4 py-2 rounded-lg border border-[#27272A] text-xs text-[#A1A1AA] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggle2FA}
                disabled={twoFactorLoading}
                className="px-4 py-2 rounded-lg text-black font-semibold text-xs shadow-md"
                style={{
                  backgroundColor: accentColor,
                  boxShadow: `0 4px 14px ${accentColor}40`,
                }}
              >
                {twoFactorLoading
                  ? 'Processing...'
                  : securitySettings.is2FAEnabled
                  ? 'Confirm Disable'
                  : 'Verify & Enable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AccountSettingsLayout>
  );
};
