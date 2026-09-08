import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { HttpError } from '../middleware/errorEnvelope';
import { verifySessionToken, TTK_SESSION_COOKIE } from './session';

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
  mustChangePassword: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: CurrentUser;
    }
  }
}

export async function resolveCurrentUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[TTK_SESSION_COOKIE];
    if (typeof token !== 'string' || token.length === 0) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'No active session');
    }

    const session = await verifySessionToken(token);
    if (!session) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Session is invalid, expired, or revoked');
    }

    // BR-11: isActive is re-checked live on every request, never cached at login time.
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || !user.isActive) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Account is no longer active');
    }

    req.user = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
    next();
  } catch (error) {
    next(error);
  }
}
