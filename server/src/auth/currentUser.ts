import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { HttpError } from '../middleware/errorEnvelope';

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: CurrentUser;
    }
  }
}

function devIdentityAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_IDENTITY === 'true';
}

export async function resolveCurrentUser(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!devIdentityAllowed()) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'No identity source is configured');
    }

    const userId = req.header('x-dev-user-id');
    if (!userId) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'No identity source is configured');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || user.role !== 'REQUESTER') {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Identity could not be resolved');
    }

    req.user = { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Lab 2 has no production identity provider yet (Lab 3 adds real sessions). Call this once at
 * boot; it throws (and should crash startup) if NODE_ENV=production without an explicit,
 * intentional override.
 */
export function assertIdentitySeamBootGuard(): void {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_IDENTITY !== 'true') {
    throw new Error(
      'Lab 2 has no production identity provider yet (Lab 3 adds real sessions). ' +
        'Refusing to start with NODE_ENV=production unless ALLOW_DEV_IDENTITY=true is set explicitly.'
    );
  }
}
