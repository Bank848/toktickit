import { Router } from 'express';
import { resolveCurrentUser } from '../../auth/currentUser';
import { meRouter } from './me';
import { devRouter } from './dev';
import { categoriesV1Router } from './categories';
import { relatedSystemsRouter } from './relatedSystems';
import { ticketsRouter } from './tickets';

export const v1Router = Router();

// /dev/* is how a caller gets identity in the first place (D-18) — it must stay reachable with
// no identity yet, so it's mounted ahead of the blanket resolveCurrentUser below.
v1Router.use('/dev', devRouter);

// Every other /api/v1/* route requires identity. Mounted once here so a future route can never
// forget it (the risk with the old per-route `router.get('/', resolveCurrentUser, ...)` pattern).
v1Router.use(resolveCurrentUser);

v1Router.use('/me', meRouter);
v1Router.use('/categories', categoriesV1Router);
v1Router.use('/related-systems', relatedSystemsRouter);
v1Router.use('/tickets', ticketsRouter);
