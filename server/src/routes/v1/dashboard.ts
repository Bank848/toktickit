import { Router } from 'express';
import { getRequesterDashboard } from '../../services/dashboardMetrics';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (req, res, next) => {
  try {
    // BR-12: requesterId is never taken from the query -- always the authenticated caller.
    const result = await getRequesterDashboard(req.user!.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
