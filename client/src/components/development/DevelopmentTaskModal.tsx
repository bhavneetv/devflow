import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  FileText,
  FolderGit2,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { developmentService } from '../../services/development.service';
import { useAccentTheme } from '../../services/accentTheme.service';
import { AnimatedMultiSelect, AnimatedSelect, type SelectOption } from '../settings/AnimatedSelect';
import { CustomDatePicker } from '../settings/CustomDatePicker';
import type {
  DevAssigneeGroups,
  DevGitCommitLink,
  DevMasterChoiceItem,
  DevTeamOption,
  DevUser,
  DevelopmentModuleMaster,
  DevelopmentProjectConfig,
  DevelopmentTaskAttachment,
  DevelopmentTaskItem,
} from '../../types/development';
import { DEFAULT_DEV_TASK_TYPES, DEV_PRIORITIES } from '../../types/development';
import { MasterIconBadge, getMasterIconComponent } from './devIcons';
import {
  getTaskTypeStyle,
  isDevelopmentTaskType,
  isEndStatusName,
} from './devBadges';
import { CommitCompletionModal } from './CommitCompletionModal';

interface DevelopmentTaskModalProps {
  isOpen: boolean;
  projectId: number;
  taskToEdit?: DevelopmentTaskItem | null;
  modules: DevelopmentModuleMaster[];
  eligibleMembers: DevUser[];
  assigneeGroups?: DevAssigneeGroups;
  config: DevelopmentProjectConfig;
  canManageMasters: boolean;
  onClose: () => void;
  onSaved: (saved: DevelopmentTaskItem, mode: 'create' | 'edit') => void;
  onModulesUpdated: () => Promise<void> | void;
}

interface PendingUploadFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  base64: string;
}

interface UploadedDocItem {
  id: number;
  displayName: string;
  originalName: string;
  mimeType?: string;
  sizeBytes: number;
  branch: string;
  repositoryPath: string;
}

const DEFAULT_PRIORITY_CHOICES: DevMasterChoiceItem[] = [
  { name: 'Critical', icon: 'Flame', color: '#EF4444' },
  { name: 'High', icon: 'ArrowUp', color: '#F97316' },
  { name: 'Medium', icon: 'Minus', color: '#F59E0B' },
  { name: 'Low', icon: 'ArrowDown', color: '#3B82F6' },
];

const DEFAULT_STATUS_CHOICES: DevMasterChoiceItem[] = [
  { name: 'Not Started', icon: 'Circle', color: '#71717A' },
  { name: 'In Progress', icon: 'Zap', color: '#3B82F6' },
  { name: 'In Review', icon: 'Eye', color: '#8B5CF6' },
  { name: 'Blocked', icon: 'AlertTriangle', color: '#EF4444' },
  { name: 'Completed', icon: 'CheckCircle2', color: '#10B981' },
];

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getLocalTodayDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysToDateStr(baseDateStr: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(baseDateStr);
  const d = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      const idx = res.indexOf('base64,');
      resolve(idx >= 0 ? res.slice(idx + 7) : res);
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function UserAvatarIcon({ user }: { user: DevUser }) {
  const bg = user.avatarColor || '#8B5CF6';
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        className="w-5 h-5 rounded-full object-cover border shrink-0"
        style={{ borderColor: `${bg}80` }}
      />
    );
  }
  return (
    <span
      className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[9px] font-bold text-white shrink-0 border border-white/15"
      style={{ backgroundColor: bg }}
    >
      {getInitials(user.name)}
    </span>
  );
}

export const DevelopmentTaskModal: React.FC<DevelopmentTaskModalProps> = ({
  isOpen,
  projectId,
  taskToEdit,
  modules,
  eligibleMembers,
  assigneeGroups,
  config,
  canManageMasters,
  onClose,
  onSaved,
  onModulesUpdated,
}) => {
  const { accentColor } = useAccentTheme();
  const isEdit = Boolean(taskToEdit);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Section A — Task Details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [moduleId, setModuleId] = useState<string>('');
  const [submoduleId, setSubmoduleId] = useState<string>('');

  // Section B — Assignment (selected teams + extra individual members) & Classification
  const [taskType, setTaskType] = useState<string>('Development');
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [individualMemberIds, setIndividualMemberIds] = useState<number[]>([]);
  const [priority, setPriority] = useState<string>('Medium');
  const [status, setStatus] = useState<string>('Not Started');
  const [pendingCommitModal, setPendingCommitModal] = useState(false);

  // Section C — Schedule (Start Date defaults to Today on create)
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Section D — Attachments
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocItem[]>([]);
  const [stagedFiles, setStagedFiles] = useState<PendingUploadFile[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<DevelopmentTaskAttachment[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayStr = getLocalTodayDateStr();

  // Active modules & submodules filtered by selection
  const activeModules = useMemo(() => modules.filter((m) => !m.isArchived), [modules]);
  const selectedModule = useMemo(
    () => activeModules.find((m) => String(m.id) === moduleId) || null,
    [activeModules, moduleId]
  );
  const availableSubmodules = useMemo(
    () => (selectedModule ? selectedModule.submodules.filter((s) => !s.isArchived) : []),
    [selectedModule]
  );

  // Priority & Status Master Items from Project Master Data
  const priorityChoices: DevMasterChoiceItem[] = useMemo(() => {
    if (config.priorityItems && config.priorityItems.length > 0) return config.priorityItems;
    if (config.priorities && config.priorities.length > 0) {
      return config.priorities.map((p) => {
        const def = DEFAULT_PRIORITY_CHOICES.find((d) => d.name.toLowerCase() === p.toLowerCase());
        return def || { name: p, icon: 'Flag', color: '#F59E0B' };
      });
    }
    return DEV_PRIORITIES.map(
      (p) => DEFAULT_PRIORITY_CHOICES.find((d) => d.name === p) || { name: p, icon: 'Flag', color: '#F59E0B' }
    );
  }, [config]);

  const statusChoices: DevMasterChoiceItem[] = useMemo(() => {
    if (config.statusItems && config.statusItems.length > 0) return config.statusItems;
    return config.statuses.map((s) => {
      const def = DEFAULT_STATUS_CHOICES.find((d) => d.name.toLowerCase() === s.toLowerCase());
      return def || { name: s, icon: 'Circle', color: '#71717A' };
    });
  }, [config]);

  const taskTypeChoices: string[] = useMemo(() => {
    const merged = [
      'Development',
      'Research',
      ...(config.taskTypes && config.taskTypes.length > 0
        ? config.taskTypes
        : Array.from(DEFAULT_DEV_TASK_TYPES)),
    ];
    return Array.from(new Set(merged));
  }, [config.taskTypes]);

  // Populate form on open
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setUploadedDocs([]);
    setStagedFiles([]);
    setPendingCommitModal(false);

    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setModuleId(String(taskToEdit.moduleId));
      setSubmoduleId(String(taskToEdit.submoduleId));
      setTaskType(taskToEdit.taskType || 'Development');
      const savedTeamIds =
        taskToEdit.teamIds && taskToEdit.teamIds.length > 0
          ? taskToEdit.teamIds
          : (taskToEdit.assignedTeams || []).map((t) => t.id);
      const coveredBySavedTeams = new Set<number>();
      for (const tid of savedTeamIds) {
        const team = teamLookup.get(tid) || (taskToEdit.assignedTeams || []).find((t) => t.id === tid);
        if (team) {
          for (const mid of team.memberIds || []) coveredBySavedTeams.add(mid);
        }
      }
      setSelectedTeamIds(savedTeamIds);
      setIndividualMemberIds(
        taskToEdit.assignees.map((a) => a.id).filter((id) => !coveredBySavedTeams.has(id))
      );
      setPriority(taskToEdit.priority);
      setStatus(taskToEdit.status);
      setStartDate(taskToEdit.startDate || '');
      setDueDate(taskToEdit.dueDate || '');
      setExistingAttachments(taskToEdit.attachments || []);
    } else {
      setTitle('');
      setDescription('');
      const firstMod = activeModules[0];
      setModuleId(firstMod ? String(firstMod.id) : '');
      const firstSub = firstMod?.submodules.find((s) => !s.isArchived);
      setSubmoduleId(firstSub ? String(firstSub.id) : '');
      setTaskType(taskTypeChoices[0] || 'Development');
      setSelectedTeamIds([]);
      setIndividualMemberIds([]);
      setPriority(priorityChoices.find((p) => p.name === 'Medium')?.name || priorityChoices[0]?.name || 'Medium');
      setStatus(statusChoices[0]?.name || 'Not Started');
      setStartDate(getLocalTodayDateStr());
      setDueDate('');
      setExistingAttachments([]);
    }
  }, [isOpen, taskToEdit]);

  // Ensure submodule belongs to current module when module switches
  useEffect(() => {
    if (!isOpen) return;
    if (!moduleId) {
      setSubmoduleId('');
      return;
    }
    const stillValid = availableSubmodules.some((s) => String(s.id) === submoduleId);
    if (!stillValid) {
      setSubmoduleId(availableSubmodules[0] ? String(availableSubmodules[0].id) : '');
    }
  }, [moduleId, availableSubmodules, isOpen]);

  // Build grouped assignee options in order:
  // 1) Teams Assigned to Project -> 2) Members Linked to Project -> 3) All Teams -> 4) All Members
  const projectTeamsList = assigneeGroups?.teams || [];
  const allOtherTeamsList = assigneeGroups?.allTeams || [];
  const projectMembersList =
    assigneeGroups?.projectMembers && assigneeGroups.projectMembers.length > 0
      ? assigneeGroups.projectMembers
      : eligibleMembers;
  const orgMembersList = assigneeGroups?.orgMembers || [];

  const teamLookup = useMemo(() => {
    const map = new Map<number, DevTeamOption>();
    for (const t of [...projectTeamsList, ...allOtherTeamsList]) {
      if (!map.has(t.id)) map.set(t.id, t);
    }
    return map;
  }, [projectTeamsList, allOtherTeamsList]);

  const memberLookup = useMemo(() => {
    const map = new Map<number, DevUser>();
    for (const u of [...eligibleMembers, ...projectMembersList, ...orgMembersList]) {
      if (!map.has(u.id)) map.set(u.id, u);
    }
    return map;
  }, [eligibleMembers, projectMembersList, orgMembersList]);

  // Any member belonging to a currently selected team is disabled from individual selection
  const selectedTeamsMemberIdSet = useMemo(() => {
    const set = new Set<number>();
    for (const tid of selectedTeamIds) {
      const team = teamLookup.get(tid);
      if (team) {
        for (const mid of team.memberIds) set.add(mid);
      }
    }
    return set;
  }, [selectedTeamIds, teamLookup]);

  const assigneeOptions: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = [];

    const buildTeamOpt = (team: DevTeamOption, groupName: string): SelectOption => {
      const TeamIcon = getMasterIconComponent(team.icon, Users);
      return {
        value: `team:${team.id}`,
        label: team.name,
        sublabel: `${team.memberCount} ${team.memberCount === 1 ? 'member' : 'members'}`,
        group: groupName,
        icon: (
          <span
            className="w-5 h-5 rounded-md inline-flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: `${team.color}25`,
              borderColor: `${team.color}65`,
              color: team.color,
            }}
          >
            <TeamIcon size={11} />
          </span>
        ),
      };
    };

    const buildMemberOpt = (m: DevUser, groupName: string, defaultRole: string): SelectOption => {
      const lockedByTeam = selectedTeamsMemberIdSet.has(m.id);
      return {
        value: `member:${m.id}`,
        label: m.name,
        sublabel: lockedByTeam
          ? 'Included in selected team'
          : m.projectRole || m.jobTitle || m.email || defaultRole,
        group: groupName,
        disabled: lockedByTeam,
        icon: <UserAvatarIcon user={m} />,
      };
    };

    // 1) Teams Assigned to Project
    for (const team of projectTeamsList) {
      opts.push(buildTeamOpt(team, 'Teams Assigned to Project'));
    }

    // 2) Members Linked to Project
    for (const m of projectMembersList) {
      opts.push(buildMemberOpt(m, 'Members Linked to Project', 'Project Member'));
    }

    // 3) All Teams
    for (const team of allOtherTeamsList) {
      opts.push(buildTeamOpt(team, 'All Teams'));
    }

    // 4) All Members
    const projectMemberIdSet = new Set(projectMembersList.map((m) => m.id));
    for (const m of orgMembersList) {
      if (projectMemberIdSet.has(m.id)) continue;
      opts.push(buildMemberOpt(m, 'All Members', 'Organization Member'));
    }

    return opts;
  }, [projectTeamsList, allOtherTeamsList, projectMembersList, orgMembersList, selectedTeamsMemberIdSet]);

  // Every selected value maps 1:1 to a unique option key (never duplicates or raw IDs)
  const multiSelectValues = useMemo(
    () => [
      ...selectedTeamIds.map((id) => `team:${id}`),
      ...individualMemberIds
        .filter((id) => !selectedTeamsMemberIdSet.has(id))
        .map((id) => `member:${id}`),
    ],
    [selectedTeamIds, individualMemberIds, selectedTeamsMemberIdSet]
  );

  const handleAssigneeMultiChange = (nextVals: string[]) => {
    const nextTeamIds: number[] = [];
    const nextMemberIds: number[] = [];

    for (const val of nextVals) {
      if (val.startsWith('team:')) {
        const tid = parseInt(val.slice(5), 10);
        if (!Number.isNaN(tid) && !nextTeamIds.includes(tid)) nextTeamIds.push(tid);
      } else if (val.startsWith('member:')) {
        const uid = parseInt(val.slice(7), 10);
        if (!Number.isNaN(uid) && !nextMemberIds.includes(uid)) nextMemberIds.push(uid);
      }
    }

    // Absorb any individual member covered by newly selected teams
    const coveredByTeams = new Set<number>();
    for (const tid of nextTeamIds) {
      const team = teamLookup.get(tid);
      if (team) {
        for (const mid of team.memberIds) coveredByTeams.add(mid);
      }
    }

    setSelectedTeamIds(nextTeamIds);
    setIndividualMemberIds(nextMemberIds.filter((uid) => !coveredByTeams.has(uid)));
  };

  // Inbuilt Module & Submodule creation inside the select bar
  const handleCreateModuleFromSelect = async (name: string) => {
    setError(null);
    const res = await developmentService.createModule(projectId, {
      name,
      color: '#10B981',
      icon: 'Layers',
    });
    if (!res.success || !res.data) {
      setError(res.error || 'Failed to create module.');
      return;
    }
    await onModulesUpdated();
    setModuleId(String(res.data.id));
    setSubmoduleId('');
  };

  const handleCreateSubmoduleFromSelect = async (name: string) => {
    if (!moduleId) {
      setError('Select an application module first.');
      return;
    }
    setError(null);
    const res = await developmentService.createSubmodule(projectId, {
      moduleId: Number(moduleId),
      name,
      icon: 'Box',
    });
    if (!res.success || !res.data) {
      setError(res.error || 'Failed to create submodule.');
      return;
    }
    await onModulesUpdated();
    setSubmoduleId(String(res.data.id));
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    e.target.value = '';
    if (fileList.length === 0) return;

    setError(null);
    setUploadingFiles(true);
    try {
      const prepared: PendingUploadFile[] = await Promise.all(
        fileList.map(async (f) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: f.name,
          mimeType: f.type || 'application/octet-stream',
          sizeBytes: f.size,
          base64: await readFileAsBase64(f),
        }))
      );

      if (!moduleId) {
        setStagedFiles((prev) => [...prev, ...prepared]);
        return;
      }

      const modNum = Number(moduleId);
      const res = await developmentService.uploadTaskAttachments(
        projectId,
        modNum,
        prepared.map((p) => ({ name: p.name, base64: p.base64, mimeType: p.mimeType }))
      );

      if (!res.success || !res.data) {
        setError(res.error || 'Failed to upload file(s) to repository.');
        return;
      }

      const docs = res.data.documents || [];
      if (isEdit && taskToEdit && docs.length > 0) {
        for (const doc of docs) {
          const linkRes = await developmentService.addAttachment(projectId, taskToEdit.id, {
            documentId: doc.id,
          });
          if (linkRes.success && linkRes.data) {
            setExistingAttachments((prev) => [linkRes.data!, ...prev]);
          }
        }
      } else {
        setUploadedDocs((prev) => [...prev, ...docs]);
      }

      if (res.data.errors && res.data.errors.length > 0) {
        setError(res.data.errors.map((err) => `${err.fileName}: ${err.error}`).join(' | '));
      }
    } catch (err: any) {
      setError(err?.message || 'Could not process selected file(s).');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleRemoveExistingAttachment = async (attId: number) => {
    if (!taskToEdit) return;
    const res = await developmentService.removeAttachment(projectId, taskToEdit.id, attId);
    if (res.success) {
      setExistingAttachments((prev) => prev.filter((a) => a.id !== attId));
    } else {
      setError(res.error || 'Failed to remove attachment.');
    }
  };

  const executeSave = async (chosenCommit?: DevGitCommitLink | null) => {
    const finalAssigneeIds = Array.from(
      new Set([...Array.from(selectedTeamsMemberIdSet), ...individualMemberIds])
    );

    setSubmitting(true);
    try {
      let finalDocumentIds = uploadedDocs.map((d) => d.id);

      // Upload any staged files queued before module selection
      if (stagedFiles.length > 0) {
        const uploadRes = await developmentService.uploadTaskAttachments(
          projectId,
          Number(moduleId),
          stagedFiles.map((s) => ({ name: s.name, base64: s.base64, mimeType: s.mimeType }))
        );
        if (!uploadRes.success || !uploadRes.data) {
          setSubmitting(false);
          setError(uploadRes.error || 'Failed to upload staged attachments.');
          return;
        }
        const newlyUploaded = uploadRes.data.documents || [];
        if (isEdit && taskToEdit) {
          for (const doc of newlyUploaded) {
            await developmentService.addAttachment(projectId, taskToEdit.id, { documentId: doc.id });
          }
        } else {
          finalDocumentIds = [...finalDocumentIds, ...newlyUploaded.map((d) => d.id)];
        }
        setStagedFiles([]);
      }

      if (isEdit && taskToEdit) {
        const res = await developmentService.updateTask(projectId, taskToEdit.id, {
          title: title.trim(),
          description: description.trim() || null,
          taskType: taskType || config.taskTypes[0] || 'Development',
          moduleId: Number(moduleId),
          submoduleId: Number(submoduleId),
          assigneeIds: finalAssigneeIds,
          teamIds: selectedTeamIds,
          priority,
          status,
          startDate: startDate || null,
          dueDate: dueDate || null,
          ...(chosenCommit !== undefined ? { gitCommit: chosenCommit } : {}),
        });
        setSubmitting(false);
        if (!res.success || !res.data) {
          setError(res.error || 'Failed to update task.');
          return;
        }
        setPendingCommitModal(false);
        onSaved(res.data, 'edit');
      } else {
        const res = await developmentService.createTask(projectId, {
          title: title.trim(),
          description: description.trim() || null,
          taskType: taskType || config.taskTypes[0] || 'Development',
          moduleId: Number(moduleId),
          submoduleId: Number(submoduleId),
          assigneeIds: finalAssigneeIds,
          teamIds: selectedTeamIds,
          priority,
          status,
          startDate: startDate || null,
          dueDate: dueDate || null,
          attachmentDocumentIds: finalDocumentIds,
          ...(chosenCommit !== undefined ? { gitCommit: chosenCommit } : {}),
        });
        setSubmitting(false);
        if (!res.success || !res.data) {
          setError(res.error || 'Failed to create task.');
          return;
        }
        setPendingCommitModal(false);
        onSaved(res.data, 'create');
      }
    } catch (err: any) {
      setSubmitting(false);
      setError(err?.message || 'Unexpected error while saving task.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || uploadingFiles) return;
    setError(null);

    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }
    if (!moduleId) {
      setError('Please select or create an application module.');
      return;
    }
    if (!submoduleId) {
      setError('Please select or create an application submodule.');
      return;
    }
    if (startDate && dueDate && dueDate < startDate) {
      setError('Due date cannot be earlier than start date.');
      return;
    }

    const wasAlreadyEnded = Boolean(
      isEdit && taskToEdit && isEndStatusName(taskToEdit.status, config.statusItems)
    );
    const nextIsEnd = isEndStatusName(status, config.statusItems);
    if (!wasAlreadyEnded && nextIsEnd && isDevelopmentTaskType(taskType)) {
      setPendingCommitModal(true);
      return;
    }

    await executeSave();
  };

  if (!isOpen) return null;

  const moduleOptions: SelectOption[] = activeModules.map((m) => ({
    value: String(m.id),
    label: m.name,
    sublabel: `${m.submodules.filter((s) => !s.isArchived).length} submodules`,
    icon: <MasterIconBadge icon={m.icon} color={m.color || '#10B981'} size={12} />,
  }));

  const submoduleOptions: SelectOption[] = availableSubmodules.map((s) => ({
    value: String(s.id),
    label: s.name,
    sublabel: s.description || undefined,
    icon: <MasterIconBadge icon={s.icon || 'Box'} color={selectedModule?.color || '#10B981'} size={12} />,
  }));

  const scheduleBaseDate = startDate || todayStr;
  const quickTodayTarget = startDate && startDate > todayStr ? startDate : todayStr;
  const quickTomorrowTarget = addDaysToDateStr(scheduleBaseDate, 1);
  const quickNext3DaysTarget = addDaysToDateStr(scheduleBaseDate, 3);

  return createPortal(
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-[130] flex justify-end bg-black/75 backdrop-blur-sm">
        <div className="flex-1" onClick={() => !submitting && onClose()} />
        <motion.div
          initial={{ x: '100%', opacity: 0.5 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.5 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="w-full max-w-2xl h-full bg-[#111319] border-l border-[#27272A] shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Drawer Header */}
          <div className="px-6 py-4 border-b border-[#27272A] flex items-center justify-between bg-[#151721]">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                {isEdit ? `Edit Work Item · ${taskToEdit?.taskKey}` : 'New Development Work Item'}
              </span>
              <h2 className="text-base sm:text-lg font-semibold text-white mt-0.5">
                {isEdit ? 'Update Development Task' : 'Create Development Task'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => !submitting && onClose()}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-[#1E202B] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Body */}
          <form id="dev-task-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/35 text-xs text-red-300">
                {error}
              </div>
            )}

            {/* ── SECTION A: TASK DETAILS ─────────────────────────────────── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-[#27272A]/80 pb-2">
                <span
                  className="w-1.5 h-4 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-semibold">
                  Section A — Task Details
                </h3>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">
                  Task Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Implement OAuth token refresh middleware"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0D0F14] border border-[#27272A] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Description</label>
                <textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Technical requirements, acceptance criteria, implementation notes..."
                  className="w-full min-h-[128px] max-h-[128px] px-3.5 py-3 rounded-xl bg-[#0D0F14] border border-[#27272A] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none leading-relaxed"
                />
              </div>

              {/* Application Module & Submodule with inbuilt type-to-add creation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 block">
                    Application Module <span className="text-red-400">*</span>
                  </label>
                  <AnimatedSelect
                    value={moduleId}
                    onChange={(val) => setModuleId(val)}
                    options={moduleOptions}
                    searchPlaceholder={
                      canManageMasters
                        ? 'Search or type name to add...'
                        : 'Search modules...'
                    }
                    placeholder={
                      activeModules.length === 0
                        ? 'Type module name to create...'
                        : 'Select module...'
                    }
                    emptyMessage="Type a name above to create a module"
                    accentColor={accentColor}
                    onCreateOption={canManageMasters ? handleCreateModuleFromSelect : undefined}
                    createOptionLabel={(name) => `Add "${name}" module`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 block">
                    Application Submodule <span className="text-red-400">*</span>
                  </label>
                  <AnimatedSelect
                    value={submoduleId}
                    onChange={(val) => setSubmoduleId(val)}
                    options={submoduleOptions}
                    searchPlaceholder={
                      canManageMasters
                        ? 'Search or type name to add...'
                        : 'Search submodules...'
                    }
                    placeholder={
                      !moduleId
                        ? 'Select a module first...'
                        : availableSubmodules.length === 0
                        ? 'Type submodule name to create...'
                        : 'Select submodule...'
                    }
                    emptyMessage="Type a name above to add a submodule"
                    disabled={!moduleId}
                    accentColor={accentColor}
                    onCreateOption={
                      canManageMasters && moduleId ? handleCreateSubmoduleFromSelect : undefined
                    }
                    createOptionLabel={(name) => `Add "${name}" submodule`}
                  />
                </div>
              </div>
            </section>

            {/* ── SECTION B: ASSIGNMENT & CLASSIFICATION ──────────────────── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-[#27272A]/80 pb-2">
                <span
                  className="w-1.5 h-4 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-semibold">
                  Section B — Assignment
                </h3>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300">Assigned To</label>
                <AnimatedMultiSelect
                  values={multiSelectValues}
                  onChange={handleAssigneeMultiChange}
                  options={assigneeOptions}
                  searchPlaceholder="Search teams or members..."
                  placeholder="Select teams or members..."
                  accentColor={accentColor}
                />

                {(selectedTeamIds.length > 0 || individualMemberIds.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedTeamIds.map((tid) => {
                      const team = teamLookup.get(tid);
                      if (!team) return null;
                      const TeamIcon = getMasterIconComponent(team.icon, Users);
                      return (
                        <span
                          key={`chip-team-${tid}`}
                          className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-full border text-[11px] text-white"
                          style={{
                            backgroundColor: `${team.color}1C`,
                            borderColor: `${team.color}55`,
                          }}
                        >
                          <TeamIcon size={11} style={{ color: team.color }} />
                          <span>{team.name}</span>
                          <span className="text-[10px] font-mono text-zinc-400">
                            ({team.memberCount})
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedTeamIds((prev) => prev.filter((id) => id !== tid))
                            }
                            className="text-zinc-400 hover:text-white"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      );
                    })}

                    {individualMemberIds
                      .filter((uid) => !selectedTeamsMemberIdSet.has(uid))
                      .map((uid) => {
                        const member = memberLookup.get(uid);
                        if (!member) return null;
                        return (
                          <span
                            key={`chip-member-${uid}`}
                            className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full bg-[#191C26] border border-[#27272A] text-[11px] text-zinc-200"
                          >
                            <UserAvatarIcon user={member} />
                            <span>{member.name}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setIndividualMemberIds((prev) => prev.filter((id) => id !== uid))
                              }
                              className="text-zinc-400 hover:text-white"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Task Type</label>
                  <AnimatedSelect
                    value={taskType}
                    onChange={(val) => setTaskType(val)}
                    options={taskTypeChoices.map((tt) => {
                      const st = getTaskTypeStyle(tt);
                      const TypeIcon = st.icon;
                      return {
                        value: tt,
                        label: tt,
                        icon: (
                          <span
                            className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                            style={{ backgroundColor: st.bg, color: st.color }}
                          >
                            <TypeIcon size={10} />
                          </span>
                        ),
                      };
                    })}
                    accentColor={accentColor}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Priority</label>
                  <AnimatedSelect
                    value={priority}
                    onChange={(val) => setPriority(val)}
                    options={priorityChoices.map((p) => ({
                      value: p.name,
                      label: p.name,
                      icon: <MasterIconBadge icon={p.icon} color={p.color} size={11} />,
                    }))}
                    accentColor={accentColor}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Status</label>
                  <AnimatedSelect
                    value={status}
                    onChange={(val) => setStatus(val)}
                    options={statusChoices.map((s) => ({
                      value: s.name,
                      label: s.name,
                      icon: <MasterIconBadge icon={s.icon} color={s.color} size={11} />,
                    }))}
                    accentColor={accentColor}
                  />
                </div>
              </div>
            </section>

            {/* ── SECTION C: SCHEDULE ─────────────────────────────────────── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-[#27272A]/80 pb-2">
                <span
                  className="w-1.5 h-4 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-semibold">
                  Section C — Schedule
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5 min-h-[22px]">
                    <Calendar size={12} className="text-zinc-400" /> Start Date
                  </label>
                  <CustomDatePicker
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="Select start date..."
                    presetMode="start"
                    align="left"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap min-h-[22px]">
                    <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                      <Calendar size={12} className="text-zinc-400" /> Due Date
                    </label>
                    <div className="flex items-center gap-1">
                      {[
                        { label: 'Today', target: quickTodayTarget },
                        { label: 'Tomorrow', target: quickTomorrowTarget },
                        { label: 'Next 3 Days', target: quickNext3DaysTarget },
                      ].map((preset) => {
                        const active = dueDate === preset.target;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setDueDate(preset.target)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors ${
                              active
                                ? 'text-white border-emerald-500/50 bg-emerald-500/20'
                                : 'text-zinc-400 border-white/[0.08] bg-white/[0.03] hover:text-zinc-200 hover:border-white/[0.18]'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <CustomDatePicker
                    value={dueDate}
                    onChange={setDueDate}
                    placeholder="Select due date..."
                    presetMode="end"
                    align="right"
                  />
                </div>
              </div>
            </section>

            {/* ── SECTION D: ATTACHMENTS (DIRECT REPO UPLOAD) ─────────────── */}
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#27272A]/80 pb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-4 rounded-full"
                    style={{ backgroundColor: accentColor }}
                  />
                  <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-semibold">
                    Section D — Attachments
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-400">
                  <FolderGit2 size={11} className="text-emerald-400" />
                  {moduleId ? `main · module-${moduleId}` : 'main · selected module folder'}
                </span>
              </div>

              <div className="rounded-xl border border-dashed border-[#2A2E3B] bg-[#0D0F14]/80 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                    <Paperclip size={13} className="text-zinc-400" />
                    Upload task files to project repository
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Files commit into{' '}
                    <code className="text-zinc-300">
                      {moduleId ? `module-${moduleId}/attachments` : 'module-<id>/attachments'}
                    </code>{' '}
                    on the <code className="text-zinc-300">main</code> branch.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFilesSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploadingFiles || submitting}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm disabled:opacity-50 transition-opacity shrink-0"
                  style={{ backgroundColor: accentColor }}
                >
                  {uploadingFiles ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  {uploadingFiles ? 'Uploading...' : 'Upload'}
                </button>
              </div>

              {(existingAttachments.length > 0 || uploadedDocs.length > 0 || stagedFiles.length > 0) && (
                <div className="space-y-2">
                  {existingAttachments.map((att) => (
                    <div
                      key={`existing-${att.id}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0D0F14] border border-[#27272A]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText size={14} className="text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-zinc-200 truncate">{att.fileName}</div>
                          <div className="text-[10px] font-mono text-zinc-500">
                            {formatFileSize(att.fileSize)}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveExistingAttachment(att.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                        title="Remove attachment"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}

                  {uploadedDocs.map((doc) => (
                    <div
                      key={`uploaded-${doc.id}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0D0F14] border border-emerald-500/30"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText size={14} className="text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-white truncate">{doc.displayName}</div>
                          <div className="text-[10px] font-mono text-zinc-500 truncate">
                            {doc.branch} · {doc.repositoryPath} · {formatFileSize(doc.sizeBytes)}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUploadedDocs((prev) => prev.filter((d) => d.id !== doc.id))}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                        title="Unlink from task"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}

                  {stagedFiles.map((sf) => (
                    <div
                      key={sf.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0D0F14] border border-amber-500/30"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText size={14} className="text-amber-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-zinc-200 truncate">{sf.name}</div>
                          <div className="text-[10px] font-mono text-amber-300/80">
                            Queued for upload ({formatFileSize(sf.sizeBytes)})
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStagedFiles((prev) => prev.filter((item) => item.id !== sf.id))}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </form>

          {/* Sticky Footer */}
          <div className="px-6 py-4 border-t border-[#27272A] bg-[#151721] flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={submitting || uploadingFiles}
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#1A1C26] border border-[#27272A] text-xs font-medium text-zinc-300 hover:text-white hover:border-[#3A3A48] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="dev-task-form"
              disabled={submitting || uploadingFiles}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
    <CommitCompletionModal
      isOpen={pendingCommitModal}
      projectId={projectId}
      taskKey={isEdit && taskToEdit ? taskToEdit.taskKey : undefined}
      taskTitle={title.trim() || 'Development Task'}
      targetStatus={status}
      mode="complete"
      existingCommit={isEdit && taskToEdit ? taskToEdit.gitCommit : null}
      isSubmitting={submitting}
      onCancel={() => {
        if (!submitting) setPendingCommitModal(false);
      }}
      onConfirm={async (commit) => {
        await executeSave(commit);
      }}
    />
    </>,
    document.body
  );
};
