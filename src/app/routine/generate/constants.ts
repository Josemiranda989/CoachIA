export const GOALS = [
  { value: "Hipertrofia", label: "Hipertrofia (ganar masa muscular)" },
  { value: "Fuerza", label: "Fuerza (levantar más peso)" },
  { value: "Resistencia", label: "Resistencia (más reps, menos descanso)" },
  { value: "Recomposición corporal", label: "Recomposición corporal (perder grasa, ganar músculo)" },
] as const;

export const FOCUS_AREAS = [
  { label: "Pecho", emoji: "💪" },
  { label: "Espalda", emoji: "🔙" },
  { label: "Piernas", emoji: "🦵" },
  { label: "Hombros", emoji: "🏔️" },
  { label: "Brazos", emoji: "💪" },
  { label: "Core", emoji: "⚡" },
  { label: "Glúteos", emoji: "🍑" },
] as const;

export const DAY_LABELS: Record<string, string> = {
  Monday: "Lunes",
  Tuesday: "Martes",
  Wednesday: "Miércoles",
  Thursday: "Jueves",
  Friday: "Viernes",
  Saturday: "Sábado",
  Sunday: "Domingo",
};

export type DayType = {
  dayOfWeek: string;
  type: string;
  exercises?: { name: string; targetSets: number; targetReps: string }[];
  targetDuration?: number;
  targetPower?: string;
  notes?: string;
};

export type GeneratedRoutine = {
  weekStart: string;
  days: DayType[];
};
