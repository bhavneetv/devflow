import React from 'react';
import {
  Copy,
  Trash2,
  ArrowUpToLine,
  ArrowDownToLine,
  Pipette,
  Palette,
} from 'lucide-react';
import { STROKE_COLORS, STICKY_COLORS, STROKE_WIDTHS, FONT_SIZES } from './whiteboard.constants';
import { WhiteboardElement, WhiteboardTool } from './whiteboard.types';
import { useAccentTheme } from '../../services/accentTheme.service';
import { cn } from '../../lib/utils';

interface WhiteboardPropertiesBarProps {
  selectedElement: WhiteboardElement | null;
  selectedCount?: number;
  tool: WhiteboardTool;
  currentColor: string;
  setCurrentColor: (color: string) => void;
  currentWidth: number;
  setCurrentWidth: (width: number) => void;
  currentStyle: 'solid' | 'dashed';
  setCurrentStyle: (style: 'solid' | 'dashed') => void;
  currentFill: string;
  setCurrentFill: (fill: string) => void;
  currentNoteColor: string;
  setCurrentNoteColor: (color: string) => void;
  currentFontSize: number;
  setCurrentFontSize: (size: number) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
}

export const WhiteboardPropertiesBar: React.FC<WhiteboardPropertiesBarProps> = ({
  selectedElement,
  selectedCount,
  tool,
  currentColor,
  setCurrentColor,
  currentWidth,
  setCurrentWidth,
  currentStyle,
  setCurrentStyle,
  currentFill,
  setCurrentFill,
  currentNoteColor,
  setCurrentNoteColor,
  currentFontSize,
  setCurrentFontSize,
  onDuplicate,
  onDelete,
  onBringToFront,
  onSendToBack,
}) => {
  const { accentColor } = useAccentTheme();
  const isSticky = selectedElement?.type === 'note' || tool === 'note';
  const isText = selectedElement?.type === 'text' || tool === 'text';
  const isShape =
    selectedElement?.type === 'rectangle' ||
    selectedElement?.type === 'roundedRect' ||
    selectedElement?.type === 'circle' ||
    selectedElement?.type === 'diamond' ||
    tool === 'rectangle' ||
    tool === 'roundedRect' ||
    tool === 'circle' ||
    tool === 'diamond';

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute top-12 sm:top-18 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 px-2 sm:px-3 bg-[#121316]/95 backdrop-blur-md border border-[#27272A] rounded-2xl shadow-xl select-none text-xs max-w-[calc(100vw-16px)] overflow-x-auto no-scrollbar"
    >
      {/* Multi-Selection Count Badge */}
      {selectedCount && selectedCount > 1 && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-semibold text-[11px] shrink-0">
          <span>{selectedCount} selected</span>
        </div>
      )}

      {/* Sticky Note Color Palette */}
      {isSticky ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1 text-zinc-400 mr-1 shrink-0" title="Sticky Note Color Palette">
            <Palette size={13} style={{ color: accentColor }} />
            <span className="text-[11px] font-semibold hidden sm:inline">Color:</span>
          </div>
          {Object.values(STICKY_COLORS).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrentNoteColor(s.id)}
              className={cn(
                'w-5 h-5 rounded-full transition-transform cursor-pointer border',
                currentNoteColor === s.id
                  ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#121316]'
                  : 'hover:scale-110'
              )}
              style={{ backgroundColor: s.bg, borderColor: s.border }}
              title={s.name}
            />
          ))}
        </div>
      ) : (
        /* Stroke Color Palette with Custom Hex Picker */
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1 text-zinc-400 mr-1 shrink-0" title="Stroke / Element Color">
            <Palette size={13} style={{ color: accentColor }} />
            <span className="text-[11px] font-semibold hidden sm:inline">Color:</span>
          </div>
          <div className="flex items-center gap-1.5 max-w-[280px] sm:max-w-none overflow-x-auto no-scrollbar px-2 py-1.5">
            {STROKE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrentColor(c)}
                className={cn(
                  'w-4 h-4 rounded-full transition-transform cursor-pointer shrink-0 m-0.5',
                  currentColor.toLowerCase() === c.toLowerCase()
                    ? 'scale-125 ring-2 ring-offset-2 ring-offset-[#121316]'
                    : 'hover:scale-110'
                )}
                style={{
                  backgroundColor: c,
                  borderColor: c === '#FFFFFF' ? '#52525B' : c,
                  boxShadow: currentColor.toLowerCase() === c.toLowerCase() ? `0 0 8px ${c}90` : undefined,
                }}
                title={c}
              />
            ))}

            {/* Custom Color Pipette */}
            <label
              className="relative w-5 h-5 rounded-full border border-dashed border-zinc-500 hover:border-white flex items-center justify-center cursor-pointer ml-1 shrink-0"
              title="Custom Hex Color"
            >
              <Pipette size={10} className="text-zinc-400 hover:text-white" />
              <input
                type="color"
                value={currentColor.startsWith('#') ? currentColor : '#FFFFFF'}
                onChange={(e) => setCurrentColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </label>
          </div>
        </div>
      )}

      {/* Stroke Width Selector - Visual Line Icons */}
      {!isSticky && !isText && (
        <>
          <div className="w-[1px] h-4 bg-zinc-700/60 mx-1 shrink-0" />
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] font-semibold text-zinc-400 mr-1">Width:</span>
            {STROKE_WIDTHS.map((w) => (
              <button
                key={w.value}
                type="button"
                onClick={() => setCurrentWidth(w.value)}
                className={cn(
                  'flex items-center justify-center w-7 h-6 rounded-lg transition-colors cursor-pointer',
                  currentWidth === w.value
                    ? 'text-white border'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                )}
                style={
                  currentWidth === w.value
                    ? {
                        backgroundColor: `${accentColor}25`,
                        borderColor: accentColor,
                        color: accentColor,
                      }
                    : undefined
                }
                title={`${w.label} (${w.value}px)`}
              >
                <div
                  className="w-3.5 rounded-full bg-current transition-all"
                  style={{
                    height: w.value === 2 ? 1.5 : w.value === 4 ? 3 : 5.5,
                  }}
                />
              </button>
            ))}
          </div>
        </>
      )}

      {/* Stroke Style: Solid vs Dashed Visual Icons */}
      {!isSticky && !isText && (
        <>
          <div className="w-[1px] h-4 bg-zinc-700/60 mx-1 shrink-0" />
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] font-semibold text-zinc-400 mr-1">Style:</span>
            <button
              type="button"
              onClick={() => setCurrentStyle('solid')}
              className={cn(
                'flex items-center justify-center w-7 h-6 rounded-lg transition-colors cursor-pointer',
                currentStyle === 'solid'
                  ? 'text-white border'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              )}
              style={
                currentStyle === 'solid'
                  ? {
                      backgroundColor: `${accentColor}25`,
                      borderColor: accentColor,
                      color: accentColor,
                    }
                  : undefined
              }
              title="Solid line"
            >
              <svg width="16" height="6" viewBox="0 0 16 6" className="fill-none stroke-current">
                <line x1="1" y1="3" x2="15" y2="3" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setCurrentStyle('dashed')}
              className={cn(
                'flex items-center justify-center w-7 h-6 rounded-lg transition-colors cursor-pointer',
                currentStyle === 'dashed'
                  ? 'text-white border'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              )}
              style={
                currentStyle === 'dashed'
                  ? {
                      backgroundColor: `${accentColor}25`,
                      borderColor: accentColor,
                      color: accentColor,
                    }
                  : undefined
              }
              title="Dashed line"
            >
              <svg width="16" height="6" viewBox="0 0 16 6" className="fill-none stroke-current">
                <line x1="1" y1="3" x2="15" y2="3" strokeWidth="2" strokeDasharray="3 3" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </>
      )}

      {/* Shape Background Fill Option (Outline vs Tinted Fill) */}
      {isShape && (
        <>
          <div className="w-[1px] h-4 bg-zinc-700/60 mx-1 shrink-0" />
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] font-semibold text-zinc-400 mr-1 hidden sm:inline">Fill:</span>
            {/* Outline (Transparent, No Tint) */}
            <button
              type="button"
              onClick={() => setCurrentFill('transparent')}
              className={cn(
                'flex items-center gap-1.5 h-6 px-1.5 sm:px-2 rounded-lg transition-colors cursor-pointer',
                currentFill === 'transparent'
                  ? 'text-white border'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              )}
              style={
                currentFill === 'transparent'
                  ? {
                      backgroundColor: `${accentColor}25`,
                      borderColor: accentColor,
                      color: accentColor,
                    }
                  : undefined
              }
              title="Outline (Transparent, No Tint)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" className="stroke-current fill-none">
                <rect x="2" y="2" width="10" height="10" rx="2" strokeWidth="1.5" strokeDasharray="2.5 2" />
              </svg>
              <span className="text-[10px] font-medium hidden md:inline">Outline</span>
            </button>

            {/* Tinted Fill */}
            <button
              type="button"
              onClick={() => setCurrentFill('rgba(255,255,255,0.08)')}
              className={cn(
                'flex items-center gap-1.5 h-6 px-1.5 sm:px-2 rounded-lg transition-colors cursor-pointer',
                currentFill !== 'transparent'
                  ? 'text-white border'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              )}
              style={
                currentFill !== 'transparent'
                  ? {
                      backgroundColor: `${accentColor}25`,
                      borderColor: accentColor,
                      color: accentColor,
                    }
                  : undefined
              }
              title="Tinted Fill"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" className="stroke-current">
                <rect x="2" y="2" width="10" height="10" rx="2" strokeWidth="1.5" fill="currentColor" fillOpacity="0.35" />
              </svg>
              <span className="text-[10px] font-medium hidden md:inline">Tint</span>
            </button>
          </div>
        </>
      )}

      {/* Font Size Selector (Text and Sticky Note) */}
      {(isText || isSticky) && (
        <>
          <div className="w-[1px] h-4 bg-zinc-700/60 mx-1 shrink-0" />
          <div className="flex items-center gap-1 shrink-0">
            {FONT_SIZES.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setCurrentFontSize(f.value)}
                className={cn(
                  'px-2 py-0.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer',
                  currentFontSize === f.value
                    ? 'text-white border'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                )}
                style={
                  currentFontSize === f.value
                    ? {
                        backgroundColor: `${accentColor}25`,
                        borderColor: accentColor,
                        color: accentColor,
                      }
                    : undefined
                }
                title={`${f.label} (${f.value}px)`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Selection Action Buttons */}
      {(selectedElement || (selectedCount && selectedCount > 0)) && (
        <>
          <div className="w-[1px] h-4 bg-zinc-700/60 mx-1 shrink-0" />
          {/* Layer Order */}
          <button
            type="button"
            onClick={onBringToFront}
            className="flex items-center gap-1 h-6 px-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Bring to Front"
          >
            <ArrowUpToLine size={12} />
          </button>
          <button
            type="button"
            onClick={onSendToBack}
            className="flex items-center gap-1 h-6 px-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Send to Back"
          >
            <ArrowDownToLine size={12} />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            className="flex items-center gap-1 h-6 px-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Duplicate (Ctrl+D)"
          >
            <Copy size={12} />
            <span className="hidden sm:inline text-[10px]">Clone</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1 h-6 px-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Delete (Del)"
          >
            <Trash2 size={12} />
          </button>
        </>
      )}
    </div>
  );
};
