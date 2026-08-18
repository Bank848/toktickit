import { app } from './app';
import { assertIdentitySeamBootGuard } from './auth/currentUser';

assertIdentitySeamBootGuard();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`TokTickIT API listening on port ${PORT}`);
});
