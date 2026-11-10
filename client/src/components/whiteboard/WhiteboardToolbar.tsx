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
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 p-1.5 bg-[#121316]/95 backdrop-blur-md border border-[#27272A] rounded-2xl shadow-2xl select-none">
      {/* Primary Tools */}
      <div className="flex items-center gap-1">
        {mainTools.map((t) => {
          const IconComp = t.icon;
          const isActive = tool === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              className={cn(
                'relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-150 cursor-pointer',
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
              <IconComp size={16} />
              {t.shortcut && !isActive && (
                <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-zinc-500 hidden sm:inline">
                  {t.shortcut}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="w-[1px] h-5 bg-zinc-700/60 mx-1" />

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-xl transition-colors',
            canUndo
              ? 'text-zinc-300 hover:text-white hover:bg-zinc-800/80 cursor-pointer'
              : 'text-zinc-600 cursor-not-allowed'
          )}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-xl transition-colors',
            canRedo
              ? 'text-zinc-300 hover:text-white hover:bg-zinc-800/80 cursor-pointer'
              : 'text-zinc-600 cursor-not-allowed'
          )}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={15} />
        </button>
      </div>

      <div className="w-[1px] h-5 bg-zinc-700/60 mx-1" />

      {/* Templates Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowTemplates(!showTemplates);
            setShowExportMenu(false);
          }}
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
          title="Insert Pre-built Template"
        >
          <Sparkles size={14} style={{ color: accentColor }} />
          <span className="hidden sm:inline">Templates</span>
          <ChevronDown size={11} className="text-zinc-500" />
        </button>

        {showTemplates && (
          <div className="absolute top-full left-0 mt-2 w-64 p-2 bg-[#121316] border border-[#27272A] rounded-2xl shadow-2xl z-50 space-y-1">
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
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowExportMenu(!showExportMenu);
            setShowTemplates(false);
          }}
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
          title="Export Board"
        >
          <Download size={14} style={{ color: accentColor }} />
          <span className="hidden sm:inline">Export</span>
          <ChevronDown size={11} className="text-zinc-500" />
        </button>

        {showExportMenu && (
          <div className="absolute top-full right-0 mt-2 w-52 p-2 bg-[#121316] border border-[#27272A] rounded-2xl shadow-2xl z-50 space-y-1">
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

      <div className="w-[1px] h-5 bg-zinc-700/60 mx-1" />

      {/* Clear Board */}
      <button
        type="button"
        onClick={onClear}
        className="flex items-center justify-center w-8 h-8 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
        title="Clear entire canvas"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};
