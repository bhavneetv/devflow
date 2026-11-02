import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  let dbStatus = 'disconnected';
  let dbLatencyMs: number | null = null;
  let dbError: string | null = null;

  const start = Date.now();
  try {
    // Run simple query to verify database connection
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
    dbLatencyMs = Date.now() - start;
  } catch (error: any) {
    dbStatus = 'error';
    dbError = error?.message || 'Failed to connect to MySQL';
  }

  res.status(dbStatus === 'connected' ? 200 : 503).json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: {
      type: 'MySQL',
      status: dbStatus,
      latencyMs: dbLatencyMs,
      error: dbError,
    },
  });
});
