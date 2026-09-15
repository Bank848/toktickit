import { Router } from 'express';
import { prisma } from '../../prisma';
import { HttpError, ValidationHttpError } from '../../middleware/errorEnvelope';
import { hashPassword, verifyPassword } from '../../auth/password';
import { validatePasswordPolicy } from '../../auth/passwordPolicy';
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

authRouter.post('/change-password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body ?? {};

    if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
      throw new ValidationHttpError([
        { field: 'currentPassword', message: 'Current password is required' },
      ]);
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const currentMatches = await verifyPassword(currentPassword, user.passwordHash);
    if (!currentMatches) {
      throw new HttpError(422, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect', [
        { field: 'currentPassword', message: 'Current password is incorrect' },
      ]);
    }

    if (typeof newPassword !== 'string' || typeof confirmNewPassword !== 'string') {
      throw new ValidationHttpError([
        { field: 'newPassword', message: 'New password is required' },
      ]);
    }

    const fieldErrors = validatePasswordPolicy(newPassword, 'newPassword');
    if (newPassword !== confirmNewPassword) {
      fieldErrors.push({ field: 'confirmNewPassword', message: 'Passwords do not match' });
    }
    if (fieldErrors.length > 0) {
      throw new ValidationHttpError(fieldErrors);
    }

    // AC-09: mustChangePassword clears, the calling session stays valid (no forced re-login).
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
    });

    res.status(200).json({
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      role: updated.role,
      mustChangePassword: updated.mustChangePassword,
    });
  } catch (error) {
    next(error);
  }
});
