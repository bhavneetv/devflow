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

