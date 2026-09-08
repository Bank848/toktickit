import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import { validateListUsersQuery } from '../../validators/listUsersQuery';
import { HttpError, ValidationHttpError } from '../../middleware/errorEnvelope';
import { toUserAdminDto } from '../../dto/userAdminDto';
import { validateCreateUserRequest } from '../../validators/createUserRequest';
import { validateUpdateUserRequest } from '../../validators/updateUserRequest';
import { hashPassword } from '../../auth/password';

export const adminUsersRouter = Router();

adminUsersRouter.get('/', async (req, res, next) => {
  try {
    const validated = validateListUsersQuery(req.query as Record<string, unknown>);
    if (!validated.ok) throw new ValidationHttpError(validated.errors);
    const { q, role } = validated.value;

    // No pagination in Lab 3 (specification.md exclusions) -- api-spec.md #27 returns a plain
    // array, not the {data, meta} envelope every other collection endpoint uses.
    const where: Prisma.UserWhereInput = {
      ...(role !== null ? { role } : {}),
      ...(q !== null
        ? {
            OR: [
              { displayName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const users = await prisma.user.findMany({ where, orderBy: { displayName: 'asc' } });
    res.status(200).json(users.map(toUserAdminDto));
  } catch (error) {
    next(error);
  }
});

adminUsersRouter.post('/', async (req, res, next) => {
  try {
    const validated = validateCreateUserRequest(req.body ?? {});
    if (!validated.ok) throw new ValidationHttpError(validated.errors);
    const { displayName, email, role, isActive, initialPassword } = validated.value;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new HttpError(409, 'EMAIL_ALREADY_EXISTS', 'This email is already in use');
    }

    const passwordHash = await hashPassword(initialPassword);

    // BR-25: mustChangePassword is always true on create -- there is no request field for it,
    // precisely so a client cannot opt out (validateCreateUserRequest already strips any
    // client-supplied mustChangePassword by never reading it from the body).
    const created = await prisma.user.create({
      data: { displayName, email, role, isActive, passwordHash, mustChangePassword: true },
    });

    res.status(201).json(toUserAdminDto(created));
  } catch (error) {
    next(error);
  }
});

// api-spec.md §3's #29 ordered-checks note: (1) email uniqueness, (2) self-deactivation,
// (3) last-Administrator protection -- in that order, so a caller sees the most specific
// applicable error first.
adminUsersRouter.patch('/:id', async (req, res, next) => {
  try {
    const validated = validateUpdateUserRequest(req.body ?? {});
    if (!validated.ok) throw new ValidationHttpError(validated.errors);
    const { displayName, email, role, isActive } = validated.value;

    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
    }

    if (email !== target.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== target.id) {
        throw new HttpError(409, 'EMAIL_ALREADY_EXISTS', 'This email is already in use');
      }
    }

    if (!isActive && target.id === req.user!.id) {
      throw new HttpError(409, 'SELF_DEACTIVATION_BLOCKED', 'You cannot deactivate your own account');
    }

    const updated = await prisma.$transaction(async (tx) => {
      // BR-28: counted inside the same transaction as the update, excluding the row being
      // edited's *current* state, to avoid a race between the count and the write.
      const wouldLoseAdmin =
        target.role === 'ADMINISTRATOR' && target.isActive && (role !== 'ADMINISTRATOR' || !isActive);
      if (wouldLoseAdmin) {
        const otherActiveAdmins = await tx.user.count({
          where: { role: 'ADMINISTRATOR', isActive: true, id: { not: target.id } },
        });
        if (otherActiveAdmins === 0) {
          throw new HttpError(409, 'LAST_ADMIN_PROTECTED', 'At least one active Administrator is required');
        }
      }

      return tx.user.update({ where: { id: target.id }, data: { displayName, email, role, isActive } });
    });

    res.status(200).json(toUserAdminDto(updated));
  } catch (error) {
    next(error);
  }
});
