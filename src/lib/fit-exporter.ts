import { CrcCalculator } from "@garmin/fitsdk";
import { resolveHrZone, type HrConfig } from "./hr-zones";

export type Block = {
  id?: string;
  order: number;
  kind: string;
  duration: number;
  targetPower: string;
  repetitions?: number | null;
  recoveryDuration?: number | null;
  recoveryPower?: string | null;
  // When cadence is a clean numeric range ("60-65 rpm", "55-65 rpm big gear"),
  // it overrides the power target for this step — iGPSPORT workouts allow
  // only one target type per step (confirmed by inspecting an exported .fit).
  // Qualitative cadence cues ("big gear", "100+ rpm spin-up") are left to the
  // in-app UI / notes since they have no clean range to encode.
  targetCadence?: string | null;
  notes?: string | null;
};

export type FitWorkoutInput = {
  name: string;
  blocks: Block[];
  // Optional HR config. When provided, "Z1"-"Z7" labels resolve to explicit
  // bpm ranges (target_type=heart_rate + customTargetValueLow/High). Without
  // it, the exporter emits a zone reference (target_value=N) and the device
  // uses its own HR zones — works only if the rider configured them on-device.
  hrConfig?: HrConfig;
};

// FIT epoch: seconds between Unix epoch (1970-01-01) and FIT epoch (1989-12-31 UTC)
const FIT_EPOCH_OFFSET = 631065600;

// FIT base type byte encoding: high bit = endian flag, low nibble = type id
const BT_ENUM = 0x00;
const BT_UINT8 = 0x02;
const BT_STRING = 0x07;
const BT_UINT16 = 0x84;
const BT_UINT32 = 0x86;
const BT_UINT32Z = 0x8c;

// Global mesg nums
const MESG_FILE_ID = 0;
const MESG_WORKOUT = 26;
const MESG_WORKOUT_STEP = 27;

// Enum values (per FIT profile 21.78)
const FILE_TYPE_WORKOUT = 5;
const SPORT_CYCLING = 2;
const INTENSITY = { active: 0, rest: 1, warmup: 2, cooldown: 3 } as const;
const DURATION_TIME = 0;
const DURATION_REPEAT_STEPS = 6;
const TARGET_OPEN = 2;
const TARGET_HEART_RATE = 1;
const TARGET_CADENCE = 3;

// Manufacturer IDs (FIT profile)
const MFR_IGPSPORT = 115;

// Fixed sizes — chosen to cover our Spanish names without per-step redefinitions
const WKT_NAME_SIZE = 20;    // fits "CoachIA mie" + room
const STEP_NAME_SIZE = 20;   // fits "Vuelta a la calma\0"

// Step-level field definition, in the exact order used by workouts generated
// by the iGPSPORT app itself (observed from official sample workouts).
// Field numbers per FIT profile 21.78 workoutStep:
//   #0 wktStepName, #1 durationType, #2 durationValue, #3 targetType, #4 targetValue,
//   #5 customTargetValueLow (aka durationStep when durationType=repeat*),
//   #6 customTargetValueHigh (aka repeatSteps when durationType=repeat*),
//   #7 intensity, #254 messageIndex
const WORKOUT_STEP_FIELDS = [
  { num: 5,   size: 4,              base: BT_UINT32 }, // customTargetValueLow / durationStep
  { num: 6,   size: 4,              base: BT_UINT32 }, // customTargetValueHigh / repeatSteps
  { num: 254, size: 2,              base: BT_UINT16 }, // messageIndex
  { num: 0,   size: STEP_NAME_SIZE, base: BT_STRING }, // wktStepName
  { num: 1,   size: 1,              base: BT_ENUM },   // durationType
  { num: 2,   size: 4,              base: BT_UINT32 }, // durationValue
  { num: 3,   size: 1,              base: BT_ENUM },   // targetType
  { num: 4,   size: 4,              base: BT_UINT32 }, // targetValue
  { num: 7,   size: 1,              base: BT_ENUM },   // intensity
];

type StepDraft = {
  messageIndex: number;
  wktStepName: string;
  intensity: number;
  durationType: number;
  durationValue: number;
  // Field #5 and #6 are dual-purpose in FIT: for repeat steps they hold
  // durationStep + repeatSteps; for regular steps they hold
  // customTargetValueLow + customTargetValueHigh (used for cadence ranges).
  field5: number | null;
  field6: number | null;
  targetType: number;
  targetValue: number;
};

// Resolve a "Z1"-"Z7" label to a FIT target. We emit HR-zone targets rather
// than POWER-zone targets because the typical CoachIA rider trains with a HR
// strap + cadence sensor (no power meter on the bike). The BSC300T resolves
// HR Zone N against the rider's configured FCmax, so the target range shown
// on screen is something they can actually chase in real time. Power target
// would render a watt range that's unmeasurable without a power meter.
//
// When hrConfig has fcMax/lthr, we compute the bpm range from the rider's
// own zones and emit it as a custom range (target_value=0, customLow/High).
// This wins over the device's internal HR zones — useful because the device
// defaults often lag what the rider's actual zones should be.
//
// (The `targetPower` field name in the data model is historical — the value
// is a zone label, not a watt prescription.)
function resolveZoneTarget(
  raw: string | null | undefined,
  hrConfig?: HrConfig,
): { targetType: number; targetValue: number; field5: number | null; field6: number | null } {
  if (!raw) return { targetType: TARGET_OPEN, targetValue: 0, field5: null, field6: null };
  const m = raw.match(/Z([1-7])/i);
  if (!m) return { targetType: TARGET_OPEN, targetValue: 0, field5: null, field6: null };
  const zone = parseInt(m[1], 10);
  if (hrConfig) {
    const range = resolveHrZone(zone, hrConfig);
    if (range) {
      return {
        targetType: TARGET_HEART_RATE,
        targetValue: 0,
        field5: range.low,
        field6: range.high,
      };
    }
  }
  return { targetType: TARGET_HEART_RATE, targetValue: zone, field5: null, field6: null };
}

// Parse a cadence prescription like "60-65 rpm", "55-65 rpm big gear",
// "90 - 100 rpm". Returns null for qualitative cues ("big gear", "100+ rpm")
// since the FIT custom-range fields need a closed [low, high] pair.
export function parseCadenceTarget(raw: string | null | undefined): { low: number; high: number } | null {
  if (!raw) return null;
  const m = raw.match(/(\d{2,3})\s*-\s*(\d{2,3})\s*rpm/i);
  if (!m) return null;
  const low = parseInt(m[1], 10);
  const high = parseInt(m[2], 10);
  if (low < 30 || high > 200 || low >= high) return null;
  return { low, high };
}

// Pick the effective FIT target for a step. Cadence wins when it has a clean
// range — the rider explicitly added a cadence prescription (big-gear,
// spin-up, recovery high-cadence) and that's the discipline of the step.
function resolveTarget(
  power: string | null | undefined,
  cadence: string | null | undefined,
  hrConfig?: HrConfig,
): { targetType: number; targetValue: number; field5: number | null; field6: number | null } {
  const cad = parseCadenceTarget(cadence);
  if (cad) {
    return { targetType: TARGET_CADENCE, targetValue: 0, field5: cad.low, field6: cad.high };
  }
  return resolveZoneTarget(power, hrConfig);
}

function kindToIntensity(kind: string): number {
  if (kind === "warmup") return INTENSITY.warmup;
  if (kind === "cooldown") return INTENSITY.cooldown;
  return INTENSITY.active;
}

const STEP_NAME: Record<string, string> = {
  warmup: "Calentamiento",
  steady: "Sostenido",
  interval: "Intervalo",
  recovery: "Recuperacion",
  cooldown: "Vuelta a la calma",
};

// --- Low-level buffer writers (little-endian FIT binary format) ----------

function writeDefinition(
  out: number[],
  localMesgNum: number,
  globalMesgNum: number,
  fields: { num: number; size: number; base: number }[]
) {
  out.push(0x40 | (localMesgNum & 0x0f)); // definition header
  out.push(0);                             // reserved
  out.push(0);                             // architecture: 0 = little-endian
  out.push(globalMesgNum & 0xff, (globalMesgNum >> 8) & 0xff);
  out.push(fields.length);
  for (const f of fields) out.push(f.num, f.size, f.base);
}

function writeU8(out: number[], v: number) {
  out.push(v & 0xff);
}
function writeU16(out: number[], v: number) {
  out.push(v & 0xff, (v >> 8) & 0xff);
}
function writeU32(out: number[], v: number) {
  out.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
}
function writeString(out: number[], s: string, fixedSize: number) {
  const buf = Buffer.from(s, "utf8");
  const n = Math.min(buf.length, fixedSize - 1);
  for (let i = 0; i < n; i++) out.push(buf[i]);
  for (let i = n; i < fixedSize; i++) out.push(0);
}

// --- Main export ----------------------------------------------------------

export function blocksToFitWorkout({ name, blocks, hrConfig }: FitWorkoutInput): Uint8Array {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);

  // Expand CoachIA blocks into flat FIT step drafts.
  const drafts: StepDraft[] = [];
  for (const b of sorted) {
    const workTarget = resolveTarget(b.targetPower, b.targetCadence, hrConfig);
    const hasReps =
      b.kind === "interval" && !!b.repetitions && b.repetitions > 1 && !!b.recoveryDuration;

    if (hasReps) {
      const workStart = drafts.length;
      drafts.push({
        messageIndex: drafts.length,
        wktStepName: STEP_NAME.interval,
        intensity: INTENSITY.active,
        durationType: DURATION_TIME,
        durationValue: b.duration * 60_000,
        field5: workTarget.field5,
        field6: workTarget.field6,
        targetType: workTarget.targetType,
        targetValue: workTarget.targetValue,
      });
      // Recovery never has a cadence prescription of its own — defaults to HR zone.
      const rec = resolveZoneTarget(b.recoveryPower, hrConfig);
      drafts.push({
        messageIndex: drafts.length,
        wktStepName: STEP_NAME.recovery,
        intensity: INTENSITY.rest,
        durationType: DURATION_TIME,
        durationValue: (b.recoveryDuration ?? 0) * 60_000,
        field5: rec.field5,
        field6: rec.field6,
        targetType: rec.targetType,
        targetValue: rec.targetValue,
      });
      drafts.push({
        messageIndex: drafts.length,
        wktStepName: "",
        intensity: INTENSITY.active,
        durationType: DURATION_REPEAT_STEPS,
        durationValue: workStart,
        field5: workStart,
        field6: b.repetitions!,
        targetType: TARGET_OPEN,
        targetValue: b.repetitions!,
      });
    } else {
      drafts.push({
        messageIndex: drafts.length,
        wktStepName: STEP_NAME[b.kind] ?? "",
        intensity: kindToIntensity(b.kind),
        durationType: DURATION_TIME,
        durationValue: b.duration * 60_000,
        field5: workTarget.field5,
        field6: workTarget.field6,
        targetType: workTarget.targetType,
        targetValue: workTarget.targetValue,
      });
    }
  }

  // --- Build data section (all records after the file header) -----------
  const data: number[] = [];

  // FILE_ID definition + data (local mesg 0)
  writeDefinition(data, 0, MESG_FILE_ID, [
    { num: 0, size: 1, base: BT_ENUM },     // type
    { num: 1, size: 2, base: BT_UINT16 },   // manufacturer
    { num: 2, size: 2, base: BT_UINT16 },   // product
    { num: 3, size: 4, base: BT_UINT32Z },  // serialNumber
    { num: 4, size: 4, base: BT_UINT32 },   // timeCreated
  ]);
  writeU8(data, 0x00);
  writeU8(data, FILE_TYPE_WORKOUT);
  writeU16(data, MFR_IGPSPORT);
  writeU16(data, 65534);
  writeU32(data, Math.floor(Math.random() * 0x7fffffff) || 1);
  writeU32(data, Math.floor(Date.now() / 1000) - FIT_EPOCH_OFFSET);

  // WORKOUT definition + data (local mesg 0, reused)
  writeDefinition(data, 0, MESG_WORKOUT, [
    { num: 8, size: WKT_NAME_SIZE, base: BT_STRING }, // wktName
    { num: 6, size: 2,             base: BT_UINT16 }, // numValidSteps
    { num: 4, size: 1,             base: BT_ENUM },   // sport
  ]);
  writeU8(data, 0x00);
  writeString(data, name, WKT_NAME_SIZE);
  writeU16(data, drafts.length);
  writeU8(data, SPORT_CYCLING);

  // WORKOUT_STEP definition (local mesg 0, reused — ONE def for all steps)
  writeDefinition(data, 0, MESG_WORKOUT_STEP, WORKOUT_STEP_FIELDS);

  // Data record for each step — values written in definition order
  for (const d of drafts) {
    writeU8(data, 0x00);
    writeU32(data, d.field5 ?? 0xffffffff);         // field #5 (durationStep | customTargetValueLow)
    writeU32(data, d.field6 ?? 0xffffffff);         // field #6 (repeatSteps  | customTargetValueHigh)
    writeU16(data, d.messageIndex);                 // field #254
    writeString(data, d.wktStepName, STEP_NAME_SIZE); // field #0
    writeU8(data, d.durationType);                  // field #1
    writeU32(data, d.durationValue);                // field #2
    writeU8(data, d.targetType);                    // field #3
    writeU32(data, d.targetValue);                  // field #4
    writeU8(data, d.intensity);                     // field #7
  }

  // --- Assemble full file: header (14) + data + CRC (2) -----------------
  const HEADER_SIZE = 14;
  const CRC_SIZE = 2;
  const total = HEADER_SIZE + data.length + CRC_SIZE;
  const out = new Uint8Array(total);

  out[0] = HEADER_SIZE;
  out[1] = 0x10;                   // protocol version 1.0
  out[2] = 0x82;                   // profile version low (21.78 = 2178 LE)
  out[3] = 0x08;
  out[4] = data.length & 0xff;     // data_size uint32 LE
  out[5] = (data.length >> 8) & 0xff;
  out[6] = (data.length >> 16) & 0xff;
  out[7] = (data.length >>> 24) & 0xff;
  out[8] = 0x2e;                   // '.'
  out[9] = 0x46;                   // 'F'
  out[10] = 0x49;                  // 'I'
  out[11] = 0x54;                  // 'T'

  // Header CRC covers bytes 0..11
  const headerCrc = CrcCalculator.calculateCRC(out, 0, 12);
  out[12] = headerCrc & 0xff;
  out[13] = (headerCrc >> 8) & 0xff;

  // Copy data section
  for (let i = 0; i < data.length; i++) out[HEADER_SIZE + i] = data[i];

  // File CRC covers the entire file except the last 2 bytes
  const fileCrc = CrcCalculator.calculateCRC(out, 0, HEADER_SIZE + data.length);
  out[total - 2] = fileCrc & 0xff;
  out[total - 1] = (fileCrc >> 8) & 0xff;

  return out;
}
