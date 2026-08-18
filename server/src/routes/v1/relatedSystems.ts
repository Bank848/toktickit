import { Router } from 'express';
import { prisma } from '../../prisma';
import { resolveCurrentUser } from '../../auth/currentUser';

export const relatedSystemsRouter = Router();

relatedSystemsRouter.get('/', resolveCurrentUser, async (_req, res) => {
  const systems = await prisma.relatedSystem.findMany({
    where: { isActive: true },
    orderBy: { id: 'asc' },
    select: { id: true, code: true, name: true },
  });
  res.status(200).json(systems);
});
