import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  PenTool,
  Plus,
  HelpCircle,
  Maximize2,
  Minimize2,
  Copy,
  Trash2,
  Edit2,
  Check,
} from 'lucide-react';
import { WhiteboardCanvas } from '../../components/whiteboard/WhiteboardCanvas';
import {
  loadBoardsMeta,
  loadActiveBoardId,
  saveActiveBoardId,
  createNewBoard,
  duplicateExistingBoard,
  deleteExistingBoard,
  renameExistingBoard,
} from '../../components/whiteboard/whiteboard.storage';
import { WhiteboardBoardMeta } from '../../components/whiteboard/whiteboard.types';
import { useAccentTheme } from '../../services/accentTheme.service';
import { useNavigation } from '../../context/NavigationContext';
import { cn } from '../../lib/utils';

export interface WhiteboardViewProps {
  submoduleId?: number | string;
  submoduleName?: string;
}

export const WhiteboardView: React.FC<WhiteboardViewProps> = ({
  submoduleId,
  submoduleName,
}) => {
  const { id, projectId: paramProjectId, submoduleId: paramSubmoduleId } = useParams<{
    id?: string;
    projectId?: string;
    submoduleId?: string;
  }>();

  const projectId = paramProjectId || id || '1';
  const effectiveSubmoduleId = submoduleId ?? paramSubmoduleId;
  const scopeKey = effectiveSubmoduleId ? `submodule_${effectiveSubmoduleId}` : 'main';

  const { accentColor } = useAccentTheme();
  const { projectModules } = useNavigation();

  const resolvedSubmoduleName = useMemo(() => {
    if (submoduleName) return submoduleName;
    if (!effectiveSubmoduleId || !projectModules) return undefined;
    const subIdNum = parseInt(String(effectiveSubmoduleId), 10);
    for (const mod of projectModules) {
      const found = mod.submodules?.find((s) => s.id === subIdNum);
      if (found) return found.name;
    }
    return undefined;
  }, [submoduleName, effectiveSubmoduleId, projectModules]);

  // Multi-Board State
  const [boards, setBoards] = useState<WhiteboardBoardMeta[]>(() =>
    loadBoardsMeta(projectId, scopeKey, resolvedSubmoduleName)
  );
  const [activeBoardId, setActiveBoardId] = useState<string>(() =>
    loadActiveBoardId(projectId, scopeKey, boards)
  );

  // Board Renaming State
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // UI States
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync boards when scope changes (e.g. switching between different whiteboard submodules)
  const prevScopeRef = useRef(`${projectId}:${scopeKey}`);
  useEffect(() => {
    const currentScope = `${projectId}:${scopeKey}`;
    if (prevScopeRef.current !== currentScope) {
      prevScopeRef.current = currentScope;
      const list = loadBoardsMeta(projectId, scopeKey, resolvedSubmoduleName);
      setBoards(list);
      const active = loadActiveBoardId(projectId, scopeKey, list);
      setActiveBoardId(active);
    }
  }, [projectId, scopeKey, resolvedSubmoduleName]);

  // Stable callback for element count updates to prevent render loops
  const handleElementsCountChange = React.useCallback(
    (count: number) => {
      setBoards((prev) => {
        const target = prev.find((b) => b.id === activeBoardId);
        if (target && target.elementCount === count) return prev;
        return prev.map((b) => (b.id === activeBoardId ? { ...b, elementCount: count } : b));
      });
    },
    [activeBoardId]
  );

  // Switch Active Board
  const handleSelectBoard = (boardId: string) => {
    setActiveBoardId(boardId);
    saveActiveBoardId(projectId, scopeKey, boardId);
  };

  // Create New Board
  const handleCreateBoard = () => {
    const result = createNewBoard(projectId, scopeKey);
    setBoards(result.updatedList);
    setActiveBoardId(result.meta.id);
    setEditingBoardId(result.meta.id);
    setEditingTitle(result.meta.title);
    setTimeout(() => renameInputRef.current?.select(), 50);
  };

  // Duplicate Current Board
  const handleDuplicateBoard = (boardIdToDup: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const result = duplicateExistingBoard(projectId, scopeKey, boardIdToDup);
    setBoards(result.updatedList);
    setActiveBoardId(result.meta.id);
  };

  // Delete Board
  const handleDeleteBoard = (boardIdToDel: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (boards.length <= 1) {
      alert('You must keep at least one whiteboard in this project.');
      return;
    }
    const targetBoard = boards.find((b) => b.id === boardIdToDel);
    if (
      window.confirm(
        `Are you sure you want to delete whiteboard "${targetBoard?.title || 'Untitled'}"? This action cannot be undone.`
      )
    ) {
      const { remainingList, nextActiveId } = deleteExistingBoard(
        projectId,
        scopeKey,
        boardIdToDel
      );
      setBoards(remainingList);
      setActiveBoardId(nextActiveId);
    }
  };

  // Start Rename
  const handleStartRename = (board: WhiteboardBoardMeta, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingBoardId(board.id);
    setEditingTitle(board.title);
    setTimeout(() => renameInputRef.current?.select(), 50);
  };

  // Commit Rename
  const handleSaveRename = () => {
    if (!editingBoardId) return;
    const updated = renameExistingBoard(projectId, scopeKey, editingBoardId, editingTitle);
    setBoards(updated);
    setEditingBoardId(null);
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  // Keyboard shortcut to exit in-app fullscreen on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
          return;
        }
        if (isFullscreen) {
          setIsFullscreen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, showShortcutsModal]);

  return (
    <div
      className={cn(
        'w-full h-full flex flex-col bg-[#0A0B0E] overflow-hidden select-none',
        isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : 'relative'
      )}
    >
      {/* ─── Top Whiteboard Header: Clean board tabs, no redundant project path ─── */}
      <header className="h-10 sm:h-11 px-2 sm:px-3 border-b border-[#27272A]/70 bg-[#0E0F14]/90 backdrop-blur-md flex items-center justify-between z-30 shrink-0 gap-2 sm:gap-3">
        {/* Left Side: Whiteboard Icon + Boards Tab Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0 py-0.5">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#14151A] border border-[#27272A] shrink-0 text-zinc-300 mr-1">
            <PenTool size={13} style={{ color: accentColor }} />
            <span className="text-[11px] font-bold tracking-wide uppercase text-zinc-300">
              {resolvedSubmoduleName || 'Whiteboard'}
            </span>
          </div>

          {/* Board Tabs */}
          {boards.map((b) => {
            const isActive = b.id === activeBoardId;
            const isEditing = editingBoardId === b.id;

            if (isEditing) {
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-1 h-7 px-2 rounded-lg bg-[#18191E] border border-zinc-600 shrink-0"
                >
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={handleSaveRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename();
                      if (e.key === 'Escape') setEditingBoardId(null);
                    }}
                    className="w-24 sm:w-32 bg-transparent text-xs text-white font-medium outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveRename}
                    className="text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  >
                    <Check size={11} />
                  </button>
                </div>
              );
            }

            return (
              <div
                key={b.id}
                onClick={() => handleSelectBoard(b.id)}
                className={cn(
                  'group flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium cursor-pointer shrink-0 border select-none',
                  isActive
                    ? 'text-white border'
                    : 'text-zinc-400 hover:text-zinc-200 bg-[#14151A] hover:bg-[#1A1B22] border-[#27272A]/70'
                )}
                style={
                  isActive
                    ? {
                        backgroundColor: `${accentColor}18`,
                        borderColor: `${accentColor}55`,
                        boxShadow: `0 0 10px ${accentColor}20`,
                      }
                    : undefined
                }
                title="Click to view board, double click to rename"
                onDoubleClick={(e) => handleStartRename(b, e)}
              >
                <span className="truncate max-w-[100px] sm:max-w-[160px] font-semibold text-[11px]">
                  {b.title}
                </span>

                {b.elementCount > 0 && (
                  <span className="px-1 py-0.2 rounded bg-black/40 text-[9px] font-mono text-zinc-400">
                    {b.elementCount}
                  </span>
                )}

                {/* Tab Hover Actions (Rename, Duplicate, Delete) */}
                <div className="hidden group-hover:flex items-center gap-0.5 ml-1 opacity-80 hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => handleStartRename(b, e)}
                    className="p-0.5 text-zinc-400 hover:text-white rounded"
                    title="Rename board"
                  >
                    <Edit2 size={9} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDuplicateBoard(b.id, e)}
                    className="p-0.5 text-zinc-400 hover:text-white rounded"
                    title="Duplicate board"
                  >
                    <Copy size={9} />
                  </button>
                  {boards.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteBoard(b.id, e)}
                      className="p-0.5 text-zinc-400 hover:text-rose-400 rounded"
                      title="Delete board"
                    >
                      <Trash2 size={9} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add New Whiteboard Button - Static and clean, no animated hover bounce */}
          <button
            type="button"
            onClick={handleCreateBoard}
            className="flex items-center gap-1 h-7 px-2 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-[#14151A] hover:bg-[#1C1D24] border border-[#27272A] cursor-pointer shrink-0"
            title="Create another separate whiteboard"
          >
            <Plus size={12} style={{ color: accentColor }} />
            <span className="hidden sm:inline text-[11px]">New Board</span>
            <span className="inline sm:hidden text-[11px]">New</span>
          </button>
        </div>

        {/* Right Side: Header Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            className="hidden sm:flex items-center gap-1 h-7 px-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs cursor-pointer"
            title="Keyboard Shortcuts"
          >
            <HelpCircle size={13} />
            <span className="hidden md:inline text-[11px]">Shortcuts</span>
          </button>

          {isFullscreen ? (
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-600 text-xs font-medium cursor-pointer shadow-lg transition-all"
              title="Minimize / Exit Fullscreen (Esc)"
            >
              <Minimize2 size={13} style={{ color: accentColor }} />
              <span className="text-[11px] font-semibold">Minimize</span>
              <kbd className="px-1 py-0.2 rounded bg-black/50 text-[9px] font-mono text-zinc-400 border border-zinc-600">
                Esc
              </kbd>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="flex items-center gap-1 h-7 px-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs cursor-pointer transition-colors"
              title="Expand Whiteboard to Fullscreen"
            >
              <Maximize2 size={13} />
              <span className="hidden sm:inline text-[11px]">Fullscreen</span>
            </button>
          )}
        </div>
      </header>

      {/* ─── Infinite Whiteboard Canvas (Keyed by activeBoardId for strict isolation) ─── */}
      <div className="flex-1 relative w-full h-full overflow-hidden">
        {activeBoardId && (
          <WhiteboardCanvas
            key={`${projectId}_${scopeKey}_${activeBoardId}`}
            projectId={projectId}
            scopeKey={scopeKey}
            boardId={activeBoardId}
            onElementsCountChange={handleElementsCountChange}
          />
        )}
      </div>

      {/* ─── Keyboard Shortcuts Modal ─────────────────────────────────────────── */}
      {showShortcutsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div
            className="w-full max-w-md p-5 bg-[#121316] border border-[#27272A] rounded-2xl shadow-2xl space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#27272A]">
              <div className="flex items-center gap-2">
                <PenTool size={16} style={{ color: accentColor }} />
                <h3 className="text-sm font-semibold text-white">Whiteboard Shortcuts</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-[#18191E] border border-[#27272A]">
                <span className="text-zinc-400">Select Tool</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-200">V</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-[#18191E] border border-[#27272A]">
                <span className="text-zinc-400">Pan Canvas</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-200">Space+Drag</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-[#18191E] border border-[#27272A]">
                <span className="text-zinc-400">Pen Sketch</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-200">P</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-[#18191E] border border-[#27272A]">
                <span className="text-zinc-400">Sticky Note</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-200">S</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-[#18191E] border border-[#27272A]">
                <span className="text-zinc-400">Rectangle</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-200">R</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-[#18191E] border border-[#27272A]">
                <span className="text-zinc-400">Circle</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-200">C / O</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-[#18191E] border border-[#27272A]">
                <span className="text-zinc-400">Arrow / Line</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-200">A / L</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-[#18191E] border border-[#27272A]">
                <span className="text-zinc-400">Text</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-200">T</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-[#18191E] border border-[#27272A]">
                <span className="text-zinc-400">Undo / Redo</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-200">Ctrl+Z / Y</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-[#18191E] border border-[#27272A]">
                <span className="text-zinc-400">Delete Element</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-200">Del / Bksp</kbd>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="w-full py-2.5 rounded-xl text-white font-medium text-xs cursor-pointer shadow-lg"
                style={{ backgroundColor: accentColor }}
              >
                Close Shortcuts
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
