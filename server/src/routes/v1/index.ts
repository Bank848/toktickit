import { Router } from 'express';
import { meRouter } from './me';
import { devRouter } from './dev';
import { categoriesV1Router } from './categories';
import { relatedSystemsRouter } from './relatedSystems';
import { ticketsRouter } from './tickets';

export const v1Router = Router();

v1Router.use('/me', meRouter);
v1Router.use('/dev', devRouter);
v1Router.use('/categories', categoriesV1Router);
v1Router.use('/related-systems', relatedSystemsRouter);
v1Router.use('/tickets', ticketsRouter);
