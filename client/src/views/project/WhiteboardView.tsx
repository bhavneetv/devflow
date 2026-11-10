import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  PenTool,
  Plus,
  HelpCircle,
  FolderKanban,
  Check,
  ChevronRight,
  Maximize2,
  Minimize2,
  Copy,
  Trash2,
  Edit2,
  ChevronDown,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { WhiteboardCanvas } from '../../components/whiteboard/WhiteboardCanvas';
import {
  loadBoardsMeta,
  saveBoardsMeta,
  loadActiveBoardId,
  saveActiveBoardId,
  createNewBoard,
  duplicateExistingBoard,
  deleteExistingBoard,
  renameExistingBoard,
} from '../../components/whiteboard/whiteboard.storage';
import { WhiteboardBoardMeta } from '../../components/whiteboard/whiteboard.types';
import { useNavigation } from '../../context/NavigationContext';
import { useAccentTheme } from '../../services/accentTheme.service';
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

  const { activeProject } = useNavigation();
  const { accentColor } = useAccentTheme();

  // Multi-Board State
  const [boards, setBoards] = useState<WhiteboardBoardMeta[]>(() =>
    loadBoardsMeta(projectId, scopeKey, submoduleName)
  );
  const [activeBoardId, setActiveBoardId] = useState<string>(() =>
    loadActiveBoardId(projectId, scopeKey, boards)
  );

  // Board Renaming State
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // UI States
  const [showDropdown, setShowDropdown] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync boards when scope changes
  useEffect(() => {
    const list = loadBoardsMeta(projectId, scopeKey, submoduleName);
    setBoards(list);
    const active = loadActiveBoardId(projectId, scopeKey, list);
    setActiveBoardId(active);
  }, [projectId, scopeKey, submoduleName]);

  const activeBoard = boards.find((b) => b.id === activeBoardId) || boards[0];

  // Switch Active Board
  const handleSelectBoard = (boardId: string) => {
    setActiveBoardId(boardId);
    saveActiveBoardId(projectId, scopeKey, boardId);
    setShowDropdown(false);
  };

  // Create New Board
  const handleCreateBoard = () => {
    const result = createNewBoard(projectId, scopeKey);
    setBoards(result.updatedList);
    setActiveBoardId(result.meta.id);
    setShowDropdown(false);
    // Start renaming immediately
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
    setShowDropdown(false);
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
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-48px)] flex flex-col bg-[#0A0B0E] overflow-hidden select-none">
      {/* ─── Top Navigation Header (Matching DevFlow Dark Glass Theme) ─────────── */}
      <header className="h-12 px-4 border-b border-[#27272A]/70 bg-[#0E0F14]/90 backdrop-blur-md flex items-center justify-between z-30 shrink-0 gap-3">
        {/* Left Side: Project Breadcrumb + Submodule Pill */}
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to={`/projects/${projectId}`}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors truncate shrink-0"
          >
            <FolderKanban size={13} style={{ color: accentColor }} />
            <span className="truncate max-w-[120px] sm:max-w-[180px]">
              {activeProject?.title || `Project #${projectId}`}
            </span>
          </Link>

          <ChevronRight size={12} className="text-zinc-600 shrink-0" />

          {submoduleName && (
            <>
              <span className="px-2 py-0.5 rounded-md bg-[#18191E] border border-[#27272A] text-xs font-medium text-zinc-300 truncate max-w-[140px]">
                {submoduleName}
              </span>
              <ChevronRight size={12} className="text-zinc-600 shrink-0" />
            </>
          )}

          {/* Module Tag */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <span
              className="px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wider uppercase border"
              style={{
                backgroundColor: `${accentColor}18`,
                borderColor: `${accentColor}40`,
                color: accentColor,
              }}
            >
              Whiteboard
            </span>
          </div>
        </div>

        {/* Center: Multi-Board Tabs / Switcher */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[55%]">
          {/* Quick Tabs for all boards */}
          {boards.map((b) => {
            const isActive = b.id === activeBoardId;
            const isEditing = editingBoardId === b.id;

            if (isEditing) {
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-1 h-8 px-2 rounded-xl bg-[#18191E] border border-zinc-600 shrink-0"
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
                    className="w-28 sm:w-36 bg-transparent text-xs text-white font-medium outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveRename}
                    className="text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  >
                    <Check size={12} />
                  </button>
                </div>
              );
            }

            return (
              <div
                key={b.id}
                onClick={() => handleSelectBoard(b.id)}
                className={cn(
                  'group flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer shrink-0 border select-none',
                  isActive
                    ? 'text-white border'
                    : 'text-zinc-400 hover:text-zinc-200 bg-[#121316]/60 hover:bg-[#18191E] border-[#27272A]/70'
                )}
                style={
                  isActive
                    ? {
                        backgroundColor: `${accentColor}18`,
                        borderColor: `${accentColor}55`,
                        boxShadow: `0 0 12px ${accentColor}20`,
                      }
                    : undefined
                }
                title="Click to view whiteboard, double click to rename"
                onDoubleClick={(e) => handleStartRename(b, e)}
              >
                <PenTool
                  size={12}
                  style={{ color: isActive ? accentColor : '#71717A' }}
                  className="shrink-0"
                />

                <span className="truncate max-w-[90px] sm:max-w-[140px] font-semibold">
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
                    title="Rename"
                  >
                    <Edit2 size={10} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDuplicateBoard(b.id, e)}
                    className="p-0.5 text-zinc-400 hover:text-white rounded"
                    title="Duplicate board"
                  >
                    <Copy size={10} />
                  </button>
                  {boards.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteBoard(b.id, e)}
                      className="p-0.5 text-zinc-400 hover:text-rose-400 rounded"
                      title="Delete board"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add New Whiteboard Button */}
          <button
            type="button"
            onClick={handleCreateBoard}
            className="flex items-center gap-1 h-8 px-2.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-[#121316] hover:bg-[#18191E] border border-[#27272A] hover:border-zinc-700 transition-all cursor-pointer shrink-0"
            title="Create another separate whiteboard"
          >
            <Plus size={13} style={{ color: accentColor }} />
            <span className="hidden sm:inline">New Board</span>
          </button>
        </div>

        {/* Right Side: Header Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            className="flex items-center gap-1 h-8 px-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-xs cursor-pointer"
            title="Keyboard Shortcuts"
          >
            <HelpCircle size={14} />
            <span className="hidden md:inline">Shortcuts</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Canvas'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </header>

      {/* ─── Infinite Whiteboard Canvas (Keyed by activeBoardId for strict isolation) ─── */}
      <div className="flex-1 relative w-full h-full overflow-hidden">
        {activeBoardId && (
          <WhiteboardCanvas
            key={activeBoardId}
            projectId={projectId}
            scopeKey={scopeKey}
            boardId={activeBoardId}
            onElementsCountChange={(count) => {
              setBoards((prev) =>
                prev.map((b) => (b.id === activeBoardId ? { ...b, elementCount: count } : b))
              );
            }}
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
                className="w-full py-2.5 rounded-xl text-white font-medium text-xs transition-colors cursor-pointer shadow-lg"
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
