# Handoff — Cadence sensor + HR zones integration

**Branch:** `claude/cadence-sensor-integration-jVPFK`
**Status:** code merged-ready, awaiting outside ride to confirm cadence target renders on BSC300T.

## Context

Athlete bought a cadence sensor for the bike (paired to the iGS BSC300T cyclocomputer). This kicked off two related changes:

1. **End-to-end cadence support** — IA prescribes cadence-driven sessions (big-gear, spin-ups, high-cadence recovery), the `.fit` exported to the BSC300T renders cadence as the device target.
2. **Actionable HR targets** — athlete has HR strap + cadence sensor but no power meter on the bike, so power-zone targets were rendering as unreachable watt ranges. Switched defaults to HR-zone targets with explicit bpm ranges resolved from user-configured FCmax / LTHR.

## Commits on this branch (in order)

| SHA | Subject |
|---|---|
| `54b5d8c` | feat(cycling): cadence ingest + zone-duration guardrails on routine prompts |
| `1d1bb8c` | feat(fit): emit cadence target steps to match iGPSPORT format |
| `a61c647` | feat(fit): default zone labels to HR target, not power |
| `573a807` | feat(hr): user HR zones + actionable bpm targets on device |

All four commits build cumulatively. Tests pass: `npm test` → 19 passing.

## What's in the branch

### 1. Cadence pipeline

- **Schema:** `CyclingBlock.targetCadence` (optional string, e.g. `"60-65 rpm"`, `"55-65 rpm big gear"`, `"100+ rpm spin-up"`). Migration `prisma/migrations/20260515_add_cycling_block_cadence.sql`.
- **Generators** (`src/app/api/routines/generate/route.ts`, `generate-monthly/route.ts`):
  - `gatherAthleteData()` reads `average_cadence` from Strava activities and appends "<N> rpm" to the recent-rides summary the prompt sees.
  - Prompt teaches three new session types: big-gear / fuerza-resistencia (Z3-Z4 @ 55-65 rpm), spin-ups (Z2 @ 100+ rpm), recovery (90+ rpm).
  - `routineResponseSchema` (single-week generator) gained `targetCadence` as an optional block field.
- **Persistence** (`src/app/api/routines/route.ts`, `generate-monthly/route.ts`): nested block create carries `targetCadence`.
- **UI** (`src/components/CyclingBlocks.tsx`): renders cadence inline → `"4x6min Z3 @ 55-65 rpm / 4min Z2 rec"`.
- **Strava ingestion** (`src/app/api/stats/cycling/route.ts`): maps `average_cadence` → `avgCadence` on each ride, summary avg across rides.
- **Metrics dashboard:**
  - `src/components/StravaActivities.tsx`: per-ride cadence row with `RotateCw` icon.
  - `src/app/metrics/CyclingCards.tsx`: "Cadencia Media" card (averaged across last 30 activities with sensor data).
- **Export routes** (`export-all-fit`, `export-cycling`): pass `targetCadence` through to downstream consumers.

### 2. Zone-duration guardrails (the "6min Z5 steady" bug)

The single-week generator's prompt was missing zone-vs-duration constraints, so Gemini could produce `{kind:"steady", duration:6, targetPower:"Z5"}` — physiologically impossible. Added to `src/app/api/routines/generate/route.ts`:

- Coggan zone definitions with rep-duration ranges (Z3 8-20min, Z4 4-15min, Z5 2-5min, Z6+ 30s-2min).
- Hard rule: `kind="steady"` only allowed in Z1-Z3. Z4 always `interval` ≥2 reps. Z5 always `interval` ≥3 reps.
- 4 worked examples in the prompt (recovery, VO2max, big-gear, long ride).

### 3. FIT exporter (`src/lib/fit-exporter.ts`)

Reverse-engineered iGPSPORT's own export format (sample uploaded by user, parsed manually) — confirmed:

```
Cadence target encoding:
  target_type           = 3 (CADENCE)
  target_value          = 0 (custom range, no zone reference)
  customTargetValueLow  = 60   (rpm as raw uint32, little-endian)
  customTargetValueHigh = 65
```

The exporter:

- `parseCadenceTarget(raw)` parses clean rpm ranges (`"60-65 rpm"`, `"55-65 rpm big gear"`). Returns `null` for qualitative cues so they fall back to power/HR.
- `resolveTarget()` — cadence wins when block has a parseable rpm range (iGPSPORT only allows one target type per step). Power label "Z1"-"Z7" otherwise.
- Fields `field5`/`field6` are dual-purpose in FIT: for `kind="interval"` repeat steps they hold `durationStep` + `repeatSteps`; for regular steps they hold `customTargetValueLow`/`High`.
- Recovery steps inside intervals don't accept their own cadence — always use the recovery's power label.
- **Default zone target switched from POWER (target_type=4) to HEART_RATE (target_type=1)** — the BSC300T resolves HR zones from rider's configured FCmax, whereas power zones need both an FTP and an actual power meter on the bike. Without the power meter, the device displays an unreachable watt range as the current value field stays blank.

### 4. HR zones (the FCmax UX)

- **Schema:** `User.fcMax` and `User.lthr` (both optional Int). Migration `prisma/migrations/20260516_add_user_hr_zones.sql`.
- **`src/lib/hr-zones.ts`** — resolves "Z1"-"Z7" → `{ low, high }` bpm:
  - LTHR set (preferred): Friel cycling zones (Z4 = 94-99% LTHR — the threshold range most coaches train against).
  - FCmax only: %FCmax 5-zone (Z1 50-60% ... Z5 90-100%). Z6 and Z7 collapse to high-HR since lagged HR can't track anaerobic/neuromuscular efforts.
  - Neither set: exporter emits zone reference (`target_value=N`) and the device's own HR zones render the range.
  - `hrZonesSummary(hr)` builds the one-line prompt-friendly summary.
- **`fit-exporter` integration:** `blocksToFitWorkout({ name, blocks, hrConfig })` accepts optional HR config; when present, emits explicit bpm range as custom target.
- **Export routes** pass `{ fcMax, lthr }` from the authenticated user to the exporter.
- **API** `PATCH /api/profile/athlete` validates plausibility (FCmax 120-230, LTHR 100-210, LTHR < FCmax).
- **`/profile`** gains a "Datos del atleta" card with FCmax + LTHR inputs and a brief Friel-test explanation.
- **`/metrics`** gains a "FC Máx Observada" card sampling peak HR from last ~30 Strava rides. When observed > configured + 3 bpm (or no FCmax configured), the card flips to amber-warning tone with the suggestion to update.
- **Prompts** (both generators): inject the `hrZonesSummary()` one-liner so the AI can annotate notes like `"Z4 sostenible (~150-158 bpm)"`.

## What's NOT in the branch yet

### Open testing

- [ ] **Outside test of cadence step on the BSC300T** — the user ran an indoor test successfully with HR/cadence targets on the test `.fit`, but the cycle stops when not pedaling so the cadence step (step 2) couldn't be inspected. Needs an actual ride to confirm:
  1. Step 1 (warmup): target shows bpm range, not "0-109 W".
  2. Step 2 (interval): target shows "60-65 rpm" and the field next to it shows live cadence from the sensor.
  3. Steps 3/5 (recovery): target back to HR bpm range.
- [ ] **Confirm real FCmax from `/metrics` "FC Máx Observada"** — user hadn't checked this yet. The card was built specifically to surface this. Their previous FCmax setting (176) felt too low (Z3 reached when relaxed), so observed peak is probably 185-195.

### Open TODO (sensible follow-ups)

- [ ] **Power meter path** — if the user ever gets a power meter, the current code emits HR target by default. Could add a `User.hasPowerMeter` flag that, when true, switches Z1-Z7 back to power target with custom watt range computed from FTP. Today FTP is mentioned in the prompt but not stored on `User` — would need `User.ftp Int?`.
- [ ] **Explicit watt ranges in `targetPower`** — currently `targetPower` only parses `Z[1-7]` and falls back to OPEN otherwise. If we ever want to support raw watt prescriptions like `"180-200W"`, regex + emit as power custom range.
- [ ] **Round-trip test of generated .fit through a real FIT parser** — current tests check byte signatures inline. The smoke test (Node parser at `/tmp/parse-fit.js` — not committed) proved compatibility against iGPSPORT's own output, but a permanent test would catch regressions. The `@garmin/fitsdk` dep is already in `node_modules` for the CRC; could use its parser for round-trip.
- [ ] **HR target on recovery rides post-leg-day** — the prompt teaches the AI to set `targetCadence: "90+ rpm"` (qualitative, not parseable). Recovery rides end up with HR-zone target on the device. Could also support a `targetCadence` lower-bound (`"90+ rpm"` → `low=90, high=160` — the device's upper rpm range) so the device alerts when cadence drops below 90.
- [ ] **Stale token / Strava re-auth UX** — unrelated to this branch but the `/metrics` page currently dies silently if Strava token is expired (the helper returns `null`). Could surface a re-auth banner.

## How to continue locally

1. **Pull the branch:**

   ```bash
   git fetch origin claude/cadence-sensor-integration-jVPFK
   git checkout claude/cadence-sensor-integration-jVPFK
   ```

2. **If you already ran `docker compose up -d --build` and `docker exec coachia-coach-ia-1 npx prisma db push`**, the schema is current. Verify:

   ```bash
   docker exec coachia-coach-ia-1 npx prisma db pull --print 2>&1 | grep -E "fcMax|lthr|targetCadence"
   ```

   Should show `fcMax`, `lthr` (on User) and `targetCadence` (on CyclingBlock).

3. **Tests:** `docker exec coachia-coach-ia-1 npm test` → 19 passing. The interesting ones are in `src/lib/fit-exporter.test.ts`.

4. **What to check in the UI:**

   - `/profile` → "Datos del atleta" card, save your FCmax (and LTHR if you tested it).
   - `/metrics` → "FC Máx Observada" card. The number it shows is your strongest signal for the real FCmax.
   - Generate a new routine → the prompt now passes your HR zones to the AI. The `notes` field of each cycling block should include bpm ranges for HR-based blocks.
   - Download a `.fit` from `/workout/today` → on the BSC300T, target ranges show bpm (resolved from your FCmax) instead of watt zones.

5. **Test the cadence step on a real ride** (open testing item above).

## Key design decisions to know about

1. **Cadence wins over power as the FIT target when present** — because iGPSPORT only allows one target type per step, and if the AI has explicitly prescribed a cadence range, that's the step's discipline (big-gear, spin-up). The power zone goes into the step name + block notes for context.

2. **HR is the default zone target, not power** — explained above. The rider has HR + cadence sensors, no power meter. Power as target rendered an unreachable watt range on the device.

3. **LTHR wins over FCmax when both set** — Friel zones (LTHR-based) are more accurate for cyclists than %FCmax. The Z4 range in Friel = 94-99% LTHR = exactly the threshold work most coaches prescribe. %FCmax is the fallback for riders who haven't done a Friel test.

4. **FIT field 5/6 dual-purpose** — `customTargetValueLow/High` AND `durationStep/repeatSteps` share the same byte offsets in the workout_step message. The exporter tracks which is which via a `StepDraft.field5/field6` pair.

5. **`targetPower` field name stayed historical** — the field carries zone labels ("Z1"-"Z7"), never watts. Renaming would touch a lot of files for no real gain. Comments in `fit-exporter.ts` and `parsePowerTarget` (now `resolveZoneTarget`) flag this.

6. **The exporter doesn't trust internal device defaults** — when `hrConfig` is provided, we emit an explicit bpm custom range (`target_value=0` + `customLow/High`) rather than a zone reference (`target_value=N`). This way the device renders the rider's actual zones, not whatever it was last configured with.

## Files in this branch (changed or added)

```
prisma/schema.prisma                              modified  (CyclingBlock.targetCadence, User.fcMax, User.lthr)
prisma/migrations/20260515_add_cycling_block_cadence.sql   new
prisma/migrations/20260516_add_user_hr_zones.sql           new
src/lib/hr-zones.ts                               new       (zone math + prompt summary)
src/lib/fit-exporter.ts                           modified  (cadence target, HR default, hrConfig)
src/lib/fit-exporter.test.ts                      new       (10 of the 19 tests)
src/app/api/profile/athlete/route.ts              new       (GET/PATCH FCmax + LTHR)
src/app/api/routines/route.ts                     modified  (pipe targetCadence on save)
src/app/api/routines/generate/route.ts            modified  (cadence ingest, zone guardrails, HR section, schema field)
src/app/api/routines/generate-monthly/route.ts    modified  (cadence ingest, HR section, save targetCadence)
src/app/api/stats/cycling/route.ts                modified  (avg cadence per ride + summary)
src/app/api/workouts/[id]/export-fit/route.ts     modified  (pass hrConfig)
src/app/api/workouts/export-all-fit/route.ts      modified  (pass hrConfig + targetCadence)
src/app/api/workouts/export-cycling/route.ts      modified  (pipe targetCadence)
src/components/CyclingBlocks.tsx                  modified  (render cadence inline)
src/components/StravaActivities.tsx               modified  (per-ride cadence display)
src/app/metrics/CyclingCards.tsx                  modified  (Cadencia Media + FC Máx Observada cards)
src/app/profile/page.tsx                          modified  (load fcMax/lthr)
src/app/profile/ProfileClient.tsx                 modified  ("Datos del atleta" card)
```
