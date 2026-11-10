import React from 'react';
import {
  Copy,
  Trash2,
  Minus,
  Square,
  Sparkles,
} from 'lucide-react';
import { STROKE_COLORS, STICKY_COLORS, STROKE_WIDTHS, FONT_SIZES } from './whiteboard.constants';
import { WhiteboardElement, WhiteboardTool } from './whiteboard.types';
import { useAccentTheme } from '../../services/accentTheme.service';
import { cn } from '../../lib/utils';

interface WhiteboardPropertiesBarProps {
  selectedElement: WhiteboardElement | null;
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
}

export const WhiteboardPropertiesBar: React.FC<WhiteboardPropertiesBarProps> = ({
  selectedElement,
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
    <div className="absolute top-18 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-1.5 px-3 bg-[#121316]/95 backdrop-blur-md border border-[#27272A] rounded-2xl shadow-xl select-none text-xs">
      {/* Sticky Note Color Palette */}
      {isSticky ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-zinc-400 mr-1">Note:</span>
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
        /* Stroke Color Palette */
        <div className="flex items-center gap-1.5">
          {STROKE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrentColor(c)}
              className={cn(
                'w-4 h-4 rounded-full transition-transform cursor-pointer',
                currentColor === c
                  ? 'scale-125 ring-2 ring-offset-2 ring-offset-[#121316]'
                  : 'hover:scale-110'
              )}
              style={{
                backgroundColor: c,
                borderColor: c === '#FFFFFF' ? '#52525B' : c,
                boxShadow: currentColor === c ? `0 0 8px ${c}80` : undefined,
              }}
              title={c}
            />
          ))}
        </div>
      )}

      {/* Stroke Width Selector */}
      {!isSticky && !isText && (
        <>
          <div className="w-[1px] h-4 bg-zinc-700/60 mx-1" />
          <div className="flex items-center gap-1">
            {STROKE_WIDTHS.map((w) => (
              <button
                key={w.value}
                type="button"
                onClick={() => setCurrentWidth(w.value)}
                className={cn(
                  'px-2 py-0.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer',
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
                {w.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Stroke Style: Solid vs Dashed */}
      {!isSticky && !isText && (
        <>
          <div className="w-[1px] h-4 bg-zinc-700/60 mx-1" />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentStyle('solid')}
              className={cn(
                'px-2 py-0.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer',
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
              Solid
            </button>
            <button
              type="button"
              onClick={() => setCurrentStyle('dashed')}
              className={cn(
                'px-2 py-0.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer',
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
              Dashed
            </button>
          </div>
        </>
      )}

      {/* Shape Background Fill Option */}
      {isShape && (
        <>
          <div className="w-[1px] h-4 bg-zinc-700/60 mx-1" />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentFill('transparent')}
              className={cn(
                'px-2 py-0.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer',
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
              title="Transparent fill"
            >
              Outline
            </button>
            <button
              type="button"
              onClick={() => setCurrentFill('rgba(255,255,255,0.08)')}
              className={cn(
                'px-2 py-0.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer',
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
              title="Tinted fill"
            >
              Tint
            </button>
          </div>
        </>
      )}

      {/* Font Size Selector (Text and Sticky Note) */}
      {(isText || isSticky) && (
        <>
          <div className="w-[1px] h-4 bg-zinc-700/60 mx-1" />
          <div className="flex items-center gap-1">
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
      {selectedElement && (
        <>
          <div className="w-[1px] h-4 bg-zinc-700/60 mx-1" />
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
