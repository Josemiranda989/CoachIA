"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Timer,
  Trophy,
  Dumbbell,
} from "lucide-react";
import type {
  DayWithLogs,
  ExerciseWithLogs,
} from "@/lib/queries/getActiveRoutine";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SetLog {
  reps: string;
  weight: string;
  done: boolean;
}

type Exercise = ExerciseWithLogs & { lastWeight?: number };

export type GymWorkoutData = Omit<DayWithLogs, "exercises"> & {
  completed: boolean;
  exercises: Exercise[];
};

/* ------------------------------------------------------------------ */
/*  NumericInput                                                       */
/* ------------------------------------------------------------------ */

function NumericInput({
  value,
  onChange,
  placeholder,
  label,
  step = 1,
  min = 0,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label?: string;
  step?: number;
  min?: number;
  disabled?: boolean;
}) {
  const num = parseFloat(value) || 0;
  return (
    <div className="flex items-center gap-1">
      {label && (
        <span
          className="text-xs font-semibold shrink-0 text-text-secondary"
          style={{ minWidth: "20px" }}
        >
          {label}
        </span>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(Math.max(min, num - step).toString())}
        className="shrink-0 flex items-center justify-center rounded-lg text-base font-bold transition-all active:scale-95"
        style={{
          width: 36,
          height: 48,
          background: "color-mix(in srgb, var(--accent-gym) 15%, transparent)",
          color: "var(--accent-gym)",
          border: "1px solid color-mix(in srgb, var(--accent-gym) 30%, transparent)",
          opacity: disabled ? 0.4 : 1,
        }}
        aria-label={`Reducir ${placeholder}`}
      >
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input text-center font-bold"
        style={{
          width: "56px",
          height: "48px",
          padding: "4px 2px",
          fontSize: "17px",
          opacity: disabled ? 0.4 : 1,
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange((num + step).toString())}
        className="shrink-0 flex items-center justify-center rounded-lg text-base font-bold transition-all active:scale-95"
        style={{
          width: 36,
          height: 48,
          background: "color-mix(in srgb, var(--accent-gym) 15%, transparent)",
          color: "var(--accent-gym)",
          border: "1px solid color-mix(in srgb, var(--accent-gym) 30%, transparent)",
          opacity: disabled ? 0.4 : 1,
        }}
        aria-label={`Aumentar ${placeholder}`}
      >
        +
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  RestTimer                                                          */
/* ------------------------------------------------------------------ */

function RestTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (left <= 0) {
      onDone();
      return;
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, onDone]);

  const mins = Math.floor(left / 60);
  const secs = left % 60;
  const pct = ((seconds - left) / seconds) * 100;

  return (
    <div
      className="flex flex-col items-center gap-3 py-6 rounded-2xl"
      style={{
        background: "color-mix(in srgb, var(--accent-gym) 6%, transparent)",
        border: "1px solid color-mix(in srgb, var(--accent-gym) 15%, transparent)",
      }}
    >
      <Timer size={24} style={{ color: "var(--accent-gym)" }} />
      <span className="text-xs uppercase font-bold tracking-widest text-text-secondary">
        Descanso
      </span>
      <span style={{ fontSize: "48px", fontWeight: 900, color: "var(--accent-gym)", lineHeight: 1 }}>
        {mins}:{secs.toString().padStart(2, "0")}
      </span>
      {/* Progress ring */}
      <div style={{ width: "100%", maxWidth: 200, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 2,
            background: "var(--accent-gym)",
            transition: "width 1s linear",
          }}
        />
      </div>
      <button
        onClick={onDone}
        className="text-xs font-semibold mt-1 px-4 py-2 rounded-lg transition-all active:scale-95"
        style={{
          color: "var(--accent-gym)",
          background: "color-mix(in srgb, var(--accent-gym) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--accent-gym) 25%, transparent)",
        }}
      >
        Saltar
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  WorkoutComplete                                                    */
/* ------------------------------------------------------------------ */

function WorkoutComplete({ totalSets, onSave, loading }: { totalSets: number; onSave: () => void; loading: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: 80,
          height: 80,
          background: "color-mix(in srgb, var(--accent-cycling) 15%, transparent)",
          border: "2px solid var(--accent-cycling)",
        }}
      >
        <Trophy size={40} style={{ color: "var(--accent-cycling)" }} />
      </div>
      <h2 className="text-text-primary" style={{ fontSize: 24, fontWeight: 800 }}>
        Sesión Completa
      </h2>
      <p className="text-text-secondary" style={{ fontSize: 14 }}>
        {totalSets} series completadas
      </p>
      <button
        className="btn w-full max-w-xs flex items-center justify-center gap-2 mt-4"
        style={{ backgroundColor: "var(--accent-gym)", height: 56, fontSize: 16 }}
        onClick={onSave}
        disabled={loading}
      >
        {loading ? "Guardando..." : "Guardar Sesión"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main: GymWorkoutClient                                             */
/* ------------------------------------------------------------------ */

const REST_SECONDS = 90;
const LS_KEY = "coachia-gym-session";

export function GymWorkoutClient({ workout }: { workout: GymWorkoutData }) {
  const router = useRouter();
  const exercises = workout.exercises;
  const [loading, setLoading] = useState(false);
  const [resting, setResting] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  const restDoneRef = useRef<(() => void) | undefined>(undefined);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Build initial logs state: restore from localStorage if same workout, else from server
  const [logs, setLogs] = useState<Record<string, SetLog>>(() => {
    // Try to restore from localStorage
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.workoutId === workout.id && parsed.logs) {
          return parsed.logs;
        }
      }
    } catch { /* ignore */ }

    // Build from server data. Existing WorkoutLog rows are used ONLY as suggestions
    // (prefill reps/weight from the most recent log for that set, if any). They never
    // arrive marked as done, because WorkoutLog has no week identifier — a "done" set
    // from a previous week would otherwise pollute the current session view.
    const initial: Record<string, SetLog> = {};
    exercises.forEach((ex) => {
      const defaultReps = ex.targetReps?.match(/\d+/)?.[0] || "";
      const defaultWeight = ex.lastWeight ? ex.lastWeight.toString() : "";
      for (let i = 1; i <= ex.targetSets; i++) {
        const key = `${ex.id}_${i}`;
        const existing = ex.logs?.find((l) => l.setNumber === i);
        initial[key] = {
          reps: existing ? existing.reps.toString() : defaultReps,
          weight: existing ? existing.weight.toString() : defaultWeight,
          done: false,
        };
      }
    });
    return initial;
  });

  // Start at the first incomplete exercise — computed once at mount via initializer (no derived useEffect)
  const [exIdx, setExIdx] = useState(() => {
    const firstIncomplete = exercises.findIndex((ex) => {
      for (let i = 1; i <= ex.targetSets; i++) {
        const log = logs[`${ex.id}_${i}`];
        if (!log?.done) return true;
      }
      return false;
    });
    return firstIncomplete >= 0 ? firstIncomplete : 0;
  });

  // Refs let beforeunload/click listeners read the latest state without remounting on every keystroke.
  const hasUnsavedRef = useRef(false);
  const loadingRef = useRef(false);

  // Persist logs to localStorage and refresh transient flags on every change
  useEffect(() => {
    hasUnsavedRef.current = Object.values(logs).some((l) => l.done);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ workoutId: workout.id, logs }));
    } catch { /* storage full or unavailable */ }
  }, [logs, workout.id]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // Warn before leaving with unsaved data — listener stays mounted for the whole session
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedRef.current && !loadingRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Intercept in-app navigation when there's unsaved data. Always block,
  // capture the target, and let the <dialog> below ask the user. Synchronous
  // preventDefault is required (browser navigates the moment the listener
  // returns), so we cannot await a custom modal here.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!hasUnsavedRef.current) return;
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor || !anchor.href) return;
      const url = new URL(anchor.href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingNav(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  // Open the modal whenever a navigation is pending. Native <dialog> handles
  // focus trap, Escape, and focus return automatically.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (pendingNav && dialog && !dialog.open) {
      dialog.showModal();
    }
  }, [pendingNav]);

  const handleConfirmLeave = () => {
    const target = pendingNav;
    setPendingNav(null);
    dialogRef.current?.close();
    if (target) router.push(target);
  };

  const handleCancelLeave = () => {
    setPendingNav(null);
    dialogRef.current?.close();
  };

  // Track input focus to hide FAB when keyboard is open
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement) setInputFocused(true);
    };
    const onBlur = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement) setInputFocused(false);
    };
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
    };
  }, []);

  const currentEx = exercises[exIdx];
  const nextEx = exercises[exIdx + 1];

  // Find current (first incomplete) set for this exercise
  const currentSetNum = (() => {
    if (!currentEx) return 1;
    for (let i = 1; i <= currentEx.targetSets; i++) {
      if (!logs[`${currentEx.id}_${i}`]?.done) return i;
    }
    return currentEx.targetSets + 1; // all done
  })();

  const allSetsForExDone = currentEx && currentSetNum > currentEx.targetSets;

  // Total progress
  const totalSets = exercises.reduce((a, e) => a + e.targetSets, 0);
  const completedSets = Object.values(logs).filter((l) => l.done).length;
  const allDone = completedSets === totalSets;
  const progressPct = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  const handleChange = (field: "reps" | "weight", value: string) => {
    const key = `${currentEx.id}_${currentSetNum}`;
    setLogs((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleRestDone = useCallback(() => {
    setResting(false);
  }, []);

  // Keep ref updated for RestTimer
  restDoneRef.current = handleRestDone;

  const handleCompleteSet = () => {
    const key = `${currentEx.id}_${currentSetNum}`;
    setLogs((prev) => ({ ...prev, [key]: { ...prev[key], done: true } }));

    // Check if this was the last set of this exercise
    const isLastSetOfExercise = currentSetNum >= currentEx.targetSets;

    if (isLastSetOfExercise && nextEx) {
      // Move to next exercise after a brief moment
      setTimeout(() => setExIdx((i) => i + 1), 300);
    } else if (!isLastSetOfExercise) {
      // Start rest timer between sets
      setResting(true);
    }
    // If last set of last exercise → allDone will be true on next render
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const logsArray = Object.entries(logs)
        .filter(([, val]) => val.done)
        .map(([key, val]) => {
          const [exerciseId, setStr] = key.split("_");
          return {
            exerciseId,
            setNumber: parseInt(setStr),
            reps: parseInt(val.reps),
            weight: parseFloat(val.weight),
          };
        })
        .filter((log) => !isNaN(log.reps) && !isNaN(log.weight));

      const res = await fetch("/api/workouts/log-gym", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutId: workout.id, logs: logsArray }),
      });
      if (!res.ok) throw new Error("Error");
      localStorage.removeItem(LS_KEY);
      router.refresh();
      toast.success("Entrenamiento guardado!");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const navGuardDialog = (
    <dialog
      ref={dialogRef}
      className="dialog-card"
      aria-labelledby="unsaved-title"
      aria-describedby="unsaved-desc"
      onClose={() => setPendingNav(null)}
    >
      <h3 id="unsaved-title" className="text-lg font-bold mb-2 text-accent-gym">
        Tenés sets sin guardar
      </h3>
      <p id="unsaved-desc" className="text-sm text-text-secondary mb-5">
        Si salís ahora vas a perder los sets que cargaste pero no guardaste.
      </p>
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleCancelLeave}
          autoFocus
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn"
          onClick={handleConfirmLeave}
        >
          Salir igual
        </button>
      </div>
    </dialog>
  );

  /* ---- Render: all done ---- */
  if (allDone) {
    return (
      <>
        <div>
          <ProgressBar pct={100} completed={completedSets} total={totalSets} />
          <WorkoutComplete totalSets={totalSets} onSave={handleSave} loading={loading} />
        </div>
        {navGuardDialog}
      </>
    );
  }

  if (!currentEx) return navGuardDialog;

  const currentLog = logs[`${currentEx.id}_${currentSetNum}`];

  return (
    <>
    <div className="pb-24 md:pb-0">
      {/* Global progress */}
      <ProgressBar pct={progressPct} completed={completedSets} total={totalSets} />

      {/* Exercise navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setExIdx((i) => Math.max(0, i - 1))}
          disabled={exIdx === 0}
          className="flex items-center justify-center rounded-xl transition-all active:scale-95"
          style={{
            width: 40,
            height: 40,
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            color: exIdx === 0 ? "var(--glass-border)" : "var(--text-primary)",
          }}
          aria-label="Ejercicio anterior"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">
          Ejercicio {exIdx + 1} de {exercises.length}
        </span>
        <button
          onClick={() => setExIdx((i) => Math.min(exercises.length - 1, i + 1))}
          disabled={exIdx === exercises.length - 1}
          className="flex items-center justify-center rounded-xl transition-all active:scale-95"
          style={{
            width: 40,
            height: 40,
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            color: exIdx === exercises.length - 1 ? "var(--glass-border)" : "var(--text-primary)",
          }}
          aria-label="Ejercicio siguiente"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Current exercise card */}
      <div className="card mb-4" style={{ cursor: "default" }}>
        {/* Exercise header */}
        <div className="flex items-center gap-3 mb-1">
          <Dumbbell size={20} style={{ color: "var(--accent-gym)" }} />
          <h2 className="text-text-primary" style={{ fontSize: 22, fontWeight: 800 }}>
            {currentEx.name}
          </h2>
        </div>
        <p className="text-text-secondary" style={{ fontSize: 13, marginBottom: 20 }}>
          {currentEx.targetSets} series × {currentEx.targetReps || "?"} reps
          {currentEx.lastWeight ? (
            <span style={{ marginLeft: 8, color: "var(--accent-gym)", opacity: 0.7 }}>
              · última vez {currentEx.lastWeight} kg
            </span>
          ) : null}
        </p>

        {/* Completed sets summary */}
        {currentSetNum > 1 && (
          <div className="flex flex-col gap-2 mb-4">
            {Array.from({ length: currentSetNum - 1 }).map((_, i) => {
              const sn = i + 1;
              const log = logs[`${currentEx.id}_${sn}`];
              if (!log?.done) return null;
              return (
                <div
                  key={sn}
                  className="flex items-center gap-3 px-4 py-2 rounded-xl"
                  style={{
                    background: "color-mix(in srgb, var(--accent-cycling) 8%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--accent-cycling) 20%, transparent)",
                  }}
                >
                  <CheckCircle2 size={16} style={{ color: "var(--accent-cycling)", flexShrink: 0 }} />
                  <span className="text-text-secondary" style={{ fontSize: 13 }}>Set {sn}</span>
                  <span style={{ color: "var(--accent-cycling)", fontWeight: 700, fontSize: 14 }}>
                    {log.weight} kg × {log.reps}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Rest timer */}
        {resting && (
          <div className="mb-4">
            <RestTimer seconds={REST_SECONDS} onDone={handleRestDone} />
          </div>
        )}

        {/* Current set input — or all sets done message */}
        {allSetsForExDone ? (
          <div
            className="flex flex-col items-center gap-2 py-6 rounded-2xl"
            style={{
              background: "color-mix(in srgb, var(--accent-cycling) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent-cycling) 20%, transparent)",
            }}
          >
            <CheckCircle2 size={32} style={{ color: "var(--accent-cycling)" }} />
            <span style={{ color: "var(--accent-cycling)", fontWeight: 700, fontSize: 16 }}>
              Ejercicio completo
            </span>
            {nextEx && (
              <button
                onClick={() => setExIdx((i) => i + 1)}
                className="btn mt-2"
                style={{ backgroundColor: "var(--accent-gym)", fontSize: 14, padding: "10px 24px" }}
              >
                Ir a {nextEx.name}
              </button>
            )}
          </div>
        ) : !resting ? (
          <div
            className="rounded-2xl p-4"
            style={{
              background: "color-mix(in srgb, var(--accent-gym) 6%, transparent)",
              border: "2px solid color-mix(in srgb, var(--accent-gym) 30%, transparent)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <span style={{ color: "var(--accent-gym)", fontWeight: 800, fontSize: 16 }}>
                Set {currentSetNum} de {currentEx.targetSets}
              </span>
              <span className="text-xs text-text-secondary">
                Objetivo: {currentEx.targetReps} reps
              </span>
            </div>

            <div className="flex items-center gap-3 justify-center flex-wrap">
              <NumericInput
                value={currentLog?.weight || ""}
                onChange={(v) => handleChange("weight", v)}
                placeholder="kg"
                label="kg"
                step={2.5}
              />
              <span className="text-text-secondary" style={{ fontSize: 14, fontWeight: 700 }}>×</span>
              <NumericInput
                value={currentLog?.reps || ""}
                onChange={(v) => handleChange("reps", v)}
                placeholder="reps"
                label=""
                step={1}
              />
            </div>

            {/* Complete set button */}
            <button
              onClick={handleCompleteSet}
              className="btn w-full mt-4 flex items-center justify-center gap-2"
              style={{
                backgroundColor: "var(--accent-gym)",
                height: 52,
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              <CheckCircle2 size={20} />
              Completar Set
            </button>
          </div>
        ) : null}
      </div>

      {/* Next up preview */}
      {nextEx && !allSetsForExDone && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
          }}
        >
          <span className="text-xs uppercase font-bold text-text-secondary">
            Siguiente:
          </span>
          <span className="text-sm text-text-primary">
            {nextEx.name}
          </span>
          <span className="text-xs text-text-secondary">
            {nextEx.targetSets}×{nextEx.targetReps}
          </span>
        </div>
      )}

      {/* Floating save button — hidden when keyboard is open */}
      {completedSets > 0 && !inputFocused && (
        <div className="md:hidden fixed left-0 right-0 z-40 px-4 pb-2" style={{ bottom: 72 }}>
          <button
            className="btn w-full flex items-center justify-center gap-2 shadow-2xl"
            style={{
              backgroundColor: "var(--accent-gym)",
              height: 56,
              fontSize: 16,
              boxShadow: "0 8px 32px rgba(245,158,11,0.4)",
            }}
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "Guardando..." : `Guardar (${completedSets}/${totalSets})`}
          </button>
        </div>
      )}

      {/* Desktop save */}
      {completedSets > 0 && (
        <button
          className="btn hidden md:flex w-full items-center justify-center gap-2 mt-4"
          style={{ backgroundColor: "var(--accent-gym)" }}
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Guardando..." : `Guardar Sesión (${completedSets}/${totalSets})`}
        </button>
      )}
    </div>
    {navGuardDialog}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  ProgressBar                                                        */
/* ------------------------------------------------------------------ */

function ProgressBar({ pct, completed, total }: { pct: number; completed: number; total: number }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">
          Progreso
        </span>
        <span className="text-xs font-bold" style={{ color: "var(--accent-gym)" }}>
          {completed}/{total} series
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 3,
            background: "var(--accent-gym)",
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}
