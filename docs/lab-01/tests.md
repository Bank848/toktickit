# Lab 1 Test Documentation

| Test File (tests/lab-01/) | Tool | Test Description |
|---|---|---|
| API-01 — `server/tests/lab-01/health.test.ts` | Supertest | GET /api/health returns 200 with `{ status: "ok", service: "TokTickIT API" }` |
| API-02 — `server/tests/lab-01/categories.test.ts` | Supertest | GET /api/categories returns the four seeded categories |
| UI-01 — `client/tests/lab-01/App.test.tsx` | Vitest | TokTickIT heading renders |
| UI-02 — `client/tests/lab-01/checkSystem.test.tsx` | Vitest | Loading state changes to the category list on a successful Check System call |
| UI-03 — `client/tests/lab-01/checkSystem.test.tsx` | Vitest | API failure displays a useful error message ("Unable to connect to TokTickIT API") |

`server/tests/lab-01/app.test.ts` also runs as part of the server suite (basic Express app smoke test from the project-foundation PR review fix); it is not one of the five labsheet-required tests but passes alongside them.

## Passing Test Output

### Server (`cd server && npm run test`)

```
> toktickit-server@1.0.0 test
> vitest run

The CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.

 RUN  v2.1.9 D:/CPE334/LAB1/toktickit/server

 ✓ tests/lab-01/health.test.ts (1 test) 20ms
 ✓ tests/lab-01/app.test.ts (1 test) 21ms
 ✓ tests/lab-01/categories.test.ts (1 test) 75ms

 Test Files  3 passed (3)
      Tests  3 passed (3)
   Start at  15:21:37
   Duration  2.95s (transform 170ms, setup 0ms, collect 6.73s, tests 116ms, environment 1ms, prepare 928ms)
```

### Client (`cd client && npm run test`)

```
> client@0.0.0 test
> vitest run


 RUN  v4.1.10 D:/CPE334/LAB1/toktickit/client


 Test Files  2 passed (2)
      Tests  3 passed (3)
   Start at  15:22:10
   Duration  15.06s (transform 232ms, setup 4.87s, import 204ms, tests 716ms, environment 23.29s)
```

Database used for this run: local PostgreSQL at `localhost:5433`, database `toktickit`, seeded via `npx prisma db seed` and confirmed idempotent (running the seed twice produced the same four rows, no duplicates, no errors):

```
[
  { id: 1, name: 'Account and Access', createdAt: 2026-08-04T09:22:37.040Z },
  { id: 2, name: 'Hardware', createdAt: 2026-08-04T09:22:37.051Z },
  { id: 3, name: 'Software', createdAt: 2026-08-04T09:22:37.052Z },
  { id: 4, name: 'Network', createdAt: 2026-08-04T09:22:37.054Z }
]
```
