-- Add optional cadence target to CyclingBlock.
-- Powers cadence-based prescriptions (big gear, spin-ups) now that the athlete
-- paired a cadence sensor to the iGPSport BSC300T, so Strava captures rpm.

ALTER TABLE "CyclingBlock" ADD COLUMN "targetCadence" TEXT;
