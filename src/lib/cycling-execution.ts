// Compares the prescribed HR zone of each cycling block against the actual HR
// recorded by the rider. Consumes the HR stream from a Strava activity and
// slices it by the cumulative duration of each block. Per-block average HR is
// then bucketed into one of three verdicts (in_zone, above, below) with a
// small tolerance to absorb sensor noise.
//
// Interval blocks are deliberately skipped — their HR averages mix work and
// recovery, which makes any single number misleading. The drill detector
// covers the cadence-focused interval case (warmup spin-ups). A future
// extension could segment intervals into work/recovery windows.
//
// Time alignment assumption (MVP): the Strava activity start corresponds to
// the start of the workout. The rider does not pause-and-resume between
// blocks. If/when riders use lap markers, switching to lap-based slicing
// would be more accurate.

import { resolveHrZone, type HrConfig } from "./hr-zones";

export type BlockInput = {
  order: number;
  kind: string;
  duration: number; // minutes
  targetPower: string; // zone label, e.g. "Z2" or "Z1-Z2"
  repetitions: number | null;
  recoveryDuration: number | null;
};

export type BlockExecution = {
  blockOrder: number;
  kind: string;
  prescribedZone: string;
  prescribedRangeBpm: { low: number; high: number } | null;
  actualAvgHr: number | null;
  actualMaxHr: number | null;
  status:
    | "in_zone"
    | "above"
    | "below"
    | "skipped_interval"
    | "no_zone_config"
    | "no_data";
  windowSec: number;
};

// HR sensor dropouts read as 0 or 1. Anything below 30bpm is filtered.
const HR_SENSOR_FLOOR = 30;
// Tolerance bands for verdict — sensor and effort noise of ±3bpm is normal.
const VERDICT_TOLERANCE_BPM = 3;

function blockTotalSec(b: BlockInput): number {
  if (b.kind === "interval" && b.repetitions && b.recoveryDuration) {
    return (b.duration + b.recoveryDuration) * 60 * b.repetitions;
  }
  return b.duration * 60;
}

// Parses a target label like "Z2", "Z1-Z2", "Z4 (~230W)" into a combined
// bpm range. "Z1-Z3" gives [Z1.low, Z3.high] — useful when the prescription
// is a wide cruise window.
export function parseTargetZoneRange(
  label: string,
  hrConfig: HrConfig,
): { low: number; high: number } | null {
  const matches = [...label.matchAll(/Z([1-7])/gi)];
  if (matches.length === 0) return null;
  const zones = matches.map((m) => parseInt(m[1], 10));
  const minZone = Math.min(...zones);
  const maxZone = Math.max(...zones);
  const lowRange = resolveHrZone(minZone, hrConfig);
  const highRange = resolveHrZone(maxZone, hrConfig);
  if (!lowRange || !highRange) return null;
  return { low: lowRange.low, high: highRange.high };
}

export function analyzeCyclingExecution({
  blocks,
  hrStream,
  hrConfig,
}: {
  blocks: BlockInput[];
  hrStream: number[];
  hrConfig: HrConfig;
}): BlockExecution[] {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  const results: BlockExecution[] = [];
  let cumSec = 0;

  for (const block of sorted) {
    const totalSec = blockTotalSec(block);
    const sliceStart = cumSec;
    const sliceEnd = Math.min(hrStream.length, cumSec + totalSec);
    cumSec += totalSec;

    const base = {
      blockOrder: block.order,
      kind: block.kind,
      prescribedZone: block.targetPower,
      windowSec: totalSec,
    };

    if (block.kind === "interval") {
      results.push({
        ...base,
        prescribedRangeBpm: parseTargetZoneRange(block.targetPower, hrConfig),
        actualAvgHr: null,
        actualMaxHr: null,
        status: "skipped_interval",
      });
      continue;
    }

    const range = parseTargetZoneRange(block.targetPower, hrConfig);
    if (!range) {
      results.push({
        ...base,
        prescribedRangeBpm: null,
        actualAvgHr: null,
        actualMaxHr: null,
        status: "no_zone_config",
      });
      continue;
    }

    const slice = hrStream.slice(sliceStart, sliceEnd);
    const validValues = slice.filter((v) => v >= HR_SENSOR_FLOOR);
    if (validValues.length === 0) {
      results.push({
        ...base,
        prescribedRangeBpm: range,
        actualAvgHr: null,
        actualMaxHr: null,
        status: "no_data",
      });
      continue;
    }

    const sum = validValues.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / validValues.length);
    const max = Math.max(...validValues);

    let status: BlockExecution["status"];
    if (avg < range.low - VERDICT_TOLERANCE_BPM) status = "below";
    else if (avg > range.high + VERDICT_TOLERANCE_BPM) status = "above";
    else status = "in_zone";

    results.push({
      ...base,
      prescribedRangeBpm: range,
      actualAvgHr: avg,
      actualMaxHr: max,
      status,
    });
  }

  return results;
}
