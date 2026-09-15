import { Request, Response, NextFunction } from 'express';
import { HttpError } from './errorEnvelope';
import { CurrentUser } from '../auth/currentUser';

export function requireRole(...roles: Array<CurrentUser['role']>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new HttpError(403, 'FORBIDDEN_ROLE', `This action requires role: ${roles.join(' or ')}`));
      return;
    }
    next();
  };
}
