import { describe, it, expect } from "vitest";
import {
  analyzeCyclingExecution,
  parseTargetZoneRange,
  type BlockInput,
} from "./cycling-execution";

const hrConfig = { fcMax: 182 }; // gives %FCmax bands: Z1=91-109, Z2=109-127, Z3=127-146, Z4=146-164, Z5=164-182

// Builds a flat-HR stream of `durationSec` samples at `bpm`.
function flat(bpm: number, durationSec: number): number[] {
  return new Array(durationSec).fill(bpm);
}
function concat(...arrays: number[][]): number[] {
  return ([] as number[]).concat(...arrays);
}

describe("parseTargetZoneRange", () => {
  it("parses a single zone", () => {
    expect(parseTargetZoneRange("Z2", hrConfig)).toEqual({ low: 109, high: 127 });
  });

  it("parses a zone range like 'Z1-Z2'", () => {
    expect(parseTargetZoneRange("Z1-Z2", hrConfig)).toEqual({ low: 91, high: 127 });
  });

  it("uses the widest span for compound labels like 'Z2 + 4xZ5'", () => {
    expect(parseTargetZoneRange("Z2 + 4xZ5", hrConfig)).toEqual({ low: 109, high: 182 });
  });

  it("returns null when no Z label is present", () => {
    expect(parseTargetZoneRange("steady", hrConfig)).toBeNull();
  });

  it("returns null when fcMax is missing", () => {
    expect(parseTargetZoneRange("Z2", {})).toBeNull();
  });
});

describe("analyzeCyclingExecution — happy path", () => {
  const blocks: BlockInput[] = [
    { order: 0, kind: "warmup", duration: 15, targetPower: "Z1", repetitions: null, recoveryDuration: null },
    { order: 1, kind: "steady", duration: 88, targetPower: "Z2", repetitions: null, recoveryDuration: null },
    { order: 2, kind: "cooldown", duration: 15, targetPower: "Z1", repetitions: null, recoveryDuration: null },
  ];

  it("verdicts in_zone when rider stayed inside the target", () => {
    const stream = concat(
      flat(100, 15 * 60),   // warmup at 100bpm — inside Z1 (91-109)
      flat(118, 88 * 60),   // steady at 118bpm — inside Z2 (109-127)
      flat(95, 15 * 60),    // cooldown at 95bpm — inside Z1
    );
    const result = analyzeCyclingExecution({ blocks, hrStream: stream, hrConfig });
    expect(result.map((r) => r.status)).toEqual(["in_zone", "in_zone", "in_zone"]);
    expect(result[0].actualAvgHr).toBe(100);
    expect(result[1].actualAvgHr).toBe(118);
  });

  it("flags above when rider went too hard on the steady block", () => {
    const stream = concat(
      flat(100, 15 * 60),
      flat(140, 88 * 60),   // way above Z2 high (127+3)
      flat(95, 15 * 60),
    );
    const result = analyzeCyclingExecution({ blocks, hrStream: stream, hrConfig });
    expect(result[1].status).toBe("above");
    expect(result[1].actualAvgHr).toBe(140);
  });

  it("flags below when rider was too easy", () => {
    const stream = concat(
      flat(100, 15 * 60),
      flat(100, 88 * 60),   // below Z2 low (109-3)
      flat(95, 15 * 60),
    );
    const result = analyzeCyclingExecution({ blocks, hrStream: stream, hrConfig });
    expect(result[1].status).toBe("below");
  });

  it("accepts ±3bpm tolerance for in_zone verdict", () => {
    const stream = concat(
      flat(106, 15 * 60),   // 3bpm below Z1.low (91) → wait, 106 is INSIDE Z1
      flat(130, 88 * 60),   // 3bpm above Z2.high (127) → still in_zone (tolerance)
      flat(95, 15 * 60),
    );
    const result = analyzeCyclingExecution({ blocks, hrStream: stream, hrConfig });
    expect(result[1].status).toBe("in_zone"); // 130 within 127+3
  });
});

describe("analyzeCyclingExecution — edge cases", () => {
  it("skips interval blocks (HR avg of work+recovery is misleading)", () => {
    const blocks: BlockInput[] = [
      { order: 0, kind: "warmup", duration: 15, targetPower: "Z1", repetitions: null, recoveryDuration: null },
      { order: 1, kind: "interval", duration: 4, targetPower: "Z4", repetitions: 4, recoveryDuration: 3 },
      { order: 2, kind: "cooldown", duration: 15, targetPower: "Z1", repetitions: null, recoveryDuration: null },
    ];
    const stream = concat(
      flat(100, 15 * 60),
      flat(140, 4 * (4 + 3) * 60),
      flat(95, 15 * 60),
    );
    const result = analyzeCyclingExecution({ blocks, hrStream: stream, hrConfig });
    expect(result[1].status).toBe("skipped_interval");
    expect(result[1].actualAvgHr).toBeNull();
  });

  it("filters out HR sensor dropouts (zeros)", () => {
    const blocks: BlockInput[] = [
      { order: 0, kind: "steady", duration: 10, targetPower: "Z2", repetitions: null, recoveryDuration: null },
    ];
    // First half: HR=0 (sensor not connected). Second half: 120bpm. Avg should be 120, not 60.
    const stream = concat(flat(0, 5 * 60), flat(120, 5 * 60));
    const result = analyzeCyclingExecution({ blocks, hrStream: stream, hrConfig });
    expect(result[0].actualAvgHr).toBe(120);
    expect(result[0].status).toBe("in_zone");
  });

  it("returns no_data when block has no valid HR samples", () => {
    const blocks: BlockInput[] = [
      { order: 0, kind: "steady", duration: 10, targetPower: "Z2", repetitions: null, recoveryDuration: null },
    ];
    const stream = flat(0, 10 * 60); // all dropouts
    const result = analyzeCyclingExecution({ blocks, hrStream: stream, hrConfig });
    expect(result[0].status).toBe("no_data");
    expect(result[0].actualAvgHr).toBeNull();
  });

  it("returns no_zone_config when fcMax/lthr is missing", () => {
    const blocks: BlockInput[] = [
      { order: 0, kind: "steady", duration: 10, targetPower: "Z2", repetitions: null, recoveryDuration: null },
    ];
    const result = analyzeCyclingExecution({ blocks, hrStream: flat(120, 600), hrConfig: {} });
    expect(result[0].status).toBe("no_zone_config");
    expect(result[0].prescribedRangeBpm).toBeNull();
  });

  it("respects sliding block boundaries (block N starts where block N-1 ended)", () => {
    const blocks: BlockInput[] = [
      { order: 0, kind: "warmup", duration: 1, targetPower: "Z1", repetitions: null, recoveryDuration: null },
      { order: 1, kind: "steady", duration: 1, targetPower: "Z2", repetitions: null, recoveryDuration: null },
    ];
    // First minute: 100bpm (Z1). Second minute: 120bpm (Z2).
    const stream = concat(flat(100, 60), flat(120, 60));
    const result = analyzeCyclingExecution({ blocks, hrStream: stream, hrConfig });
    expect(result[0].actualAvgHr).toBe(100);
    expect(result[1].actualAvgHr).toBe(120);
  });

  it("handles ride shorter than prescribed total", () => {
    const blocks: BlockInput[] = [
      { order: 0, kind: "warmup", duration: 1, targetPower: "Z1", repetitions: null, recoveryDuration: null },
      { order: 1, kind: "steady", duration: 5, targetPower: "Z2", repetitions: null, recoveryDuration: null },
    ];
    // Only 2 minutes of data — warmup full, steady has only 1 minute
    const stream = concat(flat(100, 60), flat(120, 60));
    const result = analyzeCyclingExecution({ blocks, hrStream: stream, hrConfig });
    expect(result[0].actualAvgHr).toBe(100);
    expect(result[1].actualAvgHr).toBe(120); // computed from the 60 samples it found
  });

  it("works with zone-range labels like Z1-Z2", () => {
    const blocks: BlockInput[] = [
      { order: 0, kind: "steady", duration: 10, targetPower: "Z1-Z2", repetitions: null, recoveryDuration: null },
    ];
    // 100bpm is in Z1, 125bpm is in Z2 — both should be in_zone
    const result1 = analyzeCyclingExecution({ blocks, hrStream: flat(100, 600), hrConfig });
    expect(result1[0].status).toBe("in_zone");
    const result2 = analyzeCyclingExecution({ blocks, hrStream: flat(125, 600), hrConfig });
    expect(result2[0].status).toBe("in_zone");
  });
});
