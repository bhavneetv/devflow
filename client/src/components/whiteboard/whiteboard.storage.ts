import { WhiteboardElement, CanvasViewport, WhiteboardBoardMeta, WhiteboardBoardContent } from './whiteboard.types';
import { WHITEBOARD_TEMPLATES } from './whiteboard.constants';

const META_KEY_PREFIX = 'devflow:wb_boards';
const ACTIVE_KEY_PREFIX = 'devflow:wb_active';
const CONTENT_KEY_PREFIX = 'devflow:wb_content';

export function getBoardsMetaKey(projectId: string | number, scopeKey: string): string {
  return `${META_KEY_PREFIX}:${projectId}:${scopeKey}`;
}

export function getActiveBoardIdKey(projectId: string | number, scopeKey: string): string {
  return `${ACTIVE_KEY_PREFIX}:${projectId}:${scopeKey}`;
}

export function getBoardContentKey(projectId: string | number, scopeKey: string, boardId: string): string {
  return `${CONTENT_KEY_PREFIX}:${projectId}:${scopeKey}:${boardId}`;
}

/**
 * Loads metadata of all boards for a given project and submodule scope.
 * Automatically migrates any legacy single-board data if found.
 */
export function loadBoardsMeta(
  projectId: string | number,
  scopeKey: string,
  defaultTitle?: string
): WhiteboardBoardMeta[] {
  if (typeof window === 'undefined') return [];

  const metaKey = getBoardsMetaKey(projectId, scopeKey);
  try {
    const raw = localStorage.getItem(metaKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse boards metadata:', err);
  }

  // Check legacy storage key: devflow:whiteboard:${projectId}
  const legacyKey = `devflow:whiteboard:${projectId}`;
  let legacyElements: WhiteboardElement[] | null = null;
  try {
    const rawLegacy = localStorage.getItem(legacyKey);
    if (rawLegacy) {
      const parsedLegacy = JSON.parse(rawLegacy);
      if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
        legacyElements = parsedLegacy;
      }
    }
  } catch {
    // non-blocking
  }

  const initialBoardId = `board_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const initialTitle = defaultTitle || (legacyElements ? 'Migrated Whiteboard' : 'Whiteboard 1');

  const initialMeta: WhiteboardBoardMeta = {
    id: initialBoardId,
    title: initialTitle,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    elementCount: legacyElements ? legacyElements.length : WHITEBOARD_TEMPLATES[0].elements.length,
  };

  const initialList = [initialMeta];
  saveBoardsMeta(projectId, scopeKey, initialList);
  saveActiveBoardId(projectId, scopeKey, initialBoardId);

  // Save initial content
  const initialElements: WhiteboardElement[] = legacyElements
    ? legacyElements
    : WHITEBOARD_TEMPLATES[0].elements.map((el, i) => ({
        ...el,
        id: `init-${i}-${Date.now()}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })) as WhiteboardElement[];

  saveBoardContent(projectId, scopeKey, initialBoardId, {
    elements: initialElements,
    viewport: { x: 0, y: 0, zoom: 1 },
  });

  return initialList;
}

export function saveBoardsMeta(
  projectId: string | number,
  scopeKey: string,
  boards: WhiteboardBoardMeta[]
): void {
  if (typeof window === 'undefined') return;
  const metaKey = getBoardsMetaKey(projectId, scopeKey);
  try {
    localStorage.setItem(metaKey, JSON.stringify(boards));
  } catch (err) {
    console.error('Failed to save boards metadata:', err);
  }
}

export function loadActiveBoardId(
  projectId: string | number,
  scopeKey: string,
  availableBoards: WhiteboardBoardMeta[]
): string {
  if (typeof window === 'undefined') return availableBoards[0]?.id || '';
  const activeKey = getActiveBoardIdKey(projectId, scopeKey);
  try {
    const saved = localStorage.getItem(activeKey);
    if (saved && availableBoards.some((b) => b.id === saved)) {
      return saved;
    }
  } catch {
    // fallback
  }
  return availableBoards[0]?.id || '';
}

export function saveActiveBoardId(
  projectId: string | number,
  scopeKey: string,
  boardId: string
): void {
  if (typeof window === 'undefined') return;
  const activeKey = getActiveBoardIdKey(projectId, scopeKey);
  try {
    localStorage.setItem(activeKey, boardId);
  } catch {
    // non-blocking
  }
}

export function loadBoardContent(
  projectId: string | number,
  scopeKey: string,
  boardId: string
): WhiteboardBoardContent {
  if (typeof window === 'undefined') return { elements: [], viewport: { x: 0, y: 0, zoom: 1 } };
  const contentKey = getBoardContentKey(projectId, scopeKey, boardId);
  try {
    const raw = localStorage.getItem(contentKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.elements)) {
        return {
          elements: parsed.elements,
          viewport: parsed.viewport || { x: 0, y: 0, zoom: 1 },
        };
      }
    }
  } catch (err) {
    console.warn('Failed to load board content:', err);
  }

  return {
    elements: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function saveBoardContent(
  projectId: string | number,
  scopeKey: string,
  boardId: string,
  content: WhiteboardBoardContent
): void {
  if (typeof window === 'undefined') return;
  const contentKey = getBoardContentKey(projectId, scopeKey, boardId);
  try {
    localStorage.setItem(contentKey, JSON.stringify(content));
  } catch (err) {
    console.error('Failed to save board content:', err);
  }
}

export function createNewBoard(
  projectId: string | number,
  scopeKey: string,
  title?: string,
  initialElements?: WhiteboardElement[]
): { meta: WhiteboardBoardMeta; updatedList: WhiteboardBoardMeta[] } {
  const currentList = loadBoardsMeta(projectId, scopeKey);
  const newId = `board_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const defaultNum = currentList.length + 1;
  const newTitle = title || `Whiteboard ${defaultNum}`;

  const newMeta: WhiteboardBoardMeta = {
    id: newId,
    title: newTitle,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    elementCount: initialElements ? initialElements.length : 0,
  };

  const updatedList = [...currentList, newMeta];
  saveBoardsMeta(projectId, scopeKey, updatedList);
  saveActiveBoardId(projectId, scopeKey, newId);

  saveBoardContent(projectId, scopeKey, newId, {
    elements: initialElements || [],
    viewport: { x: 0, y: 0, zoom: 1 },
  });

  return { meta: newMeta, updatedList };
}

export function duplicateExistingBoard(
  projectId: string | number,
  scopeKey: string,
  sourceBoardId: string,
  newTitle?: string
): { meta: WhiteboardBoardMeta; updatedList: WhiteboardBoardMeta[] } {
  const currentList = loadBoardsMeta(projectId, scopeKey);
  const sourceMeta = currentList.find((b) => b.id === sourceBoardId);
  const sourceContent = loadBoardContent(projectId, scopeKey, sourceBoardId);

  const newId = `board_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const title = newTitle || `${sourceMeta?.title || 'Whiteboard'} (Copy)`;

  // Clone elements with new unique IDs
  const clonedElements: WhiteboardElement[] = (sourceContent.elements || []).map((el, i) => ({
    ...el,
    id: `clone-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 5)}`,
    x: el.x + 40,
    y: el.y + 40,
  }));

  const newMeta: WhiteboardBoardMeta = {
    id: newId,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    elementCount: clonedElements.length,
  };

  const updatedList = [...currentList, newMeta];
  saveBoardsMeta(projectId, scopeKey, updatedList);
  saveActiveBoardId(projectId, scopeKey, newId);

  saveBoardContent(projectId, scopeKey, newId, {
    elements: clonedElements,
    viewport: sourceContent.viewport || { x: 0, y: 0, zoom: 1 },
  });

  return { meta: newMeta, updatedList };
}

export function deleteExistingBoard(
  projectId: string | number,
  scopeKey: string,
  boardIdToDelete: string
): { remainingList: WhiteboardBoardMeta[]; nextActiveId: string } {
  const currentList = loadBoardsMeta(projectId, scopeKey);
  if (currentList.length <= 1) {
    // Keep at least one board
    return { remainingList: currentList, nextActiveId: currentList[0].id };
  }

  const remainingList = currentList.filter((b) => b.id !== boardIdToDelete);
  saveBoardsMeta(projectId, scopeKey, remainingList);

  // Remove content from storage
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(getBoardContentKey(projectId, scopeKey, boardIdToDelete));
    } catch {
      // non-blocking
    }
  }

  const activeKey = getActiveBoardIdKey(projectId, scopeKey);
  const currentActive = localStorage.getItem(activeKey);
  let nextActiveId = remainingList[0].id;

  if (currentActive === boardIdToDelete) {
    saveActiveBoardId(projectId, scopeKey, nextActiveId);
  } else if (currentActive) {
    nextActiveId = currentActive;
  }

  return { remainingList, nextActiveId };
}

export function renameExistingBoard(
  projectId: string | number,
  scopeKey: string,
  boardId: string,
  newTitle: string
): WhiteboardBoardMeta[] {
  const currentList = loadBoardsMeta(projectId, scopeKey);
  const updatedList = currentList.map((b) =>
    b.id === boardId ? { ...b, title: newTitle.trim() || b.title, updatedAt: Date.now() } : b
  );
  saveBoardsMeta(projectId, scopeKey, updatedList);
  return updatedList;
}
