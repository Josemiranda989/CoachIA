/**
 * ERG workout file generator (TrainerRoad / Zwift compatible XML format).
 */

export type Block = {
  kind: string;
  duration: number; // minutes
  targetPower: string; // e.g. "Z1", "Z2", "Z4 (~230W)"
  repetitions?: number | null;
  recoveryDuration?: number | null;
  recoveryPower?: string | null;
  notes?: string | null;
};

export type CyclingDay = {
  dayOfWeek: string;
  weekLabel: string; // "Semana 1" etc
  weekStart: string; // YYYY-MM-DD
  totalDuration: number;
  totalPower: string;
  blocks: Block[];
};

/**
 * Convert a zone string ("Z2", "Z4 (~230W)", "Z1-Z2") to a %FTP fraction.
 */
function zoneToFtpFraction(zone: string): number {
  const z = zone.toUpperCase();
  // Try to extract wattage first: e.g. "Z4 (~230W)"
  const wattMatch = z.match(/~?(\d+)\s*W/i);
  if (wattMatch) {
    const watts = parseInt(wattMatch[1]);
    // Estimate FTP = watts / zoneFactor, then return fraction
    // If ~230W and Z4 (~0.98), FTP ≈ 235
    const zoneFrac = zoneToFtpFraction(z.replace(/\(.*\)/, "").trim());
    // For wattage, we return the fraction directly since the value already has zone context
    // Actually, for ERG format we need %FTP, not raw watts
    // If user says "Z4 (~230W)", the fraction is the zone fraction
    return zoneFrac;
  }

  // Handle ranges like "Z1-Z2"
  if (z.includes("-")) {
    const parts = z.split("-").map((p) => p.trim());
    const first = extractZoneNum(parts[0]);
    const second = extractZoneNum(parts[parts.length - 1]);
    if (first && second) return zoneToFraction((first + second) / 2);
    return 0.65; // safe default
  }

  const zoneNum = extractZoneNum(z);
  if (!zoneNum) {
    // Try common text zone descriptors
    if (z.includes("RECOVERY") || z.includes("REC")) return 0.50;
    if (z.includes("ENDURANCE")) return 0.65;
    if (z.includes("TEMPO")) return 0.83;
    if (z.includes("THRESHOLD")) return 0.98;
    if (z.includes("VO2") || z.includes("VO2MAX")) return 1.13;
    if (z.includes("ANAEROBIC") || z.includes("SPRINT")) return 1.30;
    return 0.65; // default to Z2
  }
  return zoneToFraction(zoneNum);
}

function extractZoneNum(s: string): number | null {
  const m = s.match(/Z(\d+)/i);
  if (m) return parseInt(m[1]);
  return null;
}

function zoneToFraction(zone: number): number {
  // Coggan 7-zone %FTP midpoints
  const map: Record<number, number> = {
    1: 0.50,
    2: 0.65,
    3: 0.83,
    4: 0.98,
    5: 1.13,
    6: 1.30,
    7: 1.50,
  };
  return map[zone] ?? 0.65;
}

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "-").trim();
}

function getDayName(dayOfWeek: string): string {
  const map: Record<string, string> = {
    Monday: "Lunes", Tuesday: "Martes", Wednesday: "Miércoles",
    Thursday: "Jueves", Friday: "Viernes", Saturday: "Sábado", Sunday: "Domingo",
  };
  return map[dayOfWeek] ?? dayOfWeek;
}

/**
 * Generate an .erg file XML string for a single cycling workout.
 */
export function generateErgXml(day: CyclingDay): string {
  const name = `${sanitizeName(getDayName(day.dayOfWeek))} - ${day.totalPower}`;
  const blocksXml = day.blocks.map((b) => blockToErg(b)).join("\n    ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <name>${escXml(name)}</name>
  <description>${escXml(day.weekLabel)} - ${escXml(day.weekStart)} | ${day.totalDuration} min ${day.totalPower}${day.blocks[0]?.notes ? ` | ${escXml(day.blocks[0].notes)}` : ""}</description>
  <author>CoachIA</author>
  <workout>
    ${blocksXml}
  </workout>
</workout_file>`;
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function blockToErg(b: Block): string {
  const durSec = Math.round(b.duration * 60);

  switch (b.kind) {
    case "warmup": {
      const low = zoneToFtpFraction(b.targetPower);
      const high = Math.min(low + 0.15, 0.75);
      return `<Warmup Duration="${durSec}" PowerLow="${low.toFixed(2)}" PowerHigh="${high.toFixed(2)}"/>`;
    }
    case "steady": {
      const power = zoneToFtpFraction(b.targetPower);
      return `<SteadyState Duration="${durSec}" Power="${power.toFixed(2)}"/>`;
    }
    case "interval": {
      const reps = b.repetitions ?? 1;
      const onDurSec = Math.round(b.duration * 60);
      const offDurSec = Math.round((b.recoveryDuration ?? b.duration) * 60);
      const onPower = zoneToFtpFraction(b.targetPower);
      const offPower = zoneToFtpFraction(b.recoveryPower ?? "Z1");
      return `<IntervalsT Repeat="${reps}" OnDuration="${onDurSec}" OffDuration="${offDurSec}" OnPower="${onPower.toFixed(2)}" OffPower="${offPower.toFixed(2)}"/>`;
    }
    case "cooldown": {
      const low = zoneToFtpFraction(b.targetPower);
      const high = Math.min(low + 0.15, 0.65);
      return `<Cooldown Duration="${durSec}" PowerLow="${low.toFixed(2)}" PowerHigh="${high.toFixed(2)}"/>`;
    }
    default: {
      const power = zoneToFtpFraction(b.targetPower);
      return `<SteadyState Duration="${durSec}" Power="${power.toFixed(2)}"/>`;
    }
  }
}

/**
 * Generate a readable .txt summary for a single cycling workout.
 */
export function generateTxtSummary(day: CyclingDay): string {
  const lines: string[] = [];
  lines.push(`═══ ${getDayName(day.dayOfWeek)} ═══`);
  lines.push(`📅 ${day.weekLabel} (desde ${day.weekStart})`);
  lines.push(`⏱ ${day.totalDuration} min — ${day.totalPower}`);
  lines.push("");

  for (const b of day.blocks) {
    const kindLabel: Record<string, string> = {
      warmup: "▸ Calentamiento",
      steady: "▬ Sostenido",
      interval: "⚡ Intervalo",
      cooldown: "▾ Vuelta a la calma",
    };
    const label = kindLabel[b.kind] ?? b.kind;
    if (b.kind === "interval" && b.repetitions) {
      lines.push(`  ${label}: ${b.repetitions}x ${b.duration}min ${b.targetPower}`);
      lines.push(`    Recuperación: ${b.recoveryDuration}min ${b.recoveryPower ?? "Z1"}`);
    } else {
      lines.push(`  ${label}: ${b.duration}min ${b.targetPower}`);
    }
    if (b.notes) lines.push(`    📝 ${b.notes}`);
  }
  lines.push("");
  return lines.join("\n");
}
