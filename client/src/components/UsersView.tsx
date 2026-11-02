import React, { useState } from 'react';
import { Plus, Users, Mail, CheckCircle, FolderKanban } from 'lucide-react';
import { Role, User } from '../types';

interface UsersViewProps {
  users: User[];
  onCreateUser: (data: { name: string; email: string; role: Role }) => Promise<void>;
}

export const UsersView: React.FC<UsersViewProps> = ({ users, onCreateUser }) => {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('MEMBER');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    try {
      await onCreateUser({ name, email, role });
      setName('');
      setEmail('');
      setShowForm(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadge = (r: Role) => {
    switch (r) {
      case 'ADMIN':
        return <span className="badge badge-urgent">Admin</span>;
      case 'MEMBER':
        return <span className="badge badge-in_progress">Member</span>;
      case 'VIEWER':
        return <span className="badge badge-todo">Viewer</span>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Team Members</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            User table with unique email constraint & role enum in MySQL
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={16} />
          <span>{showForm ? 'Cancel' : 'Add Member'}</span>
        </button>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleSubmit}>
          <div className="form-title">
            <Users size={18} color="#6366f1" />
            <span>Add Team Member</span>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Email Address *</label>
              <input
                type="email"
                className="form-control"
                placeholder="john@devflow.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select
                className="form-control"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
                <option value="VIEWER">Viewer</option>
              </select>
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
              {submitting ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      )}

      <div className="cards-grid">
        {users.map((user) => (
          <div key={user.id} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}
                >
                  {user.name.charAt(0)}
                </div>
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 className="card-title">{user.name}</h3>
                  {getRoleBadge(user.role)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                  <Mail size={12} />
                  <span>{user.email}</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <FolderKanban size={14} color="#6366f1" />
                <span>{user._count?.projects || 0} Owned Projects</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <CheckCircle size={14} color="#10b981" />
                <span>{user._count?.assignedTasks || 0} Assigned Tasks</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
