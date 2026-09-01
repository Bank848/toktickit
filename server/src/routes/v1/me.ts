import { Router } from 'express';

export const meRouter = Router();

meRouter.get('/', (req, res) => {
  const user = req.user!;
  res.status(200).json({ id: user.id, email: user.email, displayName: user.displayName });
});
