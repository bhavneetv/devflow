import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { projectsRouter } from './routes/projects.routes.js';
import { tasksRouter } from './routes/tasks.routes.js';
import { seedRouter } from './routes/seed.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Middleware
app.use(
  cors({
    origin: [CORS_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:5173'],
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
app.use('/api/health', healthRouter);
app.use('/api/users', usersRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/seed', seedRouter);

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

app.listen(PORT, () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
});
