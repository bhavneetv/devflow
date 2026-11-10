import React, { useState } from 'react';
import {
  MousePointer2,
  Hand,
  Pencil,
  Highlighter,
  Square,
  RectangleHorizontal,
  Circle,
  Diamond,
  ArrowRight,
  Minus,
  Type,
  StickyNote,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { WhiteboardTool } from './whiteboard.types';
import { WHITEBOARD_TEMPLATES } from './whiteboard.constants';
import { useAccentTheme } from '../../services/accentTheme.service';
import { cn } from '../../lib/utils';

interface WhiteboardToolbarProps {
  tool: WhiteboardTool;
  setTool: (tool: WhiteboardTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onApplyTemplate: (templateId: string) => void;
  onExportPng: () => void;
  onExportJson: () => void;
}

export const WhiteboardToolbar: React.FC<WhiteboardToolbarProps> = ({
  tool,
  setTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onApplyTemplate,
  onExportPng,
  onExportJson,
}) => {
  const { accentColor } = useAccentTheme();
  const [showTemplates, setShowTemplates] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const mainTools: Array<{ id: WhiteboardTool; label: string; icon: any; shortcut: string }> = [
    { id: 'select', label: 'Select (V)', icon: MousePointer2, shortcut: 'V' },
    { id: 'hand', label: 'Hand / Pan (H or Space)', icon: Hand, shortcut: 'H' },
    { id: 'freedraw', label: 'Pen Sketch (P)', icon: Pencil, shortcut: 'P' },
    { id: 'highlighter', label: 'Highlighter', icon: Highlighter, shortcut: '' },
    { id: 'note', label: 'Sticky Note (S)', icon: StickyNote, shortcut: 'S' },
    { id: 'rectangle', label: 'Rectangle (R)', icon: Square, shortcut: 'R' },
    { id: 'roundedRect', label: 'Rounded Box', icon: RectangleHorizontal, shortcut: '' },
    { id: 'circle', label: 'Circle (O)', icon: Circle, shortcut: 'O' },
    { id: 'diamond', label: 'Diamond (D)', icon: Diamond, shortcut: 'D' },
    { id: 'arrow', label: 'Arrow (A)', icon: ArrowRight, shortcut: 'A' },
    { id: 'line', label: 'Line (L)', icon: Minus, shortcut: 'L' },
    { id: 'text', label: 'Text (T)', icon: Type, shortcut: 'T' },
    { id: 'eraser', label: 'Eraser (E)', icon: Eraser, shortcut: 'E' },
  ];

  return (
    <>
      {/* Outside click dismissal overlay for open dropdowns */}
      {(showTemplates || showExportMenu) && (
        <div
          className="fixed inset-0 z-30 bg-transparent"
          onPointerDown={() => {
            setShowTemplates(false);
            setShowExportMenu(false);
          }}
        />
      )}

      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-2 sm:top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 bg-[#121316]/95 backdrop-blur-md border border-[#27272A] rounded-2xl shadow-2xl select-none max-w-[calc(100vw-16px)] overflow-visible"
      >
        {/* Primary Tools - Horizontally scrollable on small screens */}
        <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar max-w-[calc(100vw-230px)] sm:max-w-none shrink">
        {mainTools.map((t) => {
          const IconComp = t.icon;
          const isActive = tool === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              className={cn(
                'relative flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-xl transition-all duration-150 cursor-pointer shrink-0',
                isActive
                  ? 'text-white shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
              )}
              style={
                isActive
                  ? {
                      backgroundColor: accentColor,
                      boxShadow: `0 4px 14px ${accentColor}40`,
                    }
                  : undefined
              }
              title={t.label}
            >
              <IconComp size={15} />
              {t.shortcut && !isActive && (
                <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-zinc-500 hidden md:inline">
                  {t.shortcut}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="w-[1px] h-4 sm:h-5 bg-zinc-700/60 mx-0.5 sm:mx-1 shrink-0" />

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={cn(
            'flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-xl transition-colors shrink-0',
            canUndo
              ? 'text-zinc-300 hover:text-white hover:bg-zinc-800/80 cursor-pointer'
              : 'text-zinc-600 cursor-not-allowed'
          )}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className={cn(
            'flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-xl transition-colors shrink-0',
            canRedo
              ? 'text-zinc-300 hover:text-white hover:bg-zinc-800/80 cursor-pointer'
              : 'text-zinc-600 cursor-not-allowed'
          )}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={14} />
        </button>
      </div>

      <div className="w-[1px] h-4 sm:h-5 bg-zinc-700/60 mx-0.5 sm:mx-1 shrink-0" />

      {/* Templates Dropdown */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => {
            setShowTemplates(!showTemplates);
            setShowExportMenu(false);
          }}
          className="flex items-center gap-1 sm:gap-1.5 h-7 sm:h-8 px-2 sm:px-2.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer shrink-0"
          title="Insert Pre-built Template"
        >
          <Sparkles size={13} style={{ color: accentColor }} />
          <span className="hidden sm:inline">Templates</span>
          <ChevronDown size={11} className="text-zinc-500" />
        </button>

        {showTemplates && (
          <div className="absolute top-full left-0 sm:left-auto right-auto sm:right-0 mt-2 w-64 max-w-[calc(100vw-32px)] p-2 bg-[#121316] border border-[#27272A] rounded-2xl shadow-2xl z-50 space-y-1">
            <div className="px-2 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              Canvas Templates
            </div>
            {WHITEBOARD_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => {
                  onApplyTemplate(tmpl.id);
                  setShowTemplates(false);
                }}
                className="w-full text-left px-2.5 py-2 rounded-xl text-xs hover:bg-[#18191E] hover:border hover:border-[#27272A] transition-all cursor-pointer group"
              >
                <div className="font-semibold text-zinc-200 group-hover:text-white flex items-center justify-between">
                  <span>{tmpl.name}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Insert</span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
                  {tmpl.description}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Export Dropdown */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => {
            setShowExportMenu(!showExportMenu);
            setShowTemplates(false);
          }}
          className="flex items-center gap-1 sm:gap-1.5 h-7 sm:h-8 px-2 sm:px-2.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer shrink-0"
          title="Export Board"
        >
          <Download size={13} style={{ color: accentColor }} />
          <span className="hidden sm:inline">Export</span>
          <ChevronDown size={11} className="text-zinc-500" />
        </button>

        {showExportMenu && (
          <div className="absolute top-full right-0 mt-2 w-52 max-w-[calc(100vw-32px)] p-2 bg-[#121316] border border-[#27272A] rounded-2xl shadow-2xl z-50 space-y-1">
            <button
              type="button"
              onClick={() => {
                onExportPng();
                setShowExportMenu(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 hover:text-white hover:bg-[#18191E] transition-colors cursor-pointer flex items-center justify-between"
            >
              <span>Export as Image (PNG)</span>
              <span className="text-[10px] font-mono text-zinc-500">HD</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onExportJson();
                setShowExportMenu(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 hover:text-white hover:bg-[#18191E] transition-colors cursor-pointer flex items-center justify-between"
            >
              <span>Save Canvas JSON</span>
              <span className="text-[10px] font-mono text-zinc-500">.json</span>
            </button>
          </div>
        )}
      </div>

      <div className="w-[1px] h-4 sm:h-5 bg-zinc-700/60 mx-0.5 sm:mx-1 shrink-0" />

      {/* Clear Board */}
      <button
        type="button"
        onClick={onClear}
        className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
        title="Clear entire canvas"
      >
        <Trash2 size={14} />
      </button>
    </div>
    </>
  );
};
