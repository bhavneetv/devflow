import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { healthRouter } from './routes/health.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { projectsRouter } from './routes/projects.routes.js';
import { tasksRouter } from './routes/tasks.routes.js';
import { seedRouter } from './routes/seed.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { teamsRouter } from './routes/teams.routes.js';
import { organizationsRouter } from './routes/organizations.routes.js';
import { favoritesRouter } from './routes/favorites.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { projectModulesRouter } from './routes/projectModules.routes.js';
import { initSocketIO } from './lib/socket.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const rawCorsOrigin = process.env.CORS_ORIGIN || '';
const configuredOrigins = rawCorsOrigin
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
];

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Render healthchecks)
      if (!origin) return callback(null, true);

      // Match configured origins, defaults, or any Vercel preview/production domain
      if (
        configuredOrigins.includes(origin) ||
        defaultOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.netlify.app') ||
        origin.includes('localhost') ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }

      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json());

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// Routes
app.use('/api/auth', authRouter);
app.use('/api/health', healthRouter);
app.use('/api/users', usersRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/projects', projectModulesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/seed', seedRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/organizations', organizationsRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/notifications', notificationsRouter);

// Root route
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'DevFlow API',
    status: 'online',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    error: err?.message || 'Internal server error',
  });
});

const server = http.createServer(app);
initSocketIO(server, defaultOrigins);

server.listen(PORT, () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
});
