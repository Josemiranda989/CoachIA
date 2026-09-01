// Estrategia de pacing para una carrera de resistencia larga (ultra/gravel/
// fondo), en base a cuartiles de distancia. No hay perfil de elevación
// (GPX) disponible, así que esto NO es una tabla real por kilómetro — es una
// guía de %FTP objetivo por tramo, pensada para no explotar en carreras de
// varias horas. Las subidas se manejan por percepción de esfuerzo, no por
// el %FTP de la tabla (ver `climbingNote`).

export type PacingSegment = {
  fromPct: number; // 0-100, inicio del tramo como % de la distancia total
  toPct: number;
  fromKm: number;
  toKm: number;
  pctFtpLow: number;
  pctFtpHigh: number;
  wattsLow: number;
  wattsHigh: number;
  zone: string;
  guidance: string;
};

const SEGMENTS: Array<{ fromPct: number; toPct: number; pctFtpLow: number; pctFtpHigh: number; zone: string; guidance: string }> = [
  {
    fromPct: 0, toPct: 25, pctFtpLow: 0.60, pctFtpHigh: 0.65, zone: "Z2 bajo",
    guidance: "Vas a sentir que podés ir más rápido. No lo hagas — esta energía la necesitás después.",
  },
  {
    fromPct: 25, toPct: 50, pctFtpLow: 0.63, pctFtpHigh: 0.68, zone: "Z2",
    guidance: "Asentate en tu ritmo real. Empezá a fuelear con constancia, antes de sentir hambre o sed.",
  },
  {
    fromPct: 50, toPct: 75, pctFtpLow: 0.60, pctFtpHigh: 0.66, zone: "Z2",
    guidance: "Acá se gana o se pierde la carrera. Si el cuerpo pide bajar el ritmo, bajalo — prioridad: no explotar.",
  },
  {
    fromPct: 75, toPct: 100, pctFtpLow: 0.55, pctFtpHigh: 0.70, zone: "Z1-Z2",
    guidance: "Si las piernas responden, subí el ritmo (negative split). Si no, sostené Z2 bajo — terminar entero es mejor que forzar.",
  },
];

export function buildPacingPlan(params: {
  distanceKm: number;
  elevationM: number | null;
  ftp: number;
}): PacingSegment[] {
  const { distanceKm, ftp } = params;
  return SEGMENTS.map((s) => ({
    fromPct: s.fromPct,
    toPct: s.toPct,
    fromKm: Math.round((distanceKm * s.fromPct) / 100),
    toKm: Math.round((distanceKm * s.toPct) / 100),
    pctFtpLow: Math.round(s.pctFtpLow * 100),
    pctFtpHigh: Math.round(s.pctFtpHigh * 100),
    wattsLow: Math.round(ftp * s.pctFtpLow),
    wattsHigh: Math.round(ftp * s.pctFtpHigh),
    zone: s.zone,
    guidance: s.guidance,
  }));
}

// m/km de desnivel a partir de los cuales la carrera tiene subidas
// significativas que ameritan pacear por esfuerzo y no por potencia de tabla.
const CLIMBING_THRESHOLD_M_PER_KM = 12;

export function climbingNote(distanceKm: number, elevationM: number | null): string | null {
  if (!elevationM || elevationM <= 0) return null;
  const ratio = elevationM / distanceKm;
  if (ratio < CLIMBING_THRESHOLD_M_PER_KM) return null;
  return `Esta carrera tiene ${Math.round(ratio)}m de desnivel por km — hay subidas serias. En las subidas largas, ignorá el %FTP de la tabla: andá por percepción de esfuerzo sostenible, máximo Z3, nunca Z4 o más. Recuperá en las bajadas y en el llano antes de la próxima subida.`;
}
