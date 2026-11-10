import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  Copy,
  Download,
  Hand,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import {
  WhiteboardElement,
  WhiteboardTool,
  CanvasViewport,
  Point,
} from './whiteboard.types';
import {
  STROKE_COLORS,
  STICKY_COLORS,
  STROKE_WIDTHS,
  WHITEBOARD_TEMPLATES,
} from './whiteboard.constants';
import { WhiteboardToolbar } from './WhiteboardToolbar';
import { WhiteboardPropertiesBar } from './WhiteboardPropertiesBar';
import { loadBoardContent, saveBoardContent } from './whiteboard.storage';
import { useAccentTheme } from '../../services/accentTheme.service';
import { cn } from '../../lib/utils';

interface WhiteboardCanvasProps {
  projectId: number | string;
  scopeKey?: string;
  boardId: string;
  onElementsCountChange?: (count: number) => void;
}

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  projectId,
  scopeKey = 'main',
  boardId,
  onElementsCountChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { accentColor } = useAccentTheme();

  // Load initial content for this specific board
  const initialData = useMemo(() => {
    return loadBoardContent(projectId, scopeKey, boardId);
  }, [projectId, scopeKey, boardId]);

  // Canvas Viewport (pan and zoom)
  const [viewport, setViewport] = useState<CanvasViewport>(
    initialData.viewport || { x: 0, y: 0, zoom: 1 }
  );

  // Whiteboard Elements State for active board
  const [elements, setElements] = useState<WhiteboardElement[]>(initialData.elements || []);

  // History for Undo / Redo
  const [undoStack, setUndoStack] = useState<WhiteboardElement[][]>([]);
  const [redoStack, setRedoStack] = useState<WhiteboardElement[][]>([]);

  // Active Tool & Selection State
  const [tool, setTool] = useState<WhiteboardTool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Style Settings
  const [currentColor, setCurrentColor] = useState<string>('#FFFFFF');
  const [currentWidth, setCurrentWidth] = useState<number>(2);
  const [currentStyle, setCurrentStyle] = useState<'solid' | 'dashed'>('solid');
  const [currentFill, setCurrentFill] = useState<string>('transparent');
  const [currentNoteColor, setCurrentNoteColor] = useState<string>('yellow');
  const [currentFontSize, setCurrentFontSize] = useState<number>(18);

  // Interaction State
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [dragAction, setDragAction] = useState<
    | { type: 'pan'; startX: number; startY: number; initVpX: number; initVpY: number }
    | { type: 'draw'; currentElement: WhiteboardElement }
    | { type: 'move'; startX: number; startY: number; initElemX: number; initElemY: number }
    | { type: 'resize'; handle: string; startX: number; startY: number; initElem: WhiteboardElement }
    | { type: 'erase' }
    | null
  >(null);

  // When boardId changes, reload that board's elements and viewport cleanly
  useEffect(() => {
    const loaded = loadBoardContent(projectId, scopeKey, boardId);
    setElements(loaded.elements || []);
    setViewport(loaded.viewport || { x: 0, y: 0, zoom: 1 });
    setUndoStack([]);
    setRedoStack([]);
    setSelectedId(null);
    setEditingId(null);
  }, [projectId, scopeKey, boardId]);

  // Save to isolated localStorage per board
  useEffect(() => {
    saveBoardContent(projectId, scopeKey, boardId, { elements, viewport });
    onElementsCountChange?.(elements.length);
  }, [elements, viewport, projectId, scopeKey, boardId, onElementsCountChange]);

  // Push state to undo stack
  const pushUndo = useCallback((prevElements: WhiteboardElement[]) => {
    setUndoStack((prev) => [...prev.slice(-30), prevElements]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [elements, ...prev]);
    setElements(previous);
    setSelectedId(null);
  }, [undoStack, elements]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setRedoStack((prev) => prev.slice(1));
    setUndoStack((prev) => [...prev, elements]);
    setElements(next);
  }, [redoStack, elements]);

  // Convert screen coordinates to canvas world coordinates
  const screenToWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = clientX - rect.left;
      const rawY = clientY - rect.top;
      return {
        x: (rawX - viewport.x) / viewport.zoom,
        y: (rawY - viewport.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  // Find topmost element under world point
  const findElementAt = useCallback(
    (worldPoint: Point): WhiteboardElement | null => {
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.type === 'freedraw' || el.type === 'highlighter') {
          if (el.points && el.points.length > 0) {
            const hit = el.points.some(
              (p) => Math.hypot(p.x - worldPoint.x, p.y - worldPoint.y) < 14
            );
            if (hit) return el;
          }
        } else {
          const minX = Math.min(el.x, el.x + el.width);
          const maxX = Math.max(el.x, el.x + el.width);
          const minY = Math.min(el.y, el.y + el.height);
          const maxY = Math.max(el.y, el.y + el.height);
          if (
            worldPoint.x >= minX - 6 &&
            worldPoint.x <= maxX + 6 &&
            worldPoint.y >= minY - 6 &&
            worldPoint.y <= maxY + 6
          ) {
            return el;
          }
        }
      }
      return null;
    },
    [elements]
  );

  // Keyboard shortcut listener (Space, V, H, P, S, R, C, A, L, T, E, Undo, Redo, Del)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingId) return; // Ignore when editing text inside textarea

      if (e.code === 'Space' && !isSpacePressed) {
        setIsSpacePressed(true);
      } else if (e.key === 'v' || e.key === 'V') {
        setTool('select');
      } else if (e.key === 'h' || e.key === 'H') {
        setTool('hand');
      } else if (e.key === 'p' || e.key === 'P') {
        setTool('freedraw');
      } else if (e.key === 's' || e.key === 'S') {
        setTool('note');
      } else if (e.key === 'r' || e.key === 'R') {
        setTool('rectangle');
      } else if (e.key === 'c' || e.key === 'C' || e.key === 'o' || e.key === 'O') {
        setTool('circle');
      } else if (e.key === 'd' || e.key === 'D') {
        setTool('diamond');
      } else if (e.key === 'a' || e.key === 'A') {
        setTool('arrow');
      } else if (e.key === 'l' || e.key === 'L') {
        setTool('line');
      } else if (e.key === 't' || e.key === 'T') {
        setTool('text');
      } else if (e.key === 'e' || e.key === 'E') {
        setTool('eraser');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicate();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [editingId, isSpacePressed, selectedId, handleUndo, handleRedo]);

  // Pointer Down Handler
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const isMiddleClick = e.button === 1;
    const isHandMode = tool === 'hand' || isSpacePressed || isMiddleClick;

    if (isHandMode) {
      setDragAction({
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        initVpX: viewport.x,
        initVpY: viewport.y,
      });
      setIsPointerDown(true);
      return;
    }

    const worldPoint = screenToWorld(e.clientX, e.clientY);

    if (tool === 'eraser') {
      const hit = findElementAt(worldPoint);
      if (hit) {
        pushUndo(elements);
        setElements((prev) => prev.filter((item) => item.id !== hit.id));
        if (selectedId === hit.id) setSelectedId(null);
      }
      setDragAction({ type: 'erase' });
      setIsPointerDown(true);
      return;
    }

    if (tool === 'select') {
      const hit = findElementAt(worldPoint);
      if (hit) {
        setSelectedId(hit.id);
        setDragAction({
          type: 'move',
          startX: worldPoint.x,
          startY: worldPoint.y,
          initElemX: hit.x,
          initElemY: hit.y,
        });
      } else {
        setSelectedId(null);
        setEditingId(null);
      }
      setIsPointerDown(true);
      return;
    }

    // Creating new element
    pushUndo(elements);
    const newId = `elem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const baseElement: WhiteboardElement = {
      id: newId,
      type: tool as any,
      x: worldPoint.x,
      y: worldPoint.y,
      width: 0,
      height: 0,
      color: currentColor,
      fillColor: currentFill,
      strokeWidth: currentWidth,
      strokeStyle: currentStyle,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (tool === 'freedraw') {
      baseElement.points = [worldPoint];
    } else if (tool === 'highlighter') {
      baseElement.points = [worldPoint];
      baseElement.strokeWidth = 14;
      baseElement.opacity = 0.45;
    } else if (tool === 'note') {
      baseElement.width = 180;
      baseElement.height = 140;
      baseElement.noteColor = currentNoteColor;
      baseElement.fontSize = currentFontSize;
      baseElement.text = '';
    } else if (tool === 'text') {
      baseElement.width = 240;
      baseElement.height = 40;
      baseElement.fontSize = currentFontSize;
      baseElement.text = 'Double click to edit text';
    }

    setElements((prev) => [...prev, baseElement]);
    setSelectedId(newId);

    if (tool === 'note' || tool === 'text') {
      setTool('select');
      setEditingId(newId);
    } else {
      setDragAction({ type: 'draw', currentElement: baseElement });
    }

    setIsPointerDown(true);
  };

  // Pointer Move Handler
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDown || !dragAction) return;

    if (dragAction.type === 'pan') {
      const dx = e.clientX - dragAction.startX;
      const dy = e.clientY - dragAction.startY;
      setViewport((prev) => ({
        ...prev,
        x: dragAction.initVpX + dx,
        y: dragAction.initVpY + dy,
      }));
      return;
    }

    const worldPoint = screenToWorld(e.clientX, e.clientY);

    if (dragAction.type === 'erase') {
      const hit = findElementAt(worldPoint);
      if (hit) {
        setElements((prev) => prev.filter((item) => item.id !== hit.id));
        if (selectedId === hit.id) setSelectedId(null);
      }
      return;
    }

    if (dragAction.type === 'move' && selectedId) {
      const dx = worldPoint.x - dragAction.startX;
      const dy = worldPoint.y - dragAction.startY;
      setElements((prev) =>
        prev.map((item) => {
          if (item.id !== selectedId) return item;
          if (item.points && item.points.length > 0) {
            const shiftX = dx;
            const shiftY = dy;
            return {
              ...item,
              x: dragAction.initElemX + dx,
              y: dragAction.initElemY + dy,
              points: item.points.map((p) => ({ x: p.x + shiftX, y: p.y + shiftY })),
            };
          }
          return {
            ...item,
            x: dragAction.initElemX + dx,
            y: dragAction.initElemY + dy,
          };
        })
      );
      return;
    }

    if (dragAction.type === 'draw') {
      const elem = dragAction.currentElement;
      if (elem.type === 'freedraw' || elem.type === 'highlighter') {
        setElements((prev) =>
          prev.map((item) =>
            item.id === elem.id
              ? { ...item, points: [...(item.points || []), worldPoint] }
              : item
          )
        );
      } else {
        const w = worldPoint.x - elem.x;
        const h = worldPoint.y - elem.y;
        setElements((prev) =>
          prev.map((item) =>
            item.id === elem.id ? { ...item, width: w, height: h } : item
          )
        );
      }
    }
  };

  // Pointer Up Handler
  const handlePointerUp = () => {
    setIsPointerDown(false);
    setDragAction(null);
    if (tool !== 'select' && tool !== 'hand' && tool !== 'eraser') {
      setTool('select');
    }
  };

  // Wheel Zoom & Pan
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    if (e.ctrlKey || e.metaKey) {
      // Zoom centered on cursor
      const rect = containerRef.current.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
      const newZoom = Math.min(5.0, Math.max(0.1, viewport.zoom * zoomFactor));

      const worldX = (pointerX - viewport.x) / viewport.zoom;
      const worldY = (pointerY - viewport.y) / viewport.zoom;

      setViewport({
        x: pointerX - worldX * newZoom,
        y: pointerY - worldY * newZoom,
        zoom: newZoom,
      });
    } else {
      // Pan with 2-finger wheel
      setViewport((prev) => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  // Duplicate Selected Element
  const handleDuplicate = () => {
    if (!selectedId) return;
    const item = elements.find((el) => el.id === selectedId);
    if (!item) return;
    pushUndo(elements);
    const newId = `elem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const cloned: WhiteboardElement = {
      ...item,
      id: newId,
      x: item.x + 30,
      y: item.y + 30,
      points: item.points ? item.points.map((p) => ({ x: p.x + 30, y: p.y + 30 })) : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setElements((prev) => [...prev, cloned]);
    setSelectedId(newId);
  };

  // Delete Selected Element
  const handleDeleteSelected = () => {
    if (!selectedId) return;
    pushUndo(elements);
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
    setEditingId(null);
  };

  // Clear Canvas
  const handleClearCanvas = () => {
    if (elements.length === 0) return;
    if (window.confirm('Are you sure you want to clear this entire whiteboard?')) {
      pushUndo(elements);
      setElements([]);
      setSelectedId(null);
      setEditingId(null);
    }
  };

  // Apply Template
  const handleApplyTemplate = (templateId: string) => {
    const tmpl = WHITEBOARD_TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;
    pushUndo(elements);
    const newElements = tmpl.elements.map((el, i) => ({
      ...el,
      id: `tmpl-${Date.now()}-${i}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })) as WhiteboardElement[];

    setElements((prev) => [...prev, ...newElements]);
    setViewport({ x: 0, y: 0, zoom: 1 });
  };

  // Export to HD PNG Image
  const handleExportPng = () => {
    const svgEl = containerRef.current?.querySelector('svg');
    if (!svgEl) return;

    if (elements.length === 0) {
      alert('Whiteboard is empty! Draw something first before exporting.');
      return;
    }

    // Calculate bounding box of all elements
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    elements.forEach((el) => {
      if (el.points && el.points.length > 0) {
        el.points.forEach((p) => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        });
      } else {
        const x1 = Math.min(el.x, el.x + el.width);
        const y1 = Math.min(el.y, el.y + el.height);
        const x2 = Math.max(el.x, el.x + el.width);
        const y2 = Math.max(el.y, el.y + el.height);
        minX = Math.min(minX, x1);
        minY = Math.min(minY, y1);
        maxX = Math.max(maxX, x2);
        maxY = Math.max(maxY, y2);
      }
    });

    const padding = 60;
    const width = Math.max(800, maxX - minX + padding * 2);
    const height = Math.max(600, maxY - minY + padding * 2);

    const canvas = document.createElement('canvas');
    canvas.width = width * 2; // 2x Retina resolution
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(2, 2);
    ctx.fillStyle = '#0A0B0E';
    ctx.fillRect(0, 0, width, height);

    // Render dot grid background
    ctx.fillStyle = '#222329';
    for (let x = 0; x < width; x += 24) {
      for (let y = 0; y < height; y += 24) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Offset elements to center in export
    const offsetX = padding - minX;
    const offsetY = padding - minY;

    elements.forEach((el) => {
      ctx.save();
      ctx.strokeStyle = el.color;
      ctx.lineWidth = el.strokeWidth;
      ctx.fillStyle = el.fillColor === 'transparent' ? 'transparent' : el.fillColor || 'transparent';

      if (el.strokeStyle === 'dashed') {
        ctx.setLineDash([8, 6]);
      }

      if (el.type === 'freedraw' || el.type === 'highlighter') {
        if (el.points && el.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(el.points[0].x + offsetX, el.points[0].y + offsetY);
          for (let i = 1; i < el.points.length; i++) {
            ctx.lineTo(el.points[i].x + offsetX, el.points[i].y + offsetY);
          }
          if (el.type === 'highlighter') {
            ctx.globalAlpha = 0.45;
            ctx.lineWidth = 14;
          }
          ctx.stroke();
        }
      } else if (el.type === 'rectangle' || el.type === 'roundedRect') {
        const rx = el.x + offsetX;
        const ry = el.y + offsetY;
        if (el.fillColor && el.fillColor !== 'transparent') {
          ctx.fillRect(rx, ry, el.width, el.height);
        }
        ctx.strokeRect(rx, ry, el.width, el.height);
      } else if (el.type === 'circle') {
        ctx.beginPath();
        ctx.ellipse(
          el.x + offsetX + el.width / 2,
          el.y + offsetY + el.height / 2,
          Math.abs(el.width / 2),
          Math.abs(el.height / 2),
          0,
          0,
          Math.PI * 2
        );
        if (el.fillColor && el.fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
      } else if (el.type === 'arrow' || el.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(el.x + offsetX, el.y + offsetY);
        ctx.lineTo(el.x + offsetX + el.width, el.y + offsetY + el.height);
        ctx.stroke();
      } else if (el.type === 'note') {
        const sc = STICKY_COLORS[el.noteColor || 'yellow'] || STICKY_COLORS.yellow;
        ctx.fillStyle = sc.bg;
        ctx.strokeStyle = sc.border;
        ctx.fillRect(el.x + offsetX, el.y + offsetY, el.width, el.height);
        ctx.strokeRect(el.x + offsetX, el.y + offsetY, el.width, el.height);

        ctx.fillStyle = sc.text;
        ctx.font = `bold ${el.fontSize || 16}px sans-serif`;
        ctx.fillText(el.text || '', el.x + offsetX + 12, el.y + offsetY + 28, el.width - 24);
      } else if (el.type === 'text') {
        ctx.fillStyle = el.color;
        ctx.font = `bold ${el.fontSize || 22}px sans-serif`;
        ctx.fillText(el.text || '', el.x + offsetX, el.y + offsetY + 24);
      }

      ctx.restore();
    });

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `devflow-whiteboard-${boardId}-${Date.now()}.png`;
    a.click();
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify({ version: '1.0', boardId, elements, viewport }, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `devflow-whiteboard-${boardId}.json`;
    a.click();
  };

  const selectedElement = useMemo(
    () => elements.find((el) => el.id === selectedId) || null,
    [elements, selectedId]
  );

  // SVG Helper: Construct Smooth Curve for Freehand
  const getSvgPath = (points?: Point[]) => {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      path += ` Q ${p0.x} ${p0.y}, ${midX} ${midY}`;
    }
    return path;
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      className={cn(
        'relative w-full h-full bg-[#0A0B0E] overflow-hidden select-none touch-none',
        tool === 'hand' || isSpacePressed ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
      )}
    >
      {/* ─── Top Floating Toolbar ─────────────────────────────────────────────── */}
      <WhiteboardToolbar
        tool={tool}
        setTool={setTool}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClearCanvas}
        zoom={viewport.zoom}
        onZoomIn={() =>
          setViewport((prev) => ({ ...prev, zoom: Math.min(5, prev.zoom * 1.2) }))
        }
        onZoomOut={() =>
          setViewport((prev) => ({ ...prev, zoom: Math.max(0.1, prev.zoom / 1.2) }))
        }
        onZoomReset={() => setViewport({ x: 0, y: 0, zoom: 1 })}
        onApplyTemplate={handleApplyTemplate}
        onExportPng={handleExportPng}
        onExportJson={handleExportJson}
      />

      {/* ─── Floating Properties Inspector Bar ─────────────────────────────────── */}
      <WhiteboardPropertiesBar
        selectedElement={selectedElement}
        tool={tool}
        currentColor={currentColor}
        setCurrentColor={(col) => {
          setCurrentColor(col);
          if (selectedId) {
            setElements((prev) =>
              prev.map((item) => (item.id === selectedId ? { ...item, color: col } : item))
            );
          }
        }}
        currentWidth={currentWidth}
        setCurrentWidth={(w) => {
          setCurrentWidth(w);
          if (selectedId) {
            setElements((prev) =>
              prev.map((item) => (item.id === selectedId ? { ...item, strokeWidth: w } : item))
            );
          }
        }}
        currentStyle={currentStyle}
        setCurrentStyle={(st) => {
          setCurrentStyle(st);
          if (selectedId) {
            setElements((prev) =>
              prev.map((item) => (item.id === selectedId ? { ...item, strokeStyle: st } : item))
            );
          }
        }}
        currentFill={currentFill}
        setCurrentFill={(fill) => {
          setCurrentFill(fill);
          if (selectedId) {
            setElements((prev) =>
              prev.map((item) => (item.id === selectedId ? { ...item, fillColor: fill } : item))
            );
          }
        }}
        currentNoteColor={currentNoteColor}
        setCurrentNoteColor={(nc) => {
          setCurrentNoteColor(nc);
          if (selectedId) {
            setElements((prev) =>
              prev.map((item) => (item.id === selectedId ? { ...item, noteColor: nc } : item))
            );
          }
        }}
        currentFontSize={currentFontSize}
        setCurrentFontSize={(fs) => {
          setCurrentFontSize(fs);
          if (selectedId) {
            setElements((prev) =>
              prev.map((item) => (item.id === selectedId ? { ...item, fontSize: fs } : item))
            );
          }
        }}
        onDuplicate={handleDuplicate}
        onDelete={handleDeleteSelected}
      />

      {/* ─── Bottom-Left Floating Zoom Controls (Themed) ───────────────────────── */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1 p-1 bg-[#121316]/95 backdrop-blur-md border border-[#27272A] rounded-2xl shadow-xl">
        <button
          type="button"
          onClick={() =>
            setViewport((prev) => ({ ...prev, zoom: Math.max(0.1, prev.zoom / 1.15) }))
          }
          className="w-7 h-7 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Zoom out"
        >
          <ZoomOut size={13} />
        </button>

        <button
          type="button"
          onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
          className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-medium hover:text-white transition-colors cursor-pointer"
          style={{ color: accentColor }}
          title="Reset zoom to 100%"
        >
          {Math.round(viewport.zoom * 100)}%
        </button>

        <button
          type="button"
          onClick={() =>
            setViewport((prev) => ({ ...prev, zoom: Math.min(5, prev.zoom * 1.15) }))
          }
          className="w-7 h-7 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Zoom in"
        >
          <ZoomIn size={13} />
        </button>
      </div>

      {/* ─── Infinite SVG Canvas Surface ──────────────────────────────────────── */}
      <svg className="w-full h-full pointer-events-none">
        <defs>
          <pattern
            id="dot-grid"
            width={24 * viewport.zoom}
            height={24 * viewport.zoom}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${viewport.x}, ${viewport.y})`}
          >
            <circle cx="2" cy="2" r={Math.min(1.2, 0.9 * viewport.zoom)} fill="#27272A" />
          </pattern>
          <marker
            id="arrowhead-accent"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={accentColor || '#818CF8'} />
          </marker>
          <filter id="sticky-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="2" dy="4" stdDeviation="4" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Dynamic Dot Grid Background */}
        <rect width="100%" height="100%" fill="url(#dot-grid)" />

        <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
          {elements.map((el) => {
            const isSelected = el.id === selectedId;

            if (el.type === 'freedraw' || el.type === 'highlighter') {
              const pathStr = getSvgPath(el.points);
              return (
                <path
                  key={el.id}
                  d={pathStr}
                  fill="none"
                  stroke={el.color}
                  strokeWidth={el.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={el.opacity ?? 1}
                  className="pointer-events-auto"
                />
              );
            }

            if (el.type === 'rectangle' || el.type === 'roundedRect') {
              return (
                <rect
                  key={el.id}
                  x={el.x}
                  y={el.y}
                  width={el.width}
                  height={el.height}
                  rx={el.type === 'roundedRect' ? 12 : 0}
                  fill={el.fillColor || 'transparent'}
                  stroke={el.color}
                  strokeWidth={el.strokeWidth}
                  strokeDasharray={el.strokeStyle === 'dashed' ? '8 6' : undefined}
                  className="pointer-events-auto"
                />
              );
            }

            if (el.type === 'circle') {
              return (
                <ellipse
                  key={el.id}
                  cx={el.x + el.width / 2}
                  cy={el.y + el.height / 2}
                  rx={Math.abs(el.width / 2)}
                  ry={Math.abs(el.height / 2)}
                  fill={el.fillColor || 'transparent'}
                  stroke={el.color}
                  strokeWidth={el.strokeWidth}
                  strokeDasharray={el.strokeStyle === 'dashed' ? '8 6' : undefined}
                  className="pointer-events-auto"
                />
              );
            }

            if (el.type === 'diamond') {
              const pts = `${el.x + el.width / 2},${el.y} ${el.x + el.width},${el.y + el.height / 2} ${el.x + el.width / 2},${el.y + el.height} ${el.x},${el.y + el.height / 2}`;
              return (
                <polygon
                  key={el.id}
                  points={pts}
                  fill={el.fillColor || 'transparent'}
                  stroke={el.color}
                  strokeWidth={el.strokeWidth}
                  strokeDasharray={el.strokeStyle === 'dashed' ? '8 6' : undefined}
                  className="pointer-events-auto"
                />
              );
            }

            if (el.type === 'line' || el.type === 'arrow') {
              return (
                <line
                  key={el.id}
                  x1={el.x}
                  y1={el.y}
                  x2={el.x + el.width}
                  y2={el.y + el.height}
                  stroke={el.color}
                  strokeWidth={el.strokeWidth}
                  strokeDasharray={el.strokeStyle === 'dashed' ? '8 6' : undefined}
                  markerEnd={el.type === 'arrow' ? 'url(#arrowhead-accent)' : undefined}
                  className="pointer-events-auto"
                />
              );
            }

            if (el.type === 'note') {
              const sc = STICKY_COLORS[el.noteColor || 'yellow'] || STICKY_COLORS.yellow;
              const isEditing = editingId === el.id;
              return (
                <g key={el.id} filter="url(#sticky-shadow)" className="pointer-events-auto">
                  <rect
                    x={el.x}
                    y={el.y}
                    width={el.width}
                    height={el.height}
                    rx={10}
                    fill={sc.bg}
                    stroke={sc.border}
                    strokeWidth={1}
                  />
                  {/* Top tape accent bar */}
                  <rect
                    x={el.x + el.width / 2 - 25}
                    y={el.y - 4}
                    width={50}
                    height={8}
                    rx={2}
                    fill="rgba(0,0,0,0.14)"
                  />
                  <foreignObject
                    x={el.x + 12}
                    y={el.y + 12}
                    width={el.width - 24}
                    height={el.height - 24}
                  >
                    {isEditing ? (
                      <textarea
                        autoFocus
                        value={el.text || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setElements((prev) =>
                            prev.map((item) =>
                              item.id === el.id ? { ...item, text: val } : item
                            )
                          );
                        }}
                        onBlur={() => setEditingId(null)}
                        className="w-full h-full bg-transparent resize-none outline-none font-sans font-medium"
                        style={{ color: sc.text, fontSize: `${el.fontSize || 16}px` }}
                      />
                    ) : (
                      <div
                        onDoubleClick={() => setEditingId(el.id)}
                        className="w-full h-full font-sans font-medium select-none overflow-hidden cursor-text"
                        style={{ color: sc.text, fontSize: `${el.fontSize || 16}px` }}
                      >
                        {el.text || 'Double click to edit note'}
                      </div>
                    )}
                  </foreignObject>
                </g>
              );
            }

            if (el.type === 'text') {
              const isEditing = editingId === el.id;
              return (
                <g key={el.id} className="pointer-events-auto">
                  <foreignObject
                    x={el.x}
                    y={el.y}
                    width={el.width || 300}
                    height={el.height || 60}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        autoFocus
                        value={el.text || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setElements((prev) =>
                            prev.map((item) =>
                              item.id === el.id ? { ...item, text: val } : item
                            )
                          );
                        }}
                        onBlur={() => setEditingId(null)}
                        className="w-full bg-transparent outline-none font-sans font-bold"
                        style={{ color: el.color, fontSize: `${el.fontSize || 22}px` }}
                      />
                    ) : (
                      <div
                        onDoubleClick={() => setEditingId(el.id)}
                        className="w-full font-sans font-bold select-none truncate cursor-text"
                        style={{ color: el.color, fontSize: `${el.fontSize || 22}px` }}
                      >
                        {el.text || 'Text'}
                      </div>
                    )}
                  </foreignObject>
                </g>
              );
            }

            return null;
          })}

          {/* ─── Selected Element Bounding Box (Uses DevFlow Accent Color) ──────── */}
          {selectedElement && (
            <g className="pointer-events-none">
              <rect
                x={selectedElement.x - 4}
                y={selectedElement.y - 4}
                width={selectedElement.width + 8}
                height={selectedElement.height + 8}
                fill="none"
                stroke={accentColor}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                rx={4}
              />
              {/* Corner Dots */}
              <circle
                cx={selectedElement.x - 4}
                cy={selectedElement.y - 4}
                r={4}
                fill="#FFFFFF"
                stroke={accentColor}
                strokeWidth={1.5}
              />
              <circle
                cx={selectedElement.x + selectedElement.width + 4}
                cy={selectedElement.y - 4}
                r={4}
                fill="#FFFFFF"
                stroke={accentColor}
                strokeWidth={1.5}
              />
              <circle
                cx={selectedElement.x + selectedElement.width + 4}
                cy={selectedElement.y + selectedElement.height + 4}
                r={4}
                fill="#FFFFFF"
                stroke={accentColor}
                strokeWidth={1.5}
              />
              <circle
                cx={selectedElement.x - 4}
                cy={selectedElement.y + selectedElement.height + 4}
                r={4}
                fill="#FFFFFF"
                stroke={accentColor}
                strokeWidth={1.5}
              />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
};
