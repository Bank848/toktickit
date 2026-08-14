import { Router } from 'express';
import { prisma } from '../prisma';

export const categoriesRouter = Router();

categoriesRouter.get('/', async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, name: true },
    });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Unable to load categories' });
  }
});
