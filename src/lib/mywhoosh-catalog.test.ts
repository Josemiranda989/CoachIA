import { describe, it, expect } from "vitest";
import { suggestMyWhooshCategory } from "@/lib/mywhoosh-catalog";

describe("suggestMyWhooshCategory", () => {
  it("intervalos Z5 → VO2max", () => {
    const s = suggestMyWhooshCategory([
      { kind: "warmup", targetPower: "Z1" },
      { kind: "interval", targetPower: "Z5" },
      { kind: "cooldown", targetPower: "Z2" },
    ]);
    expect(s.key).toBe("vo2max");
  });

  it("intervalos Z4 → Threshold", () => {
    const s = suggestMyWhooshCategory([
      { kind: "warmup", targetPower: "Z1" },
      { kind: "interval", targetPower: "Z4" },
      { kind: "cooldown", targetPower: "Z1" },
    ]);
    expect(s.key).toBe("threshold");
  });

  it("sostenido Z2 sin intervalos → Endurance", () => {
    const s = suggestMyWhooshCategory([
      { kind: "warmup", targetPower: "Z1" },
      { kind: "steady", targetPower: "Z2" },
      { kind: "cooldown", targetPower: "Z1" },
    ]);
    expect(s.key).toBe("endurance");
  });

  it("trabajo Z3 → Tempo", () => {
    const s = suggestMyWhooshCategory([
      { kind: "steady", targetPower: "Z3" },
    ]);
    expect(s.key).toBe("tempo");
  });

  it("intervalos Z6 → Anaerobic", () => {
    const s = suggestMyWhooshCategory([{ kind: "interval", targetPower: "Z6" }]);
    expect(s.key).toBe("anaerobic");
  });

  it("esfuerzos Z7 → Sprint", () => {
    const s = suggestMyWhooshCategory([{ kind: "interval", targetPower: "Z7" }]);
    expect(s.key).toBe("sprint");
  });

  it("un bloque de test de FTP gana sobre la zona → Testing", () => {
    const s = suggestMyWhooshCategory([
      { kind: "steady", targetPower: "Z4", notes: "FTP test 20 min all-out" },
    ]);
    expect(s.key).toBe("testing");
  });

  it("sweet spot por palabra clave → Sweetspot (aunque la zona sea Z3-Z4)", () => {
    const s = suggestMyWhooshCategory([
      { kind: "steady", targetPower: "Z3-Z4", notes: "Sweet spot 2x15" },
    ]);
    expect(s.key).toBe("sweetspot");
  });

  it("ignora warmup/cooldown al calcular la zona de trabajo", () => {
    // El cooldown en Z2 no debe degradar un día de VO2max.
    const s = suggestMyWhooshCategory([
      { kind: "warmup", targetPower: "Z1" },
      { kind: "interval", targetPower: "Z5" },
      { kind: "cooldown", targetPower: "Z2" },
    ]);
    expect(s.key).toBe("vo2max");
  });

  it("expone label y pista de duración para la UI", () => {
    const s = suggestMyWhooshCategory([{ kind: "interval", targetPower: "Z5" }], {
      totalDuration: 62,
    });
    expect(s.label).toBe("VO2max");
    expect(s.durationHint).toContain("62");
    expect(typeof s.reason).toBe("string");
  });
});
