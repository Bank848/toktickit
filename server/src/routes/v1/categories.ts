import { Router } from 'express';
import { prisma } from '../../prisma';

export const categoriesV1Router = Router();

categoriesV1Router.get('/', async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
      select: { id: true, name: true },
    });
    res.status(200).json(categories);
  } catch (error) {
    next(error);
  }
});
