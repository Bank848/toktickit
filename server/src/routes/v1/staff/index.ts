import { Router } from 'express';
import { requireRole } from '../../../middleware/requireRole';
import { staffTicketsRouter } from './tickets';
import { assignableOwnersRouter } from './assignableOwners';

export const staffRouter = Router();

// Every /staff/* route requires IT_STAFF or ADMINISTRATOR (api-spec.md section 1.2; Lab 4 widened the Lab 3
// IT_STAFF-only gate). Mounted once here so no future sub-route can forget it; a REQUESTER gets 403.
staffRouter.use(requireRole('IT_STAFF', 'ADMINISTRATOR'));

staffRouter.use('/tickets', staffTicketsRouter);
staffRouter.use('/assignable-owners', assignableOwnersRouter);
