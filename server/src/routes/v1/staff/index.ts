import { Router } from 'express';
import { requireRole } from '../../../middleware/requireRole';
import { staffTicketsRouter } from './tickets';
import { assignableOwnersRouter } from './assignableOwners';

export const staffRouter = Router();

// Every /staff/* route requires IT_STAFF -- mounted once here (A-06/A-07: Administrator gets
// no ticket-route access at all in Lab 3, and this is the single gate for the whole namespace
// so no future sub-route can forget it).
staffRouter.use(requireRole('IT_STAFF'));

staffRouter.use('/tickets', staffTicketsRouter);
staffRouter.use('/assignable-owners', assignableOwnersRouter);
