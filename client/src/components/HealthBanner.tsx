import React from 'react';
import { Database, Server, Cpu } from 'lucide-react';
import { SystemHealth } from '../types';

interface HealthBannerProps {
  health: SystemHealth | null;
  projectsCount: number;
  tasksCount: number;
  usersCount: number;
}

export const HealthBanner: React.FC<HealthBannerProps> = ({
  health,
  projectsCount,
  tasksCount,
  usersCount,
}) => {
  const isDbOk = health?.database.status === 'connected';

  return (
    <div className="system-banner">
      <div className="stat-item">
        <span className="stat-label">Backend Engine</span>
        <div className="stat-value">
          <Server size={18} color="#6366f1" />
          <span>Node.js + Express</span>
        </div>
        <span className="stat-sub">Port 5000 • TypeScript</span>
      </div>

      <div className="stat-item">
        <span className="stat-label">Database Connection</span>
        <div className="stat-value">
          <Database size={18} color={isDbOk ? '#10b981' : '#f43f5e'} />
          <span>{health?.database.type || 'MySQL'} (XAMPP)</span>
        </div>
        <span className="stat-sub">
          {isDbOk ? (
            <span style={{ color: '#34d399' }}>● Active on localhost:3306</span>
          ) : (
            <span style={{ color: '#fb7185' }}>✕ Disconnected (Check XAMPP)</span>
          )}
        </span>
      </div>

      <div className="stat-item">
        <span className="stat-label">ORM Layer</span>
        <div className="stat-value">
          <Cpu size={18} color="#06b6d4" />
          <span>Prisma ORM</span>
        </div>
        <span className="stat-sub">Type-safe schema & client</span>
      </div>

      <div className="stat-item">
        <span className="stat-label">Database Records</span>
        <div className="stat-value">
          <span>{projectsCount} Projects</span>
        </div>
        <span className="stat-sub">
          {tasksCount} tasks • {usersCount} team members
        </span>
      </div>
    </div>
  );
};
