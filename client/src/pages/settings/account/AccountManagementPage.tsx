import React, { useState } from 'react';
import { AccountSettingsLayout } from '../../../components/settings/AccountSettingsLayout';
import { SettingsPageHeader } from '../../../components/settings/SettingsPageHeader';
import { SettingsSectionNav, SettingsCategory } from '../../../components/settings/SettingsSectionNav';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { DangerZone } from '../../../components/settings/DangerZone';
import { accountSettingsService } from '../../../services/accountSettings.service';
import { useToast } from '../../../context/ToastContext';
import { useAccentTheme } from '../../../services/accentTheme.service';
import {
  Download,
  FileText,
  CheckCircle2,
  Lock,
  Database,
  ArrowRight,
} from 'lucide-react';

const MANAGEMENT_CATEGORIES: SettingsCategory[] = [
  { id: 'account-data', label: 'Account Data' },
  { id: 'account-status', label: 'Account Status' },
  { id: 'delete-account', label: 'Delete Account' },
];

export const AccountManagementPage: React.FC = () => {
  const { toast } = useToast();
  const { accentColor } = useAccentTheme();
  const [exportLoading, setExportLoading] = useState(false);
  const [lastExport, setLastExport] = useState<{
    downloadUrl: string;
    size: string;
    createdAt: string;
  } | null>(null);

  const handleRequestExport = async () => {
    try {
      setExportLoading(true);
      const res = await accountSettingsService.requestDataExport();
      setLastExport({
        downloadUrl: res.downloadUrl,
        size: res.size,
        createdAt: res.createdAt,
      });
      toast.success('Personal data archive is ready for download!');
    } catch {
      toast.error('Data export failed. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeactivate = async () => {
    const res = await accountSettingsService.deactivateAccount();
    toast.info('Account deactivated. Redirecting...');
    return res;
  };

  const handleDelete = async (phrase: string) => {
    const res = await accountSettingsService.deleteAccount(phrase);
    if (res.success) {
      toast.info('Your DevFlow account has been deleted.');
    }
    return res;
  };

  return (
    <AccountSettingsLayout>
      <SettingsPageHeader
        title="Account Management"
        description="Manage your account data and control your DevFlow account."
      />

      <SettingsSectionNav categories={MANAGEMENT_CATEGORIES} />

      <div className="px-6 sm:px-8 pb-16 space-y-2">
        {/* ── Category A: Account Data ───────────────────────────────────── */}
        <SettingsSection
          id="account-data"
          title="Personal Data & Portability"
          description="Export an encrypted archive of your profile, preferences, task history, and developer activity."
        >
          <div className="p-5 bg-[#171A21] border border-[#27272A] rounded-xl space-y-4">
            <div className="flex items-start justify-between gap-4 flex-col sm:flex-row sm:items-center">
              <div className="flex items-start gap-3.5">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: `${accentColor}18`,
                    border: `1px solid ${accentColor}35`,
                    color: accentColor,
                  }}
                >
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-[13px] font-semibold text-[#F4F4F5]">
                    Export Personal Data (GDPR & CCPA Compliant)
                  </h3>
                  <p className="text-[11px] text-[#A1A1AA] mt-0.5 leading-relaxed">
                    Download a copy of your personal data in structured JSON format. Includes your user profile, active sessions, and security activity audit logs.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRequestExport}
                disabled={exportLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-black font-semibold text-xs transition-colors flex-shrink-0 disabled:opacity-50"
                style={{
                  backgroundColor: accentColor,
                  boxShadow: `0 2px 10px ${accentColor}40`,
                }}
              >
                <Download size={14} />
                <span>{exportLoading ? 'Generating Export...' : 'Request Data Export'}</span>
              </button>
            </div>

            {/* Ready Export Download Card */}
            {lastExport && (
              <div className="p-3.5 bg-[#111216] border border-emerald-500/30 rounded-lg flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                  <div className="text-xs">
                    <span className="font-semibold text-white">devflow-account-export.json</span>
                    <span className="text-zinc-400 ml-2">({lastExport.size})</span>
                  </div>
                </div>

                <a
                  href={lastExport.downloadUrl}
                  download="devflow-account-export.json"
                  className="px-3 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium border border-emerald-500/40 inline-flex items-center gap-1 transition-colors"
                >
                  <Download size={12} />
                  <span>Download JSON</span>
                </a>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px] text-zinc-400">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#111216]/60 border border-[#27272A]/50">
                <FileText size={14} style={{ color: accentColor }} />
                <span>Profile & Customizations</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#111216]/60 border border-[#27272A]/50">
                <Lock size={14} style={{ color: accentColor }} />
                <span>Active Tokens & Audit Logs</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#111216]/60 border border-[#27272A]/50">
                <Database size={14} style={{ color: accentColor }} />
                <span>Assigned Issues & Projects</span>
              </div>
            </div>
          </div>
        </SettingsSection>

        {/* ── Category B & C: Account Status & Deletion (Danger Zone) ────── */}
        <SettingsSection
          id="account-status"
          title="Account Lifecycle"
          description="Deactivate your account temporarily or control your membership status."
        >
          <div id="delete-account">
            <DangerZone
              onDeactivate={handleDeactivate}
              onConfirmDelete={handleDelete}
            />
          </div>
        </SettingsSection>
      </div>
    </AccountSettingsLayout>
  );
};
