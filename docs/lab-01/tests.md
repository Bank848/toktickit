# Lab 1 Test Documentation

Lab 1 tests prove that the initial TokTickIT vertical slice (React/Vite/Bootstrap → Express → Prisma → PostgreSQL) works correctly.

| Test File (tests/lab-01/) | Tool | Test Description |
|---|---|---|
| API-01 — `health.test.ts` | Supertest | `GET /api/health` returns HTTP 200 with `{ status: "ok", service: "TokTickIT API" }` |
| API-02 — `categories.test.ts` | Supertest | `GET /api/categories` returns the four seeded categories (Account and Access, Hardware, Software, Network) |
| UI-01 — `App.test.tsx` | Vitest | The "TokTickIT" heading renders |
| UI-02 — `checkSystem.test.tsx` | Vitest | Clicking **Check System** shows a loading state, then the four-category list on success |
| UI-03 — `checkSystem.test.tsx` | Vitest | A failed API call shows a useful error message ("Unable to connect to TokTickIT API") and "System Status: Offline" |

`server/tests/lab-01/app.test.ts` is an extra foundation smoke test from Issue 1 (checks the Express app boots and responds), on top of the five required tests above.

## Passing Test Output

### Server (`cd server && npm run test`)

```
> toktickit-server@1.0.0 test
> vitest run

 RUN  v2.1.9 D:/CPE334/LAB1/toktickit/server

 ✓ tests/lab-01/health.test.ts (1 test) 21ms
 ✓ tests/lab-01/app.test.ts (1 test) 24ms
 ✓ tests/lab-01/categories.test.ts (1 test) 84ms

 Test Files  3 passed (3)
      Tests  3 passed (3)
   Start at  14:52:09
   Duration  2.63s
```

### Client (`cd client && npm run test`)

```
> client@0.0.0 test
> vitest run

 RUN  v4.1.10 D:/CPE334/LAB1/toktickit/client

 Test Files  2 passed (2)
      Tests  3 passed (3)
   Start at  14:52:35
   Duration  14.15s
```

All 5 required tests (API-01, API-02, UI-01, UI-02, UI-03) pass — 5/5 total, captured on `lab1-staging` after Issue 1-4 were merged in sequence.
