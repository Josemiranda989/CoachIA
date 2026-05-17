import { describe, it, expect } from "vitest";
import { detectSpinDrill, type DrillSpec } from "./drill-detector";

const week1Drill: DrillSpec = {
  durationMin: 1,
  repetitions: 4,
  targetCadenceLow: 90,
  targetCadenceHigh: 95,
  recoveryDurationMin: 2,
};

// Build a synthetic cadence stream: prefix of warmup pedaling (~80rpm),
// then `reps` of `repMin` minutes at `repRpm` with `recoveryMin` minutes
// of `recoveryRpm` between them, then steady Z2 (~82rpm) for the rest.
function buildStream({
  prefixSec = 60,
  reps,
  repMin,
  repRpm,
  recoveryMin,
  recoveryRpm = 75,
  steadyRpm = 82,
  totalSec = 60 * 60,
  jitter = 0,
}: {
  prefixSec?: number;
  reps: number;
  repMin: number;
  repRpm: number;
  recoveryMin: number;
  recoveryRpm?: number;
  steadyRpm?: number;
  totalSec?: number;
  jitter?: number;
}): number[] {
  const stream: number[] = [];
  const noise = (base: number) =>
    jitter === 0 ? base : Math.round(base + (Math.random() - 0.5) * jitter * 2);
  for (let s = 0; s < prefixSec; s++) stream.push(noise(78));
  for (let r = 0; r < reps; r++) {
    for (let s = 0; s < repMin * 60; s++) stream.push(noise(repRpm));
    if (r < reps - 1) for (let s = 0; s < recoveryMin * 60; s++) stream.push(noise(recoveryRpm));
  }
  while (stream.length < totalSec) stream.push(noise(steadyRpm));
  return stream;
}

describe("detectSpinDrill — happy path", () => {
  it("detects a clean 4x1min @ 92rpm execution", () => {
    const stream = buildStream({ reps: 4, repMin: 1, repRpm: 92, recoveryMin: 2 });
    const result = detectSpinDrill({ cadenceStream: stream, drill: week1Drill });
    expect(result.status).toBe("completed");
    expect(result.detectedReps).toBe(4);
    expect(result.expectedReps).toBe(4);
    expect(result.avgCadenceDuringReps).toBe(92);
    expect(result.details).toHaveLength(4);
  });

  it("detects when athlete pedals slightly above target (94rpm)", () => {
    const stream = buildStream({ reps: 4, repMin: 1, repRpm: 94, recoveryMin: 2 });
    const result = detectSpinDrill({ cadenceStream: stream, drill: week1Drill });
    expect(result.status).toBe("completed");
    expect(result.detectedReps).toBe(4);
  });

  it("accepts realistic sensor noise (±3 rpm jitter)", () => {
    const stream = buildStream({ reps: 4, repMin: 1, repRpm: 92, recoveryMin: 2, jitter: 3 });
    const result = detectSpinDrill({ cadenceStream: stream, drill: week1Drill });
    expect(result.status).toBe("completed");
    expect(result.detectedReps).toBe(4);
  });
});

describe("detectSpinDrill — partial executions", () => {
  it("flags partial when only 2 of 4 reps were done", () => {
    const stream = buildStream({ reps: 2, repMin: 1, repRpm: 92, recoveryMin: 2 });
    const result = detectSpinDrill({ cadenceStream: stream, drill: week1Drill });
    expect(result.status).toBe("partial");
    expect(result.detectedReps).toBe(2);
  });

  it("flags partial when 3 of 4 reps done", () => {
    const stream = buildStream({ reps: 3, repMin: 1, repRpm: 92, recoveryMin: 2 });
    const result = detectSpinDrill({ cadenceStream: stream, drill: week1Drill });
    expect(result.status).toBe("partial");
    expect(result.detectedReps).toBe(3);
  });
});

describe("detectSpinDrill — negative cases", () => {
  it("does not detect when athlete never goes above target", () => {
    const stream = buildStream({ reps: 0, repMin: 1, repRpm: 0, recoveryMin: 0, steadyRpm: 82 });
    const result = detectSpinDrill({ cadenceStream: stream, drill: week1Drill });
    expect(result.status).toBe("not_detected");
    expect(result.detectedReps).toBe(0);
    expect(result.avgCadenceDuringReps).toBeNull();
  });

  it("rejects brief spikes that don't sustain rep duration", () => {
    // 30s spikes at 95rpm — half of the 1min rep — should NOT count.
    const stream: number[] = [];
    for (let r = 0; r < 4; r++) {
      for (let s = 0; s < 30; s++) stream.push(95);
      for (let s = 0; s < 90; s++) stream.push(78);
    }
    while (stream.length < 1800) stream.push(82);
    const result = detectSpinDrill({ cadenceStream: stream, drill: week1Drill });
    expect(result.status).toBe("not_detected");
  });

  it("ignores high cadence that happens AFTER the warmup search window", () => {
    // 0-30min: just steady. 30+min: 4 perfect reps. Should NOT detect (out of window).
    const prefix: number[] = [];
    for (let s = 0; s < 1800; s++) prefix.push(82);
    const drillSegment = buildStream({
      prefixSec: 0,
      reps: 4,
      repMin: 1,
      repRpm: 92,
      recoveryMin: 2,
      totalSec: 800,
    });
    const stream = [...prefix, ...drillSegment];
    const result = detectSpinDrill({ cadenceStream: stream, drill: week1Drill });
    expect(result.status).toBe("not_detected");
  });
});

describe("detectSpinDrill — different drill specs", () => {
  const week2Drill: DrillSpec = {
    durationMin: 2,
    repetitions: 4,
    targetCadenceLow: 90,
    targetCadenceHigh: 95,
    recoveryDurationMin: 2,
  };

  it("detects week 2 drill (4x2min @ 92rpm)", () => {
    const stream = buildStream({ reps: 4, repMin: 2, repRpm: 92, recoveryMin: 2, totalSec: 60 * 30 });
    const result = detectSpinDrill({ cadenceStream: stream, drill: week2Drill });
    expect(result.status).toBe("completed");
    expect(result.detectedReps).toBe(4);
  });

  const week3Drill: DrillSpec = {
    durationMin: 2,
    repetitions: 4,
    targetCadenceLow: 95,
    targetCadenceHigh: 100,
    recoveryDurationMin: 2,
  };

  it("detects week 3 drill at higher target (4x2min @ 97rpm)", () => {
    const stream = buildStream({ reps: 4, repMin: 2, repRpm: 97, recoveryMin: 2, totalSec: 60 * 30 });
    const result = detectSpinDrill({ cadenceStream: stream, drill: week3Drill });
    expect(result.status).toBe("completed");
  });

  it("does NOT count week 3 attempt if athlete only pedals to 92rpm", () => {
    const stream = buildStream({ reps: 4, repMin: 2, repRpm: 92, recoveryMin: 2, totalSec: 60 * 30 });
    const result = detectSpinDrill({ cadenceStream: stream, drill: week3Drill });
    expect(result.status).toBe("not_detected");
  });
});
