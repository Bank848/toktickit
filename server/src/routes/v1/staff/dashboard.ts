import { Router } from 'express';
import { getStaffDashboard } from '../../../services/dashboardMetrics';

export const staffDashboardRouter = Router();

staffDashboardRouter.get('/', async (req, res, next) => {
  try {
    const includeUserCounts = req.user!.role === 'ADMINISTRATOR';
    const result = await getStaffDashboard(req.user!.id, includeUserCounts);
    const body: Record<string, unknown> = {
      unassignedCount: result.unassignedCount, ownedByMeCount: result.ownedByMeCount,
      statusCounts: result.statusCounts, priorityCounts: result.priorityCounts, recentTickets: result.recentTickets,
    };
    // FR-09/AC-11: the field is entirely absent for an IT Staff caller, not present-and-null --
    // matches the test's toBeUndefined() expectation and avoids implying to client code that
    // the field always exists.
    if (result.userCounts) body.userCounts = result.userCounts;
    res.status(200).json(body);
  } catch (error) {
    next(error);
  }
});
