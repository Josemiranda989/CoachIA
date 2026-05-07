-- Drop BodyWeight.scaleId column.
-- Reason: openScale-sync always sends id=0 (per the comment in the previous
-- migration 20260506_swap_bodyweight_unique.sql), so this column never carried
-- meaningful information. The unique constraint was already swapped to
-- (userId, date) for proper idempotency. Nothing else in the codebase reads
-- scaleId — confirmed via grep over src/.
--
-- SQLite >= 3.35 supports ALTER TABLE ... DROP COLUMN directly.

PRAGMA foreign_keys=OFF;

ALTER TABLE "BodyWeight" DROP COLUMN "scaleId";

PRAGMA foreign_keys=ON;
