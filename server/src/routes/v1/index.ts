import { Router } from 'express';
import { meRouter } from './me';

export const v1Router = Router();

v1Router.use('/me', meRouter);
