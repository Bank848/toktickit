import { Router } from 'express';
import { resolveCurrentUser } from '../../auth/currentUser';
import { assertPasswordCurrent } from '../../middleware/assertPasswordCurrent';
import { authLoginRouter, authRouter } from './auth';
import { meRouter } from './me';
import { categoriesV1Router } from './categories';
import { relatedSystemsRouter } from './relatedSystems';
import { ticketsRouter } from './tickets';
import { attachmentContentRouter } from './attachments';
import { staffRouter } from './staff';
import { adminUsersRouter } from './adminUsers';
import { requireRole } from '../../middleware/requireRole';

export const v1Router = Router();

v1Router.use('/auth/login', authLoginRouter);

v1Router.use(resolveCurrentUser);
v1Router.use(assertPasswordCurrent);

v1Router.use('/auth', authRouter);
v1Router.use('/me', meRouter);
v1Router.use('/categories', categoriesV1Router);
v1Router.use('/related-systems', relatedSystemsRouter);
v1Router.use('/tickets', ticketsRouter);
v1Router.use('/attachments', attachmentContentRouter);
v1Router.use('/staff', staffRouter);
v1Router.use('/admin/users', requireRole('ADMINISTRATOR'), adminUsersRouter);
