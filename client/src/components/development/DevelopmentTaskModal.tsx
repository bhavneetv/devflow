import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  CheckSquare,
  FileText,
  Layers,
  Link2,
  Paperclip,
  Plus,
  Tag,
  X,
} from 'lucide-react';
import { AnimatedSelect, AnimatedMultiSelect } from '../settings/AnimatedSelect';
import { CustomDatePicker } from '../settings/CustomDatePicker';
import { developmentService } from '../../services/development.service';
import { documentService } from '../../services/document.service';
import type {
  DevEffortUnit,
  DevTaskPriority,
  DevUser,
  DevelopmentModuleMaster,
  DevelopmentProjectConfig,
  DevelopmentSubmoduleMaster,
  DevelopmentTaskItem,
} from '../../types/development';
import { DEV_PRIORITIES } from '../../types/development';
import type { ProjectDocument } from '../../types/document';
import { useAccentTheme } from '../../services/accentTheme.service';
import { QuickCreateMasterModal } from './QuickCreateMasterModal';

interface DevelopmentTaskModalProps {
  isOpen: boolean;
  projectId: number;
  taskToEdit?: DevelopmentTaskItem | null;
  modules: DevelopmentModuleMaster[];
  eligibleMembers: DevUser[];
  config: DevelopmentProjectConfig;
  canManageMasters: boolean;
  onClose: () => void;
  onSaved: (task: DevelopmentTaskItem) => void;
  onModulesUpdated: () => Promise<void>;
}

export const DevelopmentTaskModal: React.FC<DevelopmentTaskModalProps> = ({
  isOpen,
  projectId,
  taskToEdit,
  modules,
  eligibleMembers,
  config,
  canManageMasters,
  onClose,
  onSaved,
  onModulesUpdated,
}) => {
  const { accentColor } = useAccentTheme();
  const isEditing = Boolean(taskToEdit);

  // Section A — Task Details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState('Task');
  const [moduleIdStr, setModuleIdStr] = useState('');
  const [submoduleIdStr, setSubmoduleIdStr] = useState('');

  // Section B — Assignment
  const [assigneeIdStrs, setAssigneeIdStrs] = useState<string[]>([]);
  const [priority, setPriority] = useState<DevTaskPriority>('Medium');
  const [status, setStatus] = useState('Not Started');

  // Section C — Schedule & Effort
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedEffort, setEstimatedEffort] = useState('');
  const [effortUnit, setEffortUnit] = useState<DevEffortUnit>(config.defaultEffortUnit || 'hours');
  const [actualEffort, setActualEffort] = useState('');

  // Section D — Labels & Attachments
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [projectDocuments, setProjectDocuments] = useState<ProjectDocument[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [externalAttachments, setExternalAttachments] = useState<
    { fileName: string; fileUrl: string }[]
  >([]);
  const [extFileName, setExtFileName] = useState('');
  const [extFileUrl, setExtFileUrl] = useState('');

  // Quick master creation modal
  const [quickMasterMode, setQuickMasterMode] = useState<'module' | 'submodule' | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load project documents for reusable attachments picker
  useEffect(() => {
    if (!isOpen) return;
    documentService.listDocuments(projectId, { limit: 100 }).then((res) => {
      if (res.success && res.data?.documents) {
        setProjectDocuments(res.data.documents);
      }
    });
  }, [isOpen, projectId]);

  // Populate initial form state
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setTaskType(taskToEdit.taskType || 'Task');
      setModuleIdStr(String(taskToEdit.moduleId));
      setSubmoduleIdStr(String(taskToEdit.submoduleId));
      setAssigneeIdStrs(taskToEdit.assignees.map((u) => String(u.id)));
      setPriority(taskToEdit.priority);
      setStatus(taskToEdit.status);
      setStartDate(taskToEdit.startDate || '');
      setDueDate(taskToEdit.dueDate || '');
      setEstimatedEffort(
        taskToEdit.estimatedEffort !== null && taskToEdit.estimatedEffort !== undefined
          ? String(taskToEdit.estimatedEffort)
          : ''
      );
      setEffortUnit(
        taskToEdit.effortUnit === 'story_points' ? 'story_points' : 'hours'
      );
      setActualEffort(
        taskToEdit.actualEffort !== null && taskToEdit.actualEffort !== undefined
          ? String(taskToEdit.actualEffort)
          : ''
      );
      setLabels(taskToEdit.labels || []);
      setSelectedDocIds([]);
      setExternalAttachments([]);
    } else {
      setTitle('');
      setDescription('');
      setTaskType(config.taskTypes[0] || 'Task');
      setModuleIdStr('');
      setSubmoduleIdStr('');
      setAssigneeIdStrs([]);
      setPriority('Medium');
      setStatus(config.statuses[0] || 'Not Started');
      setStartDate('');
      setDueDate('');
      setEstimatedEffort('');
      setEffortUnit(config.defaultEffortUnit || 'hours');
      setActualEffort('');
      setLabels([]);
      setSelectedDocIds([]);
      setExternalAttachments([]);
    }
    setLabelInput('');
    setExtFileName('');
    setExtFileUrl('');
  }, [isOpen, taskToEdit, config]);

  // Active non-archived modules (keep currently attached archived module visible if editing)
  const availableModules = useMemo(() => {
    return modules.filter(
      (m) => !m.isArchived || (taskToEdit && m.id === taskToEdit.moduleId)
    );
  }, [modules, taskToEdit]);

  const selectedModule = useMemo(() => {
    const id = parseInt(moduleIdStr, 10);
    return modules.find((m) => m.id === id) || null;
  }, [modules, moduleIdStr]);

  const availableSubmodules = useMemo(() => {
    if (!selectedModule) return [];
    return (selectedModule.submodules || []).filter(
      (s) => !s.isArchived || (taskToEdit && s.id === taskToEdit.submoduleId)
    );
  }, [selectedModule, taskToEdit]);

  // Clear submodule whenever module changes and current submodule doesn't belong to new module
  const handleModuleChange = (nextModStr: string) => {
    setModuleIdStr(nextModStr);
    const nextModId = parseInt(nextModStr, 10);
    const nextMod = modules.find((m) => m.id === nextModId);
    const currentSubId = parseInt(submoduleIdStr, 10);
    if (!nextMod || !nextMod.submodules.some((s) => s.id === currentSubId)) {
      setSubmoduleIdStr('');
    }
  };

  const handleAddLabel = () => {
    const clean = labelInput.trim();
    if (!clean) return;
    if (!labels.includes(clean)) {
      setLabels((prev) => [...prev, clean]);
    }
    setLabelInput('');
  };

  const handleAddExternalAttachment = () => {
    const fn = extFileName.trim();
    const url = extFileUrl.trim();
    if (!fn || !url) return;
    setExternalAttachments((prev) => [...prev, { fileName: fn, fileUrl: url }]);
    setExtFileName('');
    setExtFileUrl('');
  };

  const handleCreatedModule = async (mod: DevelopmentModuleMaster) => {
    await onModulesUpdated();
    setModuleIdStr(String(mod.id));
    setSubmoduleIdStr('');
  };

  const handleCreatedSubmodule = async (sub: DevelopmentSubmoduleMaster) => {
    await onModulesUpdated();
    setModuleIdStr(String(sub.moduleId));
    setSubmoduleIdStr(String(sub.id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }
    const moduleId = parseInt(moduleIdStr, 10);
    const submoduleId = parseInt(submoduleIdStr, 10);
    if (Number.isNaN(moduleId) || moduleId <= 0) {
      setError('Please select a Module.');
      return;
    }
    if (Number.isNaN(submoduleId) || submoduleId <= 0) {
      setError('Please select a Submodule belonging to the chosen Module.');
      return;
    }
    if (startDate && dueDate && dueDate < startDate) {
      setError('Due date cannot be earlier than start date.');
      return;
    }

    const estVal = estimatedEffort.trim() === '' ? null : Number(estimatedEffort);
    if (estVal !== null && (Number.isNaN(estVal) || estVal < 0)) {
      setError('Estimated effort must be a non-negative number.');
      return;
    }
    const actVal = actualEffort.trim() === '' ? null : Number(actualEffort);
    if (actVal !== null && (Number.isNaN(actVal) || actVal < 0)) {
      setError('Actual effort must be a non-negative number.');
      return;
    }

    setIsSubmitting(true);
    const assigneeIds = assigneeIdStrs
      .map((id) => parseInt(id, 10))
      .filter((id) => !Number.isNaN(id));

    if (isEditing && taskToEdit) {
      const res = await developmentService.updateTask(projectId, taskToEdit.id, {
        title: title.trim(),
        description: description.trim() || null,
        taskType,
        moduleId,
        submoduleId,
        assigneeIds,
        priority,
        status,
        startDate: startDate || null,
        dueDate: dueDate || null,
        estimatedEffort: estVal,
        effortUnit,
        actualEffort: actVal,
        labels,
      });
      setIsSubmitting(false);
      if (res.success && res.data) {
        onSaved(res.data);
        onClose();
      } else {
        setError(res.error || 'Failed to update task');
      }
    } else {
      const attachmentDocumentIds = selectedDocIds
        .map((id) => parseInt(id, 10))
        .filter((id) => !Number.isNaN(id));
      const res = await developmentService.createTask(projectId, {
        title: title.trim(),
        description: description.trim() || undefined,
        taskType,
        moduleId,
        submoduleId,
        assigneeIds,
        priority,
        status,
        startDate: startDate || null,
        dueDate: dueDate || null,
        estimatedEffort: estVal,
        effortUnit,
        actualEffort: actVal,
        labels,
        attachmentDocumentIds,
        externalAttachments,
      });
      setIsSubmitting(false);
      if (res.success && res.data) {
        onSaved(res.data);
        onClose();
      } else {
        setError(res.error || 'Failed to create task');
      }
    }
  };

  if (!isOpen) return null;

  const moduleOptions = availableModules.map((m) => ({
    value: String(m.id),
    label: m.name + (m.isArchived ? ' (Archived)' : ''),
    sublabel: `${m.submodules?.filter((s) => !s.isArchived).length || 0} submodules`,
    icon: (
      <span
        className="w-2.5 h-2.5 rounded-full inline-block"
        style={{ backgroundColor: m.color || accentColor }}
      />
    ),
  }));

  const submoduleOptions = availableSubmodules.map((s) => ({
    value: String(s.id),
    label: s.name + (s.isArchived ? ' (Archived)' : ''),
    sublabel: s.description ? s.description.slice(0, 32) : undefined,
  }));

  const memberOptions = eligibleMembers.map((m) => ({
    value: String(m.id),
    label: m.name,
    sublabel: m.projectRole || m.jobTitle || m.email || undefined,
  }));

  const docOptions = projectDocuments.map((d) => ({
    value: String(d.id),
    label: d.displayName || d.originalName,
    sublabel: `${d.extension?.toUpperCase() || 'FILE'} · ${(d.sizeBytes / 1024).toFixed(0)} KB`,
  }));

  return createPortal(
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-[#0E0F14] border border-[#27272A] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272A] bg-[#12141B] shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${accentColor}1E`, color: accentColor }}
                >
                  <CheckSquare size={18} />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    {isEditing
                      ? `Edit Work Item · ${taskToEdit?.taskKey}`
                      : 'Create Development Work Item'}
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    {isEditing
                      ? 'Changes are logged automatically in activity history'
                      : `Auto-assigned sequential key (${config.taskPrefix}-XXX)`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1E202B] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-6">
              {error && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Section A — Task Details */}
              <div className="rounded-2xl bg-[#12141B]/70 border border-[#27272A] p-4 space-y-4">
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  <Layers size={12} style={{ color: accentColor }} />
                  <span>Section A — Task Details</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">
                      Title <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Concise summary of the work item..."
                      className="w-full px-3 py-2 rounded-xl bg-[#0A0B0F] border border-[#27272A] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">Task Type</label>
                    <AnimatedSelect
                      value={taskType}
                      onChange={setTaskType}
                      accentColor={accentColor}
                      dropdownMinWidth="w-full"
                      options={config.taskTypes.map((tt) => ({ value: tt, label: tt }))}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Description</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Acceptance criteria, technical context, or implementation notes..."
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0B0F] border border-[#27272A] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 resize-y"
                  />
                </div>

                {/* Module & Submodule Master Selectors */}
                {availableModules.length === 0 ? (
                  <div className="rounded-xl bg-[#0A0B0F] border border-dashed border-[#27272A] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-zinc-200">
                        No Development Modules found
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Create your first Module master to categorize work items cleanly.
                      </p>
                    </div>
                    {canManageMasters && (
                      <button
                        type="button"
                        onClick={() => setQuickMasterMode('module')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#0A0B10] cursor-pointer hover:brightness-110 shrink-0"
                        style={{ backgroundColor: accentColor }}
                      >
                        <Plus size={13} />
                        <span>Add New Module</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-zinc-300">
                          Module <span className="text-red-400">*</span>
                        </label>
                        {canManageMasters && (
                          <button
                            type="button"
                            onClick={() => setQuickMasterMode('module')}
                            className="text-[11px] font-medium hover:underline cursor-pointer"
                            style={{ color: accentColor }}
                          >
                            + Add New Module
                          </button>
                        )}
                      </div>
                      <AnimatedSelect
                        value={moduleIdStr}
                        onChange={handleModuleChange}
                        options={moduleOptions}
                        placeholder="Select module..."
                        searchPlaceholder="Search modules..."
                        accentColor={accentColor}
                        dropdownMinWidth="w-full"
                        emptyMessage="No modules match your search."
                        footerAction={
                          canManageMasters
                            ? {
                                label: 'Add New Module',
                                onClick: () => setQuickMasterMode('module'),
                              }
                            : undefined
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-zinc-300">
                          Submodule <span className="text-red-400">*</span>
                        </label>
                        {canManageMasters && selectedModule && (
                          <button
                            type="button"
                            onClick={() => setQuickMasterMode('submodule')}
                            className="text-[11px] font-medium hover:underline cursor-pointer"
                            style={{ color: accentColor }}
                          >
                            + Add New Submodule
                          </button>
                        )}
                      </div>
                      <AnimatedSelect
                        value={submoduleIdStr}
                        onChange={setSubmoduleIdStr}
                        options={submoduleOptions}
                        disabled={!selectedModule}
                        placeholder={
                          !selectedModule
                            ? 'Select a module first...'
                            : availableSubmodules.length === 0
                            ? 'No submodules yet — add one'
                            : 'Select submodule...'
                        }
                        searchPlaceholder="Search submodules..."
                        accentColor={accentColor}
                        dropdownMinWidth="w-full"
                        emptyMessage={
                          availableSubmodules.length === 0
                            ? `No submodules under "${selectedModule?.name || 'module'}" yet.`
                            : 'No matching submodules found.'
                        }
                        footerAction={
                          canManageMasters && selectedModule
                            ? {
                                label: `Add New Submodule to ${selectedModule.name}`,
                                onClick: () => setQuickMasterMode('submodule'),
                              }
                            : undefined
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section B — Assignment */}
              <div className="rounded-2xl bg-[#12141B]/70 border border-[#27272A] p-4 space-y-4">
                <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Section B — Assignment & Status
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">Assigned To</label>
                    <AnimatedMultiSelect
                      values={assigneeIdStrs}
                      onChange={setAssigneeIdStrs}
                      options={memberOptions}
                      placeholder="Select team members..."
                      searchPlaceholder="Search members..."
                      accentColor={accentColor}
                      dropdownMinWidth="w-full"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">Priority</label>
                    <AnimatedSelect
                      value={priority}
                      onChange={(v) => setPriority(v as DevTaskPriority)}
                      accentColor={accentColor}
                      dropdownMinWidth="w-full"
                      options={DEV_PRIORITIES.map((p) => ({ value: p, label: p }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">Status</label>
                    <AnimatedSelect
                      value={status}
                      onChange={setStatus}
                      accentColor={accentColor}
                      dropdownMinWidth="w-full"
                      options={config.statuses.map((st) => ({ value: st, label: st }))}
                    />
                  </div>
                </div>
              </div>

              {/* Section C — Schedule and Effort */}
              <div className="rounded-2xl bg-[#12141B]/70 border border-[#27272A] p-4 space-y-4">
                <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Section C — Schedule & Effort
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">Start Date</label>
                    <CustomDatePicker
                      value={startDate}
                      onChange={setStartDate}
                      placeholder="Select start date"
                      presetMode="start"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">Due Date</label>
                    <CustomDatePicker
                      value={dueDate}
                      onChange={setDueDate}
                      placeholder="Select due date"
                      presetMode="end"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">Estimated Effort</label>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        value={estimatedEffort}
                        onChange={(e) => setEstimatedEffort(e.target.value)}
                        placeholder="0"
                        className="w-full px-2.5 py-2 rounded-xl bg-[#0A0B0F] border border-[#27272A] text-xs text-white focus:outline-none focus:border-zinc-500"
                      />
                      <div className="w-28 shrink-0">
                        <AnimatedSelect
                          value={effortUnit}
                          onChange={(v) => setEffortUnit(v as DevEffortUnit)}
                          accentColor={accentColor}
                          dropdownMinWidth="w-36"
                          dropdownAlign="right"
                          options={[
                            { value: 'hours', label: 'Hours' },
                            { value: 'story_points', label: 'Points' },
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">Actual Effort</label>
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={actualEffort}
                      onChange={(e) => setActualEffort(e.target.value)}
                      placeholder={effortUnit === 'hours' ? 'Hours logged' : 'Points spent'}
                      className="w-full px-3 py-2 rounded-xl bg-[#0A0B0F] border border-[#27272A] text-xs text-white focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section D — Additional Details (Labels & Attachments) */}
              <div className="rounded-2xl bg-[#12141B]/70 border border-[#27272A] p-4 space-y-4">
                <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Section D — Labels & Attachments
                </div>

                {/* Labels */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                    <Tag size={12} />
                    <span>Labels</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={labelInput}
                      onChange={(e) => setLabelInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddLabel();
                        }
                      }}
                      placeholder="Type a label (e.g., api, v2, security) and press Enter..."
                      className="flex-1 px-3 py-2 rounded-xl bg-[#0A0B0F] border border-[#27272A] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddLabel}
                      className="px-3 py-2 rounded-xl text-xs font-medium bg-[#161820] hover:bg-[#1E202B] text-zinc-200 border border-[#27272A] cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  {labels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {labels.map((lbl) => (
                        <span
                          key={lbl}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] bg-[#171923] border border-[#27272A] text-zinc-200"
                        >
                          <span>#{lbl}</span>
                          <button
                            type="button"
                            onClick={() => setLabels((prev) => prev.filter((x) => x !== lbl))}
                            className="text-zinc-500 hover:text-white cursor-pointer"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Attachments (only on create here; edit mode uses Task Drawer Attachments tab too) */}
                {!isEditing && (
                  <div className="space-y-3 pt-2 border-t border-[#27272A]/70">
                    <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                      <Paperclip size={12} />
                      <span>Attach Project Documents or Resource Links</span>
                    </label>
                    {docOptions.length > 0 && (
                      <AnimatedMultiSelect
                        values={selectedDocIds}
                        onChange={setSelectedDocIds}
                        options={docOptions}
                        placeholder="Link existing documents from Documents module..."
                        searchPlaceholder="Search project files..."
                        accentColor={accentColor}
                        dropdownMinWidth="w-full"
                      />
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                      <input
                        type="text"
                        value={extFileName}
                        onChange={(e) => setExtFileName(e.target.value)}
                        placeholder="Attachment label (e.g., Figma Spec)"
                        className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#0A0B0F] border border-[#27272A] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                      />
                      <input
                        type="text"
                        value={extFileUrl}
                        onChange={(e) => setExtFileUrl(e.target.value)}
                        placeholder="https://..."
                        className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#0A0B0F] border border-[#27272A] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddExternalAttachment}
                        className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-medium bg-[#161820] hover:bg-[#1E202B] text-zinc-200 border border-[#27272A] cursor-pointer"
                      >
                        <Link2 size={12} />
                        <span>Attach</span>
                      </button>
                    </div>
                    {externalAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {externalAttachments.map((att, idx) => (
                          <span
                            key={`${att.fileName}-${idx}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] bg-[#161820] border border-[#27272A] text-zinc-200"
                          >
                            <FileText size={11} className="text-zinc-400" />
                            <span>{att.fileName}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setExternalAttachments((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-zinc-500 hover:text-white cursor-pointer"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#27272A]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-300 bg-[#161820] hover:bg-[#1E202B] border border-[#27272A] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-[#0A0B10] transition-all cursor-pointer hover:brightness-110 disabled:opacity-50"
                  style={{
                    backgroundColor: accentColor,
                    boxShadow: `0 6px 18px -4px ${accentColor}55`,
                  }}
                >
                  {isSubmitting
                    ? isEditing
                      ? 'Saving Changes...'
                      : 'Creating Task...'
                    : isEditing
                    ? 'Save Changes'
                    : 'Create Work Item'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </AnimatePresence>

      {quickMasterMode && (
        <QuickCreateMasterModal
          isOpen={true}
          mode={quickMasterMode}
          projectId={projectId}
          parentModule={quickMasterMode === 'submodule' ? selectedModule : null}
          onClose={() => setQuickMasterMode(null)}
          onCreatedModule={handleCreatedModule}
          onCreatedSubmodule={handleCreatedSubmodule}
        />
      )}
    </>,
    document.body
  );
};

