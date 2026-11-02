import React, { useState } from 'react';
import { Plus, CheckSquare, Trash2, ArrowRight, User as UserIcon } from 'lucide-react';
import { Priority, Project, Task, TaskStatus, User } from '../types';

interface TasksViewProps {
  tasks: Task[];
  projects: Project[];
  users: User[];
  onCreateTask: (data: {
    title: string;
    description: string;
    priority: Priority;
    status: TaskStatus;
    projectId: number;
    assigneeId: number | null;
  }) => Promise<void>;
  onUpdateTask: (id: number, data: Partial<Task>) => Promise<void>;
  onDeleteTask: (id: number) => Promise<void>;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  projects,
  users,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [projectId, setProjectId] = useState<number>(projects[0]?.id || 1);
  const [assigneeId, setAssigneeId] = useState<number | null>(users[0]?.id || null);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !projectId) return;
    setSubmitting(true);
    try {
      await onCreateTask({
        title,
        description,
        priority,
        status,
        projectId,
        assigneeId: assigneeId ? Number(assigneeId) : null,
      });
      setTitle('');
      setDescription('');
      setShowForm(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const cycleStatus = async (task: Task) => {
    const nextStatus: Record<TaskStatus, TaskStatus> = {
      TODO: 'IN_PROGRESS',
      IN_PROGRESS: 'IN_REVIEW',
      IN_REVIEW: 'DONE',
      DONE: 'TODO',
    };
    await onUpdateTask(task.id, { status: nextStatus[task.status] });
  };

  const getPriorityBadge = (p: Priority) => {
    switch (p) {
      case 'URGENT':
        return <span className="badge badge-urgent">Urgent</span>;
      case 'HIGH':
        return <span className="badge badge-high">High</span>;
      case 'MEDIUM':
        return <span className="badge badge-medium">Medium</span>;
      case 'LOW':
        return <span className="badge badge-low">Low</span>;
    }
  };

  const getStatusBadge = (s: TaskStatus) => {
    switch (s) {
      case 'DONE':
        return <span className="badge badge-done">Done</span>;
      case 'IN_PROGRESS':
        return <span className="badge badge-in_progress">In Progress</span>;
      case 'IN_REVIEW':
        return <span className="badge badge-in_review">In Review</span>;
      case 'TODO':
        return <span className="badge badge-todo">To Do</span>;
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterStatus === 'ALL') return true;
    return t.status === filterStatus;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Tasks & Action Items</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Foreign key relations between Project, User, and Task in MySQL
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            className="form-control"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
          >
            <option value="ALL">All Statuses ({tasks.length})</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="DONE">Done</option>
          </select>

          <button
            className="btn btn-primary"
            onClick={() => setShowForm(!showForm)}
            disabled={projects.length === 0}
          >
            <Plus size={16} />
            <span>{showForm ? 'Cancel' : 'New Task'}</span>
          </button>
        </div>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleSubmit}>
          <div className="form-title">
            <CheckSquare size={18} color="#6366f1" />
            <span>Create New Task</span>
          </div>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Task Title *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Set up JWT middleware"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Assigned Project *</label>
              <select
                className="form-control"
                value={projectId}
                onChange={(e) => setProjectId(Number(e.target.value))}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Assignee</label>
              <select
                className="form-control"
                value={assigneeId || ''}
                onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Priority</label>
              <select
                className="form-control"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div className="form-group">
              <label>Initial Status</label>
              <select
                className="form-control"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="DONE">Done</option>
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Acceptance criteria or details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Save Task'}
            </button>
          </div>
        </form>
      )}

      {filteredTasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <CheckSquare size={24} />
          </div>
          <h3>No Tasks Found</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            No tasks match your selected filter or the database is empty.
          </p>
        </div>
      ) : (
        <div className="cards-grid">
          {filteredTasks.map((task) => (
            <div key={task.id} className="card">
              <div className="card-header">
                <div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                    {getPriorityBadge(task.priority)}
                    {getStatusBadge(task.status)}
                  </div>
                  <h3 className="card-title">{task.title}</h3>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.3rem', color: '#fda4af' }}
                  onClick={() => onDeleteTask(task.id)}
                  title="Delete Task"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {task.description && <p className="card-desc">{task.description}</p>}

              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                Project: <strong style={{ color: 'var(--text-muted)' }}>{task.project?.title || `ID #${task.projectId}`}</strong>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {task.assignee?.avatarUrl ? (
                    <img src={task.assignee.avatarUrl} alt={task.assignee.name} className="avatar" />
                  ) : (
                    <div className="avatar">
                      <UserIcon size={14} />
                    </div>
                  )}
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {task.assignee?.name || 'Unassigned'}
                  </span>
                </div>

                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => cycleStatus(task)}
                  title="Cycle to next status"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                >
                  <span>Advance</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
