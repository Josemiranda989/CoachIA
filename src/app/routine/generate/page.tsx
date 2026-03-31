"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Dumbbell, Bike, Moon, RotateCcw, Save, Loader2 } from "lucide-react";

const GOALS = [
  { value: "Hipertrofia", label: "Hipertrofia (ganar masa muscular)" },
  { value: "Fuerza", label: "Fuerza (levantar más peso)" },
  { value: "Resistencia", label: "Resistencia (más reps, menos descanso)" },
  { value: "Recomposición corporal", label: "Recomposición corporal (perder grasa, ganar músculo)" },
];

const FOCUS_AREAS = [
  { label: "Pecho", emoji: "💪" },
  { label: "Espalda", emoji: "🔙" },
  { label: "Piernas", emoji: "🦵" },
  { label: "Hombros", emoji: "🏔️" },
  { label: "Brazos", emoji: "💪" },
  { label: "Core", emoji: "⚡" },
  { label: "Glúteos", emoji: "🍑" },
];

type DayType = {
  dayOfWeek: string;
  type: string;
  exercises?: { name: string; targetSets: number; targetReps: string }[];
  targetDuration?: number;
  targetPower?: string;
  notes?: string;
};

type GeneratedRoutine = {
  weekStart: string;
  days: DayType[];
};

const DAY_LABELS: Record<string, string> = {
  Monday: "Lunes",
  Tuesday: "Martes",
  Wednesday: "Miércoles",
  Thursday: "Jueves",
  Friday: "Viernes",
  Saturday: "Sábado",
  Sunday: "Domingo",
};

function DayTypeIcon({ type }: { type: string }) {
  if (type === "Gym") return <Dumbbell size={18} className="text-accent-gym" />;
  if (type === "Cycling") return <Bike size={18} className="text-accent-cycling" />;
  if (type === "Gym + Cycling") return (
    <span className="flex gap-1">
      <Dumbbell size={18} className="text-accent-gym" />
      <Bike size={18} className="text-accent-cycling" />
    </span>
  );
  return <Moon size={18} className="text-text-secondary" />;
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Gym: "bg-accent-gym/20 text-accent-gym border-accent-gym/30",
    Cycling: "bg-accent-cycling/20 text-accent-cycling border-accent-cycling/30",
    Rest: "bg-glass-bg text-text-secondary border-glass-border",
    "Gym + Cycling": "bg-accent-primary/20 text-accent-primary border-accent-primary/30",
  };
  return (
    <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${colors[type] || colors.Rest}`}>
      {type}
    </span>
  );
}

export default function GenerateRoutinePage() {
  const router = useRouter();
  const [goal, setGoal] = useState("Hipertrofia");
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [cyclingDays, setCyclingDays] = useState(2);
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routine, setRoutine] = useState<GeneratedRoutine | null>(null);

  const toggleFocus = (label: string) => {
    setFocusAreas((prev) =>
      prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label]
    );
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setRoutine(null);
    try {
      const res = await fetch("/api/routines/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, daysPerWeek, cyclingDays, focusAreas, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar");
      setRoutine(data);
    } catch (err: any) {
      setError(err.message || "Error al conectar con Gemini");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!routine) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(routine),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      router.push("/workout/today");
    } catch (err: any) {
      setError(err.message || "Error al guardar la rutina");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-container py-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-accent-primary/20 rounded-xl">
          <Sparkles className="text-accent-primary" size={24} />
        </div>
        <h1 className="title text-3xl md:text-4xl">Generar Rutina con IA</h1>
      </div>
      <p className="subtitle mb-8">Describí tus objetivos y Gemini arma tu semana completa.</p>

      {/* ── Form ── */}
      {!routine && (
        <div className="card" style={{ marginBottom: "24px" }}>
          {/* Goal */}
          <label className="block mb-4">
            <span className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2 block">
              Objetivo principal
            </span>
            <select
              className="input w-full"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            >
              {GOALS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </label>

          {/* Days grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <label className="block">
              <span className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2 block">
                Días de Gym
              </span>
              <select className="input w-full" value={daysPerWeek} onChange={(e) => setDaysPerWeek(Number(e.target.value))}>
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n} días</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2 block">
                Días de Ciclismo
              </span>
              <select className="input w-full" value={cyclingDays} onChange={(e) => setCyclingDays(Number(e.target.value))}>
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{n} días</option>
                ))}
              </select>
            </label>
          </div>

          {/* Focus areas */}
          <div className="mb-4">
            <span className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3 block">
              Enfoque muscular (opcional)
            </span>
            <div className="flex flex-wrap gap-2">
              {FOCUS_AREAS.map(({ label, emoji }) => {
                const selected = focusAreas.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleFocus(label)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all"
                    style={selected ? {
                      background: "var(--accent-gym)",
                      color: "#000",
                      borderColor: "var(--accent-gym)",
                      boxShadow: "0 0 12px rgba(245,158,11,0.3)",
                    } : {
                      background: "var(--glass-bg)",
                      color: "var(--text-secondary)",
                      borderColor: "var(--glass-border)",
                    }}
                  >
                    <span>{emoji}</span>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <label className="block mb-6">
            <span className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2 block">
              Notas adicionales (opcional)
            </span>
            <textarea
              className="input w-full"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Tengo una lesión en el hombro derecho, prefiero ejercicios con mancuernas..."
              style={{ resize: "vertical", minHeight: "96px", maxHeight: "240px" }}
            />
          </label>

          {error && <p style={{ color: "#ef4444", marginBottom: "16px", fontSize: "14px" }}>{error}</p>}

          <button
            className="btn w-full flex items-center justify-center gap-2"
            style={{ background: "var(--accent-gym)", color: "#000", fontWeight: 700 }}
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Generando con Gemini...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Generar Rutina
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Preview ── */}
      {routine && (
        <>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-text-primary">
                Semana desde {new Date(routine.weekStart).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}
              </h2>
              <div className="flex gap-2 text-xs text-text-secondary">
                <span className="flex items-center gap-1"><Dumbbell size={14} className="text-accent-gym" /> Gym</span>
                <span className="flex items-center gap-1"><Bike size={14} className="text-accent-cycling" /> Bici</span>
                <span className="flex items-center gap-1"><Moon size={14} /> Rest</span>
              </div>
            </div>

            <div className="space-y-4">
              {routine.days.map((day) => (
                <div key={day.dayOfWeek} className="card" style={{ cursor: "default" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <DayTypeIcon type={day.type} />
                      <span className="font-bold text-lg">{DAY_LABELS[day.dayOfWeek] || day.dayOfWeek}</span>
                    </div>
                    <TypeBadge type={day.type} />
                  </div>

                  {/* Gym exercises */}
                  {day.exercises && day.exercises.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {day.exercises.map((ex, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between py-2 px-3 rounded-lg bg-glass-bg"
                        >
                          <span className="text-text-primary font-medium text-sm">{ex.name}</span>
                          <span className="text-text-secondary text-sm font-mono">
                            {ex.targetSets} x {ex.targetReps}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cycling info */}
                  {(day.targetDuration || day.targetPower) && (
                    <div className="mt-3 flex gap-4 text-sm">
                      {day.targetDuration && (
                        <span className="text-accent-cycling font-medium">
                          {day.targetDuration} min
                        </span>
                      )}
                      {day.targetPower && (
                        <span className="text-text-secondary">{day.targetPower}</span>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {day.notes && (
                    <p className="mt-2 text-xs text-text-secondary italic">{day.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && <p style={{ color: "#ef4444", marginBottom: "16px", fontSize: "14px" }}>{error}</p>}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              className="btn flex-1 flex items-center justify-center gap-2"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Guardar Rutina
                </>
              )}
            </button>
            <button
              className="btn btn-secondary flex items-center justify-center gap-2"
              onClick={() => { setRoutine(null); setError(null); }}
              disabled={generating || saving}
            >
              <RotateCcw size={18} />
              Regenerar
            </button>
          </div>
        </>
      )}

      {/* Back */}
      <button
        className="btn btn-secondary mt-6"
        onClick={() => router.push("/")}
      >
        &larr; Volver al Inicio
      </button>
    </div>
  );
}
