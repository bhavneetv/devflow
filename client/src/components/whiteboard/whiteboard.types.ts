export type ElementType =
  | 'freedraw'
  | 'highlighter'
  | 'rectangle'
  | 'roundedRect'
  | 'circle'
  | 'diamond'
  | 'arrow'
  | 'line'
  | 'text'
  | 'note';

export type WhiteboardTool = 'select' | 'hand' | 'eraser' | ElementType;

export interface Point {
  x: number;
  y: number;
}

export type FlowEdge = 'top' | 'right' | 'bottom' | 'left' | 'center';

export interface ElementBinding {
  elementId: string;
  edge: FlowEdge;
}

export interface WhiteboardElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  points?: Point[];
  color: string;
  fillColor?: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed';
  opacity?: number;
  text?: string;
  fontSize?: number;
  noteColor?: string;
  startBinding?: ElementBinding;
  endBinding?: ElementBinding;
  createdAt: number;
  updatedAt: number;
}

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface StickyColorConfig {
  id: string;
  name: string;
  bg: string;
  border: string;
  text: string;
}

export interface WhiteboardTemplate {
  id: string;
  name: string;
  description: string;
  elements: Omit<WhiteboardElement, 'id' | 'createdAt' | 'updatedAt'>[];
}

export interface WhiteboardBoardMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  elementCount: number;
}

export interface WhiteboardBoardContent {
  elements: WhiteboardElement[];
  viewport?: CanvasViewport;
}

export interface WhiteboardAuditLogEntry {
  id: string;
  timestamp: number;
  userId?: string | number;
  userName: string;
  userEmail?: string;
  userAvatar?: string | null;
  userColor?: string | null;
  action:
    | 'created'
    | 'modified'
    | 'template_applied'
    | 'renamed'
    | 'cleared'
    | 'duplicated'
    | 'guest_edit';
  description: string;
  elementCount: number;
}

export type WhiteboardSharePermission = 'view' | 'edit';
export type WhiteboardShareStatus = 'private' | 'public_view' | 'public_edit';

export interface WhiteboardShareConfig {
  token: string;
  projectId: string | number;
  scopeKey: string;
  boardId: string;
  boardTitle: string;
  permission: WhiteboardSharePermission;
  enabled?: boolean;
  createdAt: number;
  updatedAt: number;
}

