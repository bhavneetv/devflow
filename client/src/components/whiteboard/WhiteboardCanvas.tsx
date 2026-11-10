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
  Grid,
  Plus,
  Minus,
  RotateCcw,
} from 'lucide-react';
import {
  WhiteboardElement,
  WhiteboardTool,
  CanvasViewport,
  Point,
  FlowEdge,
  ElementBinding,
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

export interface WhiteboardCanvasProps {
  projectId: number | string;
  scopeKey?: string;
  boardId: string;
  onElementsCountChange?: (count: number) => void;
  readOnly?: boolean;
  onSaveContent?: (elements: WhiteboardElement[]) => void;
}

type DragAction =
  | { type: 'pan'; startX: number; startY: number; initVpX: number; initVpY: number }
  | { type: 'draw'; currentElement: WhiteboardElement }
  | {
      type: 'move';
      startX: number;
      startY: number;
      initPositions: Record<string, { x: number; y: number; points?: Point[] }>;
    }
  | {
      type: 'resize';
      handle: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w' | 'start' | 'end';
      startX: number;
      startY: number;
      initElem: WhiteboardElement;
    }
  | {
      type: 'box_select';
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
      additive: boolean;
      initialSelectedIds: string[];
    }
  | { type: 'erase' };

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  projectId,
  scopeKey = 'main',
  boardId,
  onElementsCountChange,
  readOnly = false,
  onSaveContent,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { accentColor } = useAccentTheme();

  // Load initial content for this specific board using lazy state initializers
  const [viewport, setViewport] = useState<CanvasViewport>(() => {
    const data = loadBoardContent(projectId, scopeKey, boardId);
    return data.viewport || { x: 0, y: 0, zoom: 1 };
  });

  const [elements, setElements] = useState<WhiteboardElement[]>(() => {
    const data = loadBoardContent(projectId, scopeKey, boardId);
    return data.elements || [];
  });

  const [showGrid, setShowGrid] = useState(true);

  // History for Undo / Redo
  const [undoStack, setUndoStack] = useState<WhiteboardElement[][]>([]);
  const [redoStack, setRedoStack] = useState<WhiteboardElement[][]>([]);

  // Active Tool & Multi-Selection State
  const [tool, setTool] = useState<WhiteboardTool>('select');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
  const [dragAction, setDragAction] = useState<DragAction | null>(null);
  const [snappingAnchor, setSnappingAnchor] = useState<{ elementId: string; edge: FlowEdge; pt: Point } | null>(null);

  // Derived Selection Helpers
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const selectedElements = useMemo(
    () => elements.filter((el) => selectedIds.includes(el.id)),
    [elements, selectedIds]
  );
  const selectedElement = useMemo(
    () => (selectedId ? elements.find((el) => el.id === selectedId) || null : null),
    [elements, selectedId]
  );

  // Stable references for auto-save and count notifications without render loops
  const onCountChangeRef = useRef(onElementsCountChange);
  const onSaveContentRef = useRef(onSaveContent);
  useEffect(() => {
    onCountChangeRef.current = onElementsCountChange;
    onSaveContentRef.current = onSaveContent;
  });

  const lastCountRef = useRef<number>(-1);
  const isInitialMount = useRef(true);

  // Auto-save board content whenever elements or viewport change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!readOnly) {
      saveBoardContent(projectId, scopeKey, boardId, { elements, viewport });
      onSaveContentRef.current?.(elements);
    }
    if (elements.length !== lastCountRef.current) {
      lastCountRef.current = elements.length;
      onCountChangeRef.current?.(elements.length);
    }
  }, [elements, viewport, projectId, scopeKey, boardId, readOnly]);

  // Persist on unmount
  const elementsRef = useRef(elements);
  const viewportRef = useRef(viewport);
  useEffect(() => {
    elementsRef.current = elements;
    viewportRef.current = viewport;
  }, [elements, viewport]);

  useEffect(() => {
    return () => {
      if (!readOnly) {
        saveBoardContent(projectId, scopeKey, boardId, {
          elements: elementsRef.current,
          viewport: viewportRef.current,
        });
      }
    };
  }, [projectId, scopeKey, boardId, readOnly]);

  // Global window pointerup so mouse release outside canvas never traps clicks
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      setIsPointerDown(false);
      setDragAction(null);
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, []);

  // Native non-passive Wheel & Gestures Listener
  // Prevents browser Ctrl+Wheel / trackpad zoom from scaling the entire web page,
  // and disables pinch-to-zoom & double-tap zoom gestures on touch/mobile devices
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      // Intercept and prevent the browser from zooming the webpage
      e.preventDefault();
      e.stopPropagation();

      const rect = container.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;

      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch-to-zoom OR Ctrl + Mouse Wheel -> zoom canvas centered at cursor
        const zoomDelta = -e.deltaY * 0.003;
        const zoomFactor = Math.exp(zoomDelta);
        setViewport((prev) => {
          const newZoom = Math.min(5.0, Math.max(0.1, Number((prev.zoom * zoomFactor).toFixed(3))));
          const worldX = (pointerX - prev.x) / prev.zoom;
          const worldY = (pointerY - prev.y) / prev.zoom;
          return {
            x: pointerX - worldX * newZoom,
            y: pointerY - worldY * newZoom,
            zoom: newZoom,
          };
        });
      } else {
        // Normal 2-finger trackpad scroll or mouse wheel -> smooth canvas pan
        setViewport((prev) => ({
          ...prev,
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };

    // Disable Safari/iOS browser gesture zooming
    const handleGesture = (e: Event) => {
      e.preventDefault();
    };

    // Disable multi-touch browser pinch and double-tap zoom
    let lastTouchEndTime = 0;
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEndTime <= 350) {
        e.preventDefault();
      }
      lastTouchEndTime = now;
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    container.addEventListener('gesturestart', handleGesture, { passive: false });
    container.addEventListener('gesturechange', handleGesture, { passive: false });
    container.addEventListener('gestureend', handleGesture, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Window-level Ctrl+Wheel guard when cursor is inside the canvas
    const handleWindowWheel = (e: WheelEvent) => {
      if ((e.ctrlKey || e.metaKey) && container.contains(e.target as Node)) {
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', handleWindowWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
      container.removeEventListener('gesturestart', handleGesture);
      container.removeEventListener('gesturechange', handleGesture);
      container.removeEventListener('gestureend', handleGesture);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('wheel', handleWindowWheel);
    };
  }, []);

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
    setSelectedIds([]);
  }, [undoStack, elements]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setRedoStack((prev) => prev.slice(1));
    setUndoStack((prev) => [...prev, elements]);
    setElements(next);
    setSelectedIds([]);
  }, [redoStack, elements]);

  // Bring selected elements to front
  const handleBringToFront = useCallback(() => {
    if (selectedIds.length === 0) return;
    pushUndo(elements);
    setElements((prev) => {
      const rest = prev.filter((el) => !selectedIds.includes(el.id));
      const targets = prev.filter((el) => selectedIds.includes(el.id));
      return [...rest, ...targets];
    });
  }, [selectedIds, elements, pushUndo]);

  // Send selected elements to back
  const handleSendToBack = useCallback(() => {
    if (selectedIds.length === 0) return;
    pushUndo(elements);
    setElements((prev) => {
      const targets = prev.filter((el) => selectedIds.includes(el.id));
      const rest = prev.filter((el) => !selectedIds.includes(el.id));
      return [...targets, ...rest];
    });
  }, [selectedIds, elements, pushUndo]);

  // Duplicate selected elements
  const handleDuplicate = useCallback(() => {
    if (selectedIds.length === 0) return;
    pushUndo(elements);
    const newItems: WhiteboardElement[] = [];
    const newIds: string[] = [];

    selectedElements.forEach((item) => {
      const newId = `elem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      newIds.push(newId);
      newItems.push({
        ...item,
        id: newId,
        x: item.x + 30,
        y: item.y + 30,
        points: item.points ? item.points.map((p) => ({ x: p.x + 30, y: p.y + 30 })) : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    setElements((prev) => [...prev, ...newItems]);
    setSelectedIds(newIds);
  }, [selectedIds, selectedElements, elements, pushUndo]);

  // Delete selected elements
  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    pushUndo(elements);
    setElements((prev) => prev.filter((el) => !selectedIds.includes(el.id)));
    setSelectedIds([]);
    setEditingId(null);
  }, [selectedIds, elements, pushUndo]);

  // Screen to World Coordinates conversion
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

  // Authoritative bounds calculation for any element type (shapes, text, notes, freehand)
  const getElementBounds = useCallback((el: WhiteboardElement) => {
    if (el.type === 'freedraw' || el.type === 'highlighter') {
      if (!el.points || el.points.length === 0) {
        const minX = Math.min(el.x, el.x + el.width);
        const minY = Math.min(el.y, el.y + el.height);
        const w = Math.max(20, Math.abs(el.width));
        const h = Math.max(20, Math.abs(el.height));
        return { minX, minY, maxX: minX + w, maxY: minY + h, w, h };
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of el.points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      const w = Math.max(20, maxX - minX);
      const h = Math.max(20, maxY - minY);
      return { minX, minY, maxX: minX + w, maxY: minY + h, w, h };
    }

    const minX = Math.min(el.x, el.x + el.width);
    const minY = Math.min(el.y, el.y + el.height);
    const w =
      el.type === 'note'
        ? Math.max(120, Math.abs(el.width))
        : el.type === 'text'
        ? Math.max(120, Math.abs(el.width))
        : Math.max(20, Math.abs(el.width));
    const h =
      el.type === 'note'
        ? Math.max(90, Math.abs(el.height))
        : el.type === 'text'
        ? Math.max(40, Math.abs(el.height))
        : Math.max(20, Math.abs(el.height));

    return { minX, minY, maxX: minX + w, maxY: minY + h, w, h };
  }, []);

  // Get cardinal connection anchor coordinate on an element
  const getAnchorPoint = useCallback(
    (el: WhiteboardElement, edge: FlowEdge): Point => {
      const b = getElementBounds(el);
      const midX = b.minX + b.w / 2;
      const midY = b.minY + b.h / 2;
      switch (edge) {
        case 'right':
          return { x: b.maxX, y: midY };
        case 'bottom':
          return { x: midX, y: b.maxY };
        case 'left':
          return { x: b.minX, y: midY };
        case 'top':
          return { x: midX, y: b.minY };
        case 'center':
        default:
          return { x: midX, y: midY };
      }
    },
    [getElementBounds]
  );

  // Find the nearest connection anchor on any other element near a world point
  const findNearestAnchor = useCallback(
    (
      worldPt: Point,
      excludeElementId?: string
    ): { elementId: string; edge: FlowEdge; pt: Point } | null => {
      let nearest: { elementId: string; edge: FlowEdge; pt: Point; dist: number } | null = null;
      const snapDistance = 32;

      for (const el of elements) {
        if (
          el.id === excludeElementId ||
          el.type === 'line' ||
          el.type === 'arrow' ||
          el.type === 'freedraw' ||
          el.type === 'highlighter'
        ) {
          continue;
        }
        const b = getElementBounds(el);
        const midX = b.minX + b.w / 2;
        const midY = b.minY + b.h / 2;

        const candidates: Array<{ edge: FlowEdge; pt: Point }> = [
          { edge: 'right', pt: { x: b.maxX, y: midY } },
          { edge: 'bottom', pt: { x: midX, y: b.maxY } },
          { edge: 'left', pt: { x: b.minX, y: midY } },
          { edge: 'top', pt: { x: midX, y: b.minY } },
        ];

        for (const cand of candidates) {
          const d = Math.hypot(worldPt.x - cand.pt.x, worldPt.y - cand.pt.y);
          if (d <= snapDistance) {
            if (!nearest || d < nearest.dist) {
              nearest = { elementId: el.id, edge: cand.edge, pt: cand.pt, dist: d };
            }
          }
        }
      }

      return nearest ? { elementId: nearest.elementId, edge: nearest.edge, pt: nearest.pt } : null;
    },
    [elements, getElementBounds]
  );

  // Synchronize arrows connected to moved or resized elements in real time
  const syncBoundArrows = useCallback(
    (
      allElements: WhiteboardElement[],
      updatedMap: Record<string, WhiteboardElement>
    ): WhiteboardElement[] => {
      const elemMap: Record<string, WhiteboardElement> = {};
      allElements.forEach((el) => {
        elemMap[el.id] = updatedMap[el.id] || el;
      });

      return allElements.map((el) => {
        if (el.type !== 'arrow' && el.type !== 'line') return el;
        if (!el.startBinding && !el.endBinding) return el;

        let newX = el.x;
        let newY = el.y;
        let endX = el.x + el.width;
        let endY = el.y + el.height;
        let changed = false;

        if (el.startBinding && elemMap[el.startBinding.elementId]) {
          const src = elemMap[el.startBinding.elementId];
          const pt = getAnchorPoint(src, el.startBinding.edge);
          newX = pt.x;
          newY = pt.y;
          changed = true;
        }

        if (el.endBinding && elemMap[el.endBinding.elementId]) {
          const tgt = elemMap[el.endBinding.elementId];
          const pt = getAnchorPoint(tgt, el.endBinding.edge);
          endX = pt.x;
          endY = pt.y;
          changed = true;
        }

        if (changed) {
          return {
            ...el,
            x: newX,
            y: newY,
            width: endX - newX,
            height: endY - newY,
          };
        }
        return el;
      });
    },
    [getAnchorPoint]
  );

  // Flow Arrow Starter (one-click create or drag-out connected flowchart arrow)
  const handleStartFlowArrow = useCallback(
    (
      sourceElementId: string,
      fromX: number,
      fromY: number,
      dir: 'right' | 'bottom' | 'left' | 'top',
      e: React.PointerEvent
    ) => {
      e.stopPropagation();
      pushUndo(elements);

      const deltaMap = {
        right: { dx: 140, dy: 0 },
        bottom: { dx: 0, dy: 100 },
        left: { dx: -140, dy: 0 },
        top: { dx: 0, dy: -100 },
      };
      const { dx, dy } = deltaMap[dir];

      const newId = `elem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newArrow: WhiteboardElement = {
        id: newId,
        type: 'arrow',
        x: fromX,
        y: fromY,
        width: dx,
        height: dy,
        color: currentColor === '#FFFFFF' ? '#06B6D4' : currentColor,
        fillColor: 'transparent',
        strokeWidth: Math.max(2, currentWidth),
        strokeStyle: 'solid',
        startBinding: {
          elementId: sourceElementId,
          edge: dir,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setElements((prev) => [...prev, newArrow]);
      setSelectedIds([newId]);

      const wp = screenToWorld(e.clientX, e.clientY);
      setDragAction({
        type: 'resize',
        handle: 'end',
        startX: wp.x,
        startY: wp.y,
        initElem: { ...newArrow, width: 0, height: 0 },
      });
      setIsPointerDown(true);
    },
    [elements, currentColor, currentWidth, pushUndo, screenToWorld]
  );

  // Find topmost element under world point
  const findElementAt = useCallback(
    (worldPoint: Point): WhiteboardElement | null => {
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.type === 'freedraw' || el.type === 'highlighter') {
          if (el.points && el.points.length > 0) {
            const hit = el.points.some(
              (p) => Math.hypot(p.x - worldPoint.x, p.y - worldPoint.y) < 16
            );
            if (hit) return el;
          }
        } else {
          const b = getElementBounds(el);
          if (
            worldPoint.x >= b.minX - 6 &&
            worldPoint.x <= b.maxX + 6 &&
            worldPoint.y >= b.minY - 6 &&
            worldPoint.y <= b.maxY + 6
          ) {
            return el;
          }
        }
      }
      return null;
    },
    [elements]
  );

  // Helper: check if element intersects with marquee selection box
  const elementIntersectsBox = useCallback(
    (el: WhiteboardElement, bx: number, by: number, bw: number, bh: number): boolean => {
      const bRight = bx + bw;
      const bBottom = by + bh;

      if (el.type === 'freedraw' || el.type === 'highlighter') {
        if (!el.points || el.points.length === 0) return false;
        return el.points.some(
          (p) => p.x >= bx && p.x <= bRight && p.y >= by && p.y <= bBottom
        );
      }

      const b = getElementBounds(el);
      return !(b.minX > bRight || b.maxX < bx || b.minY > bBottom || b.maxY < by);
    },
    []
  );

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingId) return;

      if (e.code === 'Space' && !isSpacePressed) {
        setIsSpacePressed(true);
      }

      if (readOnly) return;

      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'v') setTool('select');
        else if (k === 'h') setTool('hand');
        else if (k === 'p') setTool('freedraw');
        else if (k === 's') setTool('note');
        else if (k === 'r') setTool('rectangle');
        else if (k === 'c' || k === 'o') setTool('circle');
        else if (k === 'a') setTool('arrow');
        else if (k === 'l') setTool('line');
        else if (k === 't') setTool('text');
        else if (k === 'e') setTool('eraser');
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      }

      // Select All: Ctrl+A / Cmd+A
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(elements.map((el) => el.id));
      }

      // Duplicate: Ctrl+D / Cmd+D
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicate();
      }

      // Escape: clear selection
      if (e.key === 'Escape') {
        setSelectedIds([]);
        setEditingId(null);
      }

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
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
  }, [
    readOnly,
    editingId,
    isSpacePressed,
    selectedIds,
    elements,
    handleUndo,
    handleRedo,
    handleDuplicate,
    handleDeleteSelected,
  ]);

  // Pointer Down Handler
  const handlePointerDown = (e: React.PointerEvent) => {
    if (editingId) setEditingId(null);

    // In readOnly mode, any mouse button or touch pans the canvas!
    if (readOnly) {
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

    // Pan with middle mouse, spacebar, or hand tool
    if (e.button === 1 || isSpacePressed || tool === 'hand') {
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

    if (e.button !== 0) return;

    const worldPoint = screenToWorld(e.clientX, e.clientY);

    // Eraser Tool
    if (tool === 'eraser') {
      const hit = findElementAt(worldPoint);
      if (hit) {
        pushUndo(elements);
        setElements((prev) => prev.filter((item) => item.id !== hit.id));
        setSelectedIds((prev) => prev.filter((id) => id !== hit.id));
      }
      setDragAction({ type: 'erase' });
      setIsPointerDown(true);
      return;
    }

    // Select Tool: Multi-Selection & Marquee Selection Box
    if (tool === 'select') {
      const hit = findElementAt(worldPoint);
      if (hit) {
        if (e.shiftKey) {
          // Toggle individual item in multi-selection
          setSelectedIds((prev) =>
            prev.includes(hit.id) ? prev.filter((id) => id !== hit.id) : [...prev, hit.id]
          );
          setEditingId(null);
          setIsPointerDown(true);
          return;
        }

        // If clicking an item that is already part of a multi-selection, keep multi-selection for group dragging
        const targetIds = selectedIds.includes(hit.id) ? selectedIds : [hit.id];
        setSelectedIds(targetIds);

        // Record initial positions for all elements being moved
        const initPositions: Record<string, { x: number; y: number; points?: Point[] }> = {};
        elements.forEach((el) => {
          if (targetIds.includes(el.id)) {
            initPositions[el.id] = {
              x: el.x,
              y: el.y,
              points: el.points ? el.points.map((p) => ({ ...p })) : undefined,
            };
          }
        });

        pushUndo(elements);
        setDragAction({
          type: 'move',
          startX: worldPoint.x,
          startY: worldPoint.y,
          initPositions,
        });
      } else {
        // Dragging on empty space -> start Marquee Drag Selection Box!
        if (!e.shiftKey) {
          setSelectedIds([]);
        }
        setEditingId(null);
        setDragAction({
          type: 'box_select',
          startX: worldPoint.x,
          startY: worldPoint.y,
          currentX: worldPoint.x,
          currentY: worldPoint.y,
          additive: e.shiftKey,
          initialSelectedIds: e.shiftKey ? [...selectedIds] : [],
        });
      }
      setIsPointerDown(true);
      return;
    }

    // Creating new element - tool stays persistent!
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

    if (tool === 'note') {
      baseElement.noteColor = currentNoteColor;
      baseElement.text = 'Sticky Note';
      baseElement.width = 180;
      baseElement.height = 140;
      baseElement.fontSize = currentFontSize;
    } else if (tool === 'text') {
      baseElement.text = 'Text';
      baseElement.width = 160;
      baseElement.height = 40;
      baseElement.fontSize = currentFontSize;
    } else if (tool === 'freedraw' || tool === 'highlighter') {
      baseElement.points = [worldPoint];
      if (tool === 'highlighter') {
        baseElement.strokeWidth = Math.max(16, currentWidth * 5);
        baseElement.opacity = 0.4;
      }
    }

    setElements((prev) => [...prev, baseElement]);
    setSelectedIds([newId]);

    if (tool === 'note' || tool === 'text') {
      setDragAction({
        type: 'move',
        startX: worldPoint.x,
        startY: worldPoint.y,
        initPositions: {
          [newId]: { x: baseElement.x, y: baseElement.y },
        },
      });
    } else {
      setDragAction({
        type: 'draw',
        currentElement: baseElement,
      });
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

    // Eraser drag
    if (dragAction.type === 'erase') {
      const hit = findElementAt(worldPoint);
      if (hit) {
        setElements((prev) => prev.filter((item) => item.id !== hit.id));
        setSelectedIds((prev) => prev.filter((id) => id !== hit.id));
      }
      return;
    }

    // Marquee Drag Selection Box
    if (dragAction.type === 'box_select') {
      const currentX = worldPoint.x;
      const currentY = worldPoint.y;
      setDragAction((prev) => (prev?.type === 'box_select' ? { ...prev, currentX, currentY } : prev));

      const bx = Math.min(dragAction.startX, currentX);
      const by = Math.min(dragAction.startY, currentY);
      const bw = Math.abs(currentX - dragAction.startX);
      const bh = Math.abs(currentY - dragAction.startY);

      const hitIds = elements
        .filter((el) => elementIntersectsBox(el, bx, by, bw, bh))
        .map((el) => el.id);

      if (dragAction.additive) {
        setSelectedIds(Array.from(new Set([...dragAction.initialSelectedIds, ...hitIds])));
      } else {
        setSelectedIds(hitIds);
      }
      return;
    }

    // Interactive Resizing for single selected element
    if (dragAction.type === 'resize' && selectedId) {
      const dx = worldPoint.x - dragAction.startX;
      const dy = worldPoint.y - dragAction.startY;
      const init = dragAction.initElem;
      const handle = dragAction.handle;

      let newX = init.x;
      let newY = init.y;
      let newW = init.width;
      let newH = init.height;

      if (init.type === 'line' || init.type === 'arrow') {
        const snap = findNearestAnchor(worldPoint, init.id);
        setSnappingAnchor(snap);
        const effPt = snap ? snap.pt : worldPoint;

        if (handle === 'start') {
          newX = effPt.x;
          newY = effPt.y;
          const endPt = { x: init.x + init.width, y: init.y + init.height };
          newW = endPt.x - effPt.x;
          newH = endPt.y - effPt.y;
        } else if (handle === 'end') {
          newW = effPt.x - init.x;
          newH = effPt.y - init.y;
        }
      } else {
        if (handle.includes('e')) {
          newW = Math.max(24, init.width + dx);
        }
        if (handle.includes('s')) {
          newH = Math.max(24, init.height + dy);
        }
        if (handle.includes('w')) {
          const proposedW = init.width - dx;
          if (proposedW >= 24) {
            newX = init.x + dx;
            newW = proposedW;
          }
        }
        if (handle.includes('n')) {
          const proposedH = init.height - dy;
          if (proposedH >= 24) {
            newY = init.y + dy;
            newH = proposedH;
          }
        }
      }

      let newPoints = init.points;
      if (init.points && init.points.length > 0 && init.width > 0 && init.height > 0) {
        const scaleX = newW / init.width;
        const scaleY = newH / init.height;
        newPoints = init.points.map((p) => ({
          x: newX + (p.x - init.x) * scaleX,
          y: newY + (p.y - init.y) * scaleY,
        }));
      }

      const updatedElem = {
        ...init,
        x: newX,
        y: newY,
        width: newW,
        height: newH,
        points: newPoints,
      };

      setElements((prev) => {
        const base = prev.map((item) => (item.id === selectedId ? updatedElem : item));
        return syncBoundArrows(base, { [selectedId]: updatedElem });
      });
      return;
    }

    // Move multiple selected elements together
    if (dragAction.type === 'move') {
      const dx = worldPoint.x - dragAction.startX;
      const dy = worldPoint.y - dragAction.startY;
      const movedMap: Record<string, WhiteboardElement> = {};

      setElements((prev) => {
        const updated = prev.map((item) => {
          const init = dragAction.initPositions?.[item.id];
          if (!init) return item;
          let res: WhiteboardElement;
          if (init.points && init.points.length > 0) {
            res = {
              ...item,
              x: init.x + dx,
              y: init.y + dy,
              points: init.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
            };
          } else {
            res = {
              ...item,
              x: init.x + dx,
              y: init.y + dy,
            };
          }
          movedMap[item.id] = res;
          return res;
        });
        return syncBoundArrows(updated, movedMap);
      });
      return;
    }

    // Draw new shape or stroke
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
      } else if (elem.type === 'arrow' || elem.type === 'line') {
        const snap = findNearestAnchor(worldPoint, elem.id);
        setSnappingAnchor(snap);
        const effPt = snap ? snap.pt : worldPoint;
        const w = effPt.x - elem.x;
        const h = effPt.y - elem.y;
        setElements((prev) =>
          prev.map((item) =>
            item.id === elem.id ? { ...item, width: w, height: h } : item
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

    // Commit magnetic anchor snap binding for arrows
    if (snappingAnchor) {
      if (dragAction?.type === 'resize' && selectedId) {
        setElements((prev) =>
          prev.map((item) => {
            if (item.id !== selectedId) return item;
            if (dragAction.handle === 'end') {
              return {
                ...item,
                endBinding: {
                  elementId: snappingAnchor.elementId,
                  edge: snappingAnchor.edge,
                },
              };
            }
            if (dragAction.handle === 'start') {
              return {
                ...item,
                startBinding: {
                  elementId: snappingAnchor.elementId,
                  edge: snappingAnchor.edge,
                },
              };
            }
            return item;
          })
        );
      } else if (
        dragAction?.type === 'draw' &&
        (dragAction.currentElement.type === 'arrow' || dragAction.currentElement.type === 'line')
      ) {
        setElements((prev) =>
          prev.map((item) =>
            item.id === dragAction.currentElement.id
              ? {
                  ...item,
                  endBinding: {
                    elementId: snappingAnchor.elementId,
                    edge: snappingAnchor.edge,
                  },
                }
              : item
          )
        );
      }
      setSnappingAnchor(null);
    }

    if (dragAction?.type === 'box_select') {
      const dist = Math.hypot(
        dragAction.currentX - dragAction.startX,
        dragAction.currentY - dragAction.startY
      );
      if (dist < 4 && !dragAction.additive) {
        setSelectedIds([]);
      }
    }
    setDragAction(null);
  };

  // Wheel and gestures are now handled natively with non-passive listeners in useEffect to prevent browser page zoom

  // Clear Canvas
  const handleClearCanvas = () => {
    if (elements.length === 0) return;
    if (window.confirm('Clear all elements from this whiteboard?')) {
      pushUndo(elements);
      setElements([]);
      setSelectedIds([]);
      setEditingId(null);
    }
  };

  // Apply Pre-built Template
  const handleApplyTemplate = (templateId: string) => {
    const tmpl = WHITEBOARD_TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;
    pushUndo(elements);
    const newItems = tmpl.elements.map((el, i) => ({
      ...el,
      id: `elem-tmpl-${Date.now()}-${i}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })) as WhiteboardElement[];

    setElements((prev) => [...prev, ...newItems]);
    setSelectedIds([]);
  };

  // Export board as PNG image
  const handleExportPng = () => {
    const svgElem = containerRef.current?.querySelector('svg');
    if (!svgElem) return;

    const svgData = new XMLSerializer().serializeToString(svgElem);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = containerRef.current!.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    img.onload = () => {
      ctx.fillStyle = '#0A0B0E';
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.download = `devflow-whiteboard-${boardId}-${Date.now()}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
  };

  // Export board as JSON file
  const handleExportJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify({ elements, viewport }, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `devflow-whiteboard-${boardId}.json`;
    a.click();
  };

  // Batch property modifiers
  const handleColorChange = (col: string) => {
    setCurrentColor(col);
    if (selectedIds.length > 0) {
      pushUndo(elements);
      setElements((prev) =>
        prev.map((item) => (selectedIds.includes(item.id) ? { ...item, color: col } : item))
      );
    }
  };

  const handleStrokeWidthChange = (w: number) => {
    setCurrentWidth(w);
    if (selectedIds.length > 0) {
      pushUndo(elements);
      setElements((prev) =>
        prev.map((item) => (selectedIds.includes(item.id) ? { ...item, strokeWidth: w } : item))
      );
    }
  };

  const handleStrokeStyleChange = (st: 'solid' | 'dashed') => {
    setCurrentStyle(st);
    if (selectedIds.length > 0) {
      pushUndo(elements);
      setElements((prev) =>
        prev.map((item) => (selectedIds.includes(item.id) ? { ...item, strokeStyle: st } : item))
      );
    }
  };

  const handleFillChange = (fill: string) => {
    setCurrentFill(fill);
    if (selectedIds.length > 0) {
      pushUndo(elements);
      setElements((prev) =>
        prev.map((item) => (selectedIds.includes(item.id) ? { ...item, fillColor: fill } : item))
      );
    }
  };

  const handleNoteColorChange = (nc: string) => {
    setCurrentNoteColor(nc);
    if (selectedIds.length > 0) {
      pushUndo(elements);
      setElements((prev) =>
        prev.map((item) =>
          selectedIds.includes(item.id) && item.type === 'note' ? { ...item, noteColor: nc } : item
        )
      );
    }
  };

  const handleFontSizeChange = (fs: number) => {
    setCurrentFontSize(fs);
    if (selectedIds.length > 0) {
      pushUndo(elements);
      setElements((prev) =>
        prev.map((item) => (selectedIds.includes(item.id) ? { ...item, fontSize: fs } : item))
      );
    }
  };

  // Convert SVG points array to smooth Bezier curve
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
      style={{
        touchAction: 'none',
        overscrollBehavior: 'none',
        backgroundImage: showGrid
          ? 'radial-gradient(circle, #27272A 1.2px, transparent 1.2px)'
          : 'none',
        backgroundSize: `${32 * viewport.zoom}px ${32 * viewport.zoom}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
      className={cn(
        'relative w-full h-full bg-[#0A0B0E] overflow-hidden select-none touch-none',
        readOnly
          ? 'cursor-grab active:cursor-grabbing'
          : tool === 'hand' || isSpacePressed
          ? 'cursor-grab active:cursor-grabbing'
          : 'cursor-crosshair'
      )}
    >
      {/* ─── Top Floating Toolbar & Properties Bar (Hidden in Read-Only Mode) ─── */}
      {!readOnly && (
        <>
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

          <WhiteboardPropertiesBar
            selectedElement={selectedElement}
            selectedCount={selectedIds.length}
            tool={tool}
            currentColor={currentColor}
            setCurrentColor={handleColorChange}
            currentWidth={currentWidth}
            setCurrentWidth={handleStrokeWidthChange}
            currentStyle={currentStyle}
            setCurrentStyle={handleStrokeStyleChange}
            currentFill={currentFill}
            setCurrentFill={handleFillChange}
            currentNoteColor={currentNoteColor}
            setCurrentNoteColor={handleNoteColorChange}
            currentFontSize={currentFontSize}
            setCurrentFontSize={handleFontSizeChange}
            onDuplicate={handleDuplicate}
            onDelete={handleDeleteSelected}
            onBringToFront={handleBringToFront}
            onSendToBack={handleSendToBack}
          />
        </>
      )}

      {/* ─── View-Only Mode Floating Badge ─── */}
      {readOnly && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#121316]/95 border border-[#27272A] shadow-2xl backdrop-blur-md pointer-events-auto">
          <div className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="text-xs font-semibold text-zinc-200">View Only</span>
          <span className="text-[11px] text-zinc-500 font-medium">· Drag or scroll to explore canvas</span>
        </div>
      )}

      {/* ─── Interactive SVG Canvas Layer ─────────────────────────────────────── */}
      <svg className="w-full h-full absolute inset-0 pointer-events-none overflow-visible">
        <defs>
          {/* Subtle Dot Grid Background */}
          <pattern
            id="dot-grid-pattern"
            width={32}
            height={32}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={16} cy={16} r={1.2} fill="#27272A" />
          </pattern>

          {/* Standard Arrow Marker */}
          <marker
            id="wb-arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" />
          </marker>
        </defs>

        {/* ─── Transformed World Content Group (Infinite Canvas) ──────────────── */}
        <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>

        {/* ─── Whiteboard Elements List ───────────────────────────────────────── */}
        <g className="pointer-events-auto">
          {elements.map((el) => {
            const isSelected = selectedIds.includes(el.id);

            // 1. Freehand Pen Stroke & Highlighter
            if (el.type === 'freedraw' || el.type === 'highlighter') {
              const d = getSvgPath(el.points);
              return (
                <path
                  key={el.id}
                  d={d}
                  fill="none"
                  stroke={el.color}
                  strokeWidth={el.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={el.opacity ?? 1}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (tool === 'select') {
                      if (e.shiftKey) {
                        setSelectedIds((prev) =>
                          prev.includes(el.id) ? prev.filter((id) => id !== el.id) : [...prev, el.id]
                        );
                      } else {
                        setSelectedIds([el.id]);
                      }
                    }
                  }}
                />
              );
            }

            // 2. Rectangle Shape
            if (el.type === 'rectangle' || el.type === 'roundedRect') {
              const rx = el.type === 'roundedRect' ? 12 : 0;
              const x = Math.min(el.x, el.x + el.width);
              const y = Math.min(el.y, el.y + el.height);
              const w = Math.abs(el.width);
              const h = Math.abs(el.height);
              return (
                <rect
                  key={el.id}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={rx}
                  fill={el.fillColor === 'transparent' ? 'none' : el.fillColor}
                  stroke={el.color}
                  strokeWidth={el.strokeWidth}
                  strokeDasharray={el.strokeStyle === 'dashed' ? '6 6' : undefined}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (tool === 'select') {
                      if (e.shiftKey) {
                        setSelectedIds((prev) =>
                          prev.includes(el.id) ? prev.filter((id) => id !== el.id) : [...prev, el.id]
                        );
                      } else {
                        setSelectedIds([el.id]);
                      }
                    }
                  }}
                />
              );
            }

            // 3. Ellipse / Circle Shape
            if (el.type === 'circle') {
              const cx = el.x + el.width / 2;
              const cy = el.y + el.height / 2;
              const rx = Math.abs(el.width) / 2;
              const ry = Math.abs(el.height) / 2;
              return (
                <ellipse
                  key={el.id}
                  cx={cx}
                  cy={cy}
                  rx={Math.max(1, rx)}
                  ry={Math.max(1, ry)}
                  fill={el.fillColor === 'transparent' ? 'none' : el.fillColor}
                  stroke={el.color}
                  strokeWidth={el.strokeWidth}
                  strokeDasharray={el.strokeStyle === 'dashed' ? '6 6' : undefined}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (tool === 'select') {
                      if (e.shiftKey) {
                        setSelectedIds((prev) =>
                          prev.includes(el.id) ? prev.filter((id) => id !== el.id) : [...prev, el.id]
                        );
                      } else {
                        setSelectedIds([el.id]);
                      }
                    }
                  }}
                />
              );
            }

            // 4. Diamond Shape
            if (el.type === 'diamond') {
              const midX = el.x + el.width / 2;
              const midY = el.y + el.height / 2;
              const pts = `${midX},${el.y} ${el.x + el.width},${midY} ${midX},${el.y + el.height} ${el.x},${midY}`;
              return (
                <polygon
                  key={el.id}
                  points={pts}
                  fill={el.fillColor === 'transparent' ? 'none' : el.fillColor}
                  stroke={el.color}
                  strokeWidth={el.strokeWidth}
                  strokeDasharray={el.strokeStyle === 'dashed' ? '6 6' : undefined}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (tool === 'select') {
                      if (e.shiftKey) {
                        setSelectedIds((prev) =>
                          prev.includes(el.id) ? prev.filter((id) => id !== el.id) : [...prev, el.id]
                        );
                      } else {
                        setSelectedIds([el.id]);
                      }
                    }
                  }}
                />
              );
            }

            // 5. Line
            if (el.type === 'line') {
              return (
                <line
                  key={el.id}
                  x1={el.x}
                  y1={el.y}
                  x2={el.x + el.width}
                  y2={el.y + el.height}
                  stroke={el.color}
                  strokeWidth={el.strokeWidth}
                  strokeDasharray={el.strokeStyle === 'dashed' ? '6 6' : undefined}
                  strokeLinecap="round"
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (tool === 'select') {
                      if (e.shiftKey) {
                        setSelectedIds((prev) =>
                          prev.includes(el.id) ? prev.filter((id) => id !== el.id) : [...prev, el.id]
                        );
                      } else {
                        setSelectedIds([el.id]);
                      }
                    }
                  }}
                />
              );
            }

            // 6. Arrow
            if (el.type === 'arrow') {
              return (
                <line
                  key={el.id}
                  x1={el.x}
                  y1={el.y}
                  x2={el.x + el.width}
                  y2={el.y + el.height}
                  stroke={el.color}
                  color={el.color}
                  strokeWidth={el.strokeWidth}
                  strokeDasharray={el.strokeStyle === 'dashed' ? '6 6' : undefined}
                  markerEnd="url(#wb-arrow)"
                  strokeLinecap="round"
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (tool === 'select') {
                      if (e.shiftKey) {
                        setSelectedIds((prev) =>
                          prev.includes(el.id) ? prev.filter((id) => id !== el.id) : [...prev, el.id]
                        );
                      } else {
                        setSelectedIds([el.id]);
                      }
                    }
                  }}
                />
              );
            }

            // 7. Sticky Note
            if (el.type === 'note') {
              const noteTheme =
                STICKY_COLORS[el.noteColor as keyof typeof STICKY_COLORS] || STICKY_COLORS.yellow;
              const x = Math.min(el.x, el.x + el.width);
              const y = Math.min(el.y, el.y + el.height);
              const w = Math.max(120, Math.abs(el.width));
              const h = Math.max(90, Math.abs(el.height));
              const isEditingThis = editingId === el.id;

              return (
                <foreignObject
                  key={el.id}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  className="overflow-visible"
                >
                  <div
                    onDoubleClick={() => setEditingId(el.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (tool === 'select') {
                        if (e.shiftKey) {
                          setSelectedIds((prev) =>
                            prev.includes(el.id) ? prev.filter((id) => id !== el.id) : [...prev, el.id]
                          );
                        } else {
                          setSelectedIds([el.id]);
                        }
                      }
                    }}
                    className={cn(
                      'w-full h-full p-3 rounded-xl shadow-lg border transition-shadow flex flex-col cursor-pointer select-none',
                      isSelected ? 'ring-2' : ''
                    )}
                    style={{
                      backgroundColor: noteTheme.bg,
                      borderColor: noteTheme.border,
                      color: noteTheme.text,
                      boxShadow: isSelected
                        ? `0 0 0 2px ${accentColor}, 0 10px 25px rgba(0,0,0,0.5)`
                        : '0 8px 20px rgba(0,0,0,0.3)',
                    }}
                  >
                    {isEditingThis ? (
                      <textarea
                        autoFocus
                        value={el.text || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setElements((prev) =>
                            prev.map((item) => (item.id === el.id ? { ...item, text: val } : item))
                          );
                        }}
                        onBlur={() => setEditingId(null)}
                        className="w-full h-full bg-transparent resize-none outline-none text-xs font-medium leading-relaxed"
                        style={{ color: noteTheme.text }}
                      />
                    ) : (
                      <div
                        className="w-full h-full text-xs font-medium leading-relaxed whitespace-pre-wrap overflow-hidden"
                        style={{ color: noteTheme.text, fontSize: el.fontSize || 14 }}
                      >
                        {el.text || 'Double-click to write...'}
                      </div>
                    )}
                  </div>
                </foreignObject>
              );
            }

            // 8. Text Element
            if (el.type === 'text') {
              const x = Math.min(el.x, el.x + el.width);
              const y = Math.min(el.y, el.y + el.height);
              const isEditingThis = editingId === el.id;

              return (
                <foreignObject
                  key={el.id}
                  x={x}
                  y={y}
                  width={Math.max(120, Math.abs(el.width))}
                  height={Math.max(40, Math.abs(el.height))}
                  className="overflow-visible"
                >
                  <div
                    onDoubleClick={() => setEditingId(el.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (tool === 'select') {
                        if (e.shiftKey) {
                          setSelectedIds((prev) =>
                            prev.includes(el.id) ? prev.filter((id) => id !== el.id) : [...prev, el.id]
                          );
                        } else {
                          setSelectedIds([el.id]);
                        }
                      }
                    }}
                    className={cn(
                      'p-1.5 rounded cursor-pointer select-none',
                      isSelected ? 'ring-1 ring-dashed' : ''
                    )}
                    style={{
                      borderColor: accentColor,
                      color: el.color,
                      fontSize: el.fontSize || 18,
                    }}
                  >
                    {isEditingThis ? (
                      <input
                        autoFocus
                        type="text"
                        value={el.text || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setElements((prev) =>
                            prev.map((item) => (item.id === el.id ? { ...item, text: val } : item))
                          );
                        }}
                        onBlur={() => setEditingId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setEditingId(null);
                        }}
                        className="w-full bg-transparent outline-none font-medium"
                        style={{ color: el.color }}
                      />
                    ) : (
                      <div className="font-medium whitespace-pre-wrap">
                        {el.text || 'Double-click to type'}
                      </div>
                    )}
                  </div>
                </foreignObject>
              );
            }

            return null;
          })}

          {/* ─── Multi-Selection Individual Bounding Boxes ─────────────────────── */}
          {selectedIds.length > 1 &&
            selectedElements.map((el) => {
              const minX = Math.min(el.x, el.x + el.width);
              const minY = Math.min(el.y, el.y + el.height);
              const w = Math.abs(el.width);
              const h = Math.abs(el.height);
              return (
                <g key={`multi-sel-${el.id}`} className="pointer-events-none">
                  <rect
                    x={minX - 4}
                    y={minY - 4}
                    width={w + 8}
                    height={h + 8}
                    fill={`${accentColor}0D`}
                    stroke={accentColor}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    rx={4}
                  />
                </g>
              );
            })}

          {/* ─── Multi-Selection Group Outline & Count Badge ──────────────────── */}
          {selectedIds.length > 1 && !readOnly && (() => {
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            selectedElements.forEach((el) => {
              minX = Math.min(minX, el.x, el.x + el.width);
              minY = Math.min(minY, el.y, el.y + el.height);
              maxX = Math.max(maxX, el.x, el.x + el.width);
              maxY = Math.max(maxY, el.y, el.y + el.height);
            });
            if (minX === Infinity) return null;
            return (
              <g className="pointer-events-none">
                <rect
                  x={minX - 6}
                  y={minY - 6}
                  width={maxX - minX + 12}
                  height={maxY - minY + 12}
                  fill="none"
                  stroke={accentColor}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  rx={6}
                />
                <rect
                  x={minX - 6}
                  y={minY - 24}
                  width={90}
                  height={18}
                  rx={5}
                  fill="#121316"
                  stroke={accentColor}
                  strokeWidth={1}
                />
                <text
                  x={minX + 39}
                  y={minY - 14}
                  fill="#FFFFFF"
                  fontSize={10}
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {selectedIds.length} elements
                </text>
              </g>
            );
          })()}

          {/* ─── Single Selected Element: Interactive Resize Handles & Flow Connector Dots ── */}
          {selectedIds.length === 1 && selectedElement && !readOnly && (() => {
            const isLineOrArrow = selectedElement.type === 'line' || selectedElement.type === 'arrow';
            if (isLineOrArrow) {
              return (
                <g className="pointer-events-auto">
                  <line
                    x1={selectedElement.x}
                    y1={selectedElement.y}
                    x2={selectedElement.x + selectedElement.width}
                    y2={selectedElement.y + selectedElement.height}
                    stroke={accentColor}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    className="pointer-events-none"
                  />
                  <g
                    className="cursor-crosshair"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      pushUndo(elements);
                      const wp = screenToWorld(e.clientX, e.clientY);
                      setDragAction({
                        type: 'resize',
                        handle: 'start',
                        startX: wp.x,
                        startY: wp.y,
                        initElem: { ...selectedElement },
                      });
                      setIsPointerDown(true);
                    }}
                  >
                    <circle cx={selectedElement.x} cy={selectedElement.y} r={14} fill="transparent" />
                    <circle
                      cx={selectedElement.x}
                      cy={selectedElement.y}
                      r={5.5}
                      fill="#FFFFFF"
                      stroke={accentColor}
                      strokeWidth={2}
                    />
                  </g>
                  <g
                    className="cursor-crosshair"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      pushUndo(elements);
                      const wp = screenToWorld(e.clientX, e.clientY);
                      setDragAction({
                        type: 'resize',
                        handle: 'end',
                        startX: wp.x,
                        startY: wp.y,
                        initElem: { ...selectedElement },
                      });
                      setIsPointerDown(true);
                    }}
                  >
                    <circle
                      cx={selectedElement.x + selectedElement.width}
                      cy={selectedElement.y + selectedElement.height}
                      r={14}
                      fill="transparent"
                    />
                    <circle
                      cx={selectedElement.x + selectedElement.width}
                      cy={selectedElement.y + selectedElement.height}
                      r={5.5}
                      fill="#FFFFFF"
                      stroke={accentColor}
                      strokeWidth={2}
                    />
                  </g>
                </g>
              );
            }

            const bounds = getElementBounds(selectedElement);
            const midX = bounds.minX + bounds.w / 2;
            const midY = bounds.minY + bounds.h / 2;

            const handleResizePointerDown = (
              handle: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w',
              e: React.PointerEvent
            ) => {
              e.stopPropagation();
              pushUndo(elements);
              const wp = screenToWorld(e.clientX, e.clientY);
              setDragAction({
                type: 'resize',
                handle,
                startX: wp.x,
                startY: wp.y,
                initElem: {
                  ...selectedElement,
                  x: bounds.minX,
                  y: bounds.minY,
                  width: bounds.w,
                  height: bounds.h,
                },
              });
              setIsPointerDown(true);
            };

            return (
              <g className="pointer-events-auto">
                {/* Outer Bounding Box Outline */}
                <rect
                  x={bounds.minX - 4}
                  y={bounds.minY - 4}
                  width={bounds.w + 8}
                  height={bounds.h + 8}
                  fill="none"
                  stroke={accentColor}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  rx={4}
                  className="pointer-events-none"
                />

                {/* 4 Corner Steady Handles (Non-vibrating, invisible hit targets) */}
                {/* NW */}
                <g style={{ cursor: 'nwse-resize' }} onPointerDown={(e) => handleResizePointerDown('nw', e)}>
                  <circle cx={bounds.minX - 4} cy={bounds.minY - 4} r={14} fill="transparent" />
                  <circle cx={bounds.minX - 4} cy={bounds.minY - 4} r={5} fill="#FFFFFF" stroke={accentColor} strokeWidth={2} />
                </g>

                {/* NE */}
                <g style={{ cursor: 'nesw-resize' }} onPointerDown={(e) => handleResizePointerDown('ne', e)}>
                  <circle cx={bounds.maxX + 4} cy={bounds.minY - 4} r={14} fill="transparent" />
                  <circle cx={bounds.maxX + 4} cy={bounds.minY - 4} r={5} fill="#FFFFFF" stroke={accentColor} strokeWidth={2} />
                </g>

                {/* SE */}
                <g style={{ cursor: 'nwse-resize' }} onPointerDown={(e) => handleResizePointerDown('se', e)}>
                  <circle cx={bounds.maxX + 4} cy={bounds.maxY + 4} r={14} fill="transparent" />
                  <circle cx={bounds.maxX + 4} cy={bounds.maxY + 4} r={5} fill="#FFFFFF" stroke={accentColor} strokeWidth={2} />
                </g>

                {/* SW */}
                <g style={{ cursor: 'nesw-resize' }} onPointerDown={(e) => handleResizePointerDown('sw', e)}>
                  <circle cx={bounds.minX - 4} cy={bounds.maxY + 4} r={14} fill="transparent" />
                  <circle cx={bounds.minX - 4} cy={bounds.maxY + 4} r={5} fill="#FFFFFF" stroke={accentColor} strokeWidth={2} />
                </g>

                {/* 4 Edge Midpoint Steady Handles */}
                {/* N */}
                <g style={{ cursor: 'ns-resize' }} onPointerDown={(e) => handleResizePointerDown('n', e)}>
                  <circle cx={midX} cy={bounds.minY - 4} r={12} fill="transparent" />
                  <circle cx={midX} cy={bounds.minY - 4} r={4.5} fill="#FFFFFF" stroke={accentColor} strokeWidth={1.5} />
                </g>

                {/* E */}
                <g style={{ cursor: 'ew-resize' }} onPointerDown={(e) => handleResizePointerDown('e', e)}>
                  <circle cx={bounds.maxX + 4} cy={midY} r={12} fill="transparent" />
                  <circle cx={bounds.maxX + 4} cy={midY} r={4.5} fill="#FFFFFF" stroke={accentColor} strokeWidth={1.5} />
                </g>

                {/* S */}
                <g style={{ cursor: 'ns-resize' }} onPointerDown={(e) => handleResizePointerDown('s', e)}>
                  <circle cx={midX} cy={bounds.maxY + 4} r={12} fill="transparent" />
                  <circle cx={midX} cy={bounds.maxY + 4} r={4.5} fill="#FFFFFF" stroke={accentColor} strokeWidth={1.5} />
                </g>

                {/* W */}
                <g style={{ cursor: 'ew-resize' }} onPointerDown={(e) => handleResizePointerDown('w', e)}>
                  <circle cx={bounds.minX - 4} cy={midY} r={12} fill="transparent" />
                  <circle cx={bounds.minX - 4} cy={midY} r={4.5} fill="#FFFFFF" stroke={accentColor} strokeWidth={1.5} />
                </g>

                {/* ─── 4 Flow Connector Dots (Click or Drag to branch flow arrow!) ─── */}
                {/* Right Flow Connector */}
                <g
                  className="cursor-pointer"
                  onPointerDown={(e) => handleStartFlowArrow(selectedElement.id, bounds.maxX, midY, 'right', e)}
                >
                  <circle cx={bounds.maxX + 15} cy={midY} r={14} fill="transparent" />
                  <circle
                    cx={bounds.maxX + 15}
                    cy={midY}
                    r={6}
                    fill="#06B6D4"
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                    className="filter drop-shadow(0 0 4px rgba(6,182,212,0.8))"
                  />
                  <polygon
                    points={`${bounds.maxX + 14},${midY - 3} ${bounds.maxX + 18},${midY} ${bounds.maxX + 14},${midY + 3}`}
                    fill="#FFFFFF"
                    className="pointer-events-none"
                  />
                </g>

                {/* Bottom Flow Connector */}
                <g
                  className="cursor-pointer"
                  onPointerDown={(e) => handleStartFlowArrow(selectedElement.id, midX, bounds.maxY, 'bottom', e)}
                >
                  <circle cx={midX} cy={bounds.maxY + 15} r={14} fill="transparent" />
                  <circle
                    cx={midX}
                    cy={bounds.maxY + 15}
                    r={6}
                    fill="#06B6D4"
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                    className="filter drop-shadow(0 0 4px rgba(6,182,212,0.8))"
                  />
                  <polygon
                    points={`${midX - 3},${bounds.maxY + 14} ${midX},${bounds.maxY + 18} ${midX + 3},${bounds.maxY + 14}`}
                    fill="#FFFFFF"
                    className="pointer-events-none"
                  />
                </g>

                {/* Left Flow Connector */}
                <g
                  className="cursor-pointer"
                  onPointerDown={(e) => handleStartFlowArrow(selectedElement.id, bounds.minX, midY, 'left', e)}
                >
                  <circle cx={bounds.minX - 15} cy={midY} r={14} fill="transparent" />
                  <circle
                    cx={bounds.minX - 15}
                    cy={midY}
                    r={6}
                    fill="#06B6D4"
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                    className="filter drop-shadow(0 0 4px rgba(6,182,212,0.8))"
                  />
                  <polygon
                    points={`${bounds.minX - 14},${midY - 3} ${bounds.minX - 18},${midY} ${bounds.minX - 14},${midY + 3}`}
                    fill="#FFFFFF"
                    className="pointer-events-none"
                  />
                </g>

                {/* Top Flow Connector */}
                <g
                  className="cursor-pointer"
                  onPointerDown={(e) => handleStartFlowArrow(selectedElement.id, midX, bounds.minY, 'top', e)}
                >
                  <circle cx={midX} cy={bounds.minY - 15} r={14} fill="transparent" />
                  <circle
                    cx={midX}
                    cy={bounds.minY - 15}
                    r={6}
                    fill="#06B6D4"
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                    className="filter drop-shadow(0 0 4px rgba(6,182,212,0.8))"
                  />
                  <polygon
                    points={`${midX - 3},${bounds.minY - 14} ${midX},${bounds.minY - 18} ${midX + 3},${bounds.minY - 14}`}
                    fill="#FFFFFF"
                    className="pointer-events-none"
                  />
                </g>
              </g>
            );
          })()}

          {/* ─── Magnetic Snapping Anchor Target Ring ───────────────────────── */}
          {snappingAnchor && !readOnly && (
            <g className="pointer-events-none">
              <circle
                cx={snappingAnchor.pt.x}
                cy={snappingAnchor.pt.y}
                r={12}
                fill="none"
                stroke="#06B6D4"
                strokeWidth={2}
                strokeDasharray="4 3"
              />
              <circle
                cx={snappingAnchor.pt.x}
                cy={snappingAnchor.pt.y}
                r={4.5}
                fill="#06B6D4"
              />
            </g>
          )}

          {/* ─── Marquee Drag Selection Box ──────────────────────────────────── */}
          {dragAction?.type === 'box_select' && !readOnly && (
            <rect
              x={Math.min(dragAction.startX, dragAction.currentX)}
              y={Math.min(dragAction.startY, dragAction.currentY)}
              width={Math.abs(dragAction.currentX - dragAction.startX)}
              height={Math.abs(dragAction.currentY - dragAction.startY)}
              fill={`${accentColor}18`}
              stroke={accentColor}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              rx={3}
              className="pointer-events-none"
            />
          )}
        </g>
      </g>
    </svg>

    {/* ─── Bottom-Left: Grid Toggle ─────────────────────────────────────────── */}
    <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-20 flex items-center gap-1.5 bg-[#121316]/95 backdrop-blur-md border border-[#27272A] p-1 rounded-xl shadow-xl select-none">
      <button
        type="button"
        onClick={() => setShowGrid((prev) => !prev)}
        className={cn(
          'flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors',
          showGrid ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
        )}
        style={showGrid ? { backgroundColor: `${accentColor}25`, color: accentColor } : undefined}
        title={showGrid ? 'Hide Dot Grid' : 'Show Dot Grid'}
      >
        <Grid size={13} />
        <span className="text-[11px] font-medium hidden xs:inline">Grid</span>
      </button>
    </div>

    {/* ─── Bottom-Right: Floating Zoom In/Out & Canvas View Controls ──────────── */}
    <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 flex items-center gap-0.5 sm:gap-1 bg-[#121316]/95 backdrop-blur-md border border-[#27272A] p-1 rounded-xl shadow-2xl select-none text-xs">
      {/* Zoom Out Button */}
      <button
        type="button"
        onClick={() =>
          setViewport((prev) => ({
            ...prev,
            zoom: Math.max(0.1, Number((prev.zoom / 1.2).toFixed(2))),
          }))
        }
        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 active:bg-zinc-700/80 transition-colors cursor-pointer"
        title="Zoom Out (Ctrl -)"
      >
        <Minus size={14} />
      </button>

      {/* Zoom Level Display / Reset to 100% */}
      <button
        type="button"
        onClick={() => setViewport((prev) => ({ ...prev, zoom: 1 }))}
        className="px-1.5 sm:px-2 h-7 sm:h-8 flex items-center justify-center rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800/80 font-mono text-[11px] sm:text-xs transition-colors cursor-pointer"
        title="Reset Zoom to 100%"
      >
        {Math.round(viewport.zoom * 100)}%
      </button>

      {/* Zoom In Button */}
      <button
        type="button"
        onClick={() =>
          setViewport((prev) => ({
            ...prev,
            zoom: Math.min(5, Number((prev.zoom * 1.2).toFixed(2))),
          }))
        }
        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 active:bg-zinc-700/80 transition-colors cursor-pointer"
        title="Zoom In (Ctrl +)"
      >
        <Plus size={14} />
      </button>

      <div className="w-[1px] h-4 bg-zinc-800 mx-0.5" />

      {/* Reset View Center */}
      <button
        type="button"
        onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
        title="Reset View to Center (0, 0)"
      >
        <Maximize2 size={13} />
      </button>
    </div>
    </div>
  );
};
