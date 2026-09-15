import { Request, Response, NextFunction } from 'express';
import { HttpError } from './errorEnvelope';

// FR-05: reachable even while mustChangePassword is true. Paths are relative to v1Router's
// own mount point (e.g. a request to /api/v1/me arrives here as req.path === '/me').
const EXEMPT_PATHS = new Set(['/auth/logout', '/auth/change-password', '/me']);

export function assertPasswordCurrent(req: Request, _res: Response, next: NextFunction) {
  if (EXEMPT_PATHS.has(req.path)) {
    next();
    return;
  }
  if (req.user?.mustChangePassword) {
    next(new HttpError(403, 'PASSWORD_CHANGE_REQUIRED', 'You must change your password before continuing'));
    return;
  }
  next();
}
