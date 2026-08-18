# Requirements -> Feature -> Issue -> Test Traceability (Lab 2, W3 scope)

| Requirement | Feature | Issue | Test(s) |
|---|---|---|---|
| FR-008...FR-013, FR-008b | Feature-B | 8 | server/tests/lab-02/ticketCreation.test.ts |
| BR-001, BR-002, BR-009 | Feature-B | 8 | server/tests/lab-02/ticketCreation.test.ts |
| BR-014, BR-015 (ticket number uniqueness) | Feature-B | 8 | server/tests/lab-02/ticketNumber.test.ts |
| D-13 (Requester status authority) | SDS/SRS | 5 | docs/lab-02/decision-register-addendum.md review |
| D-16 (RelatedSystem reference data) | Feature-B, Feature-M | 7, 8 | server/tests/lab-02/migration.test.ts, relatedSystems.test.ts |
| D-18 (identity seam) | API foundation | 6 | server/tests/lab-02/currentUser.test.ts |
| D-20a (/api/v1 + Lab 1 aliases) | API foundation | 6 | server/tests/lab-01/*.test.ts (regression) |

Full matrix (FR-014...FR-031 for W4 features C-F) is deferred to Issue 9-17 planning, which
waits for the real Lab 2 labsheet per the source plan's issue-creation staging note.
