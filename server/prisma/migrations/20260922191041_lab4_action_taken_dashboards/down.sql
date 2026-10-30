-- Deliberate rollback of the Lab 4 migration (specification.md 9.5.1).
-- Export new Action Taken records first: pg_dump --data-only --table="ActionTaken"
-- The two TicketEventType values added by the migration stay: PostgreSQL cannot drop an enum
-- value in place, and they are unused once the table is gone. Lab 1-3 rows are never touched.
BEGIN;

DROP TABLE "ActionTaken";
DROP TYPE "ActionResult";
DROP INDEX "Ticket_ownerId_status_idx";
DROP INDEX "Ticket_updatedAt_idx";

COMMIT;
