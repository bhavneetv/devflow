import React, { useState } from 'react';
import { Plus, FolderKanban, Trash2, CheckCircle2, User as UserIcon } from 'lucide-react';
import { Project, User } from '../types';

interface ProjectsViewProps {
  projects: Project[];
  users: User[];
  onCreateProject: (data: { title: string; description: string; ownerId: number }) => Promise<void>;
  onDeleteProject: (id: number) => Promise<void>;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  users,
  onCreateProject,
  onDeleteProject,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState<number>(users[0]?.id || 1);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onCreateProject({ title, description, ownerId });
      setTitle('');
      setDescription('');
      setShowForm(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return <span className="badge badge-in_progress">In Progress</span>;
      case 'COMPLETED':
        return <span className="badge badge-done">Completed</span>;
      case 'PLANNING':
        return <span className="badge badge-medium">Planning</span>;
      default:
        return <span className="badge badge-todo">{status}</span>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Projects</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Managed through Prisma relational models linked with MySQL
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={16} />
          <span>{showForm ? 'Cancel' : 'New Project'}</span>
        </button>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleSubmit}>
          <div className="form-title">
            <FolderKanban size={18} color="#6366f1" />
            <span>Create New Project</span>
          </div>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Project Title *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Payment Gateway Integration"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Project Owner *</label>
              <select
                className="form-control"
                value={ownerId}
                onChange={(e) => setOwnerId(Number(e.target.value))}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Brief scope and deliverables..."
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
              {submitting ? 'Creating...' : 'Save Project'}
            </button>
          </div>
        </form>
      )}

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <FolderKanban size={24} />
          </div>
          <h3>No Projects in Database</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: 400 }}>
            Click "Quick Seed DB" in the top bar to populate your MySQL database with sample projects and tasks!
          </p>
        </div>
      ) : (
        <div className="cards-grid">
          {projects.map((project) => (
            <div key={project.id} className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">{project.title}</h3>
                  <div style={{ marginTop: '0.35rem' }}>{getStatusBadge(project.status)}</div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.3rem', color: '#fda4af' }}
                  onClick={() => onDeleteProject(project.id)}
                  title="Delete Project"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {project.description && (
                <p className="card-desc">{project.description}</p>
              )}

              <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {project.owner?.avatarUrl ? (
                    <img src={project.owner.avatarUrl} alt={project.owner.name} className="avatar" />
                  ) : (
                    <div className="avatar">
                      <UserIcon size={14} />
                    </div>
                  )}
                  <div style={{ fontSize: '0.75rem' }}>
                    <div style={{ fontWeight: 600 }}>{project.owner?.name || 'Unassigned'}</div>
                    <div style={{ color: 'var(--text-dim)' }}>Owner</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CheckCircle2 size={14} color="#10b981" />
                  <span>{project._count?.tasks || project.tasks?.length || 0} tasks</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
