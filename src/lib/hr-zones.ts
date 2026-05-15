// Resolve "Z1"-"Z7" labels into bpm ranges for the .fit exporter.
//
// Two zone systems supported. LTHR-based (Friel) is preferred when the rider
// has done a threshold test; %FCmax is the practical fallback.
//
// LTHR (Friel cycling) — what most cycling coaches use:
//   Z1: <81% LTHR        Z2: 81-89%        Z3: 90-93%
//   Z4: 94-99%           Z5: 100-102%      Z6: 103-106%      Z7: 107%+
//
// %FCmax — 5-zone, with Z6/Z7 collapsed into the high end since HR lags too
// much to resolve anaerobic/neuromuscular efforts in real time:
//   Z1: 50-60%   Z2: 60-70%   Z3: 70-80%   Z4: 80-90%   Z5: 90-100%
//   Z6: 90-100% (alias of Z5)   Z7: 90-100% (alias of Z5)

export type HrConfig = {
  fcMax?: number | null;
  lthr?: number | null;
};

export type HrRange = { low: number; high: number };

const LTHR_BANDS: Array<{ zone: number; low: number; high: number }> = [
  { zone: 1, low: 0.65, high: 0.81 },
  { zone: 2, low: 0.81, high: 0.89 },
  { zone: 3, low: 0.90, high: 0.93 },
  { zone: 4, low: 0.94, high: 0.99 },
  { zone: 5, low: 1.00, high: 1.02 },
  { zone: 6, low: 1.03, high: 1.06 },
  { zone: 7, low: 1.07, high: 1.15 },
];

const FCMAX_BANDS: Array<{ zone: number; low: number; high: number }> = [
  { zone: 1, low: 0.50, high: 0.60 },
  { zone: 2, low: 0.60, high: 0.70 },
  { zone: 3, low: 0.70, high: 0.80 },
  { zone: 4, low: 0.80, high: 0.90 },
  { zone: 5, low: 0.90, high: 1.00 },
  { zone: 6, low: 0.90, high: 1.00 },
  { zone: 7, low: 0.90, high: 1.00 },
];

export function resolveHrZone(zone: number, hr: HrConfig): HrRange | null {
  if (zone < 1 || zone > 7) return null;
  if (hr.lthr && hr.lthr > 0) {
    const b = LTHR_BANDS.find((x) => x.zone === zone)!;
    return { low: Math.round(hr.lthr * b.low), high: Math.round(hr.lthr * b.high) };
  }
  if (hr.fcMax && hr.fcMax > 0) {
    const b = FCMAX_BANDS.find((x) => x.zone === zone)!;
    return { low: Math.round(hr.fcMax * b.low), high: Math.round(hr.fcMax * b.high) };
  }
  return null;
}

// Build a one-line summary of HR zones to inject into the routine prompt so
// the AI can be aware of what each Z label actually means for THIS rider.
export function hrZonesSummary(hr: HrConfig): string | null {
  const z1 = resolveHrZone(1, hr);
  if (!z1) return null;
  const z2 = resolveHrZone(2, hr)!;
  const z3 = resolveHrZone(3, hr)!;
  const z4 = resolveHrZone(4, hr)!;
  const z5 = resolveHrZone(5, hr)!;
  const basis = hr.lthr ? `LTHR ${hr.lthr} bpm (Friel)` : `FCmax ${hr.fcMax} bpm (%max)`;
  return `Zonas FC (${basis}): Z1 ${z1.low}-${z1.high}, Z2 ${z2.low}-${z2.high}, Z3 ${z3.low}-${z3.high}, Z4 ${z4.low}-${z4.high}, Z5 ${z5.low}-${z5.high} bpm`;
}
