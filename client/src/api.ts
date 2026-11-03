import { Project, SystemHealth, Task, User } from './types';
import { API_BASE } from './config/api';

export async function fetchHealth(): Promise<SystemHealth> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/projects`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to fetch projects');
  return json.data;
}

export async function createProject(data: {
  title: string;
  description?: string;
  status?: string;
  ownerId: number;
}): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to create project');
  return json.data;
}

export async function deleteProject(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'DELETE',
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to delete project');
}

export async function fetchTasks(projectId?: number): Promise<Task[]> {
  const url = projectId ? `${API_BASE}/tasks?projectId=${projectId}` : `${API_BASE}/tasks`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to fetch tasks');
  return json.data;
}

export async function createTask(data: {
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  projectId: number;
  assigneeId?: number | null;
}): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to create task');
  return json.data;
}

export async function updateTask(
  id: number,
  data: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assigneeId'>>
): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to update task');
  return json.data;
}

export async function deleteTask(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'DELETE',
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to delete task');
}

export async function fetchUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/users`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to fetch users');
  return json.data;
}

export async function createUser(data: {
  name: string;
  email: string;
  role?: string;
  avatarUrl?: string;
}): Promise<User> {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to create user');
  return json.data;
}

export async function triggerSeed(): Promise<{ message: string; summary: any }> {
  const res = await fetch(`${API_BASE}/seed`, {
    method: 'POST',
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to seed database');
  return json;
}
