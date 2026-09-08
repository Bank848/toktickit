# TokTickIT — Lab 1: Full-Stack Hello World Starter

A vertical slice proving React (Vite + Bootstrap) → Express (TypeScript) → Prisma → PostgreSQL
work together as one system. Opening the app shows a [Check System] button; clicking it calls
the backend health check and loads the four seeded IT request categories from PostgreSQL.

## Prerequisites

- Node.js 22+
- PostgreSQL 16 running locally, reachable at localhost:5433
- A `toktickit` database created (see server setup below)

## Setup

1. Clone the repo and install dependencies:

   ```
   cd client && npm install
   cd ../server && npm install
   ```

2. Configure the backend database connection:

   ```
   cd server
   cp .env.example .env
   # edit .env with your real PostgreSQL username/password
   ```

3. Create the database, run the migration, and seed it:

   ```
   psql -h localhost -p 5433 -U postgres -d postgres -c "CREATE DATABASE toktickit;"
   npx prisma migrate dev
   npx prisma db seed
   ```

## Run the app

```
# terminal 1
cd server && npm run dev      # http://localhost:4000

# terminal 2
cd client && npm run dev      # http://localhost:5173
```

Open http://localhost:5173 and click **Check System**.

## Run the tests

```
cd server && npm run test
cd client && npm run test
```

## Seeded accounts (local development only)

`npx prisma db seed` creates every account below with the password `DevPass123!` (bcrypt-hashed,
never stored or transmitted in plaintext). These are local-dev fixtures, not real credentials.

| Email | Role | Active | Must change password at next login |
|---|---|---|---|
| requester@toktickit.local | Requester | yes | no |
| requester2@toktickit.local .. requester4@toktickit.local | Requester | yes | no |
| requester5-inactive@toktickit.local | Requester | no | no |
| itstaff@toktickit.local, itstaff2@toktickit.local, itstaff3@toktickit.local | IT Staff | yes | no |
| itstaff4-inactive@toktickit.local | IT Staff | no | no |
| admin@toktickit.local | Administrator | yes | no |
| onboarding@toktickit.local | IT Staff | yes | **yes** |

Log in as `onboarding@toktickit.local` to exercise the mandatory first-login password change flow.

## Project structure

See `docs/lab-01/` for the AI usage log, test documentation, and peer review evidence.
