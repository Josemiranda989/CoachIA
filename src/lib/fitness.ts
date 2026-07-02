// ─── TSS Estimation ─────────────────────────────────────────────────────────

/**
 * Estimates TSS for activities that don't have it from Strava.
 * Uses TRIMP-derived method based on HR zones.
 * Returns null if no HR data available.
 */
export function estimateTSS(
  movingTimeSecs: number,
  avgHR: number | null,
  maxHR: number,
  lthr: number
): number | null {
  if (avgHR == null || maxHR <= 0 || lthr <= 0) return null;

  const durationHours = movingTimeSecs / 3600;
  const hrReserve = (avgHR - 60) / (maxHR - 60);

  // TRIMP exponential weighting
  const trimp =
    durationHours * 60 * hrReserve * 0.64 * Math.exp(1.92 * hrReserve);

  // Normalize: assume 100 TSS ≈ 1h at threshold
  const thresholdHRReserve = (lthr - 60) / (maxHR - 60);
  const thresholdTRIMP =
    60 * thresholdHRReserve * 0.64 * Math.exp(1.92 * thresholdHRReserve);

  if (thresholdTRIMP <= 0) return null;

  return Math.round((trimp / thresholdTRIMP) * 100);
}

// ─── CTL / ATL / TSB ────────────────────────────────────────────────────────

export interface FitnessPoint {
  date: string; // YYYY-MM-DD
  ctl: number; // Chronic Training Load (Fitness)
  atl: number; // Acute Training Load (Fatigue)
  tsb: number; // Training Stress Balance (Form)
  tss: number; // TSS accumulated that day
}

/**
 * Calculates the complete Fitness & Freshness time series.
 * CTL (Fitness) = 42-day EMA of daily TSS
 * ATL (Fatigue) = 7-day EMA of daily TSS
 * TSB (Form)    = CTL - ATL
 */
export function calculateFitnessHistory(
  dailyTSS: Map<string, number>,
  startDate: Date,
  endDate: Date
): FitnessPoint[] {
  // Build full date range
  const allDates: string[] = [];
  const d = new Date(startDate);
  while (d <= endDate) {
    allDates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }

  if (allDates.length === 0) return [];

  // EMA calculation
  const ctlK = 2 / (42 + 1); // 42-day EMA factor
  const atlK = 2 / (7 + 1); // 7-day EMA factor

  let ctl = 0;
  let atl = 0;
  const points: FitnessPoint[] = [];

  for (const date of allDates) {
    const tss = dailyTSS.get(date) ?? 0;
    ctl = ctl + ctlK * (tss - ctl);
    atl = atl + atlK * (tss - atl);
    points.push({
      date,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round((ctl - atl) * 10) / 10,
      tss,
    });
  }

  return points;
}

// ─── HR Zones ───────────────────────────────────────────────────────────────

export interface ZoneDef {
  zone: number;
  name: string;
  color: string;
  minPct: number;
  maxPct: number;
}

export const HR_ZONE_DEFS: ZoneDef[] = [
  { zone: 1, name: "Recovery", color: "#22c55e", minPct: 0, maxPct: 0.6 },
  { zone: 2, name: "Aerobic", color: "#84cc16", minPct: 0.6, maxPct: 0.7 },
  { zone: 3, name: "Tempo", color: "#eab308", minPct: 0.7, maxPct: 0.8 },
  { zone: 4, name: "Threshold", color: "#f97316", minPct: 0.8, maxPct: 0.9 },
  { zone: 5, name: "VO2max", color: "#ef4444", minPct: 0.9, maxPct: 1.0 },
];

export function getZoneBPM(
  maxHR: number
): { zone: number; low: number; high: number }[] {
  return HR_ZONE_DEFS.map((z, i) => ({
    zone: z.zone,
    low: Math.round(maxHR * z.minPct),
    high:
      i === HR_ZONE_DEFS.length - 1
        ? maxHR
        : Math.round(maxHR * z.maxPct),
  }));
}

export function hrZoneForBPM(bpm: number, maxHR: number): number {
  const pct = bpm / maxHR;
  for (let i = HR_ZONE_DEFS.length - 1; i >= 0; i--) {
    if (pct >= HR_ZONE_DEFS[i].minPct) return i + 1;
  }
  return 1;
}
