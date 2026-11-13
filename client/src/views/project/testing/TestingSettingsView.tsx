import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Archive,
  Bell,
  Check,
  Eye,
  EyeOff,
  FileText,
  Layers,
  Plus,
  RotateCcw,
  Shield,
  Sliders,
} from 'lucide-react';
import { useAccentTheme } from '../../../services/accentTheme.service';
import { useToast } from '../../../context/ToastContext';
import { AnimatedSelect } from '../../../components/settings/AnimatedSelect';
import { TestingPageHeader } from '../../../components/testing/TestingPageHeader';
import type { TestingMasterCategory } from '../../../components/testing/testingBadges';
import { testingService } from '../../../services/testing.service';
import { projectModuleService } from '../../../services/projectModule.service';
import type {
  TestingConfigurationItem,
  TestingMasterOption,
  TestingPermissions,
  TestingRolePermissionRule,
} from '../../../types/testing';
import type { ProjectSubmodule } from '../../../types/module';

interface TestingSettingsViewProps {
  projectId?: number;
  submoduleId?: number;
  title?: string;
}

const MASTER_SECTIONS: Array<{ key: TestingMasterCategory; title: string; subtitle: string }> = [
  { key: 'testTypes', title: 'Test Types', subtitle: 'Functional, UI, API, Integration, Regression, Security, Performance...' },
  { key: 'priorities', title: 'Priorities', subtitle: 'Critical, High, Medium, Low or custom priorities' },
  { key: 'defectSeverities', title: 'Defect Severities', subtitle: 'Critical, Major, Moderate, Minor severity options' },
  { key: 'environments', title: 'Environments', subtitle: 'Local, Dev, QA, Staging, UAT, Production...' },
];

export const TestingSettingsView: React.FC<TestingSettingsViewProps> = ({
  projectId: propProjectId,
  submoduleId: propSubmoduleId,
  title: propTitle,
}) => {
  const { id } = useParams<{ id: string }>();
  const projectId = propProjectId || Number(id);
  const submoduleId = propSubmoduleId;
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();

  const [permissions, setPermissions] = useState<TestingPermissions | null>(null);
  const [config, setConfig] = useState<TestingConfigurationItem | null>(null);
  const [qaSubmodules, setQaSubmodules] = useState<ProjectSubmodule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local editable state
  const [testCasePrefix, setTestCasePrefix] = useState('TC');
  const [defectPrefix, setDefectPrefix] = useState('BUG');
  const [defaultEnvironment, setDefaultEnvironment] = useState('Staging');
  const [maxAttachmentMb, setMaxAttachmentMb] = useState('15');
  const [allowedTypesText, setAllowedTypesText] = useState('');
  const [retentionDays, setRetentionDays] = useState('365');
  const [notifyOnRunFailure, setNotifyOnRunFailure] = useState(true);
  const [notifyOnCriticalDefect, setNotifyOnCriticalDefect] = useState(true);
  const [notifyOnPlanDueSoon, setNotifyOnPlanDueSoon] = useState(true);
  const [rolePermissions, setRolePermissions] = useState<Record<string, TestingRolePermissionRule>>({});

  // Master data inline add inputs
  const [newOptionInputs, setNewOptionInputs] = useState<Record<TestingMasterCategory, string>>({
    testTypes: '',
    priorities: '',
    defectSeverities: '',
    environments: '',
  });

  const canManageSettings = Boolean(permissions?.canManageSettings);

  const loadSettings = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [settingsRes, modsRes] = await Promise.all([
        testingService.getSettings(projectId),
        projectModuleService.getModules(projectId),
      ]);
      if (settingsRes.success && settingsRes.data) {
        setPermissions(settingsRes.data.permissions);
        const c = settingsRes.data.config;
        setConfig(c);
        setTestCasePrefix(c.testCasePrefix || 'TC');
        setDefectPrefix(c.defectPrefix || 'BUG');
        setDefaultEnvironment(c.defaultEnvironment || 'Staging');
        setMaxAttachmentMb(String(Math.round((c.maxAttachmentSizeBytes || 15 * 1024 * 1024) / (1024 * 1024))));
        setAllowedTypesText((c.allowedAttachmentTypes || []).join(', '));
        setRetentionDays(String(c.retentionDays || 365));
        setNotifyOnRunFailure(Boolean(c.notifyOnRunFailure));
        setNotifyOnCriticalDefect(Boolean(c.notifyOnCriticalDefect));
        setNotifyOnPlanDueSoon(Boolean(c.notifyOnPlanDueSoon));
        setRolePermissions(c.rolePermissions || {});
      }
      if (modsRes.success && modsRes.data) {
        const testingMod = modsRes.data.find((m) => m.name.toLowerCase().includes('testing'));
        setQaSubmodules(testingMod?.submodules || []);
      }
    } catch {
      toast.error('Failed to load testing settings');
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageSettings) return;
    setSaving(true);
    try {
      const mbNum = Math.max(1, Math.min(100, Number(maxAttachmentMb) || 15));
      const retNum = Math.max(7, Math.min(3650, Number(retentionDays) || 365));
      const allowedAttachmentTypes = allowedTypesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await testingService.updateSettings(projectId, {
        testCasePrefix: testCasePrefix.trim().toUpperCase() || 'TC',
        defectPrefix: defectPrefix.trim().toUpperCase() || 'BUG',
        defaultEnvironment,
        maxAttachmentSizeBytes: mbNum * 1024 * 1024,
        allowedAttachmentTypes,
        retentionDays: retNum,
        notifyOnRunFailure,
        notifyOnCriticalDefect,
        notifyOnPlanDueSoon,
        rolePermissions,
      });
      if (res.success && res.data) {
        setConfig(res.data.config);
        setPermissions(res.data.permissions);
        toast.success('Testing & QA configuration saved');
      } else {
        toast.error(res.error || 'Could not update settings');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMasterOption = async (category: TestingMasterCategory) => {
    const name = newOptionInputs[category].trim();
    if (!name || !canManageSettings) return;
    try {
      const res = await testingService.addMasterOption(projectId, { category, name });
      if (res.success && res.data?.config) {
        setConfig(res.data.config);
        setNewOptionInputs((p) => ({ ...p, [category]: '' }));
        toast.success(`Added "${name}"`);
      } else {
        toast.error(res.error || 'Could not add option');
      }
    } catch {
      toast.error('Failed to add master option');
    }
  };

  const handleToggleArchiveMasterOption = async (
    category: TestingMasterCategory,
    option: TestingMasterOption
  ) => {
    if (!canManageSettings) return;
    try {
      const res = await testingService.archiveMasterOption(projectId, {
        category,
        name: option.name,
        isArchived: !option.isArchived,
      });
      if (res.success && res.data?.config) {
        setConfig(res.data.config);
        toast.success(
          !option.isArchived ? `Archived "${option.name}"` : `Restored "${option.name}"`
        );
      }
    } catch {
      toast.error('Failed to update option');
    }
  };

  const handleToggleSubmoduleVisibility = async (sub: ProjectSubmodule) => {
    if (!canManageSettings) return;
    try {
      const res = await projectModuleService.updateSubmodule(projectId, sub.id, {
        isVisible: !sub.isVisible,
      });
      if (res.success) {
        toast.success(
          !sub.isVisible
            ? `${sub.name} is now visible in the sidebar`
            : `${sub.name} hidden from sidebar (data preserved)`
        );
        await loadSettings();
      } else {
        toast.error(res.error || 'Could not update submodule visibility');
      }
    } catch {
      toast.error('Could not update submodule visibility');
    }
  };

  const togglePermissionFlag = (roleKey: string, field: keyof TestingRolePermissionRule) => {
    setRolePermissions((prev) => ({
      ...prev,
      [roleKey]: {
        ...prev[roleKey],
        [field]: !prev[roleKey]?.[field],
      },
    }));
  };

  return (
    <div className="p-6 max-w-[1500px] mx-auto space-y-6">
      <TestingPageHeader
        projectId={projectId}
        activeKey="testing-settings"
        icon={Sliders}
        title={propTitle || 'Testing & QA Settings'}
        description="Configure prefixes, environment defaults, evidence rules, notifications, master dropdown lists, role permissions, and sidebar submodule visibility."
      />

      {!loading && permissions && !canManageSettings && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200">
          Viewing Testing Settings in read-only mode. Only Project Owners / Leads / Admins with Manage Settings access can save changes.
        </div>
      )}

      {loading || !config ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-2xl bg-[#12151B] border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : (
        <form onSubmit={handleSaveGeneral} className="space-y-6">
          {/* General IDs, Environments, Storage & Retention */}
          <div className="bg-[#12151B] border border-white/10 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              General Configuration & Evidence Policy
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Test Case ID Prefix
                </label>
                <input
                  type="text"
                  disabled={!canManageSettings}
                  value={testCasePrefix}
                  onChange={(e) => setTestCasePrefix(e.target.value)}
                  className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Next sequence: #{config.testCaseNextSeq}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Defect ID Prefix
                </label>
                <input
                  type="text"
                  disabled={!canManageSettings}
                  value={defectPrefix}
                  onChange={(e) => setDefectPrefix(e.target.value)}
                  className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Next sequence: #{config.defectNextSeq}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Default Test Environment
                </label>
                <AnimatedSelect
                  options={(config.environments || [])
                    .filter((o) => !o.isArchived)
                    .map((o) => ({ value: o.name, label: o.name }))}
                  value={defaultEnvironment}
                  onChange={setDefaultEnvironment}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Max Attachment Size (MB)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  disabled={!canManageSettings}
                  value={maxAttachmentMb}
                  onChange={(e) => setMaxAttachmentMb(e.target.value)}
                  className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Allowed Attachment MIME Types (comma-separated)
                </label>
                <input
                  type="text"
                  disabled={!canManageSettings}
                  value={allowedTypesText}
                  onChange={(e) => setAllowedTypesText(e.target.value)}
                  className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Execution History Retention (Days)
                </label>
                <input
                  type="number"
                  min={7}
                  max={3650}
                  disabled={!canManageSettings}
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(e.target.value)}
                  className="w-full bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-[#12151B] border border-white/10 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              QA Notifications
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <label className="flex items-center gap-2.5 bg-[#0B0D10] border border-white/10 rounded-xl p-3 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canManageSettings}
                  checked={notifyOnRunFailure}
                  onChange={(e) => setNotifyOnRunFailure(e.target.checked)}
                />
                <span className="text-gray-200">Notify leads when test run records failures</span>
              </label>
              <label className="flex items-center gap-2.5 bg-[#0B0D10] border border-white/10 rounded-xl p-3 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canManageSettings}
                  checked={notifyOnCriticalDefect}
                  onChange={(e) => setNotifyOnCriticalDefect(e.target.checked)}
                />
                <span className="text-gray-200">Notify team immediately on Critical defects</span>
              </label>
              <label className="flex items-center gap-2.5 bg-[#0B0D10] border border-white/10 rounded-xl p-3 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canManageSettings}
                  checked={notifyOnPlanDueSoon}
                  onChange={(e) => setNotifyOnPlanDueSoon(e.target.checked)}
                />
                <span className="text-gray-200">Notify owners when Test Plan due date nears</span>
              </label>
            </div>
          </div>

          {/* Role Permissions Matrix */}
          <div className="bg-[#12151B] border border-white/10 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              Role Permissions Matrix
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] text-gray-400">
                    <th className="py-2 pr-3">Project Role</th>
                    <th className="py-2 px-2 text-center">View QA</th>
                    <th className="py-2 px-2 text-center">Edit Cases</th>
                    <th className="py-2 px-2 text-center">Execute Runs</th>
                    <th className="py-2 px-2 text-center">Manage Defects</th>
                    <th className="py-2 px-2 text-center">Plans & Suites</th>
                    <th className="py-2 px-2 text-center">Reports</th>
                    <th className="py-2 px-2 text-center">Archive</th>
                    <th className="py-2 pl-2 text-center">Settings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {Object.entries(rolePermissions).map(([roleKey, rule]) => (
                    <tr key={roleKey}>
                      <td className="py-2.5 pr-3 font-mono font-semibold text-white">{roleKey}</td>
                      {(
                        [
                          'canViewTesting',
                          'canEditTestCases',
                          'canExecuteTests',
                          'canManageDefects',
                          'canManagePlansSuites',
                          'canViewReports',
                          'canArchiveRecords',
                          'canManageSettings',
                        ] as const
                      ).map((permField) => (
                        <td key={permField} className="py-2.5 px-2 text-center">
                          <input
                            type="checkbox"
                            disabled={!canManageSettings}
                            checked={Boolean(rule[permField])}
                            onChange={() => togglePermissionFlag(roleKey, permField)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {canManageSettings && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-lg"
                style={{ backgroundColor: accentColor }}
              >
                <Check className="w-4 h-4" />
                {saving ? 'Saving Configuration...' : 'Save Configuration & Permissions'}
              </button>
            </div>
          )}
        </form>
      )}

      {/* Master Dropdown Lists */}
      {config && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {MASTER_SECTIONS.map((sec) => {
            const list: TestingMasterOption[] = config[sec.key] || [];
            return (
              <div
                key={sec.key}
                className="bg-[#12151B] border border-white/10 rounded-2xl p-5 space-y-3"
              >
                <div>
                  <h4 className="text-sm font-semibold text-white">{sec.title}</h4>
                  <p className="text-[11px] text-gray-400">{sec.subtitle}</p>
                </div>

                {canManageSettings && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newOptionInputs[sec.key]}
                      onChange={(e) =>
                        setNewOptionInputs((p) => ({ ...p, [sec.key]: e.target.value }))
                      }
                      placeholder={`Add new ${sec.title.slice(0, -1).toLowerCase()}...`}
                      className="flex-1 bg-[#0B0D10] border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => void handleAddMasterOption(sec.key)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/35"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {list.map((opt) => (
                    <div
                      key={opt.name}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                        opt.isArchived
                          ? 'bg-white/[0.02] border-white/10 text-gray-500 line-through'
                          : 'bg-[#0B0D10] border-white/15 text-gray-200'
                      }`}
                    >
                      <span>{opt.name}</span>
                      {canManageSettings && (
                        <button
                          type="button"
                          onClick={() => void handleToggleArchiveMasterOption(sec.key, opt)}
                          className="text-gray-400 hover:text-amber-300"
                          title={opt.isArchived ? 'Restore option' : 'Archive option'}
                        >
                          {opt.isArchived ? (
                            <RotateCcw className="w-3 h-3" />
                          ) : (
                            <Archive className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submodule Visibility Controls */}
      {qaSubmodules.length > 0 && (
        <div className="bg-[#12151B] border border-white/10 rounded-2xl p-5 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              Sidebar Submodule Visibility
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Hide or show Testing & QA submodules in the project sidebar without deleting any records or history.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {qaSubmodules.map((sub) => (
              <div
                key={sub.id}
                className="bg-[#0B0D10] border border-white/10 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs"
              >
                <span className={sub.isVisible ? 'text-white font-medium' : 'text-gray-500'}>
                  {sub.name}
                </span>
                {canManageSettings ? (
                  <button
                    type="button"
                    onClick={() => void handleToggleSubmoduleVisibility(sub)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                      sub.isVisible
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                        : 'bg-white/5 text-gray-400 border-white/10'
                    }`}
                  >
                    {sub.isVisible ? (
                      <>
                        <Eye className="w-3 h-3" />
                        Shown
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3 h-3" />
                        Hidden
                      </>
                    )}
                  </button>
                ) : (
                  <span className="text-[11px] text-gray-500">
                    {sub.isVisible ? 'Shown' : 'Hidden'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestingSettingsView;
