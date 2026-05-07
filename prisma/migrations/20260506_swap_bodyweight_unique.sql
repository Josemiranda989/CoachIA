-- Swap BodyWeight unique constraint: drop (userId, scaleId), add (userId, date).
-- Reason: openScale-sync always sends id=0 for the latest measurement, which
-- broke (userId, scaleId) dedup after the first record. (userId, date) gives
-- real idempotency by measurement timestamp.

PRAGMA foreign_keys=OFF;

DROP INDEX IF EXISTS "BodyWeight_userId_scaleId_key";

CREATE UNIQUE INDEX "BodyWeight_userId_date_key" ON "BodyWeight"("userId", "date");

PRAGMA foreign_keys=ON;
