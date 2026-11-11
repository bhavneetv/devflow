import { Request } from 'express';

/**
 * Extracts the userId from the Authorization header token.
 * Token format: devflow_session_{userId}_{timestamp} or devflow_oauth_{provider}_{userId}_{timestamp}
 */
export function getUserIdFromToken(req: Request): number | null {
  const auth =
    req.headers.authorization ||
    (typeof req.query.token === 'string' ? req.query.token : '');
  if (!auth) return null;
  // Strip "Bearer " prefix if present
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  const parts = token.split('_');
  // Find the first purely numeric part (the userId)
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const id = parseInt(part, 10);
      if (!isNaN(id)) return id;
    }
  }
  return null;
}
