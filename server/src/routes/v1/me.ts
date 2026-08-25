import { Router } from 'express';
import { resolveCurrentUser } from '../../auth/currentUser';

export const meRouter = Router();

meRouter.get('/', resolveCurrentUser, (req, res) => {
  const user = req.user!;
  res.status(200).json({ id: user.id, email: user.email, displayName: user.displayName });
});
