import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pin,
  ChevronDown,
  GripVertical,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Check,
  X,
  Search,
  PanelLeft,
  Folder,
  CircleDot,
  MoveRight,
  Layers,
  Boxes,
  Info,
  Loader2,
  FolderKanban,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
} from 'lucide-react';
import { useAccentTheme } from '../../services/accentTheme.service';
import { useToast } from '../../context/ToastContext';
import { useNavigation } from '../../context/NavigationContext';
import { projectModuleService } from '../../services/projectModule.service';
import { ModuleIconPicker, resolveModuleIcon } from '../../components/project/ModuleIconPicker';
import {
  ProjectModule,
  ProjectSubmodule,
  BUILT_IN_SUBMODULE_DEFINITIONS,
  BuiltInSubmoduleDefinition,
} from '../../types/module';
import { cn } from '../../lib/utils';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';

interface SidebarOrderSettingsViewProps {
  projectId: number;
}

export const SidebarOrderSettingsView: React.FC<SidebarOrderSettingsViewProps> = ({ projectId }) => {
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();
  const { refreshProjectModules, activeProject } = useNavigation();

  // Modules state
  const [modules, setModules] = useState<ProjectModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Virtual Sidebar view modes
  const [sidebarViewMode, setSidebarViewMode] = useState<'expanded' | 'collapsed'>('expanded');
  const [showHiddenGhost, setShowHiddenGhost] = useState(true);
  const [expandedVirtualIds, setExpandedVirtualIds] = useState<Record<number, boolean>>({});

  // Search in pre-built catalog
  const [catalogSearch, setCatalogSearch] = useState('');

  // Modals state
  const [isCreateModuleOpen, setIsCreateModuleOpen] = useState(false);
  const [moduleFormName, setModuleFormName] = useState('');
  const [moduleFormDesc, setModuleFormDesc] = useState('');
  const [moduleFormIcon, setModuleFormIcon] = useState('folder');
  const [moduleFormPinned, setModuleFormPinned] = useState(false);

  const [editingModule, setEditingModule] = useState<ProjectModule | null>(null);
  const [editModuleFormName, setEditModuleFormName] = useState('');
  const [editModuleFormDesc, setEditModuleFormDesc] = useState('');
  const [editModuleFormIcon, setEditModuleFormIcon] = useState('folder');
  const [editModuleFormPinned, setEditModuleFormPinned] = useState(false);

  const [createSubmoduleTargetModuleId, setCreateSubmoduleTargetModuleId] = useState<number | null>(null);
  const [submoduleFormName, setSubmoduleFormName] = useState('');
  const [submoduleFormIcon, setSubmoduleFormIcon] = useState('circle-dot');
  const [submoduleFormType, setSubmoduleFormType] = useState<'custom' | 'built_in'>('custom');
  const [submoduleFormBuiltInKey, setSubmoduleFormBuiltInKey] = useState<string>('');
  const [submoduleFormPinned, setSubmoduleFormPinned] = useState(false);

  const [editingSubmodule, setEditingSubmodule] = useState<ProjectSubmodule | null>(null);
  const [editSubmoduleFormName, setEditSubmoduleFormName] = useState('');
  const [editSubmoduleFormIcon, setEditSubmoduleFormIcon] = useState('circle-dot');
  const [editSubmoduleFormPinned, setEditSubmoduleFormPinned] = useState(false);

  // Independent Page: Project Overview configuration
  const overviewPinnedKey = `devflow_proj_${projectId}_overview_pinned`;
  const overviewVisibleKey = `devflow_proj_${projectId}_overview_visible`;
  const [isOverviewPinned, setIsOverviewPinned] = useState<boolean>(() => {
    return localStorage.getItem(overviewPinnedKey) !== 'false';
  });
  const [isOverviewVisible, setIsOverviewVisible] = useState<boolean>(() => {
    return localStorage.getItem(overviewVisibleKey) !== 'false';
  });

  const handleToggleOverviewPin = () => {
    const nextVal = !isOverviewPinned;
    setIsOverviewPinned(nextVal);
    localStorage.setItem(overviewPinnedKey, String(nextVal));
    window.dispatchEvent(new Event('devflow-sidebar-config-changed'));
    toast.success(
      nextVal ? 'Overview Pinned' : 'Overview Unpinned',
      `Project Overview is now ${nextVal ? 'pinned at the top' : 'in standard pages'}.`
    );
  };

  const handleToggleOverviewVisibility = () => {
    const nextVal = !isOverviewVisible;
    setIsOverviewVisible(nextVal);
    localStorage.setItem(overviewVisibleKey, String(nextVal));
    window.dispatchEvent(new Event('devflow-sidebar-config-changed'));
    toast.success(
      nextVal ? 'Overview Visible' : 'Overview Hidden',
      `Project Overview is now ${nextVal ? 'visible in' : 'hidden from'} sidebar.`
    );
  };

  const [movingSubmodule, setMovingSubmodule] = useState<ProjectSubmodule | null>(null);
  const [moveTargetModuleId, setMoveTargetModuleId] = useState<number | null>(null);

  const [deletingModule, setDeletingModule] = useState<ProjectModule | null>(null);
  const [deletingSubmodule, setDeletingSubmodule] = useState<ProjectSubmodule | null>(null);

  // Drag and Drop tracking
  const [draggingModuleId, setDraggingModuleId] = useState<number | null>(null);
  const [dragOverModuleId, setDragOverModuleId] = useState<number | null>(null);
  const [draggingSubmoduleId, setDraggingSubmoduleId] = useState<number | null>(null);
  const [dragOverSubmoduleId, setDragOverSubmoduleId] = useState<number | null>(null);
  const [dragSourceModuleId, setDragSourceModuleId] = useState<number | null>(null);

  // Sync with live app sidebar
  const syncSidebar = async () => {
    try {
      await refreshProjectModules(projectId);
    } catch {
      // non-blocking
    }
  };

  // Load modules
  const loadModules = async () => {
    try {
      setLoading(true);
      const res = await projectModuleService.getModules(projectId);
      if (res.success && Array.isArray(res.data)) {
        const sorted = [...res.data]
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((m) => ({
            ...m,
            submodules: [...(m.submodules || [])].sort(
              (a, b) => (a.position ?? 0) - (b.position ?? 0)
            ),
          }));
        setModules(sorted);
        const expands: Record<number, boolean> = {};
        sorted.forEach((m) => {
          expands[m.id] = true;
        });
        setExpandedVirtualIds(expands);
      } else {
        toast.error('Failed to load modules', res.error);
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModules();
  }, [projectId]);

  // Derived pinned & standard modules
  const pinnedModules = useMemo(() => {
    return modules.filter((m) => m.isPinned);
  }, [modules]);

  const regularModules = useMemo(() => {
    return modules.filter((m) => !m.isPinned);
  }, [modules]);

  // Derived individually pinned submodules across all modules
  const pinnedSubmodules = useMemo(() => {
    const list: Array<{ sub: ProjectSubmodule; parentModule: ProjectModule }> = [];
    modules.forEach((mod) => {
      (mod.submodules || []).forEach((sub) => {
        if (sub.isPinned) {
          list.push({ sub, parentModule: mod });
        }
      });
    });
    return list;
  }, [modules]);

  // Check which built-in modules are already used
  const assignedBuiltInKeys = useMemo(() => {
    const keys = new Map<string, { moduleId: number; moduleName: string; submoduleName: string }>();
    modules.forEach((mod) => {
      (mod.submodules || []).forEach((sub) => {
        if (sub.type === 'built_in' && sub.builtInKey && sub.builtInKey !== 'whiteboard') {
          keys.set(sub.builtInKey, {
            moduleId: mod.id,
            moduleName: mod.name,
            submoduleName: sub.name,
          });
        }
      });
    });
    return keys;
  }, [modules]);

  // Toggle module expansion in virtual preview
  const toggleVirtualModule = (id: number) => {
    setExpandedVirtualIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // ─── Module Pin / Unpin ───────────────────────────────────────────────────────
  const handleTogglePinModule = async (mod: ProjectModule) => {
    try {
      const nextPinned = !mod.isPinned;
      const res = await projectModuleService.updateModule(projectId, mod.id, {
        isPinned: nextPinned,
      });
      if (res.success) {
        setModules((prev) =>
          prev.map((m) => (m.id === mod.id ? { ...m, isPinned: nextPinned } : m))
        );
        await syncSidebar();
        toast.success(
          nextPinned ? 'Module Pinned' : 'Module Unpinned',
          `"${mod.name}" is now ${nextPinned ? 'pinned at the top' : 'in standard modules'}.`
        );
      } else {
        toast.error('Failed to pin module', res.error);
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    }
  };

  // ─── Submodule Pin / Unpin ───────────────────────────────────────────────────
  const handleTogglePinSubmodule = async (sub: ProjectSubmodule) => {
    try {
      const nextPinned = !sub.isPinned;
      const res = await projectModuleService.updateSubmodule(projectId, sub.id, {
        isPinned: nextPinned,
      });
      if (res.success) {
        setModules((prev) =>
          prev.map((mod) => {
            if (mod.id !== sub.moduleId) return mod;
            return {
              ...mod,
              submodules: (mod.submodules || []).map((s) =>
                s.id === sub.id ? { ...s, isPinned: nextPinned } : s
              ),
            };
          })
        );
        await syncSidebar();
        toast.success(
          nextPinned ? 'Submodule Pinned' : 'Submodule Unpinned',
          `"${sub.name}" is now ${nextPinned ? 'pinned at the top' : 'in standard group'}.`
        );
      } else {
        toast.error('Failed to pin submodule', res.error);
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    }
  };

  // ─── Module Visibility Toggle ────────────────────────────────────────────────
  const handleToggleModuleVisibility = async (mod: ProjectModule) => {
    try {
      const nextVisible = !mod.isVisible;
      const res = await projectModuleService.updateModule(projectId, mod.id, {
        isVisible: nextVisible,
      });
      if (res.success) {
        setModules((prev) =>
          prev.map((m) => (m.id === mod.id ? { ...m, isVisible: nextVisible } : m))
        );
        await syncSidebar();
        toast.success(
          nextVisible ? 'Module Visible' : 'Module Hidden',
          `"${mod.name}" is ${nextVisible ? 'visible in' : 'hidden from'} sidebar.`
        );
      } else {
        toast.error('Failed to update visibility', res.error);
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    }
  };

  // ─── Submodule Visibility Toggle ─────────────────────────────────────────────
  const handleToggleSubmoduleVisibility = async (sub: ProjectSubmodule) => {
    try {
      const nextVisible = !sub.isVisible;
      const res = await projectModuleService.updateSubmodule(projectId, sub.id, {
        isVisible: nextVisible,
      });
      if (res.success) {
        setModules((prev) =>
          prev.map((mod) => {
            if (mod.id !== sub.moduleId) return mod;
            return {
              ...mod,
              submodules: (mod.submodules || []).map((s) =>
                s.id === sub.id ? { ...s, isVisible: nextVisible } : s
              ),
            };
          })
        );
        await syncSidebar();
        toast.success(
          nextVisible ? 'Submodule Visible' : 'Submodule Hidden',
          `"${sub.name}" is ${nextVisible ? 'visible in' : 'hidden from'} sidebar.`
        );
      } else {
        toast.error('Failed to update visibility', res.error);
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    }
  };

  // ─── Reorder Modules (Up / Down) ─────────────────────────────────────────────
  const handleMoveModule = async (moduleId: number, direction: 'up' | 'down') => {
    const currentIndex = modules.findIndex((m) => m.id === moduleId);
    if (currentIndex < 0) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= modules.length) return;

    const reordered = [...modules];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    const withUpdatedPositions = reordered.map((m, idx) => ({ ...m, position: idx }));
    setModules(withUpdatedPositions);

    try {
      await projectModuleService.reorderModules(
        projectId,
        reordered.map((m) => m.id)
      );
      await syncSidebar();
    } catch (err: any) {
      toast.error('Reorder failed', err.message);
      await loadModules();
    }
  };

  // ─── Drag & Drop for Modules ─────────────────────────────────────────────────
  const handleModuleDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData('text/plain', `module:${id}`);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingModuleId(id);
  };

  const handleModuleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    if (draggingModuleId && draggingModuleId !== id) {
      setDragOverModuleId(id);
    }
  };

  const handleModuleDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    setDragOverModuleId(null);
    if (!draggingModuleId || draggingModuleId === targetId) {
      setDraggingModuleId(null);
      return;
    }

    const currentIdx = modules.findIndex((m) => m.id === draggingModuleId);
    const targetIdx = modules.findIndex((m) => m.id === targetId);
    if (currentIdx < 0 || targetIdx < 0) return;

    const reordered = [...modules];
    const [removed] = reordered.splice(currentIdx, 1);
    reordered.splice(targetIdx, 0, removed);

    const withUpdatedPositions = reordered.map((m, idx) => ({ ...m, position: idx }));
    setModules(withUpdatedPositions);
    setDraggingModuleId(null);

    try {
      await projectModuleService.reorderModules(
        projectId,
        reordered.map((m) => m.id)
      );
      await syncSidebar();
      toast.success('Module Reordered', 'Updated sidebar module position.');
    } catch (err: any) {
      toast.error('Reorder failed', err.message);
      await loadModules();
    }
  };

  // ─── Submodule Reorder (Up / Down) ───────────────────────────────────────────
  const handleMoveSubmodule = async (
    moduleId: number,
    submoduleId: number,
    direction: 'up' | 'down'
  ) => {
    const parentModule = modules.find((m) => m.id === moduleId);
    if (!parentModule || !parentModule.submodules) return;

    const subList = [...parentModule.submodules];
    const currentIndex = subList.findIndex((s) => s.id === submoduleId);
    if (currentIndex < 0) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= subList.length) return;

    const [moved] = subList.splice(currentIndex, 1);
    subList.splice(targetIndex, 0, moved);

    const withUpdatedSubPositions = subList.map((s, idx) => ({ ...s, position: idx }));
    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, submodules: withUpdatedSubPositions } : m))
    );

    try {
      await projectModuleService.reorderSubmodules(
        projectId,
        moduleId,
        subList.map((s) => s.id)
      );
      await syncSidebar();
    } catch (err: any) {
      toast.error('Reorder failed', err.message);
      await loadModules();
    }
  };

  // ─── Drag & Drop for Submodules ──────────────────────────────────────────────
  const handleSubmoduleDragStart = (
    e: React.DragEvent,
    submoduleId: number,
    sourceModuleId: number
  ) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', `submodule:${submoduleId}`);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingSubmoduleId(submoduleId);
    setDragSourceModuleId(sourceModuleId);
  };

  const handleSubmoduleDragOver = (e: React.DragEvent, submoduleId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggingSubmoduleId && draggingSubmoduleId !== submoduleId) {
      setDragOverSubmoduleId(submoduleId);
    }
  };

  const handleSubmoduleDrop = async (
    e: React.DragEvent,
    targetSubmoduleId: number,
    targetModuleId: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSubmoduleId(null);

    if (!draggingSubmoduleId || draggingSubmoduleId === targetSubmoduleId) {
      setDraggingSubmoduleId(null);
      setDragSourceModuleId(null);
      return;
    }

    // Drop within same module
    if (dragSourceModuleId === targetModuleId) {
      const parentModule = modules.find((m) => m.id === targetModuleId);
      if (!parentModule || !parentModule.submodules) return;

      const subList = [...parentModule.submodules];
      const currentIdx = subList.findIndex((s) => s.id === draggingSubmoduleId);
      const targetIdx = subList.findIndex((s) => s.id === targetSubmoduleId);
      if (currentIdx < 0 || targetIdx < 0) return;

      const [moved] = subList.splice(currentIdx, 1);
      subList.splice(targetIdx, 0, moved);

      const withUpdatedSubPositions = subList.map((s, idx) => ({ ...s, position: idx }));
      setModules((prev) =>
        prev.map((m) => (m.id === targetModuleId ? { ...m, submodules: withUpdatedSubPositions } : m))
      );
      setDraggingSubmoduleId(null);
      setDragSourceModuleId(null);

      try {
        await projectModuleService.reorderSubmodules(
          projectId,
          targetModuleId,
          subList.map((s) => s.id)
        );
        await syncSidebar();
        toast.success('Submodule Reordered', 'Updated submodule position.');
      } catch (err: any) {
        toast.error('Reorder failed', err.message);
        await loadModules();
      }
    } else if (dragSourceModuleId) {
      // Cross-module move
      try {
        const res = await projectModuleService.moveSubmodule(
          projectId,
          draggingSubmoduleId,
          targetModuleId
        );
        if (res.success) {
          toast.success('Submodule Moved', 'Submodule relocated to target module.');
          await loadModules();
          await syncSidebar();
        }
      } catch (err: any) {
        toast.error('Move failed', err.message);
      } finally {
        setDraggingSubmoduleId(null);
        setDragSourceModuleId(null);
      }
    }
  };

  // ─── Create Module ───────────────────────────────────────────────────────────
  const handleOpenCreateModule = (pinned: boolean = false) => {
    setModuleFormName('');
    setModuleFormDesc('');
    setModuleFormIcon('folder');
    setModuleFormPinned(pinned);
    setIsCreateModuleOpen(true);
  };

  const handleSubmitCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleFormName.trim()) {
      toast.error('Name Required', 'Please enter a module title.');
      return;
    }

    try {
      setIsSaving(true);
      const res = await projectModuleService.createModule(projectId, {
        name: moduleFormName.trim(),
        description: moduleFormDesc.trim() || null,
        icon: moduleFormIcon,
        isVisible: true,
        isPinned: moduleFormPinned,
      });

      if (res.success && res.data) {
        toast.success(
          'Module Created',
          `"${res.data.name}" was added to ${res.data.isPinned ? 'pinned modules' : 'sidebar'}.`
        );
        setIsCreateModuleOpen(false);
        await loadModules();
        await syncSidebar();
      } else {
        toast.error('Failed to create module', res.error);
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Edit Module ─────────────────────────────────────────────────────────────
  const handleOpenEditModule = (mod: ProjectModule) => {
    setEditingModule(mod);
    setEditModuleFormName(mod.name);
    setEditModuleFormDesc(mod.description || '');
    setEditModuleFormIcon(mod.icon || 'folder');
    setEditModuleFormPinned(Boolean(mod.isPinned));
  };

  const handleSubmitEditModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModule) return;
    if (!editModuleFormName.trim()) {
      toast.error('Name Required', 'Please provide a module title.');
      return;
    }

    try {
      setIsSaving(true);
      const res = await projectModuleService.updateModule(projectId, editingModule.id, {
        name: editModuleFormName.trim(),
        description: editModuleFormDesc.trim() || null,
        icon: editModuleFormIcon,
        isPinned: editModuleFormPinned,
      });

      if (res.success && res.data) {
        toast.success('Module Updated', `"${res.data.name}" has been updated.`);
        setEditingModule(null);
        await loadModules();
        await syncSidebar();
      } else {
        toast.error('Update failed', res.error);
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Delete Module ───────────────────────────────────────────────────────────
  const handleConfirmDeleteModule = async () => {
    if (!deletingModule) return;
    try {
      setIsSaving(true);
      const res = await projectModuleService.deleteModule(projectId, deletingModule.id, {
        cascade: true,
      });
      if (res.success) {
        toast.success('Module Deleted', `"${deletingModule.name}" was removed.`);
        setDeletingModule(null);
        await loadModules();
        await syncSidebar();
      } else {
        toast.error('Delete failed', res.error);
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Create Submodule ────────────────────────────────────────────────────────
  const handleOpenCreateSubmodule = (
    moduleId: number,
    type: 'custom' | 'built_in' = 'custom',
    builtInDef?: BuiltInSubmoduleDefinition
  ) => {
    setCreateSubmoduleTargetModuleId(moduleId);
    setSubmoduleFormType(type);
    setSubmoduleFormPinned(false);
    if (type === 'built_in' && builtInDef) {
      setSubmoduleFormName(builtInDef.defaultName);
      setSubmoduleFormIcon(builtInDef.defaultIcon);
      setSubmoduleFormBuiltInKey(builtInDef.key);
    } else {
      setSubmoduleFormName('');
      setSubmoduleFormIcon('circle-dot');
      setSubmoduleFormBuiltInKey('');
    }
  };

  const handleSubmitCreateSubmodule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createSubmoduleTargetModuleId) return;
    if (!submoduleFormName.trim()) {
      toast.error('Name Required', 'Please enter a submodule title.');
      return;
    }

    try {
      setIsSaving(true);
      const res = await projectModuleService.createSubmodule(
        projectId,
        createSubmoduleTargetModuleId,
        {
          name: submoduleFormName.trim(),
          icon: submoduleFormIcon,
          type: submoduleFormType,
          builtInKey: submoduleFormType === 'built_in' ? submoduleFormBuiltInKey : null,
          isVisible: true,
          isPinned: submoduleFormPinned,
        }
      );

      if (res.success && res.data) {
        toast.success('Submodule Created', `"${res.data.name}" was added.`);
        setCreateSubmoduleTargetModuleId(null);
        await loadModules();
        await syncSidebar();
      } else {
        toast.error('Create failed', res.error);
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Edit Submodule ──────────────────────────────────────────────────────────
  const handleOpenEditSubmodule = (sub: ProjectSubmodule) => {
    setEditingSubmodule(sub);
    setEditSubmoduleFormName(sub.name);
    setEditSubmoduleFormIcon(sub.icon || 'circle-dot');
    setEditSubmoduleFormPinned(sub.isPinned ?? false);
  };

  const handleSubmitEditSubmodule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubmodule) return;
    if (!editSubmoduleFormName.trim()) {
      toast.error('Name Required', 'Please specify a title.');
      return;
    }

    try {
      setIsSaving(true);
      const res = await projectModuleService.updateSubmodule(projectId, editingSubmodule.id, {
        name: editSubmoduleFormName.trim(),
        icon: editSubmoduleFormIcon,
        isPinned: editSubmoduleFormPinned,
      });

      if (res.success && res.data) {
        toast.success('Submodule Updated', `"${res.data.name}" updated.`);
        setEditingSubmodule(null);
        await loadModules();
        await syncSidebar();
      } else {
        toast.error('Update failed', res.error);
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Delete Submodule ────────────────────────────────────────────────────────
  const handleConfirmDeleteSubmodule = async () => {
    if (!deletingSubmodule) return;
    try {
      setIsSaving(true);
      const res = await projectModuleService.deleteSubmodule(projectId, deletingSubmodule.id);
      if (res.success) {
        toast.success('Submodule Removed', `"${deletingSubmodule.name}" deleted.`);
        setDeletingSubmodule(null);
        await loadModules();
        await syncSidebar();
      } else {
        toast.error('Delete failed', res.error);
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Move Submodule to Another Module ────────────────────────────────────────
  const handleConfirmMoveSubmodule = async () => {
    if (!movingSubmodule || !moveTargetModuleId) return;
    try {
      setIsSaving(true);
      const res = await projectModuleService.moveSubmodule(
        projectId,
        movingSubmodule.id,
        moveTargetModuleId
      );
      if (res.success) {
        toast.success('Submodule Moved', `Moved "${movingSubmodule.name}".`);
        setMovingSubmodule(null);
        setMoveTargetModuleId(null);
        await loadModules();
        await syncSidebar();
      } else {
        toast.error('Move failed', res.error);
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Quick Add Built-in to First or Chosen Module ────────────────────────────
  const handleQuickAddBuiltIn = async (def: BuiltInSubmoduleDefinition, targetModId?: number) => {
    const destModuleId = targetModId || (modules.length > 0 ? modules[0].id : null);
    if (!destModuleId) {
      toast.error('No Module Found', 'Please create a module first to add this submodule.');
      return;
    }
    handleOpenCreateSubmodule(destModuleId, 'built_in', def);
  };

  // ─── Render Virtual Module Card Helper ──────────────────────────────────────
  const renderVirtualModuleCard = (mod: ProjectModule, index: number, isPinnedSection: boolean) => {
    const isExpanded = expandedVirtualIds[mod.id] ?? true;
    const ModIcon = resolveModuleIcon(mod.icon, Folder);
    const subList = mod.submodules || [];
    const isDragging = draggingModuleId === mod.id;
    const isDragOver = dragOverModuleId === mod.id;

    return (
      <div
        key={`vmod-${mod.id}`}
        draggable
        onDragStart={(e) => handleModuleDragStart(e, mod.id)}
        onDragOver={(e) => handleModuleDragOver(e, mod.id)}
        onDrop={(e) => handleModuleDrop(e, mod.id)}
        className={cn(
          'rounded-xl border transition-all duration-150 relative group/mod',
          !mod.isVisible
            ? 'bg-zinc-950/40 border-zinc-900 opacity-60'
            : isPinnedSection
            ? 'bg-[#15161B] border-amber-500/20 hover:border-amber-500/40'
            : 'bg-[#15161B] border-zinc-800/80 hover:border-zinc-700',
          isDragging && 'opacity-40 border-dashed border-indigo-500',
          isDragOver && 'border-indigo-500 ring-1 ring-indigo-500/30'
        )}
      >
        {/* Module Top Row */}
        <div className="flex items-center justify-between p-2 gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {/* Drag Handle */}
            <div
              className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300 p-0.5 rounded transition-colors"
              title="Drag to reorder"
            >
              <GripVertical size={13} />
            </div>

            {/* Expand / Collapse */}
            {sidebarViewMode === 'expanded' && (
              <button
                type="button"
                onClick={() => toggleVirtualModule(mod.id)}
                className="text-zinc-500 hover:text-zinc-200 p-0.5 rounded cursor-pointer"
              >
                <ChevronDown
                  size={13}
                  className={cn(
                    'transition-transform duration-150',
                    isExpanded ? '' : '-rotate-90'
                  )}
                />
              </button>
            )}

            {/* Module Icon & Name */}
            <ModIcon
              size={15}
              className={cn(
                'shrink-0',
                isPinnedSection ? 'text-amber-400' : 'text-zinc-400 group-hover/mod:text-zinc-200'
              )}
            />

            {sidebarViewMode === 'expanded' && (
              <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-zinc-200 truncate uppercase tracking-wider">
                  {mod.name}
                </span>
                {subList.length === 0 && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                    Independent Module
                  </span>
                )}
                {mod.isPinned && (
                  <Pin size={10} className="text-amber-400 shrink-0 fill-amber-400/20" />
                )}
                {!mod.isVisible && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-500 font-mono">
                    Hidden
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Module Action Controls */}
          {sidebarViewMode === 'expanded' && (
            <div className="flex items-center gap-1 shrink-0">
              {/* Order Up / Down Arrows */}
              <div className="flex items-center bg-[#1D1E24] rounded-lg p-0.5 border border-zinc-800">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => handleMoveModule(mod.id, 'up')}
                  className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors cursor-pointer"
                  title="Move Up"
                >
                  <ArrowUp size={11} />
                </button>
                <button
                  type="button"
                  disabled={index === (isPinnedSection ? pinnedModules.length - 1 : regularModules.length - 1)}
                  onClick={() => handleMoveModule(mod.id, 'down')}
                  className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors cursor-pointer"
                  title="Move Down"
                >
                  <ArrowDown size={11} />
                </button>
              </div>

              {/* Pin / Unpin Button */}
              <button
                type="button"
                onClick={() => handleTogglePinModule(mod)}
                className={cn(
                  'p-1.5 rounded-lg border text-xs transition-colors cursor-pointer',
                  mod.isPinned
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-[#1D1E24] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                )}
                title={mod.isPinned ? 'Unpin from Top' : 'Pin to Top'}
              >
                <Pin size={12} className={mod.isPinned ? 'fill-amber-400' : ''} />
              </button>

              {/* Hide / Show Toggle Button */}
              <button
                type="button"
                onClick={() => handleToggleModuleVisibility(mod)}
                className={cn(
                  'p-1.5 rounded-lg border text-xs transition-colors cursor-pointer',
                  mod.isVisible
                    ? 'bg-[#1D1E24] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-600 hover:text-zinc-400'
                )}
                title={mod.isVisible ? 'Hide from Sidebar' : 'Show in Sidebar'}
              >
                {mod.isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>

              {/* Edit Module Button */}
              <button
                type="button"
                onClick={() => handleOpenEditModule(mod)}
                className="p-1.5 rounded-lg bg-[#1D1E24] border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Edit Module Name & Icon"
              >
                <Edit2 size={12} />
              </button>

              {/* Add Submodule Button */}
              <button
                type="button"
                onClick={() => handleOpenCreateSubmodule(mod.id, 'custom')}
                className="p-1.5 rounded-lg bg-[#1D1E24] border border-zinc-800 text-zinc-400 hover:text-indigo-400 transition-colors cursor-pointer"
                title="Add Submodule to this module"
              >
                <Plus size={12} />
              </button>

              {/* Delete Module Button */}
              <button
                type="button"
                onClick={() => setDeletingModule(mod)}
                className="p-1.5 rounded-lg bg-[#1D1E24] border border-zinc-800 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                title="Delete Module"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Submodules List (Indented 12px via pl-3 matching live sidebar) */}
        {isExpanded && (
          <div
            className={cn(
              'space-y-1 pb-2 pt-1 border-t border-zinc-800/40',
              sidebarViewMode === 'expanded' ? 'pl-3 pr-2' : 'px-1'
            )}
          >
            {subList.length === 0 ? (
              sidebarViewMode === 'expanded' ? (
                <div className="flex items-center justify-between py-1 px-2 text-[11px] text-zinc-500 italic bg-zinc-900/20 rounded-lg">
                  <span>No submodules yet</span>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateSubmodule(mod.id, 'custom')}
                    className="text-indigo-400 hover:underline cursor-pointer not-italic text-[10px]"
                  >
                    + Add Submodule
                  </button>
                </div>
              ) : null
            ) : (
              subList.map((sub, sIdx) => {
                if (!sub.isVisible && !showHiddenGhost) return null;
                const SubIcon = resolveModuleIcon(sub.icon, CircleDot);
                const isSubDragging = draggingSubmoduleId === sub.id;
                const isSubDragOver = dragOverSubmoduleId === sub.id;

                return (
                  <div
                    key={`vsub-${sub.id}`}
                    draggable
                    onDragStart={(e) => handleSubmoduleDragStart(e, sub.id, mod.id)}
                    onDragOver={(e) => handleSubmoduleDragOver(e, sub.id)}
                    onDrop={(e) => handleSubmoduleDrop(e, sub.id, mod.id)}
                    className={cn(
                      'flex items-center justify-between p-1.5 rounded-lg border text-xs transition-colors group/sub',
                      !sub.isVisible
                        ? 'bg-zinc-950/40 border-zinc-900 text-zinc-500 opacity-60'
                        : 'bg-[#18191E] border-zinc-800/60 text-zinc-300 hover:border-zinc-700 hover:bg-[#1D1E24]',
                      isSubDragging && 'opacity-40 border-dashed border-indigo-500',
                      isSubDragOver && 'border-indigo-500 ring-1 ring-indigo-500/20'
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {/* Sub Drag Handle */}
                      <div
                        className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300 p-0.5 rounded transition-colors"
                        title="Drag to reorder"
                      >
                        <GripVertical size={11} />
                      </div>

                      <SubIcon size={13} className="text-zinc-400 shrink-0" />
                      {sidebarViewMode === 'expanded' && (
                        <div className="min-w-0 flex items-center gap-1.5 flex-1">
                          <span className="truncate text-xs font-medium text-zinc-300">
                            {sub.name}
                          </span>
                          {sub.isPinned && (
                            <Pin size={9} className="text-amber-400 fill-amber-400 shrink-0" />
                          )}
                          {!sub.isVisible && (
                            <span className="text-[9px] px-1 py-0.1 rounded bg-zinc-800 text-zinc-500 font-mono">
                              Hidden
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {sidebarViewMode === 'expanded' && (
                      <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover/sub:opacity-100 transition-opacity">
                        {/* Up / Down Submodule Reorder */}
                        <button
                          type="button"
                          disabled={sIdx === 0}
                          onClick={() => handleMoveSubmodule(mod.id, sub.id, 'up')}
                          className="p-1 text-zinc-500 hover:text-white disabled:opacity-20 cursor-pointer"
                          title="Move Up"
                        >
                          <ArrowUp size={10} />
                        </button>
                        <button
                          type="button"
                          disabled={sIdx === subList.length - 1}
                          onClick={() => handleMoveSubmodule(mod.id, sub.id, 'down')}
                          className="p-1 text-zinc-500 hover:text-white disabled:opacity-20 cursor-pointer"
                          title="Move Down"
                        >
                          <ArrowDown size={10} />
                        </button>

                        {/* Pin / Unpin Submodule Button */}
                        <button
                          type="button"
                          onClick={() => handleTogglePinSubmodule(sub)}
                          className={cn(
                            'p-1 rounded transition-colors cursor-pointer',
                            sub.isPinned
                              ? 'text-amber-400 hover:text-amber-300 bg-amber-500/10'
                              : 'text-zinc-500 hover:text-amber-400'
                          )}
                          title={sub.isPinned ? 'Unpin Submodule from Top' : 'Pin Submodule to Top (Quick Access)'}
                        >
                          <Pin size={11} className={sub.isPinned ? 'fill-amber-400' : ''} />
                        </button>

                        {/* Visibility */}
                        <button
                          type="button"
                          onClick={() => handleToggleSubmoduleVisibility(sub)}
                          className="p-1 text-zinc-500 hover:text-zinc-200 cursor-pointer"
                          title={sub.isVisible ? 'Hide from Sidebar' : 'Show in Sidebar'}
                        >
                          {sub.isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditSubmodule(sub)}
                          className="p-1 text-zinc-500 hover:text-white cursor-pointer"
                          title="Rename / Change Icon"
                        >
                          <Edit2 size={11} />
                        </button>

                        {/* Move to another module */}
                        {modules.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setMovingSubmodule(sub);
                              const other = modules.find((m) => m.id !== mod.id);
                              setMoveTargetModuleId(other ? other.id : null);
                            }}
                            className="p-1 text-zinc-500 hover:text-indigo-300 cursor-pointer"
                            title="Move to another module"
                          >
                            <MoveRight size={11} />
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => setDeletingSubmodule(sub)}
                          className="p-1 text-zinc-500 hover:text-rose-400 cursor-pointer"
                          title="Delete Submodule"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <SettingsPageHeader
        title="Sidebar Order & Virtual Preview"
        description="Preview and organize your live project sidebar. Drag or click arrows to reorder, pin key modules to the top, toggle visibility, and edit or add modules and submodules."
      />

      {/* Control & Mode Toolbar */}
      <div className="px-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[#121316] border border-[#27272A] rounded-2xl shadow-sm">
          {/* Left: View Mode & Visibility Options */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center p-0.5 bg-[#18191E] border border-zinc-800 rounded-xl">
              <button
                type="button"
                onClick={() => setSidebarViewMode('expanded')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                  sidebarViewMode === 'expanded'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                )}
              >
                <PanelLeftOpen size={13} />
                <span>Expanded (240px)</span>
              </button>
              <button
                type="button"
                onClick={() => setSidebarViewMode('collapsed')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                  sidebarViewMode === 'collapsed'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                )}
              >
                <PanelLeftClose size={13} />
                <span>Minimized (56px)</span>
              </button>
            </div>

            {/* Show Hidden Ghost Switch */}
            <button
              type="button"
              onClick={() => setShowHiddenGhost((prev) => !prev)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer',
                showHiddenGhost
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                  : 'bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-400'
              )}
              title="Show hidden items as ghosted in the virtual sidebar"
            >
              {showHiddenGhost ? <Eye size={13} className="text-indigo-400" /> : <EyeOff size={13} />}
              <span>{showHiddenGhost ? 'Showing Hidden (Ghosted)' : 'True Live Preview'}</span>
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenCreateModule(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              <Pin size={12} className="fill-amber-400/30" />
              <span>+ Pinned Module</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreateModule(false)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
              style={{ backgroundColor: accentColor }}
            >
              <Plus size={13} />
              <span>+ Add Module</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace: Virtual Sidebar Preview + Made Modules / Quick Controls */}
      <div className="px-6 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ─── COLUMN 1: VIRTUAL SIDEBAR PREVIEW (7 cols) ─────────────────── */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <PanelLeft size={16} className="text-zinc-400" />
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Virtual Sidebar Canvas
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <span className="text-[11px] text-zinc-500">
                {modules.length} modules • {pinnedModules.length} pinned to top
              </span>
            </div>

            {/* Virtual Sidebar Frame */}
            <div
              className={cn(
                'bg-[#0C0D10] border border-[#27272A] rounded-2xl shadow-2xl p-3.5 transition-all duration-300 ease-in-out',
                sidebarViewMode === 'collapsed' ? 'max-w-[100px] mx-auto' : 'w-full'
              )}
            >
              {/* Virtual App Header Simulation */}
              <div className="flex items-center gap-2.5 pb-3 mb-3 border-b border-zinc-800/80">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 font-bold text-xs shadow"
                  style={{ backgroundColor: accentColor }}
                >
                  <FolderKanban size={14} />
                </div>
                {sidebarViewMode === 'expanded' && (
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-zinc-200 truncate">
                      {activeProject?.title || 'DevFlow Workspace'}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-mono truncate">
                      Project Navigation
                    </p>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-zinc-500">
                  <Loader2 size={20} className="animate-spin text-zinc-400" />
                  <span className="text-xs font-mono">Loading virtual sidebar...</span>
                </div>
              ) : modules.length === 0 ? (
                <div className="py-12 px-4 text-center border border-dashed border-zinc-800 rounded-xl space-y-3">
                  <Boxes size={24} className="mx-auto text-zinc-600" />
                  <div>
                    <p className="text-xs font-semibold text-zinc-300">No Modules in Sidebar</p>
                    <p className="text-[11px] text-zinc-500 mt-1 max-w-xs mx-auto">
                      Add a new module or choose pre-built tools on the right to start designing your sidebar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateModule(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Create First Module</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* ──────────────── PINNED SECTION AT TOP ──────────────── */}
                  <div className="space-y-1.5">
                    {sidebarViewMode === 'expanded' ? (
                      <div className="flex items-center justify-between px-1 py-1 text-[10px] font-bold tracking-wider uppercase text-amber-400/90">
                        <div className="flex items-center gap-1.5">
                          <Pin size={11} className="fill-amber-400/30" />
                          <span>Pinned to Top</span>
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 font-mono text-[9px]">
                            {(isOverviewPinned ? 1 : 0) + pinnedModules.length + pinnedSubmodules.length}
                          </span>
                        </div>
                        <span className="text-[9px] text-zinc-500 font-normal">
                          Always visible at the top
                        </span>
                      </div>
                    ) : (
                      <div className="py-0.5 border-b border-amber-500/30 flex justify-center">
                        <Pin size={10} className="text-amber-400" />
                      </div>
                    )}

                    {/* 1. Pinned Project Overview Independent Page */}
                    {isOverviewPinned && (isOverviewVisible || showHiddenGhost) && (
                      <div
                        className={cn(
                          'flex items-center justify-between p-2 rounded-xl border transition-all',
                          !isOverviewVisible
                            ? 'bg-zinc-950/40 border-zinc-900 opacity-60'
                            : 'bg-[#15161B] border-amber-500/30 hover:border-amber-500/50'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <LayoutDashboard size={15} className="text-amber-400 shrink-0" />
                          {sidebarViewMode === 'expanded' && (
                            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-zinc-200 truncate uppercase tracking-wider">
                                Project Overview
                              </span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                                Core Page
                              </span>
                              {!isOverviewVisible && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-500 font-mono">
                                  Hidden
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {sidebarViewMode === 'expanded' && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={handleToggleOverviewPin}
                              className="p-1.5 rounded-lg border text-xs bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors cursor-pointer"
                              title="Unpin Overview from Top"
                            >
                              <Pin size={12} className="fill-amber-400" />
                            </button>
                            <button
                              type="button"
                              onClick={handleToggleOverviewVisibility}
                              className="p-1.5 rounded-lg border text-xs bg-[#1D1E24] border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                              title={isOverviewVisible ? 'Hide from Sidebar' : 'Show in Sidebar'}
                            >
                              {isOverviewVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. Pinned Entire Modules */}
                    {pinnedModules.map((mod, index) => {
                      if (!mod.isVisible && !showHiddenGhost) return null;
                      return renderVirtualModuleCard(mod, index, true);
                    })}

                    {/* 3. Individually Pinned Submodules */}
                    {pinnedSubmodules.map(({ sub, parentModule }) => {
                      if (!sub.isVisible && !showHiddenGhost) return null;
                      const SubIcon = resolveModuleIcon(sub.icon, CircleDot);
                      return (
                        <div
                          key={`vpinned-sub-${sub.id}`}
                          className={cn(
                            'flex items-center justify-between p-2 rounded-xl border transition-all',
                            !sub.isVisible
                              ? 'bg-zinc-950/40 border-zinc-900 opacity-60'
                              : 'bg-[#15161B] border-amber-500/25 hover:border-amber-500/45'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <SubIcon size={14} className="text-amber-400 shrink-0" />
                            {sidebarViewMode === 'expanded' && (
                              <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-zinc-200 truncate">
                                  {sub.name}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                                  in: {parentModule.name}
                                </span>
                                <Pin size={10} className="text-amber-400 fill-amber-400 shrink-0" />
                                {!sub.isVisible && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-500 font-mono">
                                    Hidden
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {sidebarViewMode === 'expanded' && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleTogglePinSubmodule(sub)}
                                className="p-1.5 rounded-lg border text-xs bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors cursor-pointer"
                                title="Unpin Submodule from Top"
                              >
                                <Pin size={12} className="fill-amber-400" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleSubmoduleVisibility(sub)}
                                className="p-1.5 rounded-lg border text-xs bg-[#1D1E24] border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                                title={sub.isVisible ? 'Hide from Sidebar' : 'Show in Sidebar'}
                              >
                                {sub.isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditSubmodule(sub)}
                                className="p-1.5 rounded-lg bg-[#1D1E24] border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                title="Edit Submodule"
                              >
                                <Edit2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Empty Pinned State */}
                    {!isOverviewPinned && pinnedModules.length === 0 && pinnedSubmodules.length === 0 && (
                      sidebarViewMode === 'expanded' ? (
                        <div className="px-3 py-2.5 border border-dashed border-zinc-800/80 rounded-xl text-center bg-zinc-900/30">
                          <p className="text-[11px] text-zinc-500">
                            No items pinned yet.{' '}
                            <span className="text-zinc-400">
                              Click the pin icon on Overview, any module, or individual submodules to place them at the top.
                            </span>
                          </p>
                        </div>
                      ) : null
                    )}
                  </div>

                  {/* ──────────────── STANDARD MODULES & PAGES SECTION ──────────────── */}
                  <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                    {sidebarViewMode === 'expanded' ? (
                      <div className="flex items-center justify-between px-1 py-1 text-[10px] font-bold tracking-wider uppercase text-zinc-400">
                        <div className="flex items-center gap-1.5">
                          <Layers size={11} />
                          <span>Main Modules & Pages</span>
                          <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono text-[9px]">
                            {regularModules.length + (!isOverviewPinned ? 1 : 0)}
                          </span>
                        </div>
                        <span className="text-[9px] text-zinc-500 font-normal">
                          Ordered navigation
                        </span>
                      </div>
                    ) : (
                      <div className="py-0.5 border-b border-zinc-800" />
                    )}

                    {/* Unpinned Project Overview Independent Page */}
                    {!isOverviewPinned && (isOverviewVisible || showHiddenGhost) && (
                      <div
                        className={cn(
                          'flex items-center justify-between p-2 rounded-xl border transition-all',
                          !isOverviewVisible
                            ? 'bg-zinc-950/40 border-zinc-900 opacity-60'
                            : 'bg-[#15161B] border-zinc-800/80 hover:border-zinc-700'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <LayoutDashboard size={15} className="text-zinc-400 shrink-0" />
                          {sidebarViewMode === 'expanded' && (
                            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-zinc-200 truncate uppercase tracking-wider">
                                Project Overview
                              </span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                                Core Page
                              </span>
                              {!isOverviewVisible && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-500 font-mono">
                                  Hidden
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {sidebarViewMode === 'expanded' && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={handleToggleOverviewPin}
                              className="p-1.5 rounded-lg border text-xs bg-[#1D1E24] border-zinc-800 text-zinc-400 hover:text-amber-300 transition-colors cursor-pointer"
                              title="Pin Overview to Top"
                            >
                              <Pin size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={handleToggleOverviewVisibility}
                              className="p-1.5 rounded-lg border text-xs bg-[#1D1E24] border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                              title={isOverviewVisible ? 'Hide from Sidebar' : 'Show in Sidebar'}
                            >
                              {isOverviewVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {regularModules.length === 0 && (pinnedModules.length > 0 || isOverviewPinned) ? (
                      <div className="px-3 py-2 text-center text-[11px] text-zinc-600 italic">
                        All regular modules are currently pinned to top.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {regularModules.map((mod, index) => {
                          if (!mod.isVisible && !showHiddenGhost) return null;
                          return renderVirtualModuleCard(mod, index, false);
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bottom Quick Add Module trigger */}
              {sidebarViewMode === 'expanded' && (
                <div className="mt-3 pt-3 border-t border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => handleOpenCreateModule(false)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-800/40 text-xs text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer font-medium"
                  >
                    <Plus size={13} />
                    <span>Add New Module to Sidebar</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ─── COLUMN 2: MADE MODULES CATALOG & QUICK CONTROLS (5 cols) ───── */}
          <div className="lg:col-span-5 space-y-4">
            {/* 1. Pre-built / Made Submodules Catalog */}
            <div className="bg-[#121316] border border-[#27272A] rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-amber-400" />
                  <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    Add Pre-Built Submodules
                  </h3>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {BUILT_IN_SUBMODULE_DEFINITIONS.length} Available
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Quickly add built-in DevFlow features into any module in your sidebar.
              </p>

              {/* Search catalog */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Filter pre-built tools (e.g. Issues, Board, Docs)..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#18191E] border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-600 transition-colors"
                />
                {catalogSearch && (
                  <button
                    type="button"
                    onClick={() => setCatalogSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Catalog Items */}
              <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                {BUILT_IN_SUBMODULE_DEFINITIONS.filter(
                  (def) =>
                    !catalogSearch.trim() ||
                    def.defaultName.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                    def.description.toLowerCase().includes(catalogSearch.toLowerCase())
                ).map((def) => {
                  const assigned = assignedBuiltInKeys.get(def.key);
                  const Icon = def.iconComponent;

                  return (
                    <div
                      key={def.key}
                      className={cn(
                        'flex items-center justify-between p-2.5 rounded-xl border transition-all',
                        assigned
                          ? 'bg-zinc-900/40 border-zinc-800/80 text-zinc-400'
                          : 'bg-[#18191E] border-zinc-800/90 text-zinc-200 hover:border-zinc-700'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                            assigned ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-800 text-indigo-400'
                          )}
                        >
                          <Icon size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-zinc-200 truncate">
                              {def.defaultName}
                            </span>
                            {assigned && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                                In: {assigned.moduleName}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-500 truncate">{def.description}</p>
                        </div>
                      </div>

                      {/* Add Action */}
                      <div className="shrink-0 ml-2">
                        {modules.length === 0 ? (
                          <span className="text-[10px] text-zinc-600 italic">Create module first</span>
                        ) : (
                          <div className="relative group/add">
                            <button
                              type="button"
                              onClick={() => handleQuickAddBuiltIn(def)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700/60 transition-colors cursor-pointer"
                            >
                              <Plus size={11} />
                              <span>Add</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Pinned Items & Modules Management Card */}
            <div className="bg-[#121316] border border-[#27272A] rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pin size={15} className="text-amber-400 fill-amber-400/20" />
                  <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    Pinned Items Manager
                  </h3>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {(isOverviewPinned ? 1 : 0) + pinnedModules.length + pinnedSubmodules.length} Pinned
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Pin pages, whole modules, or individual submodules directly to the top of your sidebar for immediate access.
              </p>

              <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                {/* Independent Page: Project Overview */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-[#18191E] border border-zinc-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <LayoutDashboard size={14} className="text-amber-400 shrink-0" />
                    <span className="text-xs font-medium text-zinc-200 truncate">
                      Project Overview
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                      Independent Page
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleOverviewPin}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                      isOverviewPinned
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700/50'
                    )}
                  >
                    <Pin size={11} className={isOverviewPinned ? 'fill-amber-400' : ''} />
                    <span>{isOverviewPinned ? 'Pinned' : 'Pin to Top'}</span>
                  </button>
                </div>

                {/* Modules & Submodules Pinning */}
                {modules.length === 0 ? (
                  <p className="text-xs text-zinc-600 italic">No custom modules created yet.</p>
                ) : (
                  modules.map((m) => {
                    const ModIcon = resolveModuleIcon(m.icon, Folder);
                    const subList = m.submodules || [];
                    return (
                      <div
                        key={`pin-card-${m.id}`}
                        className="rounded-xl bg-[#18191E] border border-zinc-800 overflow-hidden"
                      >
                        {/* Module Row */}
                        <div className="flex items-center justify-between p-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <ModIcon size={14} className="text-zinc-400 shrink-0" />
                            <span className="text-xs font-medium text-zinc-200 truncate">
                              {m.name}
                            </span>
                            {subList.length === 0 && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                                Independent
                              </span>
                            )}
                            {!m.isVisible && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-500">
                                Hidden
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleTogglePinModule(m)}
                            className={cn(
                              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                              m.isPinned
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700/50'
                            )}
                          >
                            <Pin size={11} className={m.isPinned ? 'fill-amber-400' : ''} />
                            <span>{m.isPinned ? 'Pinned' : 'Pin to Top'}</span>
                          </button>
                        </div>

                        {/* Submodule Rows for individual submodule pinning */}
                        {subList.length > 0 && (
                          <div className="pl-3 pr-2 pb-2 pt-1 border-t border-zinc-800/50 space-y-1 bg-[#141519]">
                            {subList.map((s) => {
                              const SubIcon = resolveModuleIcon(s.icon, CircleDot);
                              return (
                                <div
                                  key={`pin-sub-${s.id}`}
                                  className="flex items-center justify-between p-1.5 rounded-lg bg-[#18191E] border border-zinc-800/60 text-xs"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <SubIcon size={12} className="text-zinc-400 shrink-0" />
                                    <span className="truncate text-[11px] text-zinc-300">
                                      {s.name}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleTogglePinSubmodule(s)}
                                    className={cn(
                                      'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer',
                                      s.isPinned
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                        : 'bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700/40'
                                    )}
                                  >
                                    <Pin size={10} className={s.isPinned ? 'fill-amber-400' : ''} />
                                    <span>{s.isPinned ? 'Pinned' : 'Pin'}</span>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 3. Helpful Guidance Card */}
            <div className="p-4 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-zinc-300 font-semibold text-xs">
                <Info size={14} className="text-indigo-400" />
                <span>Sidebar Customization Rules</span>
              </div>
              <ul className="text-[11px] text-zinc-500 space-y-1.5 list-disc list-inside leading-relaxed">
                <li>
                  <strong className="text-zinc-400">Order:</strong> Drag the grip handle or click up/down arrows to position modules and submodules.
                </li>
                <li>
                  <strong className="text-zinc-400">Pin to Top:</strong> Pinned modules always render in the top navigation cluster.
                </li>
                <li>
                  <strong className="text-zinc-400">Hide / Show:</strong> Click the eye icon to hide modules or submodules from view without deleting data.
                </li>
                <li>
                  <strong className="text-zinc-400">Submodule Indentation:</strong> Submodules inherit a clean 12px indentation to differentiate from parent modules.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODAL: CREATE MODULE ────────────────────────────────────────────── */}
      <AnimatePresence>
        {isCreateModuleOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121316] border border-[#27272A] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Plus size={15} />
                  </div>
                  <h3 className="text-sm font-bold text-white">Create New Module</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModuleOpen(false)}
                  className="text-zinc-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitCreateModule} className="p-4 space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Module Title</label>
                  <input
                    type="text"
                    value={moduleFormName}
                    onChange={(e) => setModuleFormName(e.target.value)}
                    placeholder="e.g. Planning, Core Engine, Security"
                    maxLength={60}
                    autoFocus
                    className="w-full px-3.5 py-2.5 bg-[#18191E] border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Description <span className="text-zinc-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={moduleFormDesc}
                    onChange={(e) => setModuleFormDesc(e.target.value)}
                    placeholder="Brief description of this module section"
                    maxLength={150}
                    className="w-full px-3.5 py-2.5 bg-[#18191E] border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
                  />
                </div>

                {/* Pin to Top Checkbox */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#18191E] border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Pin size={14} className={moduleFormPinned ? 'text-amber-400 fill-amber-400' : 'text-zinc-500'} />
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">Pin to Top</p>
                      <p className="text-[10px] text-zinc-500">Show in the pinned section at the very top</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={moduleFormPinned}
                    onChange={(e) => setModuleFormPinned(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-700 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                </div>

                {/* Icon Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Choose Module Icon</label>
                  <div className="max-h-48 overflow-y-auto p-1 bg-[#18191E] border border-zinc-800 rounded-xl">
                    <ModuleIconPicker
                      value={moduleFormIcon}
                      onChange={setModuleFormIcon}
                      accentColor={accentColor}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsCreateModuleOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !moduleFormName.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 shadow-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    {isSaving ? 'Creating...' : 'Create Module'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: EDIT MODULE ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {editingModule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121316] border border-[#27272A] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Edit2 size={16} className="text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Edit Module</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingModule(null)}
                  className="text-zinc-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitEditModule} className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Module Title</label>
                  <input
                    type="text"
                    value={editModuleFormName}
                    onChange={(e) => setEditModuleFormName(e.target.value)}
                    maxLength={60}
                    className="w-full px-3.5 py-2.5 bg-[#18191E] border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Description</label>
                  <input
                    type="text"
                    value={editModuleFormDesc}
                    onChange={(e) => setEditModuleFormDesc(e.target.value)}
                    maxLength={150}
                    className="w-full px-3.5 py-2.5 bg-[#18191E] border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
                  />
                </div>

                {/* Pin to Top Checkbox */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#18191E] border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Pin size={14} className={editModuleFormPinned ? 'text-amber-400 fill-amber-400' : 'text-zinc-500'} />
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">Pin to Top</p>
                      <p className="text-[10px] text-zinc-500">Show in the pinned section at the very top</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={editModuleFormPinned}
                    onChange={(e) => setEditModuleFormPinned(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-700 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                </div>

                {/* Icon Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Choose Module Icon</label>
                  <div className="max-h-48 overflow-y-auto p-1 bg-[#18191E] border border-zinc-800 rounded-xl">
                    <ModuleIconPicker
                      value={editModuleFormIcon}
                      onChange={setEditModuleFormIcon}
                      accentColor={accentColor}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setEditingModule(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !editModuleFormName.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 shadow-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: CREATE SUBMODULE ─────────────────────────────────────────── */}
      <AnimatePresence>
        {createSubmoduleTargetModuleId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121316] border border-[#27272A] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Plus size={16} className="text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Add Submodule</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateSubmoduleTargetModuleId(null)}
                  className="text-zinc-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitCreateSubmodule} className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Submodule Title</label>
                  <input
                    type="text"
                    value={submoduleFormName}
                    onChange={(e) => setSubmoduleFormName(e.target.value)}
                    placeholder="e.g. Sprint Backlog, Architecture Notes"
                    maxLength={60}
                    autoFocus
                    className="w-full px-3.5 py-2.5 bg-[#18191E] border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
                  />
                </div>

                {/* Submodule Type Indicator */}
                {submoduleFormType === 'built_in' && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                    Adding built-in tool: <strong>{submoduleFormBuiltInKey}</strong>. This links directly to DevFlow system features.
                  </div>
                )}

                {/* Pin to Top Checkbox */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#18191E] border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Pin size={14} className={submoduleFormPinned ? 'text-amber-400 fill-amber-400' : 'text-zinc-500'} />
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">Pin to Top</p>
                      <p className="text-[10px] text-zinc-500">Show as a direct quick-access link at the top of the sidebar</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={submoduleFormPinned}
                    onChange={(e) => setSubmoduleFormPinned(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-700 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                </div>

                {/* Icon Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Choose Submodule Icon</label>
                  <div className="max-h-48 overflow-y-auto p-1 bg-[#18191E] border border-zinc-800 rounded-xl">
                    <ModuleIconPicker
                      value={submoduleFormIcon}
                      onChange={setSubmoduleFormIcon}
                      accentColor={accentColor}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setCreateSubmoduleTargetModuleId(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !submoduleFormName.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 shadow-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    {isSaving ? 'Adding...' : 'Add Submodule'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: EDIT SUBMODULE ───────────────────────────────────────────── */}
      <AnimatePresence>
        {editingSubmodule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121316] border border-[#27272A] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Edit2 size={16} className="text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Edit Submodule</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingSubmodule(null)}
                  className="text-zinc-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitEditSubmodule} className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Submodule Title</label>
                  <input
                    type="text"
                    value={editSubmoduleFormName}
                    onChange={(e) => setEditSubmoduleFormName(e.target.value)}
                    maxLength={60}
                    className="w-full px-3.5 py-2.5 bg-[#18191E] border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
                  />
                </div>

                {/* Pin to Top Checkbox */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#18191E] border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Pin size={14} className={editSubmoduleFormPinned ? 'text-amber-400 fill-amber-400' : 'text-zinc-500'} />
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">Pin to Top</p>
                      <p className="text-[10px] text-zinc-500">Show as a direct quick-access link at the top of the sidebar</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={editSubmoduleFormPinned}
                    onChange={(e) => setEditSubmoduleFormPinned(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-700 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                </div>

                {/* Icon Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Choose Icon</label>
                  <div className="max-h-48 overflow-y-auto p-1 bg-[#18191E] border border-zinc-800 rounded-xl">
                    <ModuleIconPicker
                      value={editSubmoduleFormIcon}
                      onChange={setEditSubmoduleFormIcon}
                      accentColor={accentColor}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setEditingSubmodule(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !editSubmoduleFormName.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 shadow-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: MOVE SUBMODULE ───────────────────────────────────────────── */}
      <AnimatePresence>
        {movingSubmodule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121316] border border-[#27272A] rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MoveRight size={16} className="text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Relocate Submodule</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setMovingSubmodule(null)}
                  className="text-zinc-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-zinc-400">
                Move <strong>"{movingSubmodule.name}"</strong> to another module section:
              </p>

              <div className="space-y-1.5">
                {modules
                  .filter((m) => m.id !== movingSubmodule.moduleId)
                  .map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => setMoveTargetModuleId(target.id)}
                      className={cn(
                        'w-full flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer',
                        moveTargetModuleId === target.id
                          ? 'bg-indigo-500/10 border-indigo-500 text-white'
                          : 'bg-[#18191E] border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      )}
                    >
                      <span>{target.name}</span>
                      {moveTargetModuleId === target.id && (
                        <Check size={14} className="text-indigo-400" />
                      )}
                    </button>
                  ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setMovingSubmodule(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!moveTargetModuleId || isSaving}
                  onClick={handleConfirmMoveSubmodule}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                  style={{ backgroundColor: accentColor }}
                >
                  {isSaving ? 'Moving...' : 'Move Submodule'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: DELETE CONFIRMATION ──────────────────────────────────────── */}
      <AnimatePresence>
        {(deletingModule || deletingSubmodule) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121316] border border-rose-500/30 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {deletingModule ? `Delete Module "${deletingModule.name}"?` : `Delete Submodule "${deletingSubmodule?.name}"?`}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    This will remove the item from the sidebar navigation.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setDeletingModule(null);
                    setDeletingSubmodule(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={deletingModule ? handleConfirmDeleteModule : handleConfirmDeleteSubmodule}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50"
                >
                  {isSaving ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

