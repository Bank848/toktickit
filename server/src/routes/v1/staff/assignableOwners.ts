import { Router } from 'express';
import { prisma } from '../../../prisma';

export const assignableOwnersRouter = Router();

assignableOwnersRouter.get('/', async (_req, res, next) => {
  try {
    const owners = await prisma.user.findMany({
      where: { isActive: true, role: { in: ['IT_STAFF', 'ADMINISTRATOR'] } },
      orderBy: { displayName: 'asc' },
      select: { id: true, displayName: true, role: true },
    });
    res.status(200).json(owners);
  } catch (error) {
    next(error);
  }
});
