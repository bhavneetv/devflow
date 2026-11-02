export type Role = 'ADMIN' | 'MEMBER' | 'VIEWER';
export type ProjectStatus = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    projects: number;
    assignedTasks: number;
  };
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null;
  projectId: number;
  project?: {
    id: number;
    title: string;
    status: ProjectStatus;
  };
  assigneeId: number | null;
  assignee?: {
    id: number;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: number;
  title: string;
  description: string | null;
  status: ProjectStatus;
  ownerId: number;
  owner?: {
    id: number;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  tasks?: Task[];
  _count?: {
    tasks: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SystemHealth {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
  database: {
    type: string;
    status: 'connected' | 'disconnected' | 'error';
    latencyMs: number | null;
    error: string | null;
  };
}
