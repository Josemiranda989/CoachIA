/**
 * Mapeo de la sesión de ciclismo prescrita por CoachIA a una de las colecciones
 * que MyWhoosh ya tiene en su biblioteca (workouts de coaches World Tour).
 *
 * Por qué: usar un workout existente de la library NO consume "slot credits"
 * (a diferencia de subir un .zwo custom). Perdés precisión vs el workout exacto,
 * pero el estímulo del día (zona objetivo) se cubre eligiendo la colección
 * correcta. Para los días de calidad donde la precisión importa, queda el
 * export .zwo (ver generateZwoXml / /api/workouts/export-zwo).
 *
 * Las colecciones y sus promedios salen del catálogo público de MyWhoosh
 * (duración media e IF por categoría). Acá solo necesitamos el nombre de la
 * colección y a qué zona/objetivo corresponde — no la estructura de cada
 * workout (MyWhoosh no la expone por API).
 */

export type MyWhooshCategoryKey =
  | "endurance"
  | "tempo"
  | "sweetspot"
  | "threshold"
  | "vo2max"
  | "anaerobic"
  | "sprint"
  | "testing";

export type MyWhooshSuggestion = {
  key: MyWhooshCategoryKey;
  /** Nombre exacto de la colección como aparece en MyWhoosh. */
  label: string;
  /** Pista de duración para elegir dentro de la colección (ej. "~62 min"). */
  durationHint: string;
  /** Por qué CoachIA sugiere esa colección, para mostrar al usuario. */
  reason: string;
};

const LABELS: Record<MyWhooshCategoryKey, string> = {
  endurance: "Endurance",
  tempo: "Tempo",
  sweetspot: "Sweetspot",
  threshold: "Threshold",
  vo2max: "VO2max",
  anaerobic: "Anaerobic",
  sprint: "Sprint",
  testing: "Testing",
};

/** Bloques que definen el estímulo del día (no las transiciones). */
const WORK_KINDS = new Set(["steady", "interval", "tempo", "sweetspot", "threshold"]);

export type CatalogInputBlock = {
  kind: string;
  targetPower: string;
  notes?: string | null;
};

/** Mayor zona Coggan (Z1-Z7) mencionada en un string. 0 si no hay ninguna. */
function maxZone(text: string): number {
  const zones = [...text.toUpperCase().matchAll(/Z(\d)/g)].map((m) => Number(m[1]));
  return zones.length ? Math.max(...zones) : 0;
}

export function suggestMyWhooshCategory(
  blocks: CatalogInputBlock[],
  opts: { totalDuration?: number } = {},
): MyWhooshSuggestion {
  const haystack = blocks
    .map((b) => `${b.targetPower} ${b.notes ?? ""}`)
    .join(" ")
    .toLowerCase();

  const durationHint = opts.totalDuration ? `~${opts.totalDuration} min` : "duración similar";
  const build = (key: MyWhooshCategoryKey, reason: string): MyWhooshSuggestion => ({
    key,
    label: LABELS[key],
    durationHint,
    reason,
  });

  // 1) Un test de FTP/potencia define el día por encima de la zona.
  if (/\btest\b/.test(haystack)) {
    return build("testing", "El día es un test de potencia/FTP: usá la colección Testing.");
  }

  // 2) Sweet spot suele caer entre zonas, así que lo detectamos por nombre.
  if (/sweet\s?spot/.test(haystack)) {
    return build("sweetspot", "Trabajo en sweet spot (entre tempo y umbral).");
  }

  // 3) Por la zona de mayor intensidad entre los bloques de trabajo.
  const workZone = Math.max(
    0,
    ...blocks
      .filter((b) => WORK_KINDS.has(b.kind.toLowerCase()))
      .map((b) => maxZone(b.targetPower)),
  );

  if (workZone >= 7) return build("sprint", "Esfuerzos neuromusculares (Z7).");
  if (workZone === 6) return build("anaerobic", "Intervalos anaeróbicos (Z6).");
  if (workZone === 5) return build("vo2max", "Intervalos de VO2max (Z5).");
  if (workZone === 4) return build("threshold", "Trabajo en umbral / FTP (Z4).");
  if (workZone === 3) return build("tempo", "Trabajo de tempo (Z3).");
  return build("endurance", "Sesión aeróbica de base (Z1-Z2).");
}
