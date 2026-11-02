import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { HealthBanner } from './components/HealthBanner';
import { ProjectsView } from './components/ProjectsView';
import { TasksView } from './components/TasksView';
import { UsersView } from './components/UsersView';
import { PrismaTips } from './components/PrismaTips';
import {
  fetchHealth,
  fetchProjects,
  fetchTasks,
  fetchUsers,
  createProject,
  deleteProject,
  createTask,
  updateTask,
  deleteTask,
  createUser,
  triggerSeed,
} from './api';
import { Project, SystemHealth, Task, User, Priority, TaskStatus, Role } from './types';
import { FolderKanban, CheckSquare, Users, BookOpen, CheckCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'projects' | 'tasks' | 'users' | 'architecture'>('projects');
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [healthData, projectsData, tasksData, usersData] = await Promise.allSettled([
        fetchHealth(),
        fetchProjects(),
        fetchTasks(),
        fetchUsers(),
      ]);

      if (healthData.status === 'fulfilled') setHealth(healthData.value);
      if (projectsData.status === 'fulfilled') setProjects(projectsData.value);
      if (tasksData.status === 'fulfilled') setTasks(tasksData.value);
      if (usersData.status === 'fulfilled') setUsers(usersData.value);
    } catch (err: any) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      fetchHealth().then((h) => setHealth(h)).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await triggerSeed();
      showToast(res.message);
      await loadData();
    } catch (err: any) {
      showToast(`Seed failed: ${err.message}`);
    } finally {
      setSeeding(false);
    }
  };

  const handleCreateProject = async (data: { title: string; description: string; ownerId: number }) => {
    await createProject(data);
    showToast('Project created successfully!');
    await loadData();
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    await deleteProject(id);
    showToast('Project deleted');
    await loadData();
  };

  const handleCreateTask = async (data: {
    title: string;
    description: string;
    priority: Priority;
    status: TaskStatus;
    projectId: number;
    assigneeId: number | null;
  }) => {
    await createTask(data);
    showToast('Task added successfully!');
    await loadData();
  };

  const handleUpdateTask = async (id: number, data: Partial<Task>) => {
    await updateTask(id, data);
    showToast('Task updated');
    await loadData();
  };

  const handleDeleteTask = async (id: number) => {
    if (!confirm('Delete this task?')) return;
    await deleteTask(id);
    showToast('Task deleted');
    await loadData();
  };

  const handleCreateUser = async (data: { name: string; email: string; role: Role }) => {
    await createUser(data);
    showToast('Team member added!');
    await loadData();
  };

  return (
    <div className="app-container">
      <Navbar
        health={health}
        loading={loading}
        onRefresh={loadData}
        onSeed={handleSeed}
        seeding={seeding}
      />

      <main className="main-content">
        {/* Hero Section */}
        <div className="hero-section">
          <div className="hero-text">
            <h1>DevFlow Project Manager</h1>
            <p className="hero-subtitle">
              A fullstack modern template built with React, TypeScript, Node.js, and MySQL powered by Prisma ORM.
            </p>
            <div className="tech-badges">
              <span className="tech-badge active">⚛️ React 18</span>
              <span className="tech-badge active">📘 TypeScript</span>
              <span className="tech-badge active">🟢 Node.js + Express</span>
              <span className="tech-badge active">🐬 MySQL (XAMPP)</span>
              <span className="tech-badge active">💎 Prisma ORM</span>
              <span className="tech-badge active">⚡ Vite</span>
            </div>
          </div>
        </div>

        {/* Health & Metrics Banner */}
        <HealthBanner
          health={health}
          projectsCount={projects.length}
          tasksCount={tasks.length}
          usersCount={users.length}
        />

        {/* Navigation Tabs */}
        <div className="tabs-nav">
          <button
            className={`tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            <FolderKanban size={16} />
            <span>Projects</span>
            <span className="tab-badge">{projects.length}</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            <CheckSquare size={16} />
            <span>Tasks</span>
            <span className="tab-badge">{tasks.length}</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={16} />
            <span>Team Members</span>
            <span className="tab-badge">{users.length}</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'architecture' ? 'active' : ''}`}
            onClick={() => setActiveTab('architecture')}
          >
            <BookOpen size={16} />
            <span>Setup & Architecture Guide</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'projects' && (
          <ProjectsView
            projects={projects}
            users={users}
            onCreateProject={handleCreateProject}
            onDeleteProject={handleDeleteProject}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksView
            tasks={tasks}
            projects={projects}
            users={users}
            onCreateTask={handleCreateTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
          />
        )}

        {activeTab === 'users' && (
          <UsersView users={users} onCreateUser={handleCreateUser} />
        )}

        {activeTab === 'architecture' && <PrismaTips />}
      </main>

      {/* Toast alert */}
      {toastMessage && (
        <div className="toast">
          <CheckCircle size={18} color="#10b981" />
          <span>{toastMessage}</span>
        </div>
      )}

      <footer className="footer">
        <p>
          DevFlow • React + TypeScript + Node.js + MySQL + Prisma Monorepo • Ready for production & local development
        </p>
      </footer>
    </div>
  );
};
