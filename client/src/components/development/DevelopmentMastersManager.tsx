import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  Edit2,
  FolderCog,
  GitCommitHorizontal,
  Layers,
  Lock,
  Plus,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import { developmentService } from '../../services/development.service';
import { confirmActionSwal, confirmDeleteSwal } from '../../lib/confirmAlert';
import { AnimatedSelect } from '../settings/AnimatedSelect';
import { useAccentTheme } from '../../services/accentTheme.service';
import type {
  DevEffortUnit,
  DevelopmentModuleMaster,
  DevelopmentProjectConfig,
  DevelopmentSubmoduleMaster,
} from '../../types/development';
import { QuickCreateMasterModal } from './QuickCreateMasterModal';

interface DevelopmentMastersManagerProps {
  projectId: number;
  modules: DevelopmentModuleMaster[];
  config: DevelopmentProjectConfig;
  canManageMasters: boolean;
  showArchived: boolean;
  onToggleShowArchived: (val: boolean) => void;
  onRefreshAll: () => Promise<void>;
}

export const DevelopmentMastersManager: React.FC<DevelopmentMastersManagerProps> = ({
  projectId,
  modules,
  config,
  canManageMasters,
  showArchived,
  onToggleShowArchived,
  onRefreshAll,
}) => {
  const { accentColor } = useAccentTheme();

  // Quick create modal
  const [createMode, setCreateMode] = useState<'module' | 'submodule' | null>(null);
  const [createParentMod, setCreateParentMod] = useState<DevelopmentModuleMaster | null>(null);

  // Rename inline state
  const [editingMod, setEditingMod] = useState<{ id: number; name: string } | null>(null);
  const [editingSub, setEditingSub] = useState<{ id: number; name: string } | null>(null);

  // Move / Migrate Submodule modal
  const [moveSubModal, setMoveSubModal] = useState<{
    sub: DevelopmentSubmoduleMaster;
    targetModuleId: string;
  } | null>(null);
  const [migrateSubModal, setMigrateSubModal] = useState<{
    sub: DevelopmentSubmoduleMaster;
    targetSubId: string;
  } | null>(null);

  // Workflow config form
  const [prefixInput, setPrefixInput] = useState(config.taskPrefix);
  const [taskTypesText, setTaskTypesText] = useState(config.taskTypes.join(', '));
  const [statusesText, setStatusesText] = useState(config.statuses.join(', '));
  const [defaultEffortUnit, setDefaultEffortUnit] = useState<DevEffortUnit>(config.defaultEffortUnit);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const visibleModules = showArchived ? modules : modules.filter((m) => !m.isArchived);

  const handleRenameModule = async (modId: number) => {
    if (!editingMod || !editingMod.name.trim()) return;
    const res = await developmentService.updateModule(projectId, modId, {
      name: editingMod.name.trim(),
    });
    if (res.success) {
      setEditingMod(null);
      await onRefreshAll();
    } else {
      setFeedback({ type: 'error', msg: res.error || 'Failed to rename module' });
    }
  };

  const handleArchiveModule = async (mod: DevelopmentModuleMaster) => {
    const nextArchive = !mod.isArchived;
    const ok = await confirmActionSwal({
      title: nextArchive ? `Archive module "${mod.name}"?` : `Restore module "${mod.name}"?`,
      text: nextArchive
        ? 'Existing tasks retain this module for historical reporting, but new tasks cannot select it while archived.'
        : 'This module will become available again when creating or editing tasks.',
      highlightLabel: `${mod.taskCount} work item(s) linked`,
      confirmText: nextArchive ? 'Archive Module' : 'Restore Module',
      icon: 'warning',
      accentColor,
    });
    if (!ok) return;
    const res = await developmentService.updateModule(projectId, mod.id, {
      isArchived: nextArchive,
    });
    if (res.success) await onRefreshAll();
    else setFeedback({ type: 'error', msg: res.error || 'Failed to update module' });
  };

  const handleDeleteUnreferencedModule = async (mod: DevelopmentModuleMaster) => {
    const ok = await confirmDeleteSwal({
      title: `Delete unused module "${mod.name}"?`,
      text: 'This module has zero tasks and can be safely removed.',
      confirmText: 'Delete',
      accentColor,
    });
    if (!ok) return;
    const res = await developmentService.deleteModule(projectId, mod.id);
    if (res.success) await onRefreshAll();
    else setFeedback({ type: 'error', msg: res.error || 'Failed to delete module' });
  };

  const handleReorderModules = async (index: number, dir: -1 | 1) => {
    const swapIndex = index + dir;
    if (swapIndex < 0 || swapIndex >= visibleModules.length) return;
    const reordered = [...visibleModules];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(swapIndex, 0, moved);
    const res = await developmentService.reorderModules(
      projectId,
      reordered.map((m) => m.id)
    );
    if (res.success) await onRefreshAll();
  };

  const handleRenameSubmodule = async (subId: number) => {
    if (!editingSub || !editingSub.name.trim()) return;
    const res = await developmentService.updateSubmodule(projectId, subId, {
      name: editingSub.name.trim(),
    });
    if (res.success) {
      setEditingSub(null);
      await onRefreshAll();
    } else {
      setFeedback({ type: 'error', msg: res.error || 'Failed to rename submodule' });
    }
  };

  const handleArchiveSubmodule = async (sub: DevelopmentSubmoduleMaster) => {
    const nextArchive = !sub.isArchived;
    const ok = await confirmActionSwal({
      title: nextArchive ? `Archive submodule "${sub.name}"?` : `Restore submodule "${sub.name}"?`,
      text: nextArchive
        ? 'Referenced tasks remain intact. New tasks cannot select an archived submodule.'
        : 'This submodule will reappear in task dropdowns.',
      highlightLabel: `${sub.taskCount} work item(s) linked`,
      confirmText: nextArchive ? 'Archive Submodule' : 'Restore Submodule',
      icon: 'warning',
      accentColor,
    });
    if (!ok) return;
    const res = await developmentService.updateSubmodule(projectId, sub.id, {
      isArchived: nextArchive,
    });
    if (res.success) await onRefreshAll();
    else setFeedback({ type: 'error', msg: res.error || 'Failed to update submodule' });
  };

  const handleDeleteUnreferencedSubmodule = async (sub: DevelopmentSubmoduleMaster) => {
    const ok = await confirmDeleteSwal({
      title: `Delete unused submodule "${sub.name}"?`,
      text: 'Zero tasks reference this submodule.',
      confirmText: 'Delete',
      accentColor,
    });
    if (!ok) return;
    const res = await developmentService.deleteSubmodule(projectId, sub.id);
    if (res.success) await onRefreshAll();
    else setFeedback({ type: 'error', msg: res.error || 'Failed to delete submodule' });
  };

  const handleReorderSubmodules = async (
    subs: DevelopmentSubmoduleMaster[],
    index: number,
    dir: -1 | 1
  ) => {
    const swapIdx = index + dir;
    if (swapIdx < 0 || swapIdx >= subs.length) return;
    const reordered = [...subs];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(swapIdx, 0, moved);
    const res = await developmentService.reorderSubmodules(
      projectId,
      reordered.map((s) => s.id)
    );
    if (res.success) await onRefreshAll();
  };

  const handleMoveSubmodule = async () => {
    if (!moveSubModal) return;
    const targetModId = parseInt(moveSubModal.targetModuleId, 10);
    if (Number.isNaN(targetModId)) return;
    const res = await developmentService.updateSubmodule(projectId, moveSubModal.sub.id, {
      moduleId: targetModId,
    });
    if (res.success) {
      setMoveSubModal(null);
      setFeedback({ type: 'success', msg: 'Submodule and linked tasks moved successfully.' });
      await onRefreshAll();
    } else {
      setFeedback({ type: 'error', msg: res.error || 'Failed to move submodule' });
    }
  };

  const handleMigrateSubmodule = async () => {
    if (!migrateSubModal) return;
    const targetSubId = parseInt(migrateSubModal.targetSubId, 10);
    if (Number.isNaN(targetSubId)) return;
    const res = await developmentService.migrateSubmoduleTasks(
      projectId,
      migrateSubModal.sub.id,
      targetSubId,
      true
    );
    if (res.success) {
      setMigrateSubModal(null);
      setFeedback({
        type: 'success',
        msg: `Migrated ${res.data?.migratedCount ?? 0} task(s) and archived source submodule.`,
      });
      await onRefreshAll();
    } else {
      setFeedback({ type: 'error', msg: res.error || 'Migration failed' });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setFeedback(null);
    const taskTypes = taskTypesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const statuses = statusesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await developmentService.updateSettings(projectId, {
      taskPrefix: prefixInput.trim().toUpperCase(),
      taskTypes,
      statuses,
      defaultEffortUnit,
    });
    setIsSavingSettings(false);
    if (res.success) {
      setFeedback({ type: 'success', msg: 'Development workflow configuration updated.' });
      await onRefreshAll();
    } else {
      setFeedback({ type: 'error', msg: res.error || 'Failed to save settings' });
    }
  };

  const activeDestSubmodules = modules
    .filter((m) => !m.isArchived)
    .flatMap((m) =>
      m.submodules
        .filter((s) => !s.isArchived && (!migrateSubModal || s.id !== migrateSubModal.sub.id))
        .map((s) => ({
          value: String(s.id),
          label: `${m.name} / ${s.name}`,
        }))
    );

  return (
    <div className="space-y-5">
      {!canManageMasters && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-center gap-3 text-xs text-amber-200">
          <Lock size={16} className="shrink-0 text-amber-400" />
          <span>
            Read-only view: Only Project Owners, Leads, or Admins can create, rename, move, reorder, or archive master Modules & Submodules.
          </span>
        </div>
      )}

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <span>{feedback.msg}</span>
          <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left 8 cols: Master Modules & Submodules */}
        <div className="xl:col-span-8 rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#27272A]">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}1E`, color: accentColor }}
              >
                <FolderCog size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Development Module & Submodule Masters
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Separate from project navigation sidebar · Referenced masters use safe archival instead of deletion
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleShowArchived(!showArchived)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[#161820] hover:bg-[#1E202B] border border-[#27272A] text-zinc-300 cursor-pointer"
              >
                {showArchived ? 'Hide Archived' : 'Show Archived'}
              </button>
              {canManageMasters && (
                <button
                  type="button"
                  onClick={() => {
                    setCreateParentMod(null);
                    setCreateMode('module');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#0A0B10] cursor-pointer hover:brightness-110"
                  style={{ backgroundColor: accentColor }}
                >
                  <Plus size={14} />
                  <span>New Module</span>
                </button>
              )}
            </div>
          </div>

          {visibleModules.length === 0 ? (
            <div className="py-12 text-center rounded-xl bg-[#0A0B0F] border border-dashed border-[#27272A] space-y-2">
              <Layers size={24} className="mx-auto text-zinc-600" />
              <p className="text-xs font-medium text-zinc-300">No development master modules yet</p>
              <p className="text-[11px] text-zinc-500">
                Create master Modules and Submodules here or directly while creating tasks.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleModules.map((mod, mIdx) => {
                const visibleSubs = showArchived
                  ? mod.submodules
                  : mod.submodules.filter((s) => !s.isArchived);

                return (
                  <div
                    key={mod.id}
                    className={`rounded-xl border overflow-hidden ${
                      mod.isArchived
                        ? 'bg-[#0B0C10]/70 border-amber-500/25 opacity-80'
                        : 'bg-[#12141B] border-[#27272A]'
                    }`}
                  >
                    {/* Module Header Row */}
                    <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-[#14161F]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: mod.color || accentColor }}
                        />
                        {editingMod?.id === mod.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingMod.name}
                              onChange={(e) =>
                                setEditingMod({ id: mod.id, name: e.target.value })
                              }
                              className="px-2.5 py-1 rounded-lg bg-[#0A0B0F] border border-zinc-600 text-xs text-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleRenameModule(mod.id)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#0A0B10] cursor-pointer"
                              style={{ backgroundColor: accentColor }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingMod(null)}
                              className="px-2 py-1 text-[11px] text-zinc-400 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-xs sm:text-sm font-semibold text-white truncate">
                              {mod.name}
                            </span>
                            {mod.isArchived && (
                              <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-mono">
                                ARCHIVED
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#1A1C26] border border-[#27272A] text-zinc-400">
                              {mod.taskCount} tasks ({mod.activeTaskCount} active)
                            </span>
                          </>
                        )}
                      </div>

                      {canManageMasters && (
                        <div className="flex items-center gap-1">
                          {!mod.isArchived && (
                            <button
                              type="button"
                              onClick={() => {
                                setCreateParentMod(mod);
                                setCreateMode('submodule');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#1B1D28] hover:bg-[#232635] text-zinc-200 border border-[#27272A] cursor-pointer mr-1"
                            >
                              <Plus size={11} />
                              <span>Submodule</span>
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={mIdx === 0}
                            onClick={() => handleReorderModules(mIdx, -1)}
                            title="Move up"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={mIdx === visibleModules.length - 1}
                            onClick={() => handleReorderModules(mIdx, 1)}
                            title="Move down"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingMod({ id: mod.id, name: mod.name })}
                            title="Rename module"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveModule(mod)}
                            title={mod.isArchived ? 'Restore module' : 'Archive module'}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-300 cursor-pointer"
                          >
                            {mod.isArchived ? (
                              <ArchiveRestore size={13} />
                            ) : (
                              <Archive size={13} />
                            )}
                          </button>
                          {mod.taskCount === 0 && mod.submodules.length === 0 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUnreferencedModule(mod)}
                              title="Delete unused module"
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Submodules List */}
                    {visibleSubs.length === 0 ? (
                      <div className="px-4 py-3 text-[11px] text-zinc-500 italic">
                        No active submodules under {mod.name}.
                      </div>
                    ) : (
                      <div className="divide-y divide-[#27272A]/60">
                        {visibleSubs.map((sub, sIdx) => (
                          <div
                            key={sub.id}
                            className="px-4 py-2.5 pl-8 flex flex-wrap items-center justify-between gap-2 hover:bg-[#171923]/70"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <GitCommitHorizontal size={13} className="text-zinc-500 shrink-0" />
                              {editingSub?.id === sub.id ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={editingSub.name}
                                    onChange={(e) =>
                                      setEditingSub({ id: sub.id, name: e.target.value })
                                    }
                                    className="px-2 py-0.5 rounded bg-[#0A0B0F] border border-zinc-600 text-xs text-white focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRenameSubmodule(sub.id)}
                                    className="px-2 py-0.5 rounded text-[11px] font-semibold text-[#0A0B10] cursor-pointer"
                                    style={{ backgroundColor: accentColor }}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingSub(null)}
                                    className="text-[11px] text-zinc-400 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-xs text-zinc-200 font-medium truncate">
                                    {sub.name}
                                  </span>
                                  {sub.isArchived && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-mono">
                                      ARCHIVED
                                    </span>
                                  )}
                                  <span className="text-[10px] font-mono text-zinc-500">
                                    {sub.taskCount} tasks
                                  </span>
                                </>
                              )}
                            </div>

                            {canManageMasters && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={sIdx === 0}
                                  onClick={() => handleReorderSubmodules(visibleSubs, sIdx, -1)}
                                  title="Move up"
                                  className="p-1 rounded text-zinc-500 hover:text-white disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  type="button"
                                  disabled={sIdx === visibleSubs.length - 1}
                                  onClick={() => handleReorderSubmodules(visibleSubs, sIdx, 1)}
                                  title="Move down"
                                  className="p-1 rounded text-zinc-500 hover:text-white disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowDown size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingSub({ id: sub.id, name: sub.name })}
                                  title="Rename submodule"
                                  className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMoveSubModal({
                                      sub,
                                      targetModuleId: String(sub.moduleId),
                                    })
                                  }
                                  title="Move submodule to another module"
                                  className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
                                >
                                  <ArrowRightLeft size={12} />
                                </button>
                                {sub.taskCount > 0 && activeDestSubmodules.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMigrateSubModal({
                                        sub,
                                        targetSubId: activeDestSubmodules[0]?.value || '',
                                      })
                                    }
                                    title="Migrate tasks & archive"
                                    className="px-2 py-0.5 rounded text-[10px] bg-[#1C1E26] hover:bg-[#252836] text-zinc-300 border border-[#27272A] cursor-pointer"
                                  >
                                    Migrate
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleArchiveSubmodule(sub)}
                                  title={sub.isArchived ? 'Restore submodule' : 'Archive submodule'}
                                  className="p-1 rounded text-zinc-400 hover:text-amber-300 cursor-pointer"
                                >
                                  {sub.isArchived ? (
                                    <ArchiveRestore size={12} />
                                  ) : (
                                    <Archive size={12} />
                                  )}
                                </button>
                                {sub.taskCount === 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUnreferencedSubmodule(sub)}
                                    title="Delete unused submodule"
                                    className="p-1 rounded text-zinc-500 hover:text-red-400 cursor-pointer"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 4 cols: Workflow Configuration */}
        <div className="xl:col-span-4 rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#27272A]">
            <Settings size={16} style={{ color: accentColor }} />
            <div>
              <h3 className="text-sm font-semibold text-white">Development Settings</h3>
              <p className="text-[11px] text-zinc-400">
                Task key prefix, configurable types & statuses
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Work Item Key Prefix</label>
              <input
                type="text"
                maxLength={10}
                disabled={!canManageMasters}
                value={prefixInput}
                onChange={(e) => setPrefixInput(e.target.value.toUpperCase())}
                placeholder="DEV"
                className="w-full px-3 py-2 rounded-xl bg-[#0A0B0F] border border-[#27272A] text-xs font-mono text-white disabled:opacity-50 focus:outline-none focus:border-zinc-500"
              />
              <p className="text-[10px] text-zinc-500">
                New tasks generate {prefixInput || 'DEV'}-001, {prefixInput || 'DEV'}-002, etc.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Default Effort Unit</label>
              <AnimatedSelect
                value={defaultEffortUnit}
                onChange={(v) => setDefaultEffortUnit(v as DevEffortUnit)}
                disabled={!canManageMasters}
                accentColor={accentColor}
                dropdownMinWidth="w-full"
                options={[
                  { value: 'hours', label: 'Hours (h)' },
                  { value: 'story_points', label: 'Story Points (pts)' },
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Task Types (comma-separated)
              </label>
              <textarea
                rows={2}
                disabled={!canManageMasters}
                value={taskTypesText}
                onChange={(e) => setTaskTypesText(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0A0B0F] border border-[#27272A] text-xs text-white disabled:opacity-50 focus:outline-none focus:border-zinc-500 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Statuses (comma-separated, includes Completed)
              </label>
              <textarea
                rows={2}
                disabled={!canManageMasters}
                value={statusesText}
                onChange={(e) => setStatusesText(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0A0B0F] border border-[#27272A] text-xs text-white disabled:opacity-50 focus:outline-none focus:border-zinc-500 resize-none"
              />
            </div>

            {canManageMasters && (
              <button
                type="submit"
                disabled={isSavingSettings}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-[#0A0B10] transition-all cursor-pointer hover:brightness-110 disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                {isSavingSettings ? 'Saving Settings...' : 'Save Configuration'}
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Create Module / Submodule Modal */}
      {createMode && (
        <QuickCreateMasterModal
          isOpen={true}
          mode={createMode}
          projectId={projectId}
          parentModule={createParentMod}
          onClose={() => setCreateMode(null)}
          onCreatedModule={async () => {
            await onRefreshAll();
          }}
          onCreatedSubmodule={async () => {
            await onRefreshAll();
          }}
        />
      )}

      {/* Move Submodule Modal */}
      {moveSubModal &&
        createPortal(
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-[#0E0F14] border border-[#27272A] p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">
                  Move "{moveSubModal.sub.name}" to Another Module
                </h4>
                <button
                  type="button"
                  onClick={() => setMoveSubModal(null)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-zinc-400">
                Any tasks referencing this submodule will automatically update to the new parent module.
              </p>
              <AnimatedSelect
                value={moveSubModal.targetModuleId}
                onChange={(v) => setMoveSubModal({ ...moveSubModal, targetModuleId: v })}
                accentColor={accentColor}
                dropdownMinWidth="w-full"
                options={modules
                  .filter((m) => !m.isArchived)
                  .map((m) => ({ value: String(m.id), label: m.name }))}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMoveSubModal(null)}
                  className="px-3.5 py-2 rounded-xl text-xs bg-[#161820] text-zinc-300 border border-[#27272A] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleMoveSubmodule}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0A0B10] cursor-pointer"
                  style={{ backgroundColor: accentColor }}
                >
                  Move Submodule
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Migrate Tasks & Archive Submodule Modal */}
      {migrateSubModal &&
        createPortal(
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-[#0E0F14] border border-[#27272A] p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">
                  Migrate Tasks from "{migrateSubModal.sub.name}"
                </h4>
                <button
                  type="button"
                  onClick={() => setMigrateSubModal(null)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-zinc-400">
                Safely move {migrateSubModal.sub.taskCount} existing task(s) into another active submodule and archive this record.
              </p>
              <AnimatedSelect
                value={migrateSubModal.targetSubId}
                onChange={(v) => setMigrateSubModal({ ...migrateSubModal, targetSubId: v })}
                accentColor={accentColor}
                dropdownMinWidth="w-full"
                options={activeDestSubmodules}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMigrateSubModal(null)}
                  className="px-3.5 py-2 rounded-xl text-xs bg-[#161820] text-zinc-300 border border-[#27272A] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleMigrateSubmodule}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0A0B10] cursor-pointer"
                  style={{ backgroundColor: accentColor }}
                >
                  Migrate & Archive
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

