import React, { useState, useEffect } from 'react';
import { AccountSettingsLayout } from '../../../components/settings/AccountSettingsLayout';
import { SettingsPageHeader } from '../../../components/settings/SettingsPageHeader';
import { SettingsSectionNav, SettingsCategory } from '../../../components/settings/SettingsSectionNav';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { ConnectedAccountCard } from '../../../components/settings/ConnectedAccountCard';
import {
  accountSettingsService,
  ConnectedAccount,
} from '../../../services/accountSettings.service';
import { useToast } from '../../../context/ToastContext';
import { GitBranch, Shield, KeyRound } from 'lucide-react';

const CONNECTION_CATEGORIES: SettingsCategory[] = [
  { id: 'code-hosting', label: 'Code Hosting' },
  { id: 'sign-in-providers', label: 'Sign-in Providers' },
];

export const ConnectedAccountsPage: React.FC = () => {
  const { toast } = useToast();
  const [connections, setConnections] = useState<ConnectedAccount[]>(() =>
    accountSettingsService.getConnectedAccounts()
  );

  useEffect(() => {
    setConnections(accountSettingsService.getConnectedAccounts());
  }, []);

  const handleToggleConnection = async (id: string, shouldConnect: boolean) => {
    try {
      const updated = await accountSettingsService.toggleConnection(id, shouldConnect);
      setConnections(updated);
      const target = updated.find((c) => c.id === id);
      if (shouldConnect) {
        toast.success(`Successfully linked ${target?.name} account!`);
      } else {
        toast.info(`Disconnected ${target?.name} account.`);
      }
    } catch {
      toast.error('Connection operation failed.');
    }
  };

  const codeHostingAccounts = connections.filter((c) => c.category === 'code-hosting');
  const signInAccounts = connections.filter((c) => c.category === 'sign-in-provider');

  return (
    <AccountSettingsLayout>
      <SettingsPageHeader
        title="Connected Accounts"
        description="Manage the external accounts linked to your DevFlow identity."
      />

      <SettingsSectionNav categories={CONNECTION_CATEGORIES} />

      <div className="px-6 sm:px-8 pb-16 space-y-2">
        {/* ── Category A: Code Hosting ───────────────────────────────────── */}
        <SettingsSection
          id="code-hosting"
          title="Git & Code Repositories"
          description="Connect your repositories, pull requests, commits, and automated code reviews to DevFlow."
        >
          <div className="space-y-3">
            {codeHostingAccounts.map((account) => (
              <ConnectedAccountCard
                key={account.id}
                account={account}
                onToggle={handleToggleConnection}
              />
            ))}
          </div>

          <div className="p-4 bg-[#111216] border border-[#27272A] rounded-xl flex items-start gap-3 mt-4 text-xs text-[#A1A1AA] leading-relaxed">
            <GitBranch size={16} className="text-[#A78BFA] flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Repository permissions note:</span>{' '}
              Repository access scopes only sync commits and issues assigned to your account.
              Workspace-wide repository access is configured in workspace integrations by administrators.
            </div>
          </div>
        </SettingsSection>

        {/* ── Category B: Sign-in Providers ──────────────────────────────── */}
        <SettingsSection
          id="sign-in-providers"
          title="Single Sign-on & Identity Providers"
          description="External authentication providers authorized to sign in to your DevFlow account."
        >
          <div className="space-y-3">
            {signInAccounts.map((account) => (
              <ConnectedAccountCard
                key={account.id}
                account={account}
                onToggle={handleToggleConnection}
              />
            ))}
          </div>

          <div className="p-4 bg-[#111216] border border-[#27272A] rounded-xl flex items-start gap-3 mt-4 text-xs text-[#A1A1AA] leading-relaxed">
            <KeyRound size={16} className="text-[#A78BFA] flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Account recovery safeguard:</span>{' '}
              You cannot disconnect your only active sign-in method unless a verified password
              or secondary OAuth provider has been configured first.
            </div>
          </div>
        </SettingsSection>
      </div>
    </AccountSettingsLayout>
  );
};
