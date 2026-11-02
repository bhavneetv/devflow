import React from 'react';
import { Database, RefreshCw, Sparkles, Layers } from 'lucide-react';
import { SystemHealth } from '../types';

interface NavbarProps {
  health: SystemHealth | null;
  loading: boolean;
  onRefresh: () => void;
  onSeed: () => void;
  seeding: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  health,
  loading,
  onRefresh,
  onSeed,
  seeding,
}) => {
  const isConnected = health?.database.status === 'connected';

  return (
    <header className="navbar">
      <div className="brand">
        <div className="brand-icon">
          <Layers size={22} />
        </div>
        <div>
          <span className="brand-title">DevFlow</span>
        </div>
        <span className="brand-tag">MySQL + Prisma</span>
      </div>

      <div className="nav-actions">
        {health && (
          <div className={`status-pill ${isConnected ? 'connected' : 'error'}`}>
            <span className="status-dot"></span>
            <Database size={14} />
            <span>
              {isConnected ? `MySQL Connected (${health.database.latencyMs}ms)` : 'DB Disconnected'}
            </span>
          </div>
        )}

        <button
          className="btn btn-secondary btn-sm"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh data from server"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>

        <button
          className="btn btn-primary btn-sm"
          onClick={onSeed}
          disabled={seeding}
          title="Seed demo data to MySQL via Prisma"
        >
          <Sparkles size={14} />
          <span>{seeding ? 'Seeding...' : 'Quick Seed DB'}</span>
        </button>
      </div>
    </header>
  );
};
