// Detects whether a prescribed spin-up drill was executed in a recorded ride.
//
// The prompt prescribes warmup drills like "4×1min @ 90-95rpm with 2min Z1
// recovery", scheduled in the early portion of the Saturday long ride. This
// function consumes Strava's per-second cadence stream and looks for the
// pattern: a configurable number of repetitions of a sustained high-cadence
// effort separated by recovery gaps, all within a search window at the start
// of the ride.
//
// Algorithm: scan left-to-right looking for "transitions" — the first sample
// at or above threshold after a low-cadence (warmup or recovery) period. At
// each transition, measure the next repDuration-second window: if its average
// is above threshold AND at least 70% of samples are above noiseFloor, count
// it as a rep. Then skip ahead by (repDuration + recovery - 30s slack) to find
// the next transition. This avoids the artifact of a sliding window straddling
// the rampup from prefix into the rep (which would report a lower avg than the
// athlete actually pedaled).
//
// Tolerances chosen for real sensor data:
// - threshold = targetLow - 2 rpm: allows slight undershoot of the prescribed
//   floor without rejecting legitimate efforts
// - noiseFloor = targetLow - 5 rpm: instantaneous reading floor (cadence
//   sensors fluctuate ±3-5 rpm at steady effort)
// - minValidRatio = 0.7: 70% of samples must be above noiseFloor (filters
//   out spike-and-coast patterns that happen to average above threshold)

export type DrillSpec = {
  durationMin: number;
  repetitions: number;
  targetCadenceLow: number;
  targetCadenceHigh: number;
  recoveryDurationMin: number;
};

export type DrillRep = {
  startSec: number;
  endSec: number;
  avgRpm: number;
};

export type DrillDetection = {
  status: "completed" | "partial" | "not_detected";
  detectedReps: number;
  expectedReps: number;
  avgCadenceDuringReps: number | null;
  details: DrillRep[];
};

const DEFAULT_SEARCH_WINDOW_SEC = 30 * 60;

export function detectSpinDrill({
  cadenceStream,
  drill,
  searchWindowSec = DEFAULT_SEARCH_WINDOW_SEC,
}: {
  cadenceStream: number[];
  drill: DrillSpec;
  searchWindowSec?: number;
}): DrillDetection {
  const expectedReps = drill.repetitions;
  const repDur = Math.max(1, Math.floor(drill.durationMin * 60));
  const recoveryDur = Math.max(0, Math.floor(drill.recoveryDurationMin * 60));
  const threshold = drill.targetCadenceLow - 2;
  const noiseFloor = drill.targetCadenceLow - 5;
  const minValidRatio = 0.7;

  const searchEnd = Math.min(cadenceStream.length, searchWindowSec);
  const reps: DrillRep[] = [];

  let i = 0;
  while (i + repDur <= searchEnd) {
    // Advance to the next transition into high cadence — first sample at or
    // above threshold. Starts the window AT the rep boundary, not before it.
    while (i + repDur <= searchEnd && cadenceStream[i] < threshold) i++;
    if (i + repDur > searchEnd) break;

    const window = cadenceStream.slice(i, i + repDur);
    let sum = 0;
    let validCount = 0;
    for (const c of window) {
      sum += c;
      if (c >= noiseFloor) validCount++;
    }
    const avg = sum / window.length;
    const validRatio = validCount / window.length;

    if (avg >= threshold && validRatio >= minValidRatio) {
      reps.push({ startSec: i, endSec: i + repDur, avgRpm: Math.round(avg) });
      // Skip ahead by rep + recovery (with 30s slack for early next rep).
      i += repDur + Math.max(recoveryDur - 30, 0);
    } else {
      i += 1;
    }
  }

  const detectedReps = reps.length;
  const avgCadenceDuringReps = reps.length > 0
    ? Math.round(reps.reduce((s, r) => s + r.avgRpm, 0) / reps.length)
    : null;

  const status: DrillDetection["status"] =
    detectedReps >= expectedReps
      ? "completed"
      : detectedReps > 0
        ? "partial"
        : "not_detected";

  return { status, detectedReps, expectedReps, avgCadenceDuringReps, details: reps };
}
