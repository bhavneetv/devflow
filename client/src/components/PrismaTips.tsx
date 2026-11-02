import React from 'react';
import { Terminal, Database, Code, Check, Copy } from 'lucide-react';

export const PrismaTips: React.FC = () => {
  const [copied, setCopied] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Stack Architecture & Commands</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          How React, TypeScript, Node.js, MySQL (XAMPP), and Prisma work together
        </p>
      </div>

      <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#818cf8', fontWeight: 700 }}>
            <Database size={18} />
            <span>XAMPP MySQL Configuration</span>
          </div>
          <p className="card-desc">
            Your MySQL runs via XAMPP on port 3306. Prisma connects through the connection string configured in{' '}
            <code style={{ color: '#a5b4fc' }}>server/.env</code>:
          </p>
          <div className="code-block" style={{ position: 'relative' }}>
            <div className="code-title">
              <span>server/.env</span>
              <button
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                onClick={() =>
                  copyToClipboard('DATABASE_URL="mysql://root:@localhost:3306/devflow_db"', 'env')
                }
              >
                {copied === 'env' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                <span>{copied === 'env' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            DATABASE_URL="mysql://root:@localhost:3306/devflow_db"
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Note: If you have set a MySQL root password in XAMPP, change{' '}
            <code>root:</code> to <code>root:your_password</code>.
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#06b6d4', fontWeight: 700 }}>
            <Terminal size={18} />
            <span>Essential Prisma Commands</span>
          </div>
          <p className="card-desc">Run these from the project root:</p>
          <div className="code-block">
            <div style={{ color: '#94a3b8', marginBottom: '0.25rem' }}># Open Prisma Visual Studio GUI in browser:</div>
            <div style={{ color: '#22d3ee', fontWeight: 600 }}>npm run prisma:studio</div>
            
            <div style={{ color: '#94a3b8', marginTop: '0.6rem', marginBottom: '0.25rem' }}># Push schema changes to MySQL:</div>
            <div style={{ color: '#22d3ee', fontWeight: 600 }}>npm run prisma:migrate</div>
            
            <div style={{ color: '#94a3b8', marginTop: '0.6rem', marginBottom: '0.25rem' }}># Regenerate TypeScript Prisma Client:</div>
            <div style={{ color: '#22d3ee', fontWeight: 600 }}>npm run prisma:generate</div>

            <div style={{ color: '#94a3b8', marginTop: '0.6rem', marginBottom: '0.25rem' }}># Populate demo users & tasks:</div>
            <div style={{ color: '#22d3ee', fontWeight: 600 }}>npm run db:seed</div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontWeight: 700 }}>
            <Code size={18} />
            <span>Fullstack Architecture</span>
          </div>
          <p className="card-desc">
            Organized as a clean TypeScript monorepo with workspace synchronization:
          </p>
          <div className="code-block" style={{ fontSize: '0.78rem' }}>
            devflow/
            <br />
            ├── 📂 client/         # React + Vite + TypeScript
            <br />
            │   ├── src/App.tsx
            <br />
            │   ├── src/api.ts
            <br />
            │   └── vite.config.ts # Proxies /api to Express
            <br />
            ├── 📂 server/         # Node.js + Express + TypeScript
            <br />
            │   ├── src/index.ts
            <br />
            │   ├── src/routes/    # Typed REST routes
            <br />
            │   └── prisma/
            <br />
            │       └── schema.prisma # MySQL Prisma schema
            <br />
            └── package.json       # Monorepo root dev scripts
          </div>
        </div>
      </div>
    </div>
  );
};
