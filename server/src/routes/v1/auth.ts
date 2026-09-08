import { Router } from 'express';
import { prisma } from '../../prisma';
import { HttpError, ValidationHttpError } from '../../middleware/errorEnvelope';
import { verifyPassword } from '../../auth/password';
import { createSession, TTK_SESSION_COOKIE, SESSION_COOKIE_OPTIONS, revokeSessionByToken } from '../../auth/session';

// Mounted at /auth/login, ahead of resolveCurrentUser — the one endpoint reachable with no
// session yet (api-spec.md §3).
export const authLoginRouter = Router();

authLoginRouter.post('/', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    const fieldErrors = [];
    if (typeof email !== 'string' || email.trim().length === 0) {
      fieldErrors.push({ field: 'email', message: 'Email is required' });
    }
    if (typeof password !== 'string' || password.length === 0) {
      fieldErrors.push({ field: 'password', message: 'Password is required' });
    }
    if (fieldErrors.length > 0) {
      throw new ValidationHttpError(fieldErrors);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // BR-06: unknown email and wrong password both yield the identical 401, checked together
    // so neither branch can be distinguished by the caller.
    const passwordMatches = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !passwordMatches) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // BR-07: deactivation check runs only after password verification succeeds.
    if (!user.isActive) {
      throw new HttpError(403, 'ACCOUNT_DEACTIVATED', 'This account has been deactivated');
    }

    const { token, expiresAt } = await createSession(user.id);
    res.cookie(TTK_SESSION_COOKIE, token, { ...SESSION_COOKIE_OPTIONS, expires: expiresAt });

    res.status(200).json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });
  } catch (error) {
    next(error);
  }
});

// Mounted at /auth, after resolveCurrentUser — every route here requires a valid session.
export const authRouter = Router();

authRouter.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.[TTK_SESSION_COOKIE];
    if (typeof token === 'string' && token.length > 0) {
      await revokeSessionByToken(token);
    }
    res.clearCookie(TTK_SESSION_COOKIE, { path: '/' });
    res.status(200).json({});
  } catch (error) {
    next(error);
  }
});
