import { describe, it, expect } from "vitest";
import { generateZwoXml, type CyclingDay } from "@/lib/erg";

// Un .zwo válido para MyWhoosh / Zwift es un <workout_file> XML con
// <sportType>bike</sportType> y pasos con power expresado como fracción de FTP.
const sampleDay: CyclingDay = {
  dayOfWeek: "Tuesday",
  weekLabel: "Semana 1",
  weekStart: "2026-06-15",
  totalDuration: 44,
  totalPower: "Z2 + 4xZ4",
  blocks: [
    { kind: "warmup", duration: 10, targetPower: "Z1" },
    { kind: "steady", duration: 20, targetPower: "Z2" },
    {
      kind: "interval",
      duration: 4,
      targetPower: "Z4",
      repetitions: 4,
      recoveryDuration: 4,
      recoveryPower: "Z1",
    },
    { kind: "cooldown", duration: 10, targetPower: "Z2" },
  ],
};

describe("generateZwoXml", () => {
  it("declara <sportType>bike</sportType> (requerido por MyWhoosh para importar)", () => {
    expect(generateZwoXml(sampleDay)).toContain("<sportType>bike</sportType>");
  });

  it("emite un documento <workout_file> ZWO bien formado", () => {
    const xml = generateZwoXml(sampleDay);
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain("<workout_file>");
    expect(xml).toContain("</workout_file>");
    expect(xml).toContain("<author>CoachIA</author>");
    expect(xml).toContain("<workout>");
    expect(xml).toContain("</workout>");
  });

  it("mapea warmup → <Warmup> con duración en segundos y rampa de %FTP", () => {
    expect(generateZwoXml(sampleDay)).toContain(
      '<Warmup Duration="600" PowerLow="0.50" PowerHigh="0.65"/>',
    );
  });

  it("mapea steady → <SteadyState> con %FTP de la zona", () => {
    expect(generateZwoXml(sampleDay)).toContain(
      '<SteadyState Duration="1200" Power="0.65"/>',
    );
  });

  it("mapea interval → <IntervalsT> con repeticiones y tramos on/off", () => {
    expect(generateZwoXml(sampleDay)).toContain(
      '<IntervalsT Repeat="4" OnDuration="240" OffDuration="240" OnPower="0.98" OffPower="0.50"/>',
    );
  });

  it("mapea cooldown → <Cooldown> con rampa descendente de %FTP", () => {
    expect(generateZwoXml(sampleDay)).toContain(
      '<Cooldown Duration="600" PowerLow="0.65" PowerHigh="0.65"/>',
    );
  });
});
