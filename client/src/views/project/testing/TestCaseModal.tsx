import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  FileText,
  FolderGit2,
  Loader2,
  Paperclip,
  Plus,
  Tag,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { testingService } from '../../../services/testing.service';
import { developmentService } from '../../../services/development.service';
import { useAccentTheme } from '../../../services/accentTheme.service';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { AnimatedSelect, type SelectOption } from '../../../components/settings/AnimatedSelect';
import { UserAvatar } from '../../../components/common/UserAvatar';
import { TestingAttachmentsPanel } from '../../../components/testing/TestingAttachmentsPanel';
import type {
  TestCaseDetail,
  TestCaseItem,
  TestingAttachmentDocument,
  TestingConfigurationItem,
  TestingMetaData,
  TestingPermissions,
} from '../../../types/testing';

interface StepDraft {
  action: string;
  testData: string;
  expectedResult: string;
}

interface UploadedDocItem {
  id: number;
  displayName: string;
  originalName: string;
  mimeType?: string;
  sizeBytes: number;
  branch: string;
  repositoryPath: string;
  folder: string;
}

interface TestCaseModalProps {
  projectId: number;
  isOpen: boolean;
  editingCase?: TestCaseDetail | TestCaseItem | null;
  meta: TestingMetaData;
  config: TestingConfigurationItem;
  permissions: TestingPermissions;
  onConfigUpdated: (cfg: TestingConfigurationItem) => void;
  onClose: () => void;
  onSaved: (saved: TestCaseDetail) => void;
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const TestCaseModal: React.FC<TestCaseModalProps> = ({
  projectId,
  isOpen,
  editingCase,
  meta,
  config,
  permissions,
  onConfigUpdated,
  onClose,
  onSaved,
}) => {
  const { accentColor } = useAccentTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [preconditions, setPreconditions] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [submoduleId, setSubmoduleId] = useState('');
  const [testType, setTestType] = useState('Functional');
  const [priority, setPriority] = useState('Medium');
  const [status, setStatus] = useState('Draft');
  const [assignedTesterId, setAssignedTesterId] = useState('');
  const [linkedRequirementId, setLinkedRequirementId] = useState('');
  const [linkedDevTaskId, setLinkedDevTaskId] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [steps, setSteps] = useState<StepDraft[]>([{ action: '', testData: '', expectedResult: '' }]);
  const [attachments, setAttachments] = useState<TestingAttachmentDocument[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocItem[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [saving, setSaving] = useState(false);

  // Keyboard shortcut: Escape to close drawer
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    if (editingCase) {
      setTitle(editingCase.title || '');
      setDescription(editingCase.description || '');
      setPreconditions(editingCase.preconditions || '');
      setModuleId(editingCase.moduleId ? String(editingCase.moduleId) : '');
      setSubmoduleId(editingCase.submoduleId ? String(editingCase.submoduleId) : '');
      setTestType(editingCase.testType || config.testTypes?.[0]?.name || 'Functional');
      setPriority(editingCase.priority || 'Medium');
      setStatus(editingCase.status || 'Draft');
      setAssignedTesterId(editingCase.assignedTesterId ? String(editingCase.assignedTesterId) : '');
      setLinkedRequirementId(editingCase.linkedRequirementId ? String(editingCase.linkedRequirementId) : '');
      setLinkedDevTaskId(editingCase.linkedDevTaskId ? String(editingCase.linkedDevTaskId) : '');
      setLabels(editingCase.labels || []);
      const existingSteps = (editingCase as TestCaseDetail).steps;
      if (existingSteps && existingSteps.length > 0) {
        setSteps(
          existingSteps
            .slice()
            .sort((a, b) => a.stepNumber - b.stepNumber)
            .map((s) => ({
              action: s.action,
              testData: s.testData || '',
              expectedResult: s.expectedResult || '',
            }))
        );
      } else {
        setSteps([{ action: '', testData: '', expectedResult: '' }]);
      }
      setAttachments((editingCase as TestCaseDetail).attachments || []);
    } else {
      setTitle('');
      setDescription('');
      setPreconditions('');
      setModuleId(meta.modules[0] ? String(meta.modules[0].id) : '');
      setSubmoduleId('');
      setTestType(config.testTypes?.[0]?.name || 'Functional');
      setPriority(config.priorities?.[2]?.name || 'Medium');
      setStatus('Ready');
      // Auto-select currently logged-in user as assigned tester
      setAssignedTesterId(user?.id ? String(user.id) : '');
      setLinkedRequirementId('');
      setLinkedDevTaskId('');
      setLabels([]);
      setSteps([{ action: '', testData: '', expectedResult: '' }]);
      setAttachments([]);
    }
    setUploadedDocs([]);
    setLabelInput('');
  }, [isOpen, editingCase, config, meta.modules, user]);

  const selectedModule = useMemo(
    () => meta.modules.find((m) => String(m.id) === moduleId),
    [meta.modules, moduleId]
  );

  const moduleOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'None / General' },
      ...meta.modules.map((m) => ({ value: String(m.id), label: m.name })),
    ],
    [meta.modules]
  );

  const submoduleOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'None' },
      ...(selectedModule?.submodules || []).map((s) => ({ value: String(s.id), label: s.name })),
    ],
    [selectedModule]
  );

  const testTypeOptions: SelectOption[] = useMemo(
    () =>
      (config.testTypes || [])
        .filter((t) => !t.isArchived)
        .map((t) => ({ value: t.name, label: t.name })),
    [config.testTypes]
  );

  const priorityOptions: SelectOption[] = useMemo(
    () =>
      (config.priorities || [])
        .filter((p) => !p.isArchived)
        .map((p) => ({ value: p.name, label: p.name })),
    [config.priorities]
  );

  const testerOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Unassigned' },
      ...meta.members.map((m) => ({
        value: String(m.id),
        label: m.name || m.email || `User #${m.id}`,
        sublabel: m.email || undefined,
        icon: <UserAvatar user={m} size="xs" />,
      })),
    ],
    [meta.members]
  );

  const requirementOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'None' },
      ...meta.requirements.map((r) => ({
        value: String(r.id),
        label: r.code ? `${r.code} — ${r.title}` : r.title,
        sublabel: r.workflowStatus,
      })),
    ],
    [meta.requirements]
  );

  const devTaskOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'None' },
      ...meta.devTasks.map((t) => ({
        value: String(t.id),
        label: `${t.taskKey} — ${t.title}`,
        sublabel: t.status,
      })),
    ],
    [meta.devTasks]
  );

  // Inbuilt Test Type creation via select option search
  const handleCreateTestTypeFromSelect = async (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const res = await testingService.addMasterOption(projectId, {
      category: 'testTypes',
      name: cleanName,
      color: '#10B981',
      icon: 'CheckSquare',
    });
    if (res.success && res.data) {
      onConfigUpdated(res.data.config);
      setTestType(cleanName);
      toast.success(`Created test type "${cleanName}"`);
    } else {
      toast.error(res.error || 'Failed to create test type');
    }
  };

  // Inbuilt Application Module creation via select option search
  const handleCreateModuleFromSelect = async (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const res = await developmentService.createModule(projectId, {
      name: cleanName,
      color: '#10B981',
      icon: 'Layers',
    });
    if (res.success && res.data) {
      meta.modules.push({
        id: res.data.id,
        name: res.data.name,
        color: res.data.color,
        submodules: [],
      });
      setModuleId(String(res.data.id));
      setSubmoduleId('');
      toast.success(`Created module "${cleanName}"`);
    } else {
      toast.error(res.error || 'Failed to create module');
    }
  };

  // Inbuilt Application Submodule creation via select option search
  const handleCreateSubmoduleFromSelect = async (name: string) => {
    if (!moduleId) {
      toast.error('Select an application module first');
      return;
    }
    const cleanName = name.trim();
    if (!cleanName) return;
    const res = await developmentService.createSubmodule(projectId, {
      moduleId: Number(moduleId),
      name: cleanName,
      icon: 'Box',
    });
    if (res.success && res.data) {
      const mod = meta.modules.find((m) => String(m.id) === moduleId);
      if (mod) {
        mod.submodules = mod.submodules || [];
        mod.submodules.push({ id: res.data.id, name: res.data.name });
      }
      setSubmoduleId(String(res.data.id));
      toast.success(`Created submodule "${cleanName}"`);
    } else {
      toast.error(res.error || 'Failed to create submodule');
    }
  };

  // Direct Document Upload to Docs Repository on main branch under submodule folder
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    setUploadingFiles(true);
    try {
      const payloadFiles = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          mimeType: f.type || 'application/octet-stream',
          base64: await readFileAsBase64(f),
        }))
      );

      const res = await testingService.uploadStagedAttachmentFiles(projectId, {
        moduleId: moduleId ? Number(moduleId) : null,
        submoduleId: submoduleId ? Number(submoduleId) : null,
        files: payloadFiles,
      });

      if (res.success && res.data) {
        if (res.data.documents && res.data.documents.length > 0) {
          setUploadedDocs((prev) => [...prev, ...res.data!.documents]);
          toast.success(`Uploaded ${res.data.documents.length} document(s) to folder "${res.data.folder}" on main`);
        }
        if (res.data.errors && res.data.errors.length > 0) {
          toast.error(res.data.errors[0]?.error || 'Some documents failed to upload');
        }
      } else {
        toast.error(res.error || 'Failed to upload document');
      }
    } catch (err: any) {
      toast.error(err.message || 'File upload failed');
    } finally {
      setUploadingFiles(false);
    }
  };

  const addLabelChip = () => {
    const clean = labelInput.trim();
    if (!clean) return;
    if (!labels.includes(clean)) setLabels([...labels, clean]);
    setLabelInput('');
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const nextIdx = index + dir;
    if (nextIdx < 0 || nextIdx >= steps.length) return;
    const copy = [...steps];
    const [item] = copy.splice(index, 1);
    copy.splice(nextIdx, 0, item);
    setSteps(copy);
  };

  const refreshAttachments = async () => {
    if (!editingCase) return;
    const res = await testingService.getTestCaseDetail(projectId, editingCase.id);
    if (res.success && res.data) {
      setAttachments(res.data.attachments || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Test case title is required');
      return;
    }

    const nonEmptySteps = steps.filter(
      (s) => s.action.trim() || s.testData.trim() || s.expectedResult.trim()
    );
    const invalidStep = nonEmptySteps.find((s) => !s.action.trim());
    if (invalidStep) {
      toast.error('Each test step must have an action/instruction');
      return;
    }

    setSaving(true);
    try {
      const attachmentDocumentIds = [
        ...attachments.map((a) => a.documentId),
        ...uploadedDocs.map((d) => d.id),
      ];

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        preconditions: preconditions.trim() || null,
        moduleId: moduleId ? Number(moduleId) : null,
        submoduleId: submoduleId ? Number(submoduleId) : null,
        testType,
        priority,
        status,
        assignedTesterId: assignedTesterId ? Number(assignedTesterId) : null,
        linkedRequirementId: linkedRequirementId ? Number(linkedRequirementId) : null,
        linkedDevTaskId: linkedDevTaskId ? Number(linkedDevTaskId) : null,
        labels,
        steps: nonEmptySteps.map((s, idx) => ({
          stepNumber: idx + 1,
          action: s.action.trim(),
          testData: s.testData.trim() || null,
          expectedResult: s.expectedResult.trim() || null,
        })),
        attachmentDocumentIds,
      };

      const res = editingCase
        ? await testingService.updateTestCase(projectId, editingCase.id, payload)
        : await testingService.createTestCase(projectId, payload);

      if (res.success && res.data) {
        toast.success(editingCase ? `Updated ${res.data.caseKey}` : `Created ${res.data.caseKey}`);
        onSaved(res.data);
      } else {
        toast.error(res.error || 'Failed to save test case');
      }
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] overflow-hidden">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/65 backdrop-blur-sm"
          />

          {/* Right-side Sliding Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="fixed inset-y-0 right-0 z-[75] w-full max-w-xl bg-[#0F1117] border-l border-[#27272A] shadow-2xl flex flex-col h-full overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#27272A] bg-[#13151D] shrink-0">
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: accentColor }}
                  />
                  <h2 className="text-sm sm:text-base font-bold text-white truncate">
                    {editingCase ? `Edit ${editingCase.caseKey}` : 'Create Test Case'}
                  </h2>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                  {editingCase
                    ? 'Updating definition preserves historical test execution snapshots.'
                    : 'Author manual test case with steps, traceability, and documents.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-white/[0.05] border border-white/10">
                  ESC
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Form Body */}
            <form
              id="test-case-form"
              onSubmit={(e) => void handleSubmit(e)}
              className="flex-1 overflow-y-auto px-6 py-5 space-y-5 scrollbar-thin scrollbar-thumb-zinc-700"
            >
              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-200">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Verify OAuth token refresh upon 401 response"
                  className="w-full bg-[#14161F] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
                />
              </div>

              {/* Classification: Test Type, Priority, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Test Type</label>
                  <AnimatedSelect
                    options={testTypeOptions}
                    value={testType}
                    onChange={setTestType}
                    searchPlaceholder={
                      permissions.canManageSettings ? 'Search or type name to add...' : 'Search test types...'
                    }
                    placeholder="Select type..."
                    accentColor={accentColor}
                    onCreateOption={
                      permissions.canManageSettings ? handleCreateTestTypeFromSelect : undefined
                    }
                    createOptionLabel={(query) => `Add "${query}" test type`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Priority</label>
                  <AnimatedSelect
                    options={priorityOptions}
                    value={priority}
                    onChange={setPriority}
                    placeholder="Priority..."
                    accentColor={accentColor}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Status</label>
                  <AnimatedSelect
                    options={[
                      { value: 'Draft', label: 'Draft' },
                      { value: 'Ready', label: 'Ready' },
                      { value: 'Deprecated', label: 'Deprecated' },
                    ]}
                    value={status}
                    onChange={setStatus}
                    dropdownAlign="right"
                    placeholder="Status..."
                    accentColor={accentColor}
                  />
                </div>
              </div>

              {/* Application Architecture: Module & Submodule */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Application Module</label>
                  <AnimatedSelect
                    options={moduleOptions}
                    value={moduleId}
                    onChange={(val) => {
                      setModuleId(val);
                      setSubmoduleId('');
                    }}
                    searchPlaceholder={
                      permissions.canManageSettings ? 'Search or type name to add...' : 'Search modules...'
                    }
                    placeholder="Select module..."
                    accentColor={accentColor}
                    onCreateOption={
                      permissions.canManageSettings ? handleCreateModuleFromSelect : undefined
                    }
                    createOptionLabel={(query) => `Add "${query}" module`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Submodule</label>
                  <AnimatedSelect
                    options={submoduleOptions}
                    value={submoduleId}
                    onChange={setSubmoduleId}
                    disabled={!moduleId}
                    dropdownAlign="right"
                    searchPlaceholder={
                      permissions.canManageSettings && moduleId
                        ? 'Search or type name to add...'
                        : 'Search submodules...'
                    }
                    placeholder={!moduleId ? 'Select module first...' : 'Select submodule...'}
                    accentColor={accentColor}
                    onCreateOption={
                      permissions.canManageSettings && moduleId
                        ? handleCreateSubmoduleFromSelect
                        : undefined
                    }
                    createOptionLabel={(query) => `Add "${query}" submodule`}
                  />
                </div>
              </div>

              {/* Assignment & Traceability */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Assigned Tester</label>
                  <AnimatedSelect
                    options={testerOptions}
                    value={assignedTesterId}
                    onChange={setAssignedTesterId}
                    searchPlaceholder="Search testers..."
                    placeholder="Select tester..."
                    accentColor={accentColor}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Linked Requirement</label>
                  <AnimatedSelect
                    options={requirementOptions}
                    value={linkedRequirementId}
                    onChange={setLinkedRequirementId}
                    dropdownAlign="right"
                    searchPlaceholder="Search requirements..."
                    placeholder="Select requirement..."
                    accentColor={accentColor}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Linked Development Task</label>
                  <AnimatedSelect
                    options={devTaskOptions}
                    value={linkedDevTaskId}
                    onChange={setLinkedDevTaskId}
                    dropdownAlign="right"
                    searchPlaceholder="Search dev tasks..."
                    placeholder="Select task..."
                    accentColor={accentColor}
                  />
                </div>
              </div>

              {/* Scope & Preconditions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Description</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Scope, test scenario, or business rules..."
                    className="w-full resize-none bg-[#14161F] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Preconditions</label>
                  <textarea
                    rows={3}
                    value={preconditions}
                    onChange={(e) => setPreconditions(e.target.value)}
                    placeholder="Initial state, test accounts, feature flags..."
                    className="w-full resize-none bg-[#14161F] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
              </div>

              {/* Labels */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">Labels</label>
                {labels.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    {labels.map((lbl) => (
                      <span
                        key={lbl}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-white/[0.07] text-zinc-200 border border-white/10"
                      >
                        <Tag className="w-3 h-3 text-emerald-400" />
                        {lbl}
                        <button
                          type="button"
                          onClick={() => setLabels(labels.filter((l) => l !== lbl))}
                          className="ml-1 text-zinc-400 hover:text-white"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addLabelChip();
                      }
                    }}
                    placeholder="Add label and press Enter..."
                    className="flex-1 bg-[#14161F] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                  />
                  <button
                    type="button"
                    onClick={addLabelChip}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium bg-white/[0.06] text-zinc-300 border border-[#27272A] hover:bg-white/10 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Ordered Test Steps */}
              <div className="rounded-xl bg-[#14161F] border border-[#27272A] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-white">Execution Steps</h3>
                    <p className="text-[10px] text-zinc-400">
                      Ordered actions, data inputs, and expected outcomes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSteps([...steps, { action: '', testData: '', expectedResult: '' }])}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/25 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Step
                  </button>
                </div>

                <div className="space-y-2.5">
                  {steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl bg-[#0D0F14] border border-white/[0.07] p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-semibold text-emerald-400">
                          Step #{idx + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveStep(idx, -1)}
                            className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-25"
                            title="Move up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === steps.length - 1}
                            onClick={() => moveStep(idx, 1)}
                            className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-25"
                            title="Move down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={steps.length <= 1}
                            onClick={() => setSteps(steps.filter((_, i) => i !== idx))}
                            className="p-1 rounded text-zinc-400 hover:text-red-400 disabled:opacity-25"
                            title="Remove step"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">
                            Action / Instruction <span className="text-red-400">*</span>
                          </label>
                          <textarea
                            rows={2}
                            value={step.action}
                            onChange={(e) => {
                              const copy = [...steps];
                              copy[idx] = { ...copy[idx], action: e.target.value };
                              setSteps(copy);
                            }}
                            placeholder="Click Login button..."
                            className="w-full resize-none bg-[#14161F] border border-[#27272A] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/60"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Test Data / Input</label>
                          <textarea
                            rows={2}
                            value={step.testData}
                            onChange={(e) => {
                              const copy = [...steps];
                              copy[idx] = { ...copy[idx], testData: e.target.value };
                              setSteps(copy);
                            }}
                            placeholder="email=tester@devflow.io"
                            className="w-full resize-none bg-[#14161F] border border-[#27272A] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/60"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Expected Result</label>
                          <textarea
                            rows={2}
                            value={step.expectedResult}
                            onChange={(e) => {
                              const copy = [...steps];
                              copy[idx] = { ...copy[idx], expectedResult: e.target.value };
                              setSteps(copy);
                            }}
                            placeholder="Redirects to /dashboard..."
                            className="w-full resize-none bg-[#14161F] border border-[#27272A] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/60"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Document Repository Upload Section */}
              <div className="rounded-xl bg-[#14161F] border border-[#27272A] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="w-4 h-4 text-emerald-400" />
                    <div>
                      <h3 className="text-xs font-semibold text-white">Repository Documents</h3>
                      <p className="text-[10px] text-zinc-400">
                        Upload test evidence directly to GitHub docs repo on branch <code className="text-emerald-300">main</code> in{' '}
                        <code className="text-emerald-300">
                          {submoduleId ? `submodule-${submoduleId}` : moduleId ? `module-${moduleId}` : 'test-cases'}
                        </code>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={uploadingFiles}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                  >
                    {uploadingFiles ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="w-3.5 h-3.5" />
                    )}
                    Upload to Repo
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => void handleFilesSelected(e)}
                  />
                </div>

                {/* Uploaded Document Chips */}
                {uploadedDocs.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {uploadedDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0D0F14] border border-emerald-500/30"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-zinc-200 truncate">
                              {doc.displayName || doc.originalName}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-2">
                              <span>{formatFileSize(doc.sizeBytes)}</span>
                              <span>•</span>
                              <span className="text-emerald-300">
                                {doc.branch}:{doc.folder}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUploadedDocs((prev) => prev.filter((d) => d.id !== doc.id))}
                          className="p-1 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Existing Linked Attachments Panel for edit mode */}
              {editingCase && (
                <TestingAttachmentsPanel
                  projectId={projectId}
                  entityType="test_case"
                  entityId={editingCase.id}
                  attachments={attachments}
                  availableDocuments={meta.projectDocuments}
                  canEdit={permissions.canEditTestCases}
                  onUpdated={() => void refreshAttachments()}
                />
              )}
            </form>

            {/* Fixed Sticky Footer Save Strip */}
            <div className="sticky bottom-0 bg-[#12141B] border-t border-[#27272A] px-6 py-4 flex items-center justify-between gap-3 shrink-0 z-20">
              <span className="text-[11px] text-zinc-500">
                {editingCase ? `Modifying ${editingCase.caseKey}` : 'Drafting new test case'}
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-300 bg-[#181A22] border border-[#27272A] hover:bg-[#202330] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="test-case-form"
                  disabled={saving || uploadingFiles}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-lg disabled:opacity-50 transition-all hover:brightness-110"
                  style={{ backgroundColor: accentColor }}
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {saving ? 'Saving...' : editingCase ? 'Save Changes' : 'Create Test Case'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
