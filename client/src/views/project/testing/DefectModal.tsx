import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Bug,
  Check,
  CheckSquare,
  Eye,
  FileText,
  FolderGit2,
  Loader2,
  Plus,
  ShieldAlert,
  Sparkles,
  Tag,
  UploadCloud,
  X,
} from 'lucide-react';
import { testingService } from '../../../services/testing.service';
import { developmentService } from '../../../services/development.service';
import { documentService } from '../../../services/document.service';
import { useAccentTheme } from '../../../services/accentTheme.service';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { AnimatedSelect, type SelectOption } from '../../../components/settings/AnimatedSelect';
import { UserAvatar } from '../../../components/common/UserAvatar';
import { TestingAttachmentsPanel } from '../../../components/testing/TestingAttachmentsPanel';
import type {
  QaDefectDetail,
  QaDefectItem,
  TestCaseItem,
  TestingAttachmentDocument,
  TestingConfigurationItem,
  TestingMetaData,
  TestingPermissions,
} from '../../../types/testing';

interface DefectModalProps {
  projectId: number;
  isOpen: boolean;
  editingDefect?: QaDefectDetail | QaDefectItem | null;
  meta: TestingMetaData;
  config: TestingConfigurationItem;
  permissions: TestingPermissions;
  projectSubmoduleId?: number;
  onConfigUpdated: (cfg: TestingConfigurationItem) => void;
  onClose: () => void;
  onSaved: (saved: QaDefectDetail | QaDefectItem) => void;
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

const DEFECT_STATUS_OPTIONS: SelectOption[] = [
  { value: 'Open', label: 'Open', sublabel: 'Newly reported, awaiting triage' },
  { value: 'In Progress', label: 'In Progress', sublabel: 'Developer investigating/fixing' },
  { value: 'Fixed', label: 'Fixed (Pending Retest)', sublabel: 'Fix deployed, awaits QA sign-off' },
  { value: 'Ready for Retest', label: 'Ready for Retest', sublabel: 'Ready for test execution' },
  { value: 'Verified', label: 'Verified (QA)', sublabel: 'QA verified fix on target build' },
  { value: 'Closed', label: 'Closed', sublabel: 'Defect resolved and closed' },
  { value: 'Reopened', label: 'Reopened', sublabel: 'Defect recurred upon retest' },
];

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

export const DefectModal: React.FC<DefectModalProps> = ({
  projectId,
  isOpen,
  editingDefect,
  meta,
  config,
  permissions,
  projectSubmoduleId,
  onConfigUpdated,
  onClose,
  onSaved,
}) => {
  const { accentColor } = useAccentTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [submoduleId, setSubmoduleId] = useState('');
  const [severity, setSeverity] = useState('Major');
  const [priority, setPriority] = useState('High');
  const [status, setStatus] = useState('Open');
  const [assigneeId, setAssigneeId] = useState('');
  const [environment, setEnvironment] = useState('Staging');
  const [buildVersion, setBuildVersion] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [actualResult, setActualResult] = useState('');
  const [linkedTestCaseId, setLinkedTestCaseId] = useState('');
  const [linkedDevTaskId, setLinkedDevTaskId] = useState('');
  const [linkedRequirementId, setLinkedRequirementId] = useState('');

  // Test cases list for linking
  const [availableTestCases, setAvailableTestCases] = useState<TestCaseItem[]>([]);

  // Attachments & Uploaded files
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocItem[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [attachments, setAttachments] = useState<TestingAttachmentDocument[]>([]);
  const [previewModalDoc, setPreviewModalDoc] = useState<{ url: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Keyboard shortcut: Escape to close
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

  // Load test cases list for linking
  useEffect(() => {
    if (!isOpen) return;
    void (async () => {
      try {
        const res = await testingService.listTestCases(projectId);
        if (res.success && res.data) {
          setAvailableTestCases(res.data.items || []);
        }
      } catch {
        // ignore
      }
    })();
  }, [isOpen, projectId]);

  // Populate data when editing or reset for create
  useEffect(() => {
    if (!isOpen) return;

    if (editingDefect) {
      setTitle(editingDefect.title || '');
      setDescription(editingDefect.description || '');
      setModuleId(editingDefect.moduleId ? String(editingDefect.moduleId) : '');
      setSubmoduleId(editingDefect.submoduleId ? String(editingDefect.submoduleId) : '');
      setSeverity(editingDefect.severity || 'Major');
      setPriority(editingDefect.priority || 'High');
      setStatus(editingDefect.status || 'Open');
      setAssigneeId(editingDefect.assigneeId ? String(editingDefect.assigneeId) : '');
      setEnvironment(editingDefect.environment || config?.defaultEnvironment || 'Staging');
      setBuildVersion(editingDefect.buildVersion || '');
      setStepsToReproduce(editingDefect.stepsToReproduce || '');
      setExpectedResult(editingDefect.expectedResult || '');
      setActualResult(editingDefect.actualResult || '');
      setLinkedTestCaseId(editingDefect.linkedTestCaseId ? String(editingDefect.linkedTestCaseId) : '');
      setLinkedDevTaskId(editingDefect.linkedDevTaskId ? String(editingDefect.linkedDevTaskId) : '');
      setLinkedRequirementId(editingDefect.linkedRequirementId ? String(editingDefect.linkedRequirementId) : '');
      setUploadedDocs([]);

      void (async () => {
        try {
          const detailRes = await testingService.getDefectDetail(projectId, editingDefect.id);
          if (detailRes.success && detailRes.data) {
            setAttachments(detailRes.data.attachments || []);
          }
        } catch {
          // ignore
        }
      })();
    } else {
      // Create mode - Unassigned by default (do NOT auto-select assignee)
      setTitle('');
      setDescription('');
      setModuleId(meta.modules[0] ? String(meta.modules[0].id) : '');
      setSubmoduleId('');
      setSeverity(config?.defectSeverities?.[0]?.name || 'Major');
      setPriority(config?.priorities?.[0]?.name || 'High');
      setStatus('Open');
      setAssigneeId('');
      setEnvironment(config?.defaultEnvironment || 'Staging');
      setBuildVersion('');
      setStepsToReproduce('');
      setExpectedResult('');
      setActualResult('');
      setLinkedTestCaseId('');
      setLinkedDevTaskId('');
      setLinkedRequirementId('');
      setUploadedDocs([]);
      setAttachments([]);
    }
  }, [isOpen, editingDefect, projectId, meta.modules, user?.id, config]);

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

  // Inbuilt Application Module creation via select option search
  const handleCreateModuleFromSelect = async (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const res = await developmentService.createModule(projectId, {
      name: cleanName,
      color: '#F43F5E',
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

  // Dynamic Options
  const severityOptions: SelectOption[] = useMemo(
    () =>
      (config?.defectSeverities || [])
        .filter((s) => !s.isArchived)
        .map((s) => ({ value: s.name, label: s.name })),
    [config?.defectSeverities]
  );

  const priorityOptions: SelectOption[] = useMemo(
    () =>
      (config?.priorities || [])
        .filter((p) => !p.isArchived)
        .map((p) => ({ value: p.name, label: p.name })),
    [config?.priorities]
  );

  const environmentOptions: SelectOption[] = useMemo(
    () =>
      (config?.environments || [])
        .filter((e) => !e.isArchived)
        .map((e) => ({ value: e.name, label: e.name })),
    [config?.environments]
  );

  const memberOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Unassigned', sublabel: 'No developer assigned' },
      ...meta.members.map((m) => ({
        value: String(m.id),
        label: m.name || m.email || `User #${m.id}`,
        sublabel: m.email || undefined,
        icon: <UserAvatar user={m} size="xs" />,
      })),
    ],
    [meta.members]
  );

  const testCaseOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'None', sublabel: 'No test case linked' },
      ...availableTestCases.map((tc) => ({
        value: String(tc.id),
        label: `${tc.caseKey} — ${tc.title}`,
        sublabel: tc.status,
      })),
    ],
    [availableTestCases]
  );

  const devTaskOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'None', sublabel: 'No linked task' },
      ...meta.devTasks.map((t) => ({
        value: String(t.id),
        label: `${t.taskKey} — ${t.title}`,
        sublabel: t.status,
      })),
    ],
    [meta.devTasks]
  );

  const reqOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'None', sublabel: 'No linked requirement' },
      ...meta.requirements.map((r) => ({
        value: String(r.id),
        label: r.code ? `${r.code} — ${r.title}` : r.title,
        sublabel: r.workflowStatus,
      })),
    ],
    [meta.requirements]
  );

  // Inbuilt creation of Severities via AnimatedSelect inline search
  const handleCreateSeverity = async (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const res = await testingService.addMasterOption(projectId, {
      category: 'defectSeverities',
      name: cleanName,
      color: '#F87171',
    });
    if (res.success && res.data) {
      onConfigUpdated(res.data.config);
      setSeverity(cleanName);
      toast.success(`Created severity "${cleanName}"`);
    } else {
      toast.error(res.error || 'Failed to create severity');
    }
  };

  // Inbuilt creation of Priorities via AnimatedSelect inline search
  const handleCreatePriority = async (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const res = await testingService.addMasterOption(projectId, {
      category: 'priorities',
      name: cleanName,
      color: '#FB923C',
    });
    if (res.success && res.data) {
      onConfigUpdated(res.data.config);
      setPriority(cleanName);
      toast.success(`Created priority "${cleanName}"`);
    } else {
      toast.error(res.error || 'Failed to create priority');
    }
  };

  // Inbuilt creation of Environments via AnimatedSelect inline search
  const handleCreateEnvironment = async (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const res = await testingService.addMasterOption(projectId, {
      category: 'environments',
      name: cleanName,
      color: '#38BDF8',
    });
    if (res.success && res.data) {
      onConfigUpdated(res.data.config);
      setEnvironment(cleanName);
      toast.success(`Created environment "${cleanName}"`);
    } else {
      toast.error(res.error || 'Failed to create environment');
    }
  };

  // Upload handler for repository documents (saves into staged repo folder on main)
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
          const newAtts: TestingAttachmentDocument[] = res.data.documents.map((doc: any) => ({
            id: doc.id,
            linkId: doc.id,
            documentId: doc.id,
            displayName: doc.displayName || doc.originalName || doc.name,
            originalName: doc.originalName || doc.name,
            mimeType: doc.mimeType,
            sizeBytes: doc.sizeBytes || doc.size || 0,
            repositoryPath: doc.repositoryPath || `${doc.branch || 'main'}:${doc.folder || 'defects'}`,
            branch: doc.branch || 'main',
            createdAt: new Date().toISOString(),
          }));
          setAttachments((prev) => [...prev, ...newAtts]);
          toast.success(`Uploaded ${res.data.documents.length} document(s) to folder "${res.data.folder}" on main`);
        }
        if (res.data.errors && res.data.errors.length > 0) {
          toast.error(res.data.errors[0]?.error || 'Some documents failed to upload');
        }

        // If editing an existing defect, immediately link the uploaded document
        if (editingDefect && res.data.documents) {
          for (const doc of res.data.documents) {
            await testingService.linkExistingDocument(projectId, {
              entityType: 'defect',
              entityId: editingDefect.id,
              documentId: doc.id,
            });
          }
          await refreshAttachments();
        }
      } else {
        toast.error(res.error || 'Failed to upload document');
      }
    } catch (err: any) {
      toast.error(err?.message || 'File upload failed');
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const refreshAttachments = async () => {
    if (!editingDefect) return;
    const detailRes = await testingService.getDefectDetail(projectId, editingDefect.id);
    if (detailRes.success && detailRes.data) {
      setAttachments(detailRes.data.attachments || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Defect title is required');
      return;
    }

    setSaving(true);
    try {
      const attachmentDocumentIds = [
        ...attachments.map((a) => a.documentId),
        ...uploadedDocs.map((d) => d.id),
      ];

      if (editingDefect) {
        const updatePayload: Record<string, any> = {
          title: title.trim(),
          description: description.trim() || null,
          moduleId: moduleId ? Number(moduleId) : null,
          submoduleId: submoduleId ? Number(submoduleId) : null,
          severity,
          priority,
          status,
          assigneeId: assigneeId ? Number(assigneeId) : null,
          environment: environment || null,
          buildVersion: buildVersion.trim() || null,
          stepsToReproduce: stepsToReproduce.trim() || null,
          expectedResult: expectedResult.trim() || null,
          actualResult: actualResult.trim() || null,
          linkedTestCaseId: linkedTestCaseId ? Number(linkedTestCaseId) : null,
          linkedDevTaskId: linkedDevTaskId ? Number(linkedDevTaskId) : null,
          linkedRequirementId: linkedRequirementId ? Number(linkedRequirementId) : null,
          attachmentDocumentIds,
        };

        const res = await testingService.updateDefect(projectId, editingDefect.id, updatePayload);
        if (res.success && res.data) {
          toast.success(`Defect ${res.data.defectKey} updated`);
          onSaved(res.data);
          onClose();
        } else {
          toast.error(res.error || 'Failed to update defect');
        }
      } else {
        const createPayload = {
          title: title.trim(),
          description: description.trim() || null,
          moduleId: moduleId ? Number(moduleId) : null,
          submoduleId: submoduleId ? Number(submoduleId) : null,
          projectSubmoduleId: projectSubmoduleId ? Number(projectSubmoduleId) : null,
          severity,
          priority,
          status,
          assigneeId: assigneeId ? Number(assigneeId) : null,
          environment: environment || null,
          buildVersion: buildVersion.trim() || null,
          stepsToReproduce: stepsToReproduce.trim() || null,
          expectedResult: expectedResult.trim() || null,
          actualResult: actualResult.trim() || null,
          linkedTestCaseId: linkedTestCaseId ? Number(linkedTestCaseId) : null,
          linkedDevTaskId: linkedDevTaskId ? Number(linkedDevTaskId) : null,
          linkedRequirementId: linkedRequirementId ? Number(linkedRequirementId) : null,
          attachmentDocumentIds,
        };

        const res = await testingService.createDefect(projectId, createPayload);
        if (res.success && res.data) {
          toast.success(`Defect ${res.data.defectKey} logged successfully`);
          onSaved(res.data);
          onClose();
        } else {
          toast.error(res.error || 'Failed to create defect');
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to save defect');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[75] flex justify-end">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/65 backdrop-blur-sm cursor-pointer"
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
                    {editingDefect ? `Edit ${editingDefect.defectKey}` : 'Create Defect'}
                  </h2>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                  {editingDefect
                    ? 'Updating defect definition preserves historical triage snapshots.'
                    : 'Report defect with steps to reproduce, severity, traceability, and evidence.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-white/[0.05] border border-white/10">
                  ESC
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Form Body */}
            <form
              id="defect-form"
              onSubmit={(e) => void handleSubmit(e)}
              className="flex-1 overflow-y-auto px-6 py-5 space-y-5 scrollbar-thin scrollbar-thumb-zinc-700"
            >
              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-200">
                  Defect Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Checkout modal hangs on invalid promo code submission"
                  className="w-full bg-[#14161F] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/60 transition-colors"
                />
              </div>

              {/* Application Module & Submodule */}
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
                  <label className="block text-xs font-medium text-zinc-300">Application Submodule</label>
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

              {/* Classification: Severity, Priority, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Severity</label>
                  <AnimatedSelect
                    options={severityOptions}
                    value={severity}
                    onChange={setSeverity}
                    searchPlaceholder={
                      permissions.canManageSettings ? 'Search or type name to add...' : 'Search severities...'
                    }
                    placeholder="Select severity..."
                    accentColor={accentColor}
                    onCreateOption={
                      permissions.canManageSettings ? handleCreateSeverity : undefined
                    }
                    createOptionLabel={(query) => `Add "${query}" severity`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Priority</label>
                  <AnimatedSelect
                    options={priorityOptions}
                    value={priority}
                    onChange={setPriority}
                    searchPlaceholder={
                      permissions.canManageSettings ? 'Search or type name to add...' : 'Search priorities...'
                    }
                    placeholder="Select priority..."
                    accentColor={accentColor}
                    onCreateOption={
                      permissions.canManageSettings ? handleCreatePriority : undefined
                    }
                    createOptionLabel={(query) => `Add "${query}" priority`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Status</label>
                  <AnimatedSelect
                    options={DEFECT_STATUS_OPTIONS}
                    value={status}
                    onChange={setStatus}
                    dropdownAlign="right"
                    placeholder="Select status..."
                    accentColor={accentColor}
                  />
                </div>
              </div>

              {/* Assignment & Environment: Assignee, Environment, Build Version */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Assigned Developer</label>
                  <AnimatedSelect
                    options={memberOptions}
                    value={assigneeId}
                    onChange={setAssigneeId}
                    placeholder="Assign developer..."
                    accentColor={accentColor}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Environment</label>
                  <AnimatedSelect
                    options={environmentOptions}
                    value={environment}
                    onChange={setEnvironment}
                    searchPlaceholder={
                      permissions.canManageSettings ? 'Search or type name to add...' : 'Search environments...'
                    }
                    placeholder="Select environment..."
                    accentColor={accentColor}
                    onCreateOption={
                      permissions.canManageSettings ? handleCreateEnvironment : undefined
                    }
                    createOptionLabel={(query) => `Add "${query}" environment`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Build Version</label>
                  <input
                    type="text"
                    value={buildVersion}
                    onChange={(e) => setBuildVersion(e.target.value)}
                    placeholder="e.g. v1.4.2-rc1"
                    className="w-full bg-[#14161F] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-zinc-500 focus:outline-none focus:border-rose-500/60 transition-colors"
                  />
                </div>
              </div>

              {/* Traceability: Linked Test Case, Linked Dev Task, Linked Requirement */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Linked Test Case</label>
                  <AnimatedSelect
                    options={testCaseOptions}
                    value={linkedTestCaseId}
                    onChange={setLinkedTestCaseId}
                    placeholder="None"
                    dropdownMinWidth="w-full"
                    accentColor={accentColor}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Linked Dev Task</label>
                  <AnimatedSelect
                    options={devTaskOptions}
                    value={linkedDevTaskId}
                    onChange={setLinkedDevTaskId}
                    placeholder="None"
                    dropdownMinWidth="w-full"
                    accentColor={accentColor}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Linked Requirement</label>
                  <AnimatedSelect
                    options={reqOptions}
                    value={linkedRequirementId}
                    onChange={setLinkedRequirementId}
                    placeholder="None"
                    dropdownMinWidth="w-full"
                    accentColor={accentColor}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">Problem Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summary of observed defect, impact on users, or edge conditions observed..."
                  className="w-full resize-none bg-[#14161F] border border-[#27272A] rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/60 transition-colors"
                />
              </div>

              {/* Steps to Reproduce */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">Steps to Reproduce</label>
                <textarea
                  rows={3}
                  value={stepsToReproduce}
                  onChange={(e) => setStepsToReproduce(e.target.value)}
                  placeholder={'1. Navigate to /checkout\n2. Enter invalid discount coupon\n3. Click Apply Coupon'}
                  className="w-full resize-none bg-[#14161F] border border-[#27272A] rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-zinc-500 focus:outline-none focus:border-rose-500/60 transition-colors"
                />
              </div>

              {/* Expected vs Actual Result */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-emerald-400">Expected Result</label>
                  <textarea
                    rows={2}
                    value={expectedResult}
                    onChange={(e) => setExpectedResult(e.target.value)}
                    placeholder="Validation warning appears: 'Invalid discount coupon'"
                    className="w-full resize-none bg-[#14161F] border border-[#27272A] rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-rose-400">Actual Result</label>
                  <textarea
                    rows={2}
                    value={actualResult}
                    onChange={(e) => setActualResult(e.target.value)}
                    placeholder="Application freezes with uncaught TypeError in console"
                    className="w-full resize-none bg-[#14161F] border border-[#27272A] rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/60 transition-colors"
                  />
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
                        Upload bug evidence directly to GitHub docs repo on branch <code className="text-emerald-300">main</code> in{' '}
                        <code className="text-emerald-300">defects</code>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={uploadingFiles}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/25 transition-colors disabled:opacity-50 cursor-pointer"
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
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewModalDoc({
                                url: documentService.getContentUrl(projectId, doc.id, false),
                                name: doc.displayName || doc.originalName,
                              })
                            }
                            className="p-1 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                            title="Preview document"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setUploadedDocs((prev) => prev.filter((d) => d.id !== doc.id))}
                            className="p-1 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Linked Attachments Panel (in edit mode) */}
              {editingDefect && (
                <TestingAttachmentsPanel
                  projectId={projectId}
                  entityType="defect"
                  entityId={editingDefect.id}
                  attachments={attachments}
                  availableDocuments={meta.projectDocuments}
                  canEdit={permissions.canManageDefects}
                  title="Attached Screenshots & Evidence"
                  onUpdated={() => void refreshAttachments()}
                />
              )}
            </form>

            {/* Fixed Sticky Footer Save Strip */}
            <div className="sticky bottom-0 bg-[#12141B] border-t border-[#27272A] px-6 py-4 flex items-center justify-between gap-3 shrink-0 z-20">
              <span className="text-[11px] text-zinc-500">
                {editingDefect ? `Modifying ${editingDefect.defectKey}` : 'Drafting new defect'}
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-300 bg-[#181A22] border border-[#27272A] hover:bg-[#202330] hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="defect-form"
                  disabled={saving || uploadingFiles}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-lg disabled:opacity-50 transition-all hover:brightness-110 cursor-pointer"
                  style={{ backgroundColor: accentColor }}
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {saving ? 'Saving...' : editingDefect ? 'Save Changes' : 'Create Defect'}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Lightbox Modal for Direct Attachment / Document Preview */}
          <AnimatePresence>
            {previewModalDoc && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setPreviewModalDoc(null)}
                className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-full max-w-4xl max-h-[90vh] bg-[#12141C] border border-[#27272A] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                >
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#27272A] bg-[#161824]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-semibold text-white text-sm truncate">
                        {previewModalDoc.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewModalDoc(null)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[#090A0F] min-h-[300px]">
                    {previewModalDoc.url.match(/\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i) || previewModalDoc.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? (
                      <img
                        src={previewModalDoc.url}
                        alt={previewModalDoc.name}
                        className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                      />
                    ) : (
                      <iframe
                        src={previewModalDoc.url}
                        title={previewModalDoc.name}
                        className="w-full h-[70vh] rounded-lg border border-[#27272A]"
                      />
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
