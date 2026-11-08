import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  CircleDot,
  Pencil,
  Check,
  X,
  EyeOff,
  GripVertical,
} from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useToast } from '../../context/ToastContext';
import { projectModuleService } from '../../services/projectModule.service';
import { resolveModuleIcon } from '../project/ModuleIconPicker';
import { cn } from '../../lib/utils';
import type { ProjectModule, ProjectSubmodule } from '../../types/module';

interface SidebarProjectModulesProps {
  projectId: number;
}

export const SidebarProjectModules: React.FC<SidebarProjectModulesProps> = ({ projectId }) => {
  const {
    projectModules,
    setProjectModules,
    refreshProjectModules,
    isCollapsed,
    isGroupExpanded,
    toggleGroup,
  } = useNavigation();
  const { toast } = useToast();
  const location = useLocation();

  // ─── Inline Editing State ────────────────────────────────────────────────
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
  const [editingModuleName, setEditingModuleName] = useState<string>('');
  const [editingSubmoduleId, setEditingSubmoduleId] = useState<number | null>(null);
  const [editingSubmoduleName, setEditingSubmoduleName] = useState<string>('');

  const moduleInputRef = useRef<HTMLInputElement>(null);
  const subInputRef = useRef<HTMLInputElement>(null);

  // ─── Swipe Left Active State ─────────────────────────────────────────────
  const [swipingModuleId, setSwipingModuleId] = useState<number | null>(null);
  const [swipingSubmoduleId, setSwipingSubmoduleId] = useState<number | null>(null);

  // Auto-focus input when editing starts
  useEffect(() => {
    if (editingModuleId && moduleInputRef.current) {
      moduleInputRef.current.focus();
      moduleInputRef.current.select();
    }
  }, [editingModuleId]);

  useEffect(() => {
    if (editingSubmoduleId && subInputRef.current) {
      subInputRef.current.focus();
      subInputRef.current.select();
    }
  }, [editingSubmoduleId]);

  // ─── Drag & Drop State ───────────────────────────────────────────────────
  const [draggedItem, setDraggedItem] = useState<{
    type: 'MODULE' | 'SUBMODULE';
    moduleId: number;
    submoduleId?: number;
    index: number;
  } | null>(null);

  const [moduleDropTarget, setModuleDropTarget] = useState<{
    moduleId: number;
    position: 'top' | 'bottom' | 'inside';
  } | null>(null);

  const [submoduleDropTarget, setSubmoduleDropTarget] = useState<{
    submoduleId: number;
    position: 'top' | 'bottom';
  } | null>(null);

  // ─── Module Renaming ────────────────────────────────────────────────────
  const startEditingModule = (mod: ProjectModule, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingModuleId(mod.id);
    setEditingModuleName(mod.name);
  };

  const saveModuleRename = async (mod: ProjectModule) => {
    const trimmed = editingModuleName.trim();
    if (!trimmed || trimmed === mod.name) {
      setEditingModuleId(null);
      return;
    }

    // Optimistic update
    setProjectModules((prev) =>
      prev.map((m) => (m.id === mod.id ? { ...m, name: trimmed } : m))
    );
    setEditingModuleId(null);

    try {
      const res = await projectModuleService.updateModule(projectId, mod.id, { name: trimmed });
      if (!res.success) {
        toast.error('Failed to rename module', res.error || 'Server error');
        refreshProjectModules(projectId);
      } else {
        toast.success('Module renamed', `Renamed to "${trimmed}"`);
      }
    } catch {
      toast.error('Failed to rename module', 'Could not save changes');
      refreshProjectModules(projectId);
    }
  };

  // ─── Submodule Renaming ─────────────────────────────────────────────────
  const startEditingSubmodule = (sub: ProjectSubmodule, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingSubmoduleId(sub.id);
    setEditingSubmoduleName(sub.name);
  };

  const saveSubmoduleRename = async (sub: ProjectSubmodule, moduleId: number) => {
    const trimmed = editingSubmoduleName.trim();
    if (!trimmed || trimmed === sub.name) {
      setEditingSubmoduleId(null);
      return;
    }

    // Optimistic update
    setProjectModules((prev) =>
      prev.map((m) => {
        if (m.id !== moduleId) return m;
        return {
          ...m,
          submodules: (m.submodules || []).map((s) =>
            s.id === sub.id ? { ...s, name: trimmed } : s
          ),
        };
      })
    );
    setEditingSubmoduleId(null);

    try {
      const res = await projectModuleService.updateSubmodule(projectId, sub.id, { name: trimmed });
      if (!res.success) {
        toast.error('Failed to rename submodule', res.error || 'Server error');
        refreshProjectModules(projectId);
      } else {
        toast.success('Submodule renamed', `Renamed to "${trimmed}"`);
      }
    } catch {
      toast.error('Failed to rename submodule', 'Could not save changes');
      refreshProjectModules(projectId);
    }
  };

  // ─── Hide Actions ────────────────────────────────────────────────────────
  const handleHideModule = async (mod: ProjectModule) => {
    setProjectModules((prev) =>
      prev.map((m) => (m.id === mod.id ? { ...m, isVisible: false } : m))
    );
    toast.info('Module hidden', `"${mod.name}" was hidden. Restore in Project Structure.`);

    try {
      const res = await projectModuleService.updateModule(projectId, mod.id, { isVisible: false });
      if (!res.success) {
        toast.error('Failed to hide module', res.error || 'Server error');
        refreshProjectModules(projectId);
      }
    } catch {
      toast.error('Failed to hide module', 'Server error');
      refreshProjectModules(projectId);
    }
  };

  const handleHideSubmodule = async (sub: ProjectSubmodule, moduleId: number) => {
    setProjectModules((prev) =>
      prev.map((m) => {
        if (m.id !== moduleId) return m;
        return {
          ...m,
          submodules: (m.submodules || []).map((s) =>
            s.id === sub.id ? { ...s, isVisible: false } : s
          ),
        };
      })
    );
    toast.info('Submodule hidden', `"${sub.name}" was hidden. Restore in Project Structure.`);

    try {
      const res = await projectModuleService.updateSubmodule(projectId, sub.id, { isVisible: false });
      if (!res.success) {
        toast.error('Failed to hide submodule', res.error || 'Server error');
        refreshProjectModules(projectId);
      }
    } catch {
      toast.error('Failed to hide submodule', 'Server error');
      refreshProjectModules(projectId);
    }
  };

  // ─── Module Drag & Drop (Reordering) ────────────────────────────────────
  const handleModuleDragStart = (e: React.DragEvent, mod: ProjectModule, index: number) => {
    e.stopPropagation();
    const payload = { type: 'MODULE' as const, moduleId: mod.id, index };
    setDraggedItem(payload);
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleModuleDragOver = (e: React.DragEvent, mod: ProjectModule) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItem) return;

    if (draggedItem.type === 'MODULE') {
      if (draggedItem.moduleId === mod.id) {
        setModuleDropTarget(null);
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const position = e.clientY < mid ? 'top' : 'bottom';
      setModuleDropTarget({ moduleId: mod.id, position });
    } else if (draggedItem.type === 'SUBMODULE') {
      setModuleDropTarget({ moduleId: mod.id, position: 'inside' });
    }
  };

  const handleModuleDrop = async (e: React.DragEvent, targetMod: ProjectModule) => {
    e.preventDefault();
    e.stopPropagation();

    const currentDrop = moduleDropTarget;
    setModuleDropTarget(null);
    setDraggedItem(null);

    if (!currentDrop || !draggedItem) return;

    if (draggedItem.type === 'MODULE') {
      if (draggedItem.moduleId === targetMod.id) return;

      const sourceIdx = projectModules.findIndex((m) => m.id === draggedItem.moduleId);
      let targetIdx = projectModules.findIndex((m) => m.id === targetMod.id);
      if (sourceIdx === -1 || targetIdx === -1) return;

      if (currentDrop.position === 'bottom') {
        targetIdx = targetIdx + 1;
      }
      if (sourceIdx < targetIdx) {
        targetIdx = targetIdx - 1;
      }

      const reordered = [...projectModules];
      const [removed] = reordered.splice(sourceIdx, 1);
      reordered.splice(targetIdx, 0, removed);

      setProjectModules(reordered);

      try {
        await projectModuleService.reorderModules(
          projectId,
          reordered.map((m) => m.id)
        );
      } catch {
        toast.error('Failed to reorder modules', 'Please try again');
        refreshProjectModules(projectId);
      }
    } else if (draggedItem.type === 'SUBMODULE') {
      if (!draggedItem.submoduleId || draggedItem.moduleId === targetMod.id) return;

      try {
        const res = await projectModuleService.moveSubmodule(
          projectId,
          draggedItem.submoduleId,
          targetMod.id
        );
        if (res.success) {
          toast.success('Submodule moved', `Moved into ${targetMod.name}`);
          refreshProjectModules(projectId);
        } else {
          toast.error('Failed to move submodule', res.error || 'Server error');
        }
      } catch {
        toast.error('Failed to move submodule', 'Server error');
      }
    }
  };

  // ─── Submodule Drag & Drop (Reordering within or across modules) ──────────
  const handleSubDragStart = (
    e: React.DragEvent,
    mod: ProjectModule,
    sub: ProjectSubmodule,
    index: number
  ) => {
    e.stopPropagation();
    const payload = {
      type: 'SUBMODULE' as const,
      moduleId: mod.id,
      submoduleId: sub.id,
      index,
    };
    setDraggedItem(payload);
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSubDragOver = (e: React.DragEvent, sub: ProjectSubmodule) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItem || draggedItem.type !== 'SUBMODULE') return;
    if (draggedItem.submoduleId === sub.id) {
      setSubmoduleDropTarget(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const position = e.clientY < mid ? 'top' : 'bottom';
    setSubmoduleDropTarget({ submoduleId: sub.id, position });
  };

  const handleSubDrop = async (
    e: React.DragEvent,
    targetMod: ProjectModule,
    targetSub: ProjectSubmodule
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const currentDrop = submoduleDropTarget;
    setSubmoduleDropTarget(null);
    const item = draggedItem;
    setDraggedItem(null);

    if (!currentDrop || !item || item.type !== 'SUBMODULE' || !item.submoduleId) return;
    if (item.submoduleId === targetSub.id) return;

    if (item.moduleId === targetMod.id) {
      // Reorder within same module
      const submodules = targetMod.submodules || [];
      const sourceIdx = submodules.findIndex((s) => s.id === item.submoduleId);
      let targetIdx = submodules.findIndex((s) => s.id === targetSub.id);
      if (sourceIdx === -1 || targetIdx === -1) return;

      if (currentDrop.position === 'bottom') {
        targetIdx = targetIdx + 1;
      }
      if (sourceIdx < targetIdx) {
        targetIdx = targetIdx - 1;
      }

      const reordered = [...submodules];
      const [removed] = reordered.splice(sourceIdx, 1);
      reordered.splice(targetIdx, 0, removed);

      setProjectModules((prev) =>
        prev.map((m) => (m.id === targetMod.id ? { ...m, submodules: reordered } : m))
      );

      try {
        await projectModuleService.reorderSubmodules(
          projectId,
          targetMod.id,
          reordered.map((s) => s.id)
        );
      } catch {
        toast.error('Failed to reorder submodules', 'Please try again');
        refreshProjectModules(projectId);
      }
    } else {
      // Move to a different module
      try {
        const res = await projectModuleService.moveSubmodule(
          projectId,
          item.submoduleId,
          targetMod.id
        );
        if (res.success) {
          toast.success('Submodule moved', `Moved to ${targetMod.name}`);
          refreshProjectModules(projectId);
        } else {
          toast.error('Failed to move submodule', res.error || 'Server error');
        }
      } catch {
        toast.error('Failed to move submodule', 'Server error');
      }
    }
  };

  const seenBuiltInKeys = new Set<string>();

  return (
    <div className="space-y-0.5 select-none">
      {projectModules
        .filter((mod) => mod.isVisible)
        .map((mod, modIdx) => {
          const isExpanded = isGroupExpanded(`mod-${mod.id}`, true);
          const visibleSubmodules = (mod.submodules || []).filter((sub) => {
            if (!sub.isVisible) return false;
            if (sub.type === 'built_in' && sub.builtInKey) {
              if (seenBuiltInKeys.has(sub.builtInKey)) return false;
              seenBuiltInKeys.add(sub.builtInKey);
            }
            return true;
          });

          const isModuleDragTarget = moduleDropTarget?.moduleId === mod.id;
          const isEditingThisModule = editingModuleId === mod.id;

          return (
            <div
              key={`mod-${mod.id}`}
              className={cn(
                'relative transition-all duration-150',
                isModuleDragTarget &&
                  moduleDropTarget.position === 'top' &&
                  'border-t-2 border-indigo-500 pt-0.5',
                isModuleDragTarget &&
                  moduleDropTarget.position === 'bottom' &&
                  'border-b-2 border-indigo-500 pb-0.5',
                isModuleDragTarget &&
                  moduleDropTarget.position === 'inside' &&
                  'ring-1 ring-indigo-500/80 bg-indigo-500/10 rounded-md'
              )}
              onDragOver={(e) => handleModuleDragOver(e, mod)}
              onDrop={(e) => handleModuleDrop(e, mod)}
            >
              {/* ─── MODULE HEADER ROW (SWIPE LEFT TO HIDE) ───────────────── */}
              {!isCollapsed ? (
                <div className="relative overflow-hidden rounded-md group">
                  {/* Revealed red "Hide" background ONLY when actively dragging left */}
                  {swipingModuleId === mod.id && (
                    <div className="absolute inset-y-0 right-0 w-20 bg-rose-600/90 text-white flex items-center justify-end pr-2.5 gap-1 rounded-md text-[11px] font-semibold z-0">
                      <EyeOff size={12} />
                      <span>Hide</span>
                    </div>
                  )}

                  {/* Foreground draggable row */}
                  <motion.div
                    drag={!isEditingThisModule ? 'x' : false}
                    dragConstraints={{ left: -70, right: 0 }}
                    dragElastic={0.1}
                    onDrag={(_, info) => {
                      if (info.offset.x < -10) {
                        setSwipingModuleId(mod.id);
                      } else {
                        setSwipingModuleId(null);
                      }
                    }}
                    onDragEnd={(_, info) => {
                      setSwipingModuleId(null);
                      if (info.offset.x < -40 || info.velocity.x < -200) {
                        handleHideModule(mod);
                      }
                    }}
                    className="relative z-10 bg-[var(--sidebar-bg)] hover:bg-[var(--sidebar-hover)] flex items-center justify-between px-2 h-[30px] rounded-md transition-colors"
                  >
                    {/* Left: Drag Handle, Collapse chevron, Title or Inline Input */}
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      {/* Drag handle for reordering up/down */}
                      <div
                        draggable={!isEditingThisModule}
                        onDragStart={(e) => handleModuleDragStart(e, mod, modIdx)}
                        onDragEnd={() => setDraggedItem(null)}
                        className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-0.5 -ml-1 text-zinc-500 hover:text-zinc-300 transition-opacity"
                        title="Drag up or down to reorder module"
                      >
                        <GripVertical size={11} />
                      </div>

                      {/* Collapse/Expand Toggle */}
                      <button
                        type="button"
                        onClick={() => toggleGroup(`mod-${mod.id}`)}
                        className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 cursor-pointer min-w-0 flex-1 text-left"
                      >
                        <ChevronDown
                          size={12}
                          className={cn(
                            'text-zinc-500 shrink-0 transition-transform duration-150',
                            isExpanded ? '' : '-rotate-90'
                          )}
                        />

                        {/* Title or Inline Edit Input */}
                        {isEditingThisModule ? (
                          <div
                            className="flex items-center gap-1 w-full"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              ref={moduleInputRef}
                              type="text"
                              value={editingModuleName}
                              onChange={(e) => setEditingModuleName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveModuleRename(mod);
                                if (e.key === 'Escape') setEditingModuleId(null);
                              }}
                              className="w-full bg-[#1A1A1E] text-white text-[11px] font-semibold uppercase px-1.5 py-0.5 rounded border border-indigo-500/80 outline-none tracking-wider"
                            />
                            <button
                              type="button"
                              onClick={() => saveModuleRename(mod)}
                              className="p-1 rounded text-emerald-400 hover:bg-emerald-500/20"
                              title="Save"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingModuleId(null)}
                              className="p-1 rounded text-zinc-400 hover:bg-zinc-700/50"
                              title="Cancel"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-semibold text-sidebar-text-muted hover:text-zinc-200 transition-colors uppercase tracking-wider truncate">
                            {mod.name}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Right: Quick Edit Pencil & Hide Buttons on Hover */}
                    {!isEditingThisModule && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={(e) => startEditingModule(mod, e)}
                          title="Rename module"
                          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleHideModule(mod);
                          }}
                          title="Hide module"
                          className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <EyeOff size={11} />
                        </button>
                      </div>
                    )}
                  </motion.div>
                </div>
              ) : (
                /* Minimized Sidebar Module Separator */
                <div className="py-0.5 border-t border-sidebar-border/40 first:border-0" />
              )}

              {/* ─── SUBMODULES LIST (COMPACT, NO EXTRA SPACE) ─────────────── */}
              {isExpanded && (
                <div
                  className={cn(
                    'space-y-0.5',
                    !isCollapsed && 'pl-2'
                  )}
                >
                  <AnimatePresence initial={false}>
                    {visibleSubmodules.map((sub, subIdx) => {
                      const SubIcon = resolveModuleIcon(sub.icon, CircleDot);
                      const targetPath =
                        sub.type === 'built_in' && sub.builtInKey
                          ? `/projects/${projectId}/${sub.builtInKey}`
                          : `/projects/${projectId}/submodules/${sub.id}`;

                      const isActive =
                        location.pathname === targetPath ||
                        location.pathname.startsWith(`${targetPath}/`);
                      const isSubDragTarget = submoduleDropTarget?.submoduleId === sub.id;
                      const isEditingThisSub = editingSubmoduleId === sub.id;

                      if (isCollapsed) {
                        /* Minimized Collapsed Submodule Item (Icon Only with Tooltip) */
                        return (
                          <NavLink
                            key={`sub-c-${sub.id}`}
                            to={targetPath}
                            className={cn(
                              'group relative flex items-center justify-center w-10 h-8 mx-auto rounded-md transition-colors',
                              isActive
                                ? 'bg-sidebar-active text-sidebar-text-active'
                                : 'text-zinc-400 hover:text-white hover:bg-sidebar-hover'
                            )}
                          >
                            <SubIcon size={16} />
                            <div className="absolute left-full ml-2 px-2 py-1 bg-[#1C1C1F] border border-sidebar-border text-white text-xs font-medium rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
                              {sub.name}
                            </div>
                          </NavLink>
                        );
                      }

                      /* Full Expanded Submodule Item */
                      return (
                        <div
                          key={`sub-${sub.id}`}
                          className={cn(
                            'relative transition-all duration-150',
                            isSubDragTarget &&
                              submoduleDropTarget.position === 'top' &&
                              'border-t-2 border-indigo-400',
                            isSubDragTarget &&
                              submoduleDropTarget.position === 'bottom' &&
                              'border-b-2 border-indigo-400'
                          )}
                          onDragOver={(e) => handleSubDragOver(e, sub)}
                          onDrop={(e) => handleSubDrop(e, mod, sub)}
                        >
                          <div className="relative overflow-hidden rounded-md group">
                            {/* Revealed red "Hide" background ONLY when actively dragging left */}
                            {swipingSubmoduleId === sub.id && (
                              <div className="absolute inset-y-0 right-0 w-20 bg-rose-600/90 text-white flex items-center justify-end pr-2.5 gap-1 rounded-md text-[11px] font-medium z-0">
                                <EyeOff size={12} />
                                <span>Hide</span>
                              </div>
                            )}

                            {/* Foreground draggable & clickable row */}
                            <motion.div
                              drag={!isEditingThisSub ? 'x' : false}
                              dragConstraints={{ left: -70, right: 0 }}
                              dragElastic={0.1}
                              onDrag={(_, info) => {
                                if (info.offset.x < -10) {
                                  setSwipingSubmoduleId(sub.id);
                                } else {
                                  setSwipingSubmoduleId(null);
                                }
                              }}
                              onDragEnd={(_, info) => {
                                setSwipingSubmoduleId(null);
                                if (info.offset.x < -40 || info.velocity.x < -200) {
                                  handleHideSubmodule(sub, mod.id);
                                }
                              }}
                              className={cn(
                                'relative z-10 bg-[var(--sidebar-bg)] hover:bg-[var(--sidebar-hover)] flex items-center justify-between h-[32px] px-2 rounded-md transition-colors duration-150',
                                isActive &&
                                  'bg-sidebar-active text-sidebar-text-active font-medium'
                              )}
                            >
                              {/* Left: Drag Handle, Icon, and Label or Inline Input */}
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                {/* Submodule Drag Handle */}
                                <div
                                  draggable={!isEditingThisSub}
                                  onDragStart={(e) => handleSubDragStart(e, mod, sub, subIdx)}
                                  onDragEnd={() => setDraggedItem(null)}
                                  className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-0.5 -ml-1 text-zinc-500 hover:text-zinc-300 transition-opacity shrink-0"
                                  title="Drag up or down to reorder submodule"
                                >
                                  <GripVertical size={11} />
                                </div>

                                <SubIcon
                                  size={15}
                                  className={cn(
                                    'shrink-0',
                                    isActive ? 'text-indigo-400' : 'text-zinc-400 group-hover:text-zinc-200'
                                  )}
                                />

                                {isEditingThisSub ? (
                                  <div
                                    className="flex items-center gap-1 w-full"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      ref={subInputRef}
                                      type="text"
                                      value={editingSubmoduleName}
                                      onChange={(e) => setEditingSubmoduleName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveSubmoduleRename(sub, mod.id);
                                        if (e.key === 'Escape') setEditingSubmoduleId(null);
                                      }}
                                      className="w-full bg-[#1A1A1E] text-white text-[12.5px] px-1.5 py-0.5 rounded border border-indigo-500/80 outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => saveSubmoduleRename(sub, mod.id)}
                                      className="p-1 rounded text-emerald-400 hover:bg-emerald-500/20"
                                      title="Save"
                                    >
                                      <Check size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingSubmoduleId(null)}
                                      className="p-1 rounded text-zinc-400 hover:bg-zinc-700/50"
                                      title="Cancel"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <NavLink
                                    to={targetPath}
                                    className="truncate text-[13px] tracking-[-0.01em] min-w-0 flex-1"
                                  >
                                    {sub.name}
                                  </NavLink>
                                )}
                              </div>

                              {/* Right: Quick Edit Pencil & Hide Buttons on Hover */}
                              {!isEditingThisSub && (
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => startEditingSubmodule(sub, e)}
                                    title="Rename submodule"
                                    className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                                  >
                                    <Pencil size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleHideSubmodule(sub, mod.id);
                                    }}
                                    title="Hide submodule"
                                    className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                  >
                                    <EyeOff size={11} />
                                  </button>
                                </div>
                              )}
                            </motion.div>
                          </div>
                        </div>
                      );
                    })}
                  </AnimatePresence>

                  {/* Empty Submodules Indicator - ONLY shown when NOT collapsed */}
                  {!isCollapsed && visibleSubmodules.length === 0 && (
                    <div className="px-2 py-0.5 text-[11px] text-zinc-500 italic">
                      No visible submodules
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
};
