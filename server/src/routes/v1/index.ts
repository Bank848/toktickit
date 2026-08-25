import { Router } from 'express';
import { meRouter } from './me';
import { devRouter } from './dev';

export const v1Router = Router();

v1Router.use('/me', meRouter);
v1Router.use('/dev', devRouter);
