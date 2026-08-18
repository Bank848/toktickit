import { Router } from 'express';
import { prisma } from '../../prisma';
import { resolveCurrentUser } from '../../auth/currentUser';

export const categoriesV1Router = Router();

categoriesV1Router.get('/', resolveCurrentUser, async (_req, res) => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { id: 'asc' },
    select: { id: true, name: true },
  });
  res.status(200).json(categories);
});
