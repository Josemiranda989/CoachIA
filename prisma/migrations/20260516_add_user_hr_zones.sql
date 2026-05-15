-- Add HR zone config to User so the .fit exporter can resolve "Z1"-"Z7"
-- labels into explicit bpm ranges (target_type=heart_rate + custom low/high).
-- lthr (Lactate Threshold HR) takes precedence when set; fcMax is the
-- fallback. Both nullable — rider opts in when they know their numbers.

ALTER TABLE "User" ADD COLUMN "fcMax" INTEGER;
ALTER TABLE "User" ADD COLUMN "lthr" INTEGER;
