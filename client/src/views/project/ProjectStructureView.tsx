import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderTree,
  Folder,
  FolderPlus,
  Plus,
  Search,
  GripVertical,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  ArrowUpDown,
  MoveRight,
  ArrowUp,
  ArrowDown,
  Boxes,
  Layers,
  Sparkles,
  AlertTriangle,
  Loader2,
  Check,
  X,
  Info,
  FolderKanban,
  ExternalLink,
  Pin,
  PanelLeft,
  GitBranch,
  FolderGit2,
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
import {
  GIT_FEATURES_REGISTRY,
  GIT_SUMMARY_CARD_DEFINITIONS,
  GitFeatureKey,
  CompositeLayout,
  CompositeSubmoduleConfig,
} from '../../types/git';
import { cn } from '../../lib/utils';

interface ProjectStructureViewProps {
  projectId: number;
}

export const ProjectStructureView: React.FC<ProjectStructureViewProps> = ({ projectId }) => {
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();
  const { refreshProjectModules } = useNavigation();
  const navigate = useNavigate();
  const location = useLocation();

  const [modules, setModules] = useState<ProjectModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedModuleIds, setExpandedModuleIds] = useState<Record<number, boolean>>({});

  // Active Menu Dropdowns
  const [activeModuleMenuId, setActiveModuleMenuId] = useState<number | null>(null);
  const [activeSubmoduleMenuId, setActiveSubmoduleMenuId] = useState<number | null>(null);

  // Modals state
  const [isCreateModuleOpen, setIsCreateModuleOpen] = useState(false);
  const [createModuleParent, setCreateModuleParent] = useState<ProjectModule | null>(null);
  const [editingModule, setEditingModule] = useState<ProjectModule | null>(null);
  const [deletingModule, setDeletingModule] = useState<ProjectModule | null>(null);
  const [deleteModuleMode, setDeleteModuleMode] = useState<'cascade' | 'move'>('cascade');
  const [deleteTargetModuleId, setDeleteTargetModuleId] = useState<number | null>(null);

  const [createSubmoduleTargetModuleId, setCreateSubmoduleTargetModuleId] = useState<number | null>(null);
  const [editingSubmodule, setEditingSubmodule] = useState<ProjectSubmodule | null>(null);
  const [movingSubmodule, setMovingSubmodule] = useState<ProjectSubmodule | null>(null);
  const [deletingSubmodule, setDeletingSubmodule] = useState<ProjectSubmodule | null>(null);

  // Action loaders
  const [isSaving, setIsSaving] = useState(false);

  // Drag and drop tracking
  const [draggingModuleId, setDraggingModuleId] = useState<number | null>(null);
  const [dragOverModuleId, setDragOverModuleId] = useState<number | null>(null);
  const [draggingSubmoduleId, setDraggingSubmoduleId] = useState<number | null>(null);
  const [dragOverSubmoduleId, setDragOverSubmoduleId] = useState<number | null>(null);
  const [dragSourceModuleId, setDragSourceModuleId] = useState<number | null>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown-container]')) {
        setActiveModuleMenuId(null);
        setActiveSubmoduleMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch modules
  const loadModules = async () => {
    try {
      setLoading(true);
      const res = await projectModuleService.getModules(projectId);
      if (res.success && Array.isArray(res.data)) {
        setModules(res.data);
        // Default expand all modules
        const expands: Record<number, boolean> = {};
        res.data.forEach((m) => {
          expands[m.id] = true;
        });
        setExpandedModuleIds(expands);
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

  const toggleModuleExpand = (moduleId: number) => {
    setExpandedModuleIds((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  // Synchronize sidebar
  const syncSidebar = async () => {
    try {
      if (refreshProjectModules) {
        await refreshProjectModules(projectId);
      }
      window.dispatchEvent(new CustomEvent('devflow:modules-updated'));
    } catch (e) {
      console.warn('Failed to sync sidebar:', e);
    }
  };

  // ─── Filtered Modules ────────────────────────────────────────────────────────

  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return modules;
    const q = searchQuery.toLowerCase().trim();
    return modules.filter((m) => {
      const matchesName = m.name.toLowerCase().includes(q);
      const matchesDesc = m.description?.toLowerCase().includes(q);
      const matchesSub = m.submodules?.some((s) => s.name.toLowerCase().includes(q));
      const hasMatchingChild = modules.some(
        (c) =>
          c.parentId === m.id &&
          (c.name.toLowerCase().includes(q) ||
            c.description?.toLowerCase().includes(q) ||
            c.submodules?.some((cs) => cs.name.toLowerCase().includes(q)))
      );
      return matchesName || matchesDesc || matchesSub || hasMatchingChild;
    });
  }, [modules, searchQuery]);

  const rootModules = useMemo(() => {
    return filteredModules.filter((m) => !m.parentId);
  }, [filteredModules]);

  const getChildModules = (parentId: number) => {
    return modules.filter((m) => m.parentId === parentId);
  };

  // Stats
  const totalSubmodulesCount = useMemo(() => {
    return modules.reduce((acc, m) => acc + (m.submodules?.length || 0), 0);
  }, [modules]);

  const visibleModulesCount = useMemo(() => {
    return modules.filter((m) => m.isVisible).length;
  }, [modules]);

  // ─── Preset Templates Loader ─────────────────────────────────────────────────

  const handleLoadRecommendedTemplates = async () => {
    try {
      setIsSaving(true);
      const presets = [
        {
          name: 'Planning',
          description: 'Project requirements, architecture specifications, and milestones',
          icon: 'folder',
          submodules: [
            { name: 'Requirements', type: 'built_in' as const, builtInKey: 'docs', icon: 'file-text' },
            { name: 'Documents', type: 'built_in' as const, builtInKey: 'docs', icon: 'book-open' },
            { name: 'Milestones', type: 'built_in' as const, builtInKey: 'milestones', icon: 'flag' },
          ],
        },
        {
          name: 'Development',
          description: 'Active tasks, source control repositories, and merge requests',
          icon: 'terminal',
          submodules: [
            { name: 'Issues', type: 'built_in' as const, builtInKey: 'issues', icon: 'circle-dot' },
            { name: 'Git Repositories', type: 'built_in' as const, builtInKey: 'repositories', icon: 'git-fork' },
            { name: 'Merge Requests', type: 'built_in' as const, builtInKey: 'pulls', icon: 'git-pull-request' },
          ],
        },
        {
          name: 'Testing & QA',
          description: 'Test scenarios, defect tracking, and release verification',
          icon: 'check-square',
          submodules: [
            { name: 'Test Cases', type: 'built_in' as const, builtInKey: 'test-cases', icon: 'check-square' },
            { name: 'Defects', type: 'built_in' as const, builtInKey: 'defects', icon: 'alert-circle' },
            { name: 'Activity Logs', type: 'built_in' as const, builtInKey: 'activity', icon: 'activity' },
          ],
        },
      ];

      for (const p of presets) {
        const modRes = await projectModuleService.createModule(projectId, {
          name: p.name,
          description: p.description,
          icon: p.icon,
          isVisible: true,
        });
        if (modRes.success && modRes.data) {
          for (const s of p.submodules) {
            await projectModuleService.createSubmodule(projectId, modRes.data.id, {
              name: s.name,
              type: s.type,
              builtInKey: s.builtInKey,
              icon: s.icon,
              isVisible: true,
            });
          }
        }
      }

      await loadModules();
      await syncSidebar();
      toast.success('Starter Modules Loaded', 'Created Planning, Development, and Testing & QA modules.');
    } catch (err: any) {
      toast.error('Failed to load templates', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Module Actions ──────────────────────────────────────────────────────────

  const handleToggleModuleVisibility = async (module: ProjectModule) => {
    try {
      const nextVisible = !module.isVisible;
      const res = await projectModuleService.updateModule(projectId, module.id, {
        isVisible: nextVisible,
      });
      if (res.success) {
        setModules((prev) =>
          prev.map((m) => (m.id === module.id ? { ...m, isVisible: nextVisible } : m))
        );
        await syncSidebar();
        toast.success(
          nextVisible ? 'Module Visible' : 'Module Hidden',
          `"${module.name}" is now ${nextVisible ? 'visible in' : 'hidden from'} the project sidebar.`
        );
      }
    } catch (err: any) {
      toast.error('Update failed', err.message);
    }
  };

  const handleTogglePinModule = async (module: ProjectModule) => {
    try {
      const nextPinned = !module.isPinned;
      const res = await projectModuleService.updateModule(projectId, module.id, {
        isPinned: nextPinned,
      });
      if (res.success) {
        setModules((prev) =>
          prev.map((m) => (m.id === module.id ? { ...m, isPinned: nextPinned } : m))
        );
        await syncSidebar();
        toast.success(
          nextPinned ? 'Module Pinned' : 'Module Unpinned',
          `"${module.name}" is now ${nextPinned ? 'pinned at the top' : 'in standard modules'}.`
        );
      }
    } catch (err: any) {
      toast.error('Pin failed', err.message);
    }
  };

  const handleMoveModule = async (moduleId: number, direction: 'up' | 'down') => {
    const currentIndex = modules.findIndex((m) => m.id === moduleId);
    if (currentIndex < 0) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= modules.length) return;

    const reordered = [...modules];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    setModules(reordered);

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

  // HTML5 Drag and drop for modules
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

    setModules(reordered);
    setDraggingModuleId(null);

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

  // Delete module confirmation
  const handleConfirmDeleteModule = async () => {
    if (!deletingModule) return;
    try {
      setIsSaving(true);
      const res = await projectModuleService.deleteModule(projectId, deletingModule.id, {
        targetModuleId: deleteModuleMode === 'move' ? (deleteTargetModuleId ?? undefined) : undefined,
        cascade: deleteModuleMode === 'cascade',
      });
      if (res.success) {
        toast.success('Module Deleted', `Module "${deletingModule.name}" was deleted.`);
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

  // ─── Submodule Actions ───────────────────────────────────────────────────────

  const handleToggleSubmoduleVisibility = async (sub: ProjectSubmodule) => {
    try {
      const nextVisible = !sub.isVisible;
      const res = await projectModuleService.updateSubmodule(projectId, sub.id, {
        isVisible: nextVisible,
      });
      if (res.success) {
        setModules((prev) =>
          prev.map((m) =>
            m.id === sub.moduleId
              ? {
                  ...m,
                  submodules: m.submodules?.map((s) =>
                    s.id === sub.id ? { ...s, isVisible: nextVisible } : s
                  ),
                }
              : m
          )
        );
        await syncSidebar();
        toast.success(
          nextVisible ? 'Submodule Visible' : 'Submodule Hidden',
          `"${sub.name}" is now ${nextVisible ? 'visible in' : 'hidden from'} the sidebar.`
        );
      }
    } catch (err: any) {
      toast.error('Update failed', err.message);
    }
  };

  const handleToggleSubmodulePin = async (sub: ProjectSubmodule) => {
    try {
      const nextPin = !sub.isPinned;
      const res = await projectModuleService.updateSubmodule(projectId, sub.id, {
        isPinned: nextPin,
      });
      if (res.success) {
        setModules((prev) =>
          prev.map((m) =>
            m.id === sub.moduleId
              ? {
                  ...m,
                  submodules: m.submodules?.map((s) =>
                    s.id === sub.id ? { ...s, isPinned: nextPin } : s
                  ),
                }
              : m
          )
        );
        await syncSidebar();
        toast.success(
          nextPin ? 'Submodule Pinned' : 'Submodule Unpinned',
          `"${sub.name}" is now ${nextPin ? 'pinned at the top of the sidebar' : 'unpinned'}.`
        );
      }
    } catch (err: any) {
      toast.error('Pin toggle failed', err.message);
    }
  };

  const handleMoveSubmoduleOrder = async (
    moduleId: number,
    submoduleId: number,
    direction: 'up' | 'down'
  ) => {
    const parentModule = modules.find((m) => m.id === moduleId);
    if (!parentModule || !parentModule.submodules) return;

    const subs = [...parentModule.submodules];
    const currentIndex = subs.findIndex((s) => s.id === submoduleId);
    if (currentIndex < 0) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= subs.length) return;

    const [moved] = subs.splice(currentIndex, 1);
    subs.splice(targetIndex, 0, moved);

    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, submodules: subs } : m))
    );

    try {
      await projectModuleService.reorderSubmodules(
        projectId,
        moduleId,
        subs.map((s) => s.id)
      );
      await syncSidebar();
    } catch (err: any) {
      toast.error('Reorder failed', err.message);
      await loadModules();
    }
  };

  // HTML5 Drag and drop for submodules
  const handleSubmoduleDragStart = (e: React.DragEvent, moduleId: number, submoduleId: number) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', `submodule:${submoduleId}`);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingSubmoduleId(submoduleId);
    setDragSourceModuleId(moduleId);
  };

  const handleSubmoduleDragOver = (e: React.DragEvent, targetModuleId: number, targetSubmoduleId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggingSubmoduleId) return;
    if (draggingSubmoduleId !== targetSubmoduleId) {
      setDragOverSubmoduleId(targetSubmoduleId);
    }
  };

  const handleSubmoduleDrop = async (
    e: React.DragEvent,
    targetModuleId: number,
    targetSubmoduleId: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceSubId = draggingSubmoduleId;
    const sourceModId = dragSourceModuleId;

    setDragOverSubmoduleId(null);
    setDraggingSubmoduleId(null);
    setDragSourceModuleId(null);

    if (!sourceSubId || !sourceModId || sourceSubId === targetSubmoduleId) return;

    // CASE 1: Dragging within the SAME module (reorder)
    if (sourceModId === targetModuleId) {
      const parentModule = modules.find((m) => m.id === targetModuleId);
      if (!parentModule || !parentModule.submodules) return;

      const subs = [...parentModule.submodules];
      const currentIdx = subs.findIndex((s) => s.id === sourceSubId);
      const targetIdx = subs.findIndex((s) => s.id === targetSubmoduleId);
      if (currentIdx < 0 || targetIdx < 0) return;

      const [moved] = subs.splice(currentIdx, 1);
      subs.splice(targetIdx, 0, moved);

      // Optimistic update
      setModules((prev) =>
        prev.map((m) => (m.id === targetModuleId ? { ...m, submodules: subs } : m))
      );

      try {
        await projectModuleService.reorderSubmodules(
          projectId,
          targetModuleId,
          subs.map((s) => s.id)
        );
        await syncSidebar();
      } catch (err: any) {
        toast.error('Reorder failed', err.message);
        await loadModules();
      }
      return;
    }

    // CASE 2: Dragging between DIFFERENT modules!
    if (sourceModId !== targetModuleId) {
      try {
        setIsSaving(true);
        const res = await projectModuleService.moveSubmodule(projectId, sourceSubId, targetModuleId);
        if (res.success) {
          toast.success('Submodule Moved', 'Submodule moved to another module.');
          await loadModules();
          await syncSidebar();
        } else {
          toast.error('Move failed', res.error);
        }
      } catch (err: any) {
        toast.error('Error moving submodule', err.message);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSubmoduleDragEnd = () => {
    setDraggingSubmoduleId(null);
    setDragOverSubmoduleId(null);
    setDragSourceModuleId(null);
  };

  const handleConfirmMoveSubmodule = async (targetModuleId: number) => {
    if (!movingSubmodule) return;
    try {
      setIsSaving(true);
      const res = await projectModuleService.moveSubmodule(projectId, movingSubmodule.id, targetModuleId);
      if (res.success) {
        toast.success('Submodule Moved', `Moved "${movingSubmodule.name}" successfully.`);
        setMovingSubmodule(null);
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

  const handleConfirmDeleteSubmodule = async () => {
    if (!deletingSubmodule) return;
    try {
      setIsSaving(true);
      const res = await projectModuleService.deleteSubmodule(projectId, deletingSubmodule.id);
      if (res.success) {
        toast.success('Submodule Deleted', `Deleted "${deletingSubmodule.name}".`);
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

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ─── 1. Main Content Header ─────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-xl border border-[#27272A] bg-[#0E0F14]">
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm"
              style={{ backgroundColor: `${accentColor}25`, borderColor: `${accentColor}50`, borderWidth: 1 }}
            >
              <Boxes size={18} style={{ color: accentColor }} />
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">Project Structure</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            Organize your project workspace by grouping related features into modules and submodules.
            Control which items appear in the project sidebar and customize navigation order.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {modules.length === 0 && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleLoadRecommendedTemplates}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors cursor-pointer"
            >
              <Sparkles size={13} className="text-amber-400" />
              <span>Load Presets</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate(location.pathname.replace(/\/structure$/, '/sidebar'))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors cursor-pointer"
          >
            <PanelLeft size={13} className="text-indigo-400" />
            <span>Virtual Sidebar Editor</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCreateModuleParent(null);
              setIsCreateModuleOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition-all cursor-pointer"
            style={{ backgroundColor: accentColor }}
          >
            <Plus size={14} />
            <span>Create Module</span>
          </button>
        </div>
      </div>

      {/* ─── 2. Search & Stats Bar ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search modules and submodules..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#0E0F14] border border-[#27272A] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
          <span>
            Modules: <strong className="text-white">{modules.length}</strong>
          </span>
          <span>•</span>
          <span>
            Submodules: <strong className="text-white">{totalSubmodulesCount}</strong>
          </span>
          <span>•</span>
          <span>
            Sidebar Visible: <strong className="text-emerald-400">{visibleModulesCount}</strong>
          </span>
        </div>
      </div>

      {/* ─── 3. Modules List / Empty State ───────────────────────────────────── */}
      {loading ? (
        <div className="p-12 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin text-zinc-400" />
          <span>Loading project structure...</span>
        </div>
      ) : modules.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-[#27272A] bg-[#0E0F14] text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
            <FolderTree size={28} />
          </div>
          <div className="space-y-1 max-w-sm">
            <h3 className="text-sm font-semibold text-white">No modules configured yet</h3>
            <p className="text-xs text-zinc-400">
              Your project sidebar is currently using default items. Create your first module to organize
              custom workspaces and features.
            </p>
          </div>
          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                setCreateModuleParent(null);
                setIsCreateModuleOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-sm cursor-pointer"
              style={{ backgroundColor: accentColor }}
            >
              <Plus size={14} />
              <span>Create your first module</span>
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleLoadRecommendedTemplates}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors cursor-pointer"
            >
              <Sparkles size={13} className="text-amber-400" />
              <span>Load Starter Templates</span>
            </button>
          </div>
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="p-8 text-center text-xs text-zinc-500 border border-[#27272A] rounded-xl bg-[#0E0F14]">
          No modules or submodules match "{searchQuery}"
        </div>
      ) : (
        <div className="space-y-4">
          {rootModules.map((module, mIdx) => {
            const isExpanded = expandedModuleIds[module.id] ?? true;
            const ModuleIcon = resolveModuleIcon(module.icon, FolderKanban);
            const submodules = module.submodules || [];
            const isFirst = mIdx === 0;
            const isLast = mIdx === rootModules.length - 1;
            const isDragging = draggingModuleId === module.id;
            const isOver = dragOverModuleId === module.id;
            const hasActiveDropdown =
              activeModuleMenuId === module.id ||
              submodules.some((s) => s.id === activeSubmoduleMenuId);

            return (
              <div
                key={module.id}
                draggable
                onDragStart={(e) => handleModuleDragStart(e, module.id)}
                onDragOver={(e) => handleModuleDragOver(e, module.id)}
                onDrop={(e) => handleModuleDrop(e, module.id)}
                onDragEnd={() => {
                  setDraggingModuleId(null);
                  setDragOverModuleId(null);
                }}
                className={cn(
                  'rounded-xl border bg-[#0E0F14] transition-all',
                  hasActiveDropdown ? 'overflow-visible z-30' : 'overflow-hidden',
                  isDragging ? 'opacity-40 border-dashed border-zinc-600' : 'border-[#27272A]',
                  isOver ? 'border-emerald-500/70 ring-1 ring-emerald-500/30' : '',
                  !module.isVisible && 'opacity-70 bg-[#0A0A0D]'
                )}
              >
                {/* ── Module Header Row ── */}
                <div className="p-3.5 sm:px-4 flex items-center justify-between gap-3 border-b border-[#1C1D24] bg-[#121319]/80">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Drag Handle */}
                    <div
                      className="text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing p-0.5 rounded transition-colors shrink-0"
                      title="Drag to reorder module"
                    >
                      <GripVertical size={15} />
                    </div>

                    {/* Expand/Collapse Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleModuleExpand(module.id)}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
                      title={isExpanded ? 'Collapse submodules' : 'Expand submodules'}
                    >
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>

                    {/* Module Icon */}
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm border border-white/10"
                      style={{ backgroundColor: `${accentColor}25` }}
                    >
                      <ModuleIcon size={14} style={{ color: accentColor }} />
                    </div>

                    {/* Module Title & Description */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-white truncate">{module.name}</span>

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60 shrink-0">
                          {submodules.length} {submodules.length === 1 ? 'submodule' : 'submodules'}
                        </span>

                        {module.isPinned && (
                          <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0 inline-flex items-center gap-1">
                            <Pin size={9} className="fill-amber-400" />
                            Pinned to top
                          </span>
                        )}

                        {!module.isVisible && (
                          <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0">
                            Hidden from sidebar
                          </span>
                        )}
                      </div>

                      {module.description && (
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5 max-w-xl">
                          {module.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Move Up / Move Down Accessible Buttons */}
                    <div className="hidden sm:flex items-center gap-0.5 border border-zinc-800 rounded-lg p-0.5 bg-[#0E0F14]">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => handleMoveModule(module.id, 'up')}
                        className="p-1 rounded text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-500 cursor-pointer disabled:cursor-not-allowed"
                        title="Move module up"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => handleMoveModule(module.id, 'down')}
                        className="p-1 rounded text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-500 cursor-pointer disabled:cursor-not-allowed"
                        title="Move module down"
                      >
                        <ArrowDown size={12} />
                      </button>
                    </div>

                    {/* Quick Pin Toggle */}
                    <button
                      type="button"
                      onClick={() => handleTogglePinModule(module)}
                      className={cn(
                        'p-1.5 rounded-lg border transition-colors cursor-pointer',
                        module.isPinned
                          ? 'text-amber-300 border-amber-500/40 bg-amber-500/20 hover:bg-amber-500/30'
                          : 'text-zinc-500 hover:text-zinc-200 border-zinc-800 hover:bg-zinc-800'
                      )}
                      title={module.isPinned ? 'Unpin module from top' : 'Pin module to top of sidebar'}
                    >
                      <Pin size={13} className={module.isPinned ? 'fill-amber-400' : ''} />
                    </button>

                    {/* Quick Visibility Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleModuleVisibility(module)}
                      className={cn(
                        'p-1.5 rounded-lg border transition-colors cursor-pointer',
                        module.isVisible
                          ? 'text-zinc-400 hover:text-white border-zinc-800 hover:bg-zinc-800'
                          : 'text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20'
                      )}
                      title={module.isVisible ? 'Hide module from sidebar' : 'Show module in sidebar'}
                    >
                      {module.isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>

                    {/* Add Submodule Button */}
                    {!module.parentId && (
                      <button
                        type="button"
                        onClick={() => {
                          setCreateModuleParent(module);
                          setIsCreateModuleOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-amber-400/90 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer shadow-sm"
                        title={`Add a module folder inside ${module.name}`}
                      >
                        <FolderPlus size={12} />
                        <span className="hidden sm:inline">Add Folder</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setCreateSubmoduleTargetModuleId(module.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 transition-colors cursor-pointer shadow-sm"
                    >
                      <Plus size={12} />
                      <span className="hidden sm:inline">Add Submodule</span>
                    </button>

                    {/* Three-Dot Menu */}
                    <div className="relative" data-dropdown-container>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveModuleMenuId(activeModuleMenuId === module.id ? null : module.id);
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Module options"
                      >
                        <MoreVertical size={14} />
                      </button>

                      {activeModuleMenuId === module.id && (
                        <div
                          className={cn(
                            "absolute right-0 w-48 rounded-xl border border-[#27272A] bg-[#14151B] shadow-2xl p-1 z-50 space-y-0.5 text-xs text-zinc-300 animate-in fade-in zoom-in-95 duration-150",
                            isLast ? "bottom-full mb-1" : "top-full mt-1"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveModuleMenuId(null);
                              setEditingModule(module);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-left cursor-pointer"
                          >
                            <Edit2 size={13} className="text-zinc-400" />
                            <span>Rename & Details</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveModuleMenuId(null);
                              setCreateSubmoduleTargetModuleId(module.id);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-left cursor-pointer"
                          >
                            <Plus size={13} className="text-zinc-400" />
                            <span>Add Submodule</span>
                          </button>

                          {!module.parentId && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveModuleMenuId(null);
                                setCreateModuleParent(module);
                                setIsCreateModuleOpen(true);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-left cursor-pointer text-amber-400"
                            >
                              <FolderPlus size={13} />
                              <span>Add Module Folder</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setActiveModuleMenuId(null);
                              handleToggleModuleVisibility(module);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-left cursor-pointer"
                          >
                            {module.isVisible ? (
                              <>
                                <EyeOff size={13} className="text-zinc-400" />
                                <span>Hide from Sidebar</span>
                              </>
                            ) : (
                              <>
                                <Eye size={13} className="text-emerald-400" />
                                <span>Show in Sidebar</span>
                              </>
                            )}
                          </button>

                          <div className="h-px bg-zinc-800/80 my-1" />

                          <button
                            type="button"
                            onClick={() => {
                              setActiveModuleMenuId(null);
                              setDeletingModule(module);
                              setDeleteModuleMode('cascade');
                              const otherModules = modules.filter((m) => m.id !== module.id);
                              setDeleteTargetModuleId(otherModules.length > 0 ? otherModules[0].id : null);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-red-500/15 text-red-400 text-left cursor-pointer transition-colors"
                          >
                            <Trash2 size={13} />
                            <span>Delete Module</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Submodules Container ── */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key={`sub-container-${module.id}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="divide-y divide-[#1C1D24] bg-[#0E0F14]/50"
                    >
                      {submodules.length === 0 ? (
                        <div
                          onDragOver={(e) => {
                            if (draggingSubmoduleId) {
                              e.preventDefault();
                              e.stopPropagation();
                              setDragOverModuleId(module.id);
                            }
                          }}
                          onDrop={async (e) => {
                            if (draggingSubmoduleId && dragSourceModuleId && dragSourceModuleId !== module.id) {
                              e.preventDefault();
                              e.stopPropagation();
                              const subId = draggingSubmoduleId;
                              setDraggingSubmoduleId(null);
                              setDragOverModuleId(null);
                              try {
                                setIsSaving(true);
                                const res = await projectModuleService.moveSubmodule(projectId, subId, module.id);
                                if (res.success) {
                                  toast.success('Submodule Moved', `Moved to ${module.name}`);
                                  await loadModules();
                                  await syncSidebar();
                                } else {
                                  toast.error('Move failed', res.error);
                                }
                              } catch (err: any) {
                                toast.error('Move failed', err.message);
                              } finally {
                                setIsSaving(false);
                              }
                            }
                          }}
                          className={cn(
                            'py-5 px-6 text-center text-xs text-zinc-500 flex items-center justify-center gap-2 transition-colors',
                            dragOverModuleId === module.id && draggingSubmoduleId && 'bg-indigo-500/15 border-indigo-500/60 text-indigo-300 border-dashed border'
                          )}
                        >
                          <Info size={13} />
                          <span>No submodules in this module yet.</span>
                          <button
                            type="button"
                            onClick={() => setCreateSubmoduleTargetModuleId(module.id)}
                            className="text-white underline hover:no-underline font-medium cursor-pointer ml-1"
                          >
                            Add one now
                          </button>
                          <span className="text-zinc-600">or drag one here</span>
                        </div>
                      ) : (
                        submodules.map((sub, sIdx) => {
                          const SubIcon = resolveModuleIcon(sub.icon, FolderKanban);
                          const isSubFirst = sIdx === 0;
                          const isSubLast = sIdx === submodules.length - 1;

                          return (
                            <div
                              key={sub.id}
                              draggable
                              onDragStart={(e) => handleSubmoduleDragStart(e, module.id, sub.id)}
                              onDragOver={(e) => handleSubmoduleDragOver(e, module.id, sub.id)}
                              onDrop={(e) => handleSubmoduleDrop(e, module.id, sub.id)}
                              onDragEnd={handleSubmoduleDragEnd}
                              className={cn(
                                'p-3 pl-4 sm:pl-5 flex items-center justify-between gap-3 text-xs transition-all hover:bg-[#14151C]/70 group/row select-none',
                                !sub.isVisible && 'opacity-60 bg-[#0A0A0D]',
                                draggingSubmoduleId === sub.id && 'opacity-30 border-dashed border-2 border-indigo-500/50 bg-indigo-500/5 scale-[0.99]',
                                dragOverSubmoduleId === sub.id && draggingSubmoduleId !== sub.id && 'border-t-2 border-indigo-400 bg-indigo-500/10'
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div
                                  className="text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing p-1 -m-1 rounded transition-colors shrink-0"
                                  title="Drag to reorder or move across modules"
                                >
                                  <GripVertical size={13} />
                                </div>

                                <div className="w-5 h-5 rounded flex items-center justify-center text-zinc-300 bg-zinc-800/80 border border-zinc-700/60 shrink-0">
                                  <SubIcon size={11} />
                                </div>

                                <span className="font-medium text-zinc-200 truncate">{sub.name}</span>

                                {/* Type Badge */}
                                <span
                                  className={cn(
                                    'text-[9.5px] font-mono px-1.5 py-0.2 rounded border shrink-0',
                                    sub.type === 'built_in'
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                                      : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25'
                                  )}
                                >
                                  {sub.type === 'built_in' ? `Built-in (${sub.builtInKey})` : 'Custom Placeholder'}
                                </span>

                                {!sub.isVisible && (
                                  <span className="text-[9px] font-mono text-zinc-500 hidden sm:inline">
                                    [Hidden from sidebar]
                                  </span>
                                )}
                              </div>

                              {/* Submodule Right Actions */}
                              <div className="flex items-center gap-1 shrink-0">
                                {/* Up / Down order */}
                                <div className="hidden sm:flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    disabled={isSubFirst}
                                    onClick={() => handleMoveSubmoduleOrder(module.id, sub.id, 'up')}
                                    className="p-1 rounded text-zinc-500 hover:text-zinc-200 disabled:opacity-20 cursor-pointer"
                                    title="Move up"
                                  >
                                    <ArrowUp size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isSubLast}
                                    onClick={() => handleMoveSubmoduleOrder(module.id, sub.id, 'down')}
                                    className="p-1 rounded text-zinc-500 hover:text-zinc-200 disabled:opacity-20 cursor-pointer"
                                    title="Move down"
                                  >
                                    <ArrowDown size={11} />
                                  </button>
                                </div>

                                {/* Visibility Toggle */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleSubmoduleVisibility(sub)}
                                  className={cn(
                                    'p-1 rounded transition-colors cursor-pointer',
                                    sub.isVisible
                                      ? 'text-zinc-500 hover:text-zinc-200'
                                      : 'text-amber-400 hover:text-amber-300'
                                  )}
                                  title={sub.isVisible ? 'Hide from sidebar' : 'Show in sidebar'}
                                >
                                  {sub.isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                </button>

                                {/* Three-Dot Menu */}
                                <div className="relative" data-dropdown-container>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveSubmoduleMenuId(activeSubmoduleMenuId === sub.id ? null : sub.id);
                                    }}
                                    className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                                  >
                                    <MoreVertical size={13} />
                                  </button>

                                  {activeSubmoduleMenuId === sub.id && (
                                    <div
                                      className={cn(
                                        "absolute right-0 w-44 rounded-xl border border-[#27272A] bg-[#14151B] shadow-2xl p-1 z-50 space-y-0.5 text-xs text-zinc-300 animate-in fade-in zoom-in-95 duration-150",
                                        isSubLast ? "bottom-full mb-1" : "top-full mt-1"
                                      )}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveSubmoduleMenuId(null);
                                          setEditingSubmodule(sub);
                                        }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-left cursor-pointer"
                                      >
                                        <Edit2 size={12} className="text-zinc-400" />
                                        <span>Rename / Icon</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveSubmoduleMenuId(null);
                                          setMovingSubmodule(sub);
                                        }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-left cursor-pointer"
                                      >
                                        <MoveRight size={12} className="text-zinc-400" />
                                        <span>Move to Module...</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveSubmoduleMenuId(null);
                                          handleToggleSubmoduleVisibility(sub);
                                        }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-left cursor-pointer"
                                      >
                                        {sub.isVisible ? (
                                          <>
                                            <EyeOff size={12} className="text-zinc-400" />
                                            <span>Hide in Sidebar</span>
                                          </>
                                        ) : (
                                          <>
                                            <Eye size={12} className="text-emerald-400" />
                                            <span>Show in Sidebar</span>
                                          </>
                                        )}
                                      </button>

                                      <div className="h-px bg-zinc-800 my-1" />

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveSubmoduleMenuId(null);
                                          setDeletingSubmodule(sub);
                                        }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-red-500/15 text-red-400 text-left cursor-pointer"
                                      >
                                        <Trash2 size={12} />
                                        <span>Delete Submodule</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}

                      {/* ── Nested Module Folders (1-Level Nesting Max) ── */}
                      {(() => {
                        const childFolders = getChildModules(module.id);
                        if (childFolders.length === 0) return null;

                        return (
                          <div className="p-3 sm:p-4 bg-[#0B0C10]/80 border-t border-[#1C1D24] space-y-2.5">
                            <div className="flex items-center justify-between px-1">
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                                <Folder size={12} className="text-amber-400" />
                                <span>Module Folders ({childFolders.length})</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setCreateModuleParent(module);
                                  setIsCreateModuleOpen(true);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                              >
                                <Plus size={11} />
                                <span>New Folder</span>
                              </button>
                            </div>

                            <div className="space-y-2">
                              {childFolders.map((childFolder) => {
                                const ChildIcon = resolveModuleIcon(childFolder.icon, Folder);
                                const childSubs = childFolder.submodules || [];
                                const isChildExpanded = expandedModuleIds[childFolder.id] ?? true;

                                return (
                                  <div
                                    key={childFolder.id}
                                    className="rounded-xl border border-[#27272A]/90 bg-[#12131A] shadow-md overflow-hidden transition-all"
                                  >
                                    {/* Child Folder Header */}
                                    <div className="p-2.5 sm:px-3 flex items-center justify-between gap-2.5 bg-[#161722]/80 border-b border-[#22232E]">
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <button
                                          type="button"
                                          onClick={() => toggleModuleExpand(childFolder.id)}
                                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
                                        >
                                          {isChildExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                        </button>

                                        <div className="w-6 h-6 rounded-md flex items-center justify-center text-amber-300 bg-amber-500/15 border border-amber-500/30 shrink-0">
                                          <ChildIcon size={13} />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-semibold text-white truncate">
                                              {childFolder.name}
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
                                              {childSubs.length} submodules
                                            </span>
                                          </div>
                                          {childFolder.description && (
                                            <p className="text-[11px] text-zinc-400 truncate">{childFolder.description}</p>
                                          )}
                                        </div>
                                      </div>

                                      {/* Child Folder Actions - NO "+ Folder" button here to strictly enforce 1-level limit */}
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => setCreateSubmoduleTargetModuleId(childFolder.id)}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors cursor-pointer"
                                          title="Add submodule inside this folder"
                                        >
                                          <Plus size={11} />
                                          <span>Submodule</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleToggleModuleVisibility(childFolder)}
                                          className={cn(
                                            'p-1 rounded border transition-colors cursor-pointer',
                                            childFolder.isVisible
                                              ? 'text-zinc-400 hover:text-white border-zinc-800 hover:bg-zinc-800'
                                              : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                                          )}
                                          title={childFolder.isVisible ? 'Hide from sidebar' : 'Show in sidebar'}
                                        >
                                          {childFolder.isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => setEditingModule(childFolder)}
                                          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                                          title="Rename folder"
                                        >
                                          <Edit2 size={12} />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDeletingModule(childFolder);
                                            setDeleteModuleMode('cascade');
                                            const otherMods = modules.filter((m) => m.id !== childFolder.id);
                                            setDeleteTargetModuleId(otherMods.length > 0 ? otherMods[0].id : null);
                                          }}
                                          className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer"
                                          title="Delete folder"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Child Folder Submodules */}
                                    {isChildExpanded && (
                                      <div
                                        onDragOver={(e) => {
                                          if (draggingSubmoduleId) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setDragOverModuleId(childFolder.id);
                                          }
                                        }}
                                        onDrop={async (e) => {
                                          if (draggingSubmoduleId && dragSourceModuleId && dragSourceModuleId !== childFolder.id) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const subId = draggingSubmoduleId;
                                            setDraggingSubmoduleId(null);
                                            setDragOverModuleId(null);
                                            try {
                                              setIsSaving(true);
                                              const res = await projectModuleService.moveSubmodule(projectId, subId, childFolder.id);
                                              if (res.success) {
                                                toast.success('Submodule Moved', `Moved to ${childFolder.name}`);
                                                await loadModules();
                                                await syncSidebar();
                                              } else {
                                                toast.error('Move failed', res.error);
                                              }
                                            } catch (err: any) {
                                              toast.error('Move failed', err.message);
                                            } finally {
                                              setIsSaving(false);
                                            }
                                          }
                                        }}
                                        className={cn(
                                          'divide-y divide-[#1D1E28] bg-[#0E0F16]/60 transition-colors',
                                          dragOverModuleId === childFolder.id && draggingSubmoduleId && 'bg-indigo-500/15 border-indigo-500/60'
                                        )}
                                      >
                                        {childSubs.length === 0 ? (
                                          <div className="py-3 px-4 text-center text-[11px] text-zinc-500 flex items-center justify-center gap-1.5">
                                            <Info size={12} />
                                            <span>No submodules in this folder.</span>
                                            <button
                                              type="button"
                                              onClick={() => setCreateSubmoduleTargetModuleId(childFolder.id)}
                                              className="text-white underline hover:no-underline font-medium cursor-pointer ml-1"
                                            >
                                              Add one now
                                            </button>
                                          </div>
                                        ) : (
                                          childSubs.map((sub, sIdx) => {
                                            const SubIcon = resolveModuleIcon(sub.icon, FolderKanban);
                                            const isSubLast = sIdx === childSubs.length - 1;

                                            return (
                                              <div
                                                key={sub.id}
                                                draggable
                                                onDragStart={(e) => handleSubmoduleDragStart(e, childFolder.id, sub.id)}
                                                onDragOver={(e) => handleSubmoduleDragOver(e, childFolder.id, sub.id)}
                                                onDrop={(e) => handleSubmoduleDrop(e, childFolder.id, sub.id)}
                                                onDragEnd={handleSubmoduleDragEnd}
                                                className={cn(
                                                  'p-2.5 pl-4 sm:pl-5 flex items-center justify-between gap-3 text-xs transition-all hover:bg-[#151622] group/row select-none',
                                                  !sub.isVisible && 'opacity-60 bg-[#0A0A0D]',
                                                  draggingSubmoduleId === sub.id && 'opacity-30 border-dashed border-2 border-indigo-500/50'
                                                )}
                                              >
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                  <div
                                                    className="text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing p-1 -m-1 rounded transition-colors shrink-0"
                                                    title="Drag to reorder or move"
                                                  >
                                                    <GripVertical size={12} />
                                                  </div>
                                                  <div className="w-5 h-5 rounded flex items-center justify-center text-zinc-300 bg-zinc-800/80 border border-zinc-700/60 shrink-0">
                                                    <SubIcon size={11} />
                                                  </div>
                                                  <div className="min-w-0 flex-1">
                                                    <span className="font-medium text-white truncate block">{sub.name}</span>
                                                  </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleToggleSubmodulePin(sub)}
                                                    className={cn(
                                                      'p-1 rounded transition-colors cursor-pointer',
                                                      sub.isPinned
                                                        ? 'text-amber-400 bg-amber-500/10'
                                                        : 'text-zinc-500 hover:text-zinc-300 opacity-0 group-hover/row:opacity-100'
                                                    )}
                                                    title={sub.isPinned ? 'Unpin' : 'Pin'}
                                                  >
                                                    <Pin size={11} className={sub.isPinned ? 'fill-amber-400' : ''} />
                                                  </button>

                                                  <button
                                                    type="button"
                                                    onClick={() => handleToggleSubmoduleVisibility(sub)}
                                                    className={cn(
                                                      'p-1 rounded transition-colors cursor-pointer',
                                                      sub.isVisible
                                                        ? 'text-zinc-400 hover:text-white'
                                                        : 'text-amber-400 bg-amber-500/10'
                                                    )}
                                                    title={sub.isVisible ? 'Hide' : 'Show'}
                                                  >
                                                    {sub.isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
                                                  </button>

                                                  <div className="relative" data-dropdown-container>
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveSubmoduleMenuId(activeSubmoduleMenuId === sub.id ? null : sub.id);
                                                      }}
                                                      className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                                                    >
                                                      <MoreVertical size={12} />
                                                    </button>

                                                    {activeSubmoduleMenuId === sub.id && (
                                                      <div
                                                        className={cn(
                                                          'absolute right-0 w-44 rounded-xl border border-[#27272A] bg-[#14151B] shadow-2xl p-1 z-50 space-y-0.5 text-xs text-zinc-300 animate-in fade-in zoom-in-95 duration-150',
                                                          isSubLast ? 'bottom-full mb-1' : 'top-full mt-1'
                                                        )}
                                                      >
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            setActiveSubmoduleMenuId(null);
                                                            setEditingSubmodule(sub);
                                                          }}
                                                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-left cursor-pointer"
                                                        >
                                                          <Edit2 size={12} className="text-zinc-400" />
                                                          <span>Rename / Icon</span>
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            setActiveSubmoduleMenuId(null);
                                                            setMovingSubmodule(sub);
                                                          }}
                                                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-left cursor-pointer"
                                                        >
                                                          <MoveRight size={12} className="text-zinc-400" />
                                                          <span>Move to Module...</span>
                                                        </button>
                                                        <div className="h-px bg-zinc-800 my-1" />
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            setActiveSubmoduleMenuId(null);
                                                            setDeletingSubmodule(sub);
                                                          }}
                                                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-red-500/15 text-red-400 text-left cursor-pointer"
                                                        >
                                                          <Trash2 size={12} />
                                                          <span>Delete Submodule</span>
                                                        </button>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL 1: Create Module Drawer ─────────────────────────────────── */}
      <AnimatePresence>
        {isCreateModuleOpen && (
          <CreateModuleModal
            projectId={projectId}
            parentModule={createModuleParent}
            accentColor={accentColor}
            existingNames={modules.map((m) => m.name)}
            onClose={() => {
              setIsCreateModuleOpen(false);
              setCreateModuleParent(null);
            }}
            onCreated={async (newMod) => {
              setIsCreateModuleOpen(false);
              setCreateModuleParent(null);
              await loadModules();
              await syncSidebar();
              toast.success(
                createModuleParent ? 'Folder Created' : 'Module Created',
                `Created ${createModuleParent ? 'module folder' : 'module'} "${newMod.name}"`
              );
            }}
          />
        )}
      </AnimatePresence>

      {/* ─── MODAL 2: Edit Module ───────────────────────────────────────────── */}
      {editingModule && (
        <EditModuleModal
          projectId={projectId}
          module={editingModule}
          accentColor={accentColor}
          existingNames={modules.filter((m) => m.id !== editingModule.id).map((m) => m.name)}
          onClose={() => setEditingModule(null)}
          onUpdated={async () => {
            setEditingModule(null);
            await loadModules();
            await syncSidebar();
            toast.success('Module Updated', 'Changes saved successfully.');
          }}
        />
      )}

      {/* ─── MODAL 3: Delete Module (with submodule migration or cascade) ────── */}
      {deletingModule && (
        <DeleteModuleModal
          module={deletingModule}
          otherModules={modules.filter((m) => m.id !== deletingModule.id)}
          deleteMode={deleteModuleMode}
          setDeleteMode={setDeleteModuleMode}
          targetModuleId={deleteTargetModuleId}
          setTargetModuleId={setDeleteTargetModuleId}
          isSaving={isSaving}
          onClose={() => setDeletingModule(null)}
          onConfirm={handleConfirmDeleteModule}
        />
      )}

      {/* ─── MODAL 4: Create Submodule Drawer ─────────────────────────────────── */}
      <AnimatePresence>
        {createSubmoduleTargetModuleId && (
          <CreateSubmoduleModal
            projectId={projectId}
            moduleId={createSubmoduleTargetModuleId}
            parentModule={modules.find((m) => m.id === createSubmoduleTargetModuleId)}
            accentColor={accentColor}
            onClose={() => setCreateSubmoduleTargetModuleId(null)}
            onCreated={async () => {
              setCreateSubmoduleTargetModuleId(null);
              await loadModules();
              await syncSidebar();
              toast.success('Submodule Added', 'New submodule added to module.');
            }}
          />
        )}
      </AnimatePresence>

      {/* ─── MODAL 5: Edit Submodule Drawer ───────────────────────────────────── */}
      <AnimatePresence>
        {editingSubmodule && (
          <EditSubmoduleModal
            projectId={projectId}
            submodule={editingSubmodule}
            accentColor={accentColor}
            onClose={() => setEditingSubmodule(null)}
            onUpdated={async () => {
              setEditingSubmodule(null);
              await loadModules();
              await syncSidebar();
              toast.success('Submodule Updated', 'Submodule details updated.');
            }}
          />
        )}
      </AnimatePresence>

      {/* ─── MODAL 6: Move Submodule ─────────────────────────────────────────── */}
      {movingSubmodule && (
        <MoveSubmoduleModal
          submodule={movingSubmodule}
          currentModule={modules.find((m) => m.id === movingSubmodule.moduleId)}
          availableModules={modules.filter((m) => m.id !== movingSubmodule.moduleId)}
          isSaving={isSaving}
          onClose={() => setMovingSubmodule(null)}
          onConfirm={handleConfirmMoveSubmodule}
        />
      )}

      {/* ─── MODAL 7: Delete Submodule ───────────────────────────────────────── */}
      {deletingSubmodule && (
        <DeleteSubmoduleModal
          submodule={deletingSubmodule}
          isSaving={isSaving}
          onClose={() => setDeletingSubmodule(null)}
          onConfirm={handleConfirmDeleteSubmodule}
        />
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// SUBMODALS & DIALOGS
// ═════════════════════════════════════════════════════════════════════════════

interface CreateModuleModalProps {
  projectId: number;
  parentModule?: ProjectModule | null;
  accentColor: string;
  existingNames: string[];
  onClose: () => void;
  onCreated: (mod: ProjectModule) => void;
}

const CreateModuleModal: React.FC<CreateModuleModalProps> = ({
  projectId,
  parentModule,
  accentColor,
  existingNames,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('folder');
  const [isVisible, setIsVisible] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isFolder = Boolean(parentModule);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError(isFolder ? 'Folder name is required' : 'Module name is required');
      return;
    }

    if (existingNames.some((n) => n.trim().toLowerCase() === trimmed.toLowerCase())) {
      setError(`A module or folder named "${trimmed}" already exists in this project`);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await projectModuleService.createModule(projectId, {
        name: trimmed,
        description: description.trim() || null,
        icon,
        parentId: parentModule ? parentModule.id : null,
        isVisible,
        isPinned: isFolder ? false : isPinned,
      });

      if (res.success && res.data) {
        onCreated(res.data);
      } else {
        setError(res.error || 'Failed to create module');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs"
    >
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Right-Side Slide-Over Drawer with Spring Animation */}
      <motion.div
        initial={{ x: '100%', opacity: 0.5 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0.5 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280, mass: 0.85 }}
        className="relative w-full max-w-lg h-full bg-[#0F1015] border-l border-[#27272A] shadow-2xl flex flex-col z-10"
      >
        {/* Sticky Header */}
        <div className="shrink-0 h-14 px-5 border-b border-[#27272A] flex items-center justify-between bg-[#121319]">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            >
              {isFolder ? <FolderPlus size={15} strokeWidth={2.2} /> : <Boxes size={15} strokeWidth={2.2} />}
            </div>
            <div>
              <h2 className="text-xs font-semibold text-white">
                {isFolder ? 'Create Module Folder' : 'Create New Module'}
              </h2>
              <p className="text-[11px] text-zinc-400">
                {isFolder
                  ? `Inside parent: ${parentModule?.name} (1 level max)`
                  : 'Group related features and submodules'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable Form Body - NO scrollbar */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-none">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {isFolder && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
                <FolderPlus size={14} className="shrink-0 mt-0.5 text-amber-400" />
                <span>
                  This folder will be nested inside <strong>{parentModule?.name}</strong>. Strictly 1-level limit: this child folder cannot contain further module folders.
                </span>
              </div>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                {isFolder ? 'Folder Name' : 'Module Name'} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isFolder ? 'e.g. Services, APIs, Workflows...' : 'e.g. Planning, Development, QA...'}
                className="w-full px-3 py-2 text-xs bg-[#0E0F14] border border-[#27272A] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Description (Optional)</label>
              <textarea
                rows={2}
                maxLength={200}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this scope..."
                className="w-full px-3 py-2 text-xs bg-[#0E0F14] border border-[#27272A] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none transition-colors"
              />
            </div>

            {/* Icon Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Choose Icon</label>
              <ModuleIconPicker value={icon} onChange={setIcon} accentColor={accentColor} />
            </div>

            {/* Sidebar Visibility Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#27272A] bg-[#0E0F14]">
              <div>
                <p className="text-xs font-medium text-white">Show in Project Sidebar</p>
                <p className="text-[11px] text-zinc-400">Can be toggled anytime from settings</p>
              </div>
              <input
                type="checkbox"
                checked={isVisible}
                onChange={(e) => setIsVisible(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 focus:ring-0 cursor-pointer"
              />
            </div>

            {/* Pin to Top Toggle (only for root modules) */}
            {!isFolder && (
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#27272A] bg-[#0E0F14]">
                <div className="flex items-center gap-2">
                  <Pin size={14} className={isPinned ? 'text-amber-400 fill-amber-400' : 'text-zinc-500'} />
                  <div>
                    <p className="text-xs font-medium text-white">Pin to Top of Sidebar</p>
                    <p className="text-[11px] text-zinc-400">Position this module prominently at the top of the sidebar</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="shrink-0 p-4 px-5 border-t border-[#27272A] bg-[#121319] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded-lg text-xs font-semibold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>{isFolder ? 'Create Folder' : 'Create Module'}</span>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// ─── Edit Module Modal ────────────────────────────────────────────────────────

interface EditModuleModalProps {
  projectId: number;
  module: ProjectModule;
  accentColor: string;
  existingNames: string[];
  onClose: () => void;
  onUpdated: () => void;
}

const EditModuleModal: React.FC<EditModuleModalProps> = ({
  projectId,
  module,
  accentColor,
  existingNames,
  onClose,
  onUpdated,
}) => {
  const [name, setName] = useState(module.name);
  const [description, setDescription] = useState(module.description || '');
  const [icon, setIcon] = useState(module.icon || 'folder');
  const [isPinned, setIsPinned] = useState(Boolean(module.isPinned));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Module name is required');
      return;
    }

    if (existingNames.some((n) => n.trim().toLowerCase() === trimmed.toLowerCase())) {
      setError(`A module named "${trimmed}" already exists`);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await projectModuleService.updateModule(projectId, module.id, {
        name: trimmed,
        description: description.trim() || null,
        icon,
        isPinned,
      });

      if (res.success) {
        onUpdated();
      } else {
        setError(res.error || 'Failed to update module');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-[#27272A] bg-[#121319] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Sticky Header */}
        <div className="shrink-0 p-4 px-5 border-b border-[#27272A] flex items-center justify-between bg-[#121319]">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            >
              <Edit2 size={13} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Edit Module</h2>
              <p className="text-[11px] text-zinc-400">Update module identity and icon</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-4.5 scrollbar-thin scrollbar-thumb-zinc-700">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Module Name</label>
              <input
                type="text"
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0E0F14] border border-[#27272A] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Description (Optional)</label>
              <textarea
                rows={2}
                maxLength={200}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0E0F14] border border-[#27272A] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Change Icon</label>
              <ModuleIconPicker value={icon} onChange={setIcon} accentColor={accentColor} />
            </div>

            {/* Pin to Top Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#27272A] bg-[#0E0F14]">
              <div className="flex items-center gap-2">
                <Pin size={14} className={isPinned ? 'text-amber-400 fill-amber-400' : 'text-zinc-500'} />
                <div>
                  <p className="text-xs font-medium text-white">Pin to Top of Sidebar</p>
                  <p className="text-[11px] text-zinc-400">Position this module prominently at the top of the sidebar</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Sticky Actions Footer */}
          <div className="shrink-0 p-4 px-5 border-t border-[#27272A] bg-[#121319] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded-lg text-xs font-semibold text-white shadow-sm cursor-pointer disabled:opacity-50 transition-all"
              style={{ backgroundColor: accentColor }}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Delete Module Modal ──────────────────────────────────────────────────────

interface DeleteModuleModalProps {
  module: ProjectModule;
  otherModules: ProjectModule[];
  deleteMode: 'cascade' | 'move';
  setDeleteMode: (m: 'cascade' | 'move') => void;
  targetModuleId: number | null;
  setTargetModuleId: (id: number) => void;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteModuleModal: React.FC<DeleteModuleModalProps> = ({
  module,
  otherModules,
  deleteMode,
  setDeleteMode,
  targetModuleId,
  setTargetModuleId,
  isSaving,
  onClose,
  onConfirm,
}) => {
  const hasSubmodules = (module.submodules?.length || 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#121319] shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 text-red-400">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <Trash2 size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Delete Module</h2>
            <p className="text-xs text-zinc-400">Are you sure you want to delete "{module.name}"?</p>
          </div>
        </div>

        {hasSubmodules ? (
          <div className="space-y-3 p-3.5 rounded-xl border border-zinc-800 bg-[#0E0F14] text-xs">
            <p className="text-amber-400 font-medium flex items-center gap-1.5">
              <AlertTriangle size={13} />
              <span>This module contains {module.submodules?.length} submodule(s).</span>
            </p>

            <div className="space-y-2 pt-1">
              {otherModules.length > 0 && (
                <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-zinc-800/60 cursor-pointer">
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={deleteMode === 'move'}
                    onChange={() => setDeleteMode('move')}
                    className="mt-0.5 text-purple-600 focus:ring-0"
                  />
                  <div className="space-y-1 flex-1">
                    <span className="font-medium text-white block">Move submodules to another module</span>
                    {deleteMode === 'move' && (
                      <select
                        value={targetModuleId || ''}
                        onChange={(e) => setTargetModuleId(parseInt(e.target.value, 10))}
                        className="w-full mt-1.5 px-2.5 py-1.5 text-xs bg-[#14151B] border border-zinc-700 rounded-lg text-white focus:outline-none"
                      >
                        {otherModules.map((om) => (
                          <option key={om.id} value={om.id}>
                            {om.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </label>
              )}

              <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-zinc-800/60 cursor-pointer">
                <input
                  type="radio"
                  name="deleteMode"
                  checked={deleteMode === 'cascade'}
                  onChange={() => setDeleteMode('cascade')}
                  className="mt-0.5 text-red-600 focus:ring-0"
                />
                <div>
                  <span className="font-medium text-red-300 block">Delete all submodules permanently</span>
                  <span className="text-[11px] text-zinc-500">
                    This will remove the submodules from the project structure.
                  </span>
                </div>
              </label>
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-400">
            This module has no submodules. Deleting it will remove it from the project sidebar and settings.
          </p>
        )}

        <div className="pt-2 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSaving ? 'Deleting...' : 'Delete Module'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Create Submodule Drawer ───────────────────────────────────────────────────

const BUILT_IN_CATEGORIES: { id: string; label: string; keys?: string[] }[] = [
  { id: 'all', label: 'All' },
  { id: 'git', label: 'Git', keys: ['git-overview', 'repositories', 'pulls', 'git-commits', 'git-code'] },
  { id: 'development', label: 'Development', keys: ['overview', 'development', 'issues', 'board', 'cycles', 'milestones'] },
  { id: 'testing', label: 'Testing', keys: ['test-cases', 'defects'] },
  { id: 'collaboration', label: 'Collaboration', keys: ['docs', 'documents.knowledge_base', 'whiteboard', 'activity'] },
];

interface CreateSubmoduleModalProps {
  projectId: number;
  moduleId: number;
  parentModule?: ProjectModule;
  accentColor: string;
  onClose: () => void;
  onCreated: () => void;
}

const CreateSubmoduleModal: React.FC<CreateSubmoduleModalProps> = ({
  projectId,
  moduleId,
  parentModule,
  accentColor,
  onClose,
  onCreated,
}) => {
  const [subType, setSubType] = useState<'built_in' | 'composite' | 'custom'>('built_in');
  const [selectedBuiltInKey, setSelectedBuiltInKey] = useState<string>('issues');
  const [builtInCategory, setBuiltInCategory] = useState<string>('all');
  const [moduleSearch, setModuleSearch] = useState<string>('');
  const [name, setName] = useState('Issues');
  const [icon, setIcon] = useState('circle-dot');
  const [docStorageMode, setDocStorageMode] = useState<'folder' | 'branch'>('folder');
  const [docFolderPath, setDocFolderPath] = useState('');
  const [docBranchName, setDocBranchName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);



  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Composite builder state
  const [compositeFeatures, setCompositeFeatures] = useState<GitFeatureKey[]>([
    'git.overview',
    'git.merge_requests',
  ]);
  const [compositeLayout, setCompositeLayout] = useState<CompositeLayout>('tabs');
  const [compositeCards, setCompositeCards] = useState<string[]>([
    'total-repos',
    'open-issues',
    'open-mrs',
    'mrs-with-conflicts',
  ]);

  // When selecting built-in, update default name & icon
  const handleSelectBuiltIn = (def: BuiltInSubmoduleDefinition) => {
    setSelectedBuiltInKey(def.key);
    setName(def.defaultName);
    setIcon(def.defaultIcon);
  };



  const handleToggleCompositeFeature = (key: GitFeatureKey) => {
    setCompositeFeatures((prev) =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter((k) => k !== key) : prev) : [...prev, key]
    );
  };

  const handleToggleSummaryCard = (id: string) => {
    setCompositeCards((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const filteredBuiltIns = useMemo(() => {
    let list = BUILT_IN_SUBMODULE_DEFINITIONS;
    if (builtInCategory !== 'all') {
      const cat = BUILT_IN_CATEGORIES.find((c) => c.id === builtInCategory);
      if (cat?.keys) {
        list = list.filter((item) => cat.keys!.includes(item.key));
      }
    }
    if (moduleSearch.trim()) {
      const q = moduleSearch.toLowerCase();
      list = list.filter(
        (item) =>
          item.defaultName.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.key.toLowerCase().includes(q)
      );
    }
    return list;
  }, [builtInCategory, moduleSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Submodule name is required');
      return;
    }

    // Check duplicate in parent module
    if (
      parentModule?.submodules?.some((s) => s.name.trim().toLowerCase() === trimmed.toLowerCase())
    ) {
      setError(`A submodule named "${trimmed}" already exists in "${parentModule.name}"`);
      return;
    }

    try {
      setIsSubmitting(true);
      const isDocBuiltIn =
        subType === 'built_in' &&
        ['docs', 'documents', 'documents.knowledge_base'].includes(selectedBuiltInKey);
      const safeSlug =
        trimmed
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'docs';

      const configJson =
        subType === 'composite'
          ? JSON.stringify({
              features: compositeFeatures,
              layout: compositeLayout,
              summaryCards: compositeCards,
            })
          : isDocBuiltIn
          ? JSON.stringify({
              storageMode: docStorageMode,
              folderPath:
                docStorageMode === 'folder'
                  ? docFolderPath.trim() || `modules/${safeSlug}`
                  : 'documents',
              branchName:
                docStorageMode === 'branch'
                  ? docBranchName.trim() || `docs/${safeSlug}`
                  : undefined,
            })
          : null;

      const res = await projectModuleService.createSubmodule(projectId, moduleId, {
        name: trimmed,
        type: subType,
        builtInKey: subType === 'built_in' ? selectedBuiltInKey : null,
        config: configJson,
        icon,
        isVisible: true,
      });

      if (res.success) {
        onCreated();
      } else {
        setError(res.error || 'Failed to create submodule');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs"
    >
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Right-Side Slide-Over Drawer with Spring Animation */}
      <motion.div
        initial={{ x: '100%', opacity: 0.5 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0.5 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280, mass: 0.85 }}
        className="relative w-full max-w-2xl h-full bg-[#0F1015] border-l border-[#27272A] shadow-2xl flex flex-col z-10"
      >
        {/* Drawer Header */}
        <div className="shrink-0 h-14 px-5 border-b border-[#27272A] flex items-center justify-between bg-[#121319]">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            >
              <Plus size={15} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <span>Add Submodule</span>
                <span className="text-zinc-500 font-normal">to</span>
                <span className="text-zinc-300 font-medium truncate max-w-[220px]">
                  {parentModule?.name || 'Module'}
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400">Choose type, pick preset, and configure identity</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer Body - Split Left Sidebar & Right Content */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Left Submodule Type Sidebar */}
            <div className="w-36 sm:w-40 bg-[#0C0D11] border-r border-[#27272A] p-2.5 space-y-1.5 shrink-0 select-none flex flex-col">
              <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-2 pt-1 pb-1">
                Submodule Type
              </div>

              {/* Built-in Button */}
              <button
                type="button"
                onClick={() => {
                  setSubType('built_in');
                  const def =
                    BUILT_IN_SUBMODULE_DEFINITIONS.find((d) => d.key === selectedBuiltInKey) ||
                    BUILT_IN_SUBMODULE_DEFINITIONS[0];
                  setName(def.defaultName);
                  setIcon(def.defaultIcon);
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-medium transition-all cursor-pointer border',
                  subType === 'built_in'
                    ? 'text-white border-zinc-700 bg-zinc-800/90 shadow-xs'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                )}
                style={
                  subType === 'built_in'
                    ? { borderColor: `${accentColor}80`, backgroundColor: `${accentColor}18` }
                    : undefined
                }
              >
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-colors"
                  style={
                    subType === 'built_in'
                      ? { backgroundColor: `${accentColor}25`, borderColor: `${accentColor}60`, color: accentColor }
                      : { backgroundColor: '#18191E', borderColor: '#27272A', color: '#71717A' }
                  }
                >
                  <Sparkles size={13} />
                </div>
                <div className="min-w-0">
                  <span className="block font-semibold text-[11.5px] leading-tight">Built-in</span>
                  <span className="text-[9.5px] text-zinc-500 block">Predefined tool</span>
                </div>
              </button>

              {/* Composite Button */}
              <button
                type="button"
                onClick={() => {
                  setSubType('composite');
                  setName('Git Dev Hub');
                  setIcon('boxes');
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-medium transition-all cursor-pointer border',
                  subType === 'composite'
                    ? 'text-white border-zinc-700 bg-zinc-800/90 shadow-xs'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                )}
                style={
                  subType === 'composite'
                    ? { borderColor: `${accentColor}80`, backgroundColor: `${accentColor}18` }
                    : undefined
                }
              >
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-colors"
                  style={
                    subType === 'composite'
                      ? { backgroundColor: `${accentColor}25`, borderColor: `${accentColor}60`, color: accentColor }
                      : { backgroundColor: '#18191E', borderColor: '#27272A', color: '#71717A' }
                  }
                >
                  <Boxes size={13} />
                </div>
                <div className="min-w-0">
                  <span className="block font-semibold text-[11.5px] leading-tight">Composite</span>
                  <span className="text-[9.5px] text-zinc-500 block">Multi-Git hub</span>
                </div>
              </button>

              {/* Placeholder Button */}
              <button
                type="button"
                onClick={() => {
                  setSubType('custom');
                  setName('');
                  setIcon('folder-kanban');
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-medium transition-all cursor-pointer border',
                  subType === 'custom'
                    ? 'text-white border-zinc-700 bg-zinc-800/90 shadow-xs'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                )}
                style={
                  subType === 'custom'
                    ? { borderColor: `${accentColor}80`, backgroundColor: `${accentColor}18` }
                    : undefined
                }
              >
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-colors"
                  style={
                    subType === 'custom'
                      ? { backgroundColor: `${accentColor}25`, borderColor: `${accentColor}60`, color: accentColor }
                      : { backgroundColor: '#18191E', borderColor: '#27272A', color: '#71717A' }
                  }
                >
                  <FolderKanban size={13} />
                </div>
                <div className="min-w-0">
                  <span className="block font-semibold text-[11.5px] leading-tight">Placeholder</span>
                  <span className="text-[9.5px] text-zinc-500 block">Custom route</span>
                </div>
              </button>
            </div>

            {/* Right Main Content Form */}
            <div className="flex-1 min-w-0 overflow-y-auto p-4 space-y-4 scrollbar-none">
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* If Built-in: Search & Category Group Filter & Predefined Modules */}
              {subType === 'built_in' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200">Predefined Modules</label>
                    <span className="text-[11px] text-zinc-500">{filteredBuiltIns.length} available</span>
                  </div>

                  {/* Search Predefined Modules */}
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={moduleSearch}
                      onChange={(e) => setModuleSearch(e.target.value)}
                      placeholder="Search predefined modules (e.g. git, issues, kanban, whiteboard)..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#0E0F14] border border-[#27272A] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                    />
                    {moduleSearch && (
                      <button
                        type="button"
                        onClick={() => setModuleSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-0.5 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Group Filter Chips: All, Git, Development, Testing, Collaboration */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                    {BUILT_IN_CATEGORIES.map((cat) => {
                      const isActive = builtInCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setBuiltInCategory(cat.id)}
                          className={cn(
                            'px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer border',
                            isActive
                              ? 'text-white border-zinc-700 bg-zinc-800 shadow-xs'
                              : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-zinc-800/60'
                          )}
                          style={
                            isActive
                              ? { borderColor: `${accentColor}80`, backgroundColor: `${accentColor}25` }
                              : undefined
                          }
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Predefined Modules Grid with Increased Height */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[290px] sm:max-h-[320px] overflow-y-auto p-1.5 rounded-xl border border-[#27272A] bg-[#0E0F14] scrollbar-none">
                    {filteredBuiltIns.map((def) => {
                      const Icon = def.iconComponent;
                      const isSelected = selectedBuiltInKey === def.key;
                      return (
                        <div
                          key={def.key}
                          onClick={() => handleSelectBuiltIn(def)}
                          className={cn(
                            'group relative flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer',
                            isSelected
                              ? 'text-white shadow-xs'
                              : 'border-[#27272A]/70 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                          )}
                          style={
                            isSelected
                              ? {
                                  borderColor: accentColor,
                                  backgroundColor: `${accentColor}18`,
                                }
                              : undefined
                          }
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border mt-0.5"
                            style={
                              isSelected
                                ? { backgroundColor: `${accentColor}30`, borderColor: accentColor, color: '#FFFFFF' }
                                : { backgroundColor: '#17181D', borderColor: '#27272A', color: '#A1A1AA' }
                            }
                          >
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="font-semibold text-[12px] text-white truncate">{def.defaultName}</p>

                              {isSelected && (
                                <div
                                  className="w-4 h-4 rounded-full flex items-center justify-center text-white shrink-0 shadow-xs"
                                  style={{ backgroundColor: accentColor }}
                                >
                                  <Check size={9} strokeWidth={3.5} />
                                </div>
                              )}
                            </div>
                            <p className="text-[10.5px] text-zinc-400 line-clamp-1 mt-0.5 leading-snug">
                              {def.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    {filteredBuiltIns.length === 0 && (
                      <div className="col-span-full py-8 text-center text-xs text-zinc-500">
                        No predefined modules matching "{moduleSearch}"
                      </div>
                    )}
                  </div>

                  {['docs', 'documents', 'documents.knowledge_base'].includes(selectedBuiltInKey) && (
                    <div className="p-3.5 rounded-xl border border-[#27272A] bg-[#0E0F14] space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <FolderGit2 size={14} style={{ color: accentColor }} />
                          Document Repository Isolation
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400">
                          Uses shared project repo · 2 GB combined
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Files in this module stay isolated in DevFlow and are stored either inside a dedicated folder or on a dedicated Git branch of your connected storage repo.
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setDocStorageMode('folder')}
                          className={cn(
                            'p-2.5 rounded-lg border text-left transition-all cursor-pointer',
                            docStorageMode === 'folder'
                              ? 'bg-zinc-900 text-white'
                              : 'border-[#27272A] text-zinc-400 hover:text-zinc-200'
                          )}
                          style={docStorageMode === 'folder' ? { borderColor: accentColor } : undefined}
                        >
                          <div className="text-xs font-semibold flex items-center gap-1.5">
                            <Folder size={12} style={docStorageMode === 'folder' ? { color: accentColor } : undefined} />
                            Dedicated Folder
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">
                            Folder inside default branch
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDocStorageMode('branch')}
                          className={cn(
                            'p-2.5 rounded-lg border text-left transition-all cursor-pointer',
                            docStorageMode === 'branch'
                              ? 'bg-zinc-900 text-white'
                              : 'border-[#27272A] text-zinc-400 hover:text-zinc-200'
                          )}
                          style={docStorageMode === 'branch' ? { borderColor: accentColor } : undefined}
                        >
                          <div className="text-xs font-semibold flex items-center gap-1.5">
                            <GitBranch size={12} style={docStorageMode === 'branch' ? { color: accentColor } : undefined} />
                            Dedicated Branch
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">
                            Isolated Git branch in repo
                          </div>
                        </button>
                      </div>

                      {docStorageMode === 'folder' ? (
                        <div>
                          <label className="text-[11px] text-zinc-400 block mb-1">
                            Folder Name / Path <span className="text-zinc-500">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={docFolderPath}
                            onChange={(e) => setDocFolderPath(e.target.value)}
                            placeholder={`modules/${(name || 'documents').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                            className="w-full px-3 py-1.5 rounded-lg bg-[#17181D] border border-[#27272A] text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="text-[11px] text-zinc-400 block mb-1">
                            Branch Name <span className="text-zinc-500">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={docBranchName}
                            onChange={(e) => setDocBranchName(e.target.value)}
                            placeholder={`docs/${(name || 'documents').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                            className="w-full px-3 py-1.5 rounded-lg bg-[#17181D] border border-[#27272A] text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* If Composite: Builder UI */}
              {subType === 'composite' && (
                <div className="space-y-3.5 p-3.5 rounded-xl border border-zinc-800 bg-[#0E0F14]">
                  {/* Features Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Boxes size={13} style={{ color: accentColor }} />
                      <span>Included Git Features</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {GIT_FEATURES_REGISTRY.map((feat) => {
                        const isChecked = compositeFeatures.includes(feat.key);
                        return (
                          <button
                            key={feat.key}
                            type="button"
                            onClick={() => handleToggleCompositeFeature(feat.key)}
                            className={cn(
                              'p-2 rounded-lg border text-left transition-all cursor-pointer flex items-start gap-2',
                              isChecked
                                ? 'text-white border-zinc-700 bg-zinc-800/70'
                                : 'border-[#27272A] text-zinc-400 hover:text-zinc-200'
                            )}
                            style={isChecked ? { borderColor: `${accentColor}80`, backgroundColor: `${accentColor}18` } : undefined}
                          >
                            <div
                              className={cn(
                                'w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0',
                                isChecked ? 'text-white' : 'border-zinc-700 bg-zinc-800'
                              )}
                              style={isChecked ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
                            >
                              {isChecked && <Check size={10} strokeWidth={3} />}
                            </div>
                            <div className="min-w-0">
                              <span className="text-[11.5px] font-semibold block leading-tight">{feat.title}</span>
                              <span className="text-[9.5px] text-zinc-400 line-clamp-1">{feat.description}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Layout */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-200">Submodule Layout</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['tabs', 'stacked', 'split'] as const).map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setCompositeLayout(l)}
                          className={cn(
                            'py-1 rounded-md text-xs font-medium capitalize transition-all cursor-pointer text-center border',
                            compositeLayout === l
                              ? 'bg-zinc-800 text-white border-zinc-700 font-semibold shadow-xs'
                              : 'border-[#27272A] text-zinc-400 hover:text-zinc-200'
                          )}
                          style={
                            compositeLayout === l
                              ? { borderColor: `${accentColor}80`, backgroundColor: `${accentColor}25` }
                              : undefined
                          }
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-200">Summary Metric Cards</label>
                      <span className="text-[10px] text-zinc-500">{compositeCards.length} selected</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {GIT_SUMMARY_CARD_DEFINITIONS.map((c) => {
                        const isSelected = compositeCards.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleToggleSummaryCard(c.id)}
                            className={cn(
                              'px-2 py-0.5 rounded-md text-[11px] font-medium border transition-all cursor-pointer flex items-center gap-1.5',
                              isSelected
                                ? 'bg-zinc-800 text-white border-zinc-600 shadow-xs'
                                : 'bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                            )}
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: isSelected ? c.color : '#52525B' }}
                            />
                            <span>{c.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* If Placeholder / Custom */}
              {subType === 'custom' && (
                <div className="p-3.5 rounded-xl border border-zinc-800 bg-[#0E0F14] text-xs text-zinc-400 space-y-1">
                  <p className="font-medium text-white flex items-center gap-1.5">
                    <Info size={13} style={{ color: accentColor }} />
                    <span>Custom Structural Placeholder</span>
                  </p>
                  <p className="text-[11px] leading-relaxed text-zinc-400">
                    Custom submodules act as placeholders in your project navigation tree. When clicked,
                    they display an informative overview and placeholder route.
                  </p>
                </div>
              )}

              {/* Display Name & Icon Section */}
              <div className="space-y-3 pt-2 border-t border-[#27272A]/80">
                <label className="text-xs font-semibold text-zinc-200 block">
                  Display Name <span className="text-red-400">*</span>
                </label>

                <div className="space-y-1.5">
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Issues, Sprint Backlog, Quality Audits..."
                    className="w-full px-3 py-2 text-xs bg-[#0E0F14] border border-[#27272A] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                  />
                </div>

                {/* Compact Icon Picker with Increased Height */}
                <div className="space-y-1.5">
                  <ModuleIconPicker value={icon} onChange={setIcon} accentColor={accentColor} gridHeight="max-h-[220px]" />
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Drawer Actions Footer */}
          <div className="shrink-0 h-14 px-5 border-t border-[#27272A] bg-[#121319] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded-lg text-xs font-semibold text-white shadow-sm cursor-pointer disabled:opacity-50 transition-all"
              style={{ backgroundColor: accentColor }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <span>Add Submodule</span>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// ─── Edit Submodule Modal ─────────────────────────────────────────────────────

interface EditSubmoduleModalProps {
  projectId: number;
  submodule: ProjectSubmodule;
  accentColor: string;
  onClose: () => void;
  onUpdated: () => void;
}

const EditSubmoduleModal: React.FC<EditSubmoduleModalProps> = ({
  projectId,
  submodule,
  accentColor,
  onClose,
  onUpdated,
}) => {
  const [name, setName] = useState(submodule.name);
  const [icon, setIcon] = useState(submodule.icon || 'circle-dot');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Parse existing config if composite
  const initialConfig: CompositeSubmoduleConfig = (() => {
    try {
      return submodule.config ? JSON.parse(submodule.config) : {};
    } catch {
      return {};
    }
  })();

  const [compositeFeatures, setCompositeFeatures] = useState<GitFeatureKey[]>(
    Array.isArray(initialConfig.features) && initialConfig.features.length > 0
      ? initialConfig.features
      : ['git.overview', 'git.merge_requests']
  );
  const [compositeLayout, setCompositeLayout] = useState<CompositeLayout>(
    initialConfig.layout || 'tabs'
  );
  const [compositeCards, setCompositeCards] = useState<string[]>(
    Array.isArray(initialConfig.summaryCards)
      ? initialConfig.summaryCards
      : ['total-repos', 'open-issues', 'open-mrs', 'mrs-with-conflicts']
  );

  const handleToggleCompositeFeature = (key: GitFeatureKey) => {
    setCompositeFeatures((prev) =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter((k) => k !== key) : prev) : [...prev, key]
    );
  };

  const handleToggleSummaryCard = (id: string) => {
    setCompositeCards((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      const configJson =
        submodule.type === 'composite'
          ? JSON.stringify({
              features: compositeFeatures,
              layout: compositeLayout,
              summaryCards: compositeCards,
            })
          : undefined;

      const res = await projectModuleService.updateSubmodule(projectId, submodule.id, {
        name: trimmed,
        icon,
        config: configJson,
      });
      if (res.success) {
        onUpdated();
      } else {
        setError(res.error || 'Failed to update submodule');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs"
    >
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Right-Side Slide-Over Drawer with Spring Animation */}
      <motion.div
        initial={{ x: '100%', opacity: 0.5 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0.5 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280, mass: 0.85 }}
        className="relative w-full max-w-xl h-full bg-[#0F1015] border-l border-[#27272A] shadow-2xl flex flex-col z-10"
      >
        {/* Drawer Header */}
        <div className="shrink-0 h-14 px-5 border-b border-[#27272A] flex items-center justify-between bg-[#121319]">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            >
              <Edit2 size={13} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Edit Submodule</h2>
              <span className="text-[11px] text-zinc-400 capitalize">{submodule.type} submodule</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-none">
            {error && (
              <div className="text-xs text-red-400 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Submodule Name</label>
              <input
                type="text"
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0E0F14] border border-[#27272A] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Icon</label>
              <ModuleIconPicker value={icon} onChange={setIcon} accentColor={accentColor} gridHeight="max-h-[220px]" />
            </div>

            {/* If Composite, show configuration editors */}
            {submodule.type === 'composite' && (
              <div className="space-y-4 p-4 rounded-xl border border-zinc-800 bg-[#0E0F14]">
                {/* 1. Features */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-200">Included Features</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {GIT_FEATURES_REGISTRY.map((feat) => {
                      const isChecked = compositeFeatures.includes(feat.key);
                      return (
                        <button
                          key={feat.key}
                          type="button"
                          onClick={() => handleToggleCompositeFeature(feat.key)}
                          className={cn(
                            'p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2',
                            isChecked
                              ? 'border-indigo-500/60 bg-indigo-500/10 text-white'
                              : 'border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          )}
                          style={isChecked ? { borderColor: `${accentColor}80`, backgroundColor: `${accentColor}18` } : undefined}
                        >
                          <div
                            className={cn(
                              'w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0',
                              isChecked ? 'text-white' : 'border-zinc-700 bg-zinc-800'
                            )}
                            style={isChecked ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
                          >
                            {isChecked && <Check size={10} strokeWidth={3} />}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold block">{feat.title}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Layout */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-200">Layout</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['tabs', 'stacked', 'split'] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setCompositeLayout(l)}
                        className={cn(
                          'py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer text-center border',
                          compositeLayout === l
                            ? 'bg-zinc-800 text-white border-zinc-700 font-semibold shadow-xs'
                            : 'border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        )}
                        style={
                          compositeLayout === l
                            ? { borderColor: `${accentColor}80`, backgroundColor: `${accentColor}25` }
                            : undefined
                        }
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Summary Cards */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-200">Summary Metric Cards</label>
                  <div className="flex flex-wrap gap-1.5">
                    {GIT_SUMMARY_CARD_DEFINITIONS.map((c) => {
                      const isSelected = compositeCards.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleToggleSummaryCard(c.id)}
                          className={cn(
                            'px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all cursor-pointer flex items-center gap-1.5',
                            isSelected
                              ? 'bg-zinc-800 text-white border-zinc-600 shadow-xs'
                              : 'bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                          )}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: isSelected ? c.color : '#52525B' }}
                          />
                          <span>{c.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Actions Footer */}
          <div className="shrink-0 h-14 px-5 border-t border-[#27272A] bg-[#121319] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4.5 py-2 rounded-lg text-xs font-semibold text-white shadow-sm cursor-pointer disabled:opacity-50 transition-all"
              style={{ backgroundColor: accentColor }}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// ─── Move Submodule Modal ─────────────────────────────────────────────────────

interface MoveSubmoduleModalProps {
  submodule: ProjectSubmodule;
  currentModule?: ProjectModule;
  availableModules: ProjectModule[];
  isSaving: boolean;
  onClose: () => void;
  onConfirm: (targetModuleId: number) => void;
}

const MoveSubmoduleModal: React.FC<MoveSubmoduleModalProps> = ({
  submodule,
  currentModule,
  availableModules,
  isSaving,
  onClose,
  onConfirm,
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState<number>(
    availableModules.length > 0 ? availableModules[0].id : 0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-[#27272A] bg-[#121319] shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-center gap-2.5">
          <MoveRight size={16} className="text-indigo-400" />
          <h2 className="text-sm font-semibold text-white">Move Submodule</h2>
        </div>

        <p className="text-xs text-zinc-400">
          Move <strong className="text-white">"{submodule.name}"</strong> from{' '}
          <strong className="text-white">{currentModule?.name || 'current module'}</strong> to another module.
          Its identity and settings will be preserved.
        </p>

        {availableModules.length === 0 ? (
          <div className="p-3 rounded-lg bg-zinc-800 text-xs text-zinc-400">
            No other modules available in this project. Create another module first.
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Select Destination Module</label>
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 text-xs bg-[#0E0F14] border border-[#27272A] rounded-lg text-white focus:outline-none"
            >
              {availableModules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.submodules?.length || 0} items)
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="pt-2 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving || availableModules.length === 0}
            onClick={() => onConfirm(selectedTargetId)}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSaving ? 'Moving...' : 'Move Submodule'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Delete Submodule Modal ───────────────────────────────────────────────────

interface DeleteSubmoduleModalProps {
  submodule: ProjectSubmodule;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteSubmoduleModal: React.FC<DeleteSubmoduleModalProps> = ({
  submodule,
  isSaving,
  onClose,
  onConfirm,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#121319] shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 text-red-400">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <Trash2 size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Delete Submodule</h2>
            <p className="text-xs text-zinc-400">Are you sure you want to delete "{submodule.name}"?</p>
          </div>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          This will remove the submodule from this module and the project sidebar.
        </p>

        <div className="pt-2 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSaving ? 'Deleting...' : 'Delete Submodule'}
          </button>
        </div>
      </div>
    </div>
  );
};
