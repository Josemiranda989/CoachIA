import { describe, expect, it } from "vitest";
import { Decoder, Stream } from "@garmin/fitsdk";
import { blocksToFitWorkout, parseCadenceTarget } from "./fit-exporter";

describe("parseCadenceTarget", () => {
  it("parses standard rpm ranges", () => {
    expect(parseCadenceTarget("60-65 rpm")).toEqual({ low: 60, high: 65 });
    expect(parseCadenceTarget("55-65 rpm big gear")).toEqual({ low: 55, high: 65 });
    expect(parseCadenceTarget("90 - 100 rpm")).toEqual({ low: 90, high: 100 });
  });

  it("rejects qualitative cadence cues", () => {
    expect(parseCadenceTarget("big gear")).toBeNull();
    expect(parseCadenceTarget("100+ rpm spin-up")).toBeNull();
    expect(parseCadenceTarget("90+ rpm")).toBeNull();
    expect(parseCadenceTarget(null)).toBeNull();
    expect(parseCadenceTarget(undefined)).toBeNull();
  });

  it("rejects implausible ranges", () => {
    expect(parseCadenceTarget("20-25 rpm")).toBeNull();  // low < 30
    expect(parseCadenceTarget("65-60 rpm")).toBeNull();  // inverted
    expect(parseCadenceTarget("60-60 rpm")).toBeNull();  // zero-width
  });
});

// Locate the offset of a uint8 sequence inside the binary FIT output.
function findBytes(buf: Uint8Array, needle: number[]): number {
  outer: for (let i = 0; i <= buf.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (buf[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

describe("blocksToFitWorkout cadence target", () => {
  it("emits target_type=3 + custom low/high when block has numeric cadence range", () => {
    const fit = blocksToFitWorkout({
      name: "Test",
      blocks: [
        { order: 0, kind: "warmup", duration: 5, targetPower: "Z1" },
        {
          order: 1,
          kind: "interval",
          duration: 2,
          targetPower: "Z3",
          targetCadence: "60-65 rpm",
          repetitions: 3,
          recoveryDuration: 1,
          recoveryPower: "Z1",
        },
        { order: 2, kind: "cooldown", duration: 5, targetPower: "Z1" },
      ],
    });

    // The interval work step should appear as:
    //   field#5 (custom low) = 60 LE uint32 = 3c 00 00 00
    //   field#6 (custom high) = 65 LE uint32 = 41 00 00 00
    //   message_index = 1 → 01 00
    const cadenceSig = [0x3c, 0x00, 0x00, 0x00, 0x41, 0x00, 0x00, 0x00, 0x01, 0x00];
    expect(findBytes(fit, cadenceSig)).toBeGreaterThan(0);

    // The target_type byte in that step should be 3 (cadence).
    // Locate the step header (0x00 right before the cadence custom range).
    const idx = findBytes(fit, cadenceSig);
    // From the cadence sig start, skip: 4+4+2 (low/high/index) + 20 (name) + 1 (dur_type) + 4 (dur_val)
    // = 35 bytes → next byte is target_type.
    expect(fit[idx + 35]).toBe(3);
  });

  it("falls back to HR target when cadence is qualitative", () => {
    const fit = blocksToFitWorkout({
      name: "BigGear",
      blocks: [
        {
          order: 0,
          kind: "steady",
          duration: 10,
          targetPower: "Z3",
          targetCadence: "big gear", // no numeric range
        },
      ],
    });

    // Step should use HR zone-reference target (type=1, value=3 for Z3) and
    // 0xffffffff in custom range fields (no hrConfig passed).
    const sig = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00];
    const idx = findBytes(fit, sig);
    expect(idx).toBeGreaterThan(0);
    // target_type byte at idx + 35
    expect(fit[idx + 35]).toBe(1); // TARGET_HEART_RATE
  });

  it("ignores hrConfig.fcMax for FIT output (emits zone reference for BSC300T compat)", () => {
    // Empirical evidence (2026-05-17): the BSC300T does NOT render custom HR
    // ranges from FIT workouts. It expects target_value=zone_ref and uses its
    // own configured HR zones. fcMax/lthr stay relevant for the routine
    // prompt (via hrZonesSummary) but are intentionally ignored here.
    const fit = blocksToFitWorkout({
      name: "WithFc",
      blocks: [{ order: 0, kind: "warmup", duration: 5, targetPower: "Z1" }],
      hrConfig: { fcMax: 190 },
    });

    // Zone reference mode: fields 5/6 are 0xffffffff (no custom range);
    // target_type=HEART_RATE (1), target_value=zone number (1 for Z1).
    const sig = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00];
    const idx = findBytes(fit, sig);
    expect(idx).toBeGreaterThan(0);
    expect(fit[idx + 35]).toBe(1); // TARGET_HEART_RATE
  });

  it("ignores hrConfig.lthr for FIT output (emits zone reference for BSC300T compat)", () => {
    const fit = blocksToFitWorkout({
      name: "WithLthr",
      blocks: [{ order: 0, kind: "steady", duration: 10, targetPower: "Z4" }],
      hrConfig: { fcMax: 190, lthr: 160 },
    });

    const sig = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00];
    const idx = findBytes(fit, sig);
    expect(idx).toBeGreaterThan(0);
    expect(fit[idx + 35]).toBe(1);
  });

  it("recovery step keeps HR target even when work step uses cadence", () => {
    const fit = blocksToFitWorkout({
      name: "Mixed",
      blocks: [
        {
          order: 0,
          kind: "interval",
          duration: 4,
          targetPower: "Z3",
          targetCadence: "55-65 rpm",
          repetitions: 4,
          recoveryDuration: 4,
          recoveryPower: "Z1",
        },
      ],
    });

    // 3 steps emitted: work (cadence), recovery (Z1 HR), repeat marker.
    // Find the recovery step: it has 0xffffffff in fields 5/6, intensity=rest (1).
    // Use the message_index=1 as anchor.
    const anchor = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01, 0x00];
    const idx = findBytes(fit, anchor);
    expect(idx).toBeGreaterThan(0);
    expect(fit[idx + 35]).toBe(1); // TARGET_HEART_RATE on the recovery
  });
});

// Round-trip tests: parse the bytes we emit with Garmin's own FIT SDK to make
// sure the file is structurally valid (header, CRC, message definitions) and
// that the field values we wrote come back out unchanged. Byte-signature tests
// above catch encoding regressions; these catch protocol regressions that
// byte tests don't see (CRC drift, malformed mesg defs, wrong dev fields).
describe("blocksToFitWorkout round-trip via @garmin/fitsdk", () => {
  it("produces a structurally valid FIT file with intact CRC", () => {
    const fit = blocksToFitWorkout({
      name: "Valid",
      blocks: [{ order: 0, kind: "warmup", duration: 10, targetPower: "Z1" }],
    });

    const stream = Stream.fromByteArray(Array.from(fit));
    const decoder = new Decoder(stream);
    expect(decoder.isFIT()).toBe(true);
    expect(decoder.checkIntegrity()).toBe(true);
  });

  it("round-trips workout name, step count, and intensities", () => {
    const fit = blocksToFitWorkout({
      name: "RoundTrip",
      blocks: [
        { order: 0, kind: "warmup", duration: 10, targetPower: "Z1" },
        {
          order: 1,
          kind: "interval",
          duration: 4,
          targetPower: "Z3",
          repetitions: 4,
          recoveryDuration: 4,
          recoveryPower: "Z1",
        },
        { order: 2, kind: "cooldown", duration: 10, targetPower: "Z1" },
      ],
    });

    const stream = Stream.fromByteArray(Array.from(fit));
    const decoder = new Decoder(stream);
    const { messages, errors } = decoder.read();
    expect(errors).toHaveLength(0);

    expect(messages.workoutMesgs).toHaveLength(1);
    expect(messages.workoutMesgs[0].wktName).toBe("RoundTrip");

    // warmup + (work + recovery + repeat-marker) + cooldown = 5 steps
    expect(messages.workoutStepMesgs).toHaveLength(5);

    const steps = messages.workoutStepMesgs;
    expect(steps[0].intensity).toBe("warmup");
    expect(steps[1].intensity).toBe("active");
    expect(steps[2].intensity).toBe("rest");
    // step 3 is the repeat-marker (intensity is active but durationType differs)
    expect(steps[4].intensity).toBe("cooldown");
  });

  it("round-trips cadence target with exact rpm range", () => {
    const fit = blocksToFitWorkout({
      name: "Cadence",
      blocks: [
        { order: 0, kind: "warmup", duration: 5, targetPower: "Z1" },
        {
          order: 1,
          kind: "interval",
          duration: 2,
          targetPower: "Z3",
          targetCadence: "60-65 rpm",
          repetitions: 3,
          recoveryDuration: 1,
          recoveryPower: "Z1",
        },
      ],
    });

    const stream = Stream.fromByteArray(Array.from(fit));
    const { messages } = new Decoder(stream).read();
    const work = messages.workoutStepMesgs[1]; // step after warmup
    expect(work.targetType).toBe("cadence");
    expect(work.customTargetValueLow).toBe(60);
    expect(work.customTargetValueHigh).toBe(65);
  });

  it("round-trips HR target as zone reference regardless of fcMax", () => {
    // BSC300T compat: HR target always emitted as zone_ref, not custom bpm.
    const fit = blocksToFitWorkout({
      name: "HRFcMax",
      blocks: [{ order: 0, kind: "warmup", duration: 5, targetPower: "Z1" }],
      hrConfig: { fcMax: 182 },
    });

    const stream = Stream.fromByteArray(Array.from(fit));
    const { messages } = new Decoder(stream).read();
    const step = messages.workoutStepMesgs[0];
    expect(step.targetType).toBe("heartRate");
    expect(step.targetValue).toBe(1); // zone reference for Z1
  });

  it("round-trips HR target as zone reference regardless of lthr", () => {
    const fit = blocksToFitWorkout({
      name: "HRLthr",
      blocks: [{ order: 0, kind: "steady", duration: 10, targetPower: "Z4" }],
      hrConfig: { fcMax: 190, lthr: 160 },
    });

    const stream = Stream.fromByteArray(Array.from(fit));
    const { messages } = new Decoder(stream).read();
    const step = messages.workoutStepMesgs[0];
    expect(step.targetType).toBe("heartRate");
    expect(step.targetValue).toBe(4); // zone reference for Z4
  });
});
