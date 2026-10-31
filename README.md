# TokTickIT

TokTickIT is an internal IT help desk ticketing web app. A Requester files IT tickets and follows
them, an IT Staff member works the queue, comments, records Actions Taken, and moves tickets through
their statuses, and an Administrator manages users. A ticket cannot be set to Resolved until IT Staff
has recorded at least one Action Taken. The app was built across four labs (CPE334), and this README
describes the finished Lab 4 state.

## Tech stack

- Client: React 19, TypeScript, Vite, Bootstrap 5 (Zen Green theme in `client/src/theme.css`)
- Server: Node.js, Express, TypeScript, Prisma, bcrypt, cookie-based sessions
- Database: PostgreSQL
- Tests: Vitest (client and server), Testing Library, axe-core, Playwright (E2E)

## Prerequisites

- Node.js 22 or newer
- PostgreSQL running locally. The examples use `localhost:5433`; change the URL if yours differs.
- For E2E only: a Playwright browser (`npx playwright install` from the repo root)

## Install

```
npm install                # repo root: Playwright and E2E helpers
cd client && npm install
cd ../server && npm install
```

## Database setup

```
psql -h localhost -p 5433 -U postgres -d postgres -c "CREATE DATABASE toktickit;"
cd server
cp .env.example .env       # then edit DATABASE_URL with your PostgreSQL user and password
npx prisma migrate dev     # applies all migrations (npm run prisma:migrate does the same)
npx prisma db seed         # npm run prisma:seed does the same; safe to run again (upserts)
```

The seed also creates demo tickets (`TKT-2025-00001` and later) with zero, one, and several Actions
Taken, including one with a follow-up.

### Seed accounts (local development only)

Every seeded account uses the password `DevPass123!`. These are local fixtures, not real credentials.

| Email | Role | Notes |
|---|---|---|
| requester@toktickit.local, requester2..4@toktickit.local | Requester | active |
| requester5-inactive@toktickit.local | Requester | inactive |
| itstaff@toktickit.local, itstaff2@toktickit.local, itstaff3@toktickit.local | IT Staff | active |
| itstaff4-inactive@toktickit.local | IT Staff | inactive |
| admin@toktickit.local | Administrator | active |
| onboarding@toktickit.local | IT Staff | must change password at first login |

## Run the app

```
cd server && npm run dev      # http://localhost:4000
cd client && npm run dev      # http://localhost:5173 (second terminal)
```

## Tests

Client (Vitest, no database needed):

```
cd client && npx tsc -b && npm test
```

Server (Vitest) needs a separate, disposable database. Create `server/.env.test` (gitignored) with the
same shape as `.env.example` but pointing at a `toktickit_test` database. The test setup resets that
database, so never point it at `toktickit`.

```
cd server && npm test
```

E2E (Playwright, desktop, tablet and mobile projects) needs a dedicated `toktickit_e2e` database and
an installed browser. The E2E prepare step resets and seeds that database and refuses any other name.

```
cp server/.env.e2e.example server/.env.e2e      # edit the user and password
cp client/.env.e2e.example client/.env.e2e
npm run test:e2e                                # from the repo root
```

The Playwright config starts the server on port 4001 and the client on port 5183 itself.

## Lab 4 demo walkthrough

1. Log in as `requester@toktickit.local`. You land on the Requester Dashboard (`/dashboard`) with
   open, waiting, resolved, and closed counts. Open a ticket from My Tickets: the Actions Taken list
   is read-only.
2. Log out and log in as `itstaff@toktickit.local`. You land on the IT Staff Dashboard
   (`/staff/dashboard`). Click a metric card to open the Ticket Queue filtered by that metric.
3. Open `TKT-2025-00003` or `TKT-2025-00004` in the queue. Under Actions Taken, record a new action,
   edit one, and tick Follow-Up Required to see the required note and the "Follow-Up Required" badge.
4. Resolution gate: open `TKT-2025-00002` (no Actions Taken) and try to set the status to Resolved.
   The app shows a message asking you to record an Action Taken first. Record one, then retry.
5. Log in as `admin@toktickit.local`. The staff dashboard shows an extra user-count-by-role card, and
   `/admin/users` manages accounts.

## Repository layout

```
client/      React app (src/pages, src/components, src/api) and Vitest tests (tests/lab-01..04)
server/      Express API (src/routes, src/services), Prisma schema, migrations and seed, tests
e2e/         Playwright specs (lab-02..04) and shared helpers
scripts/     E2E database prepare script and evidence helper
docs/        Lab documents
artifacts/   Screenshots and evidence per lab
```

## Lab documents

- [Lab 1](docs/lab-01/): AI use log, test notes, reviewer evidence
- [Lab 2](docs/lab-02/): specification, API spec, data model, UI spec, tests
- [Lab 3](docs/lab-03/): specification, API spec, UI spec, tests
- [Lab 4](docs/lab-04/): specification, API spec, UI spec, tests
