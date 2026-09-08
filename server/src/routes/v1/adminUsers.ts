import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import { validateListUsersQuery } from '../../validators/listUsersQuery';
import { HttpError, ValidationHttpError } from '../../middleware/errorEnvelope';
import { toUserAdminDto } from '../../dto/userAdminDto';
import { validateCreateUserRequest } from '../../validators/createUserRequest';
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
