import { describe, expect, it } from "vitest";
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

    // Step should use HR target (type=1, value=3 for Z3) and 0xffffffff in custom range fields.
    const sig = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00];
    const idx = findBytes(fit, sig);
    expect(idx).toBeGreaterThan(0);
    // target_type byte at idx + 35
    expect(fit[idx + 35]).toBe(1); // TARGET_HEART_RATE
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
