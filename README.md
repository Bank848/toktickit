# TokTickIT — Lab 1: Full-Stack Hello World Starter

Project foundation for a vertical slice proving React (Vite + Bootstrap) → Express (TypeScript) →
Prisma → PostgreSQL work together as one system. This PR scaffolds the client and server; the
health check, category seed, and category list are built out in the follow-up feature PRs.

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

3. Create the database and run the migration:

   ```
   psql -h localhost -p 5433 -U postgres -d postgres -c "CREATE DATABASE toktickit;"
   npx prisma migrate dev
   ```

   Seeding (`npx prisma db seed`) is added in the category seed PR, once a seed script exists.

## Run the app

```
# terminal 1
cd server && npm run dev      # http://localhost:4000

# terminal 2
cd client && npm run dev      # http://localhost:5173
```

Open http://localhost:5173 to see the app shell.

## Run the tests

```
cd server && npm run test
cd client && npm run test
```

## Project structure

See `docs/lab-01/` for the AI usage log, test documentation, and peer review evidence.
