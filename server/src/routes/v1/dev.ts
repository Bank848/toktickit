import { Router } from 'express';
import { prisma } from '../../prisma';
import { HttpError, ValidationHttpError } from '../../middleware/errorEnvelope';

export const devRouter = Router();

devRouter.get('/requesters', async (_req, res, next) => {
  try {
    const requesters = await prisma.user.findMany({
      where: { role: 'REQUESTER', isActive: true },
      orderBy: { displayName: 'asc' },
    });
    res.status(200).json(
      requesters.map((user) => ({ id: user.id, email: user.email, displayName: user.displayName }))
    );
  } catch (error) {
    next(error);
  }
});

devRouter.post('/session', async (req, res, next) => {
  try {
    const { userId } = req.body ?? {};
    if (typeof userId !== 'string' || userId.trim().length === 0) {
      throw new ValidationHttpError([{ field: 'userId', message: 'userId is required' }]);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || user.role !== 'REQUESTER') {
      throw new HttpError(404, 'REQUESTER_NOT_FOUND', 'No active Requester matches that id');
    }

    res.status(200).json({ id: user.id, email: user.email, displayName: user.displayName });
  } catch (error) {
    next(error);
  }
});
