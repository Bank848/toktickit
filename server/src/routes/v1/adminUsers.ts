import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import { validateListUsersQuery } from '../../validators/listUsersQuery';
import { ValidationHttpError } from '../../middleware/errorEnvelope';
import { toUserAdminDto } from '../../dto/userAdminDto';

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
