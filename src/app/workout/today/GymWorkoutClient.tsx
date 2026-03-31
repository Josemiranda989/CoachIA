"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

function NumericInput({
  value,
  onChange,
  placeholder,
  step = 1,
  min = 0,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  step?: number;
  min?: number;
}) {
  const num = parseFloat(value) || 0;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, num - step).toString())}
        className="w-10 h-12 flex items-center justify-center rounded-lg text-xl font-bold transition-all active:scale-95"
        style={{
          background: "rgba(245,158,11,0.15)",
          color: "var(--accent-gym)",
          border: "1px solid rgba(245,158,11,0.3)",
        }}
        aria-label={`Reducir ${placeholder}`}
      >
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input text-center font-bold text-lg"
        style={{ width: "72px", height: "48px", padding: "4px 8px" }}
      />
      <button
        type="button"
        onClick={() => onChange((num + step).toString())}
        className="w-10 h-12 flex items-center justify-center rounded-lg text-xl font-bold transition-all active:scale-95"
        style={{
          background: "rgba(245,158,11,0.15)",
          color: "var(--accent-gym)",
          border: "1px solid rgba(245,158,11,0.3)",
        }}
        aria-label={`Aumentar ${placeholder}`}
      >
        +
      </button>
    </div>
  );
}

export function GymWorkoutClient({ workout }: { workout: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [logs, setLogs] = useState<Record<string, { reps: string; weight: string }>>(() => {
    const initial: Record<string, { reps: string; weight: string }> = {};
    workout.exercises.forEach((ex: any) => {
      const defaultReps = ex.targetReps?.match(/\d+/)?.[0] || "";
      const defaultWeight = ex.lastWeight ? ex.lastWeight.toString() : "";
      for (let i = 1; i <= ex.targetSets; i++) {
        initial[`${ex.id}_${i}`] = { reps: defaultReps, weight: defaultWeight };
      }
    });
    return initial;
  });

  const handleChange = (exeId: string, setNum: number, field: string, value: string) => {
    const key = `${exeId}_${setNum}`;
    setLogs((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const logsArray = Object.entries(logs)
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
      router.refresh();
      alert("¡Entrenamiento guardado!");
    } catch {
      alert("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const totalSets = workout.exercises.reduce((acc: number, ex: any) => acc + ex.targetSets, 0);

  return (
    <div className="pb-24 md:pb-0">
      {/* Resumen rápido */}
      <div
        className="flex gap-4 text-sm mb-6 px-4 py-3 rounded-xl"
        style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
      >
        <span style={{ color: "var(--text-secondary)" }}>
          <span style={{ color: "var(--accent-gym)", fontWeight: 700 }}>{workout.exercises.length}</span> ejercicios
        </span>
        <span style={{ color: "var(--text-secondary)" }}>·</span>
        <span style={{ color: "var(--text-secondary)" }}>
          <span style={{ color: "var(--accent-gym)", fontWeight: 700 }}>{totalSets}</span> series totales
        </span>
      </div>

      {workout.exercises.map((exe: any, idx: number) => (
        <div
          key={exe.id}
          className="card mb-4"
          style={{ cursor: "default" }}
        >
          {/* Cabecera del ejercicio */}
          <div className="flex items-start justify-between mb-1">
            <h3 style={{ fontSize: "18px", color: "var(--accent-gym)", fontWeight: 700 }}>{exe.name}</h3>
            <span
              className="text-xs font-bold px-2 py-1 rounded-full shrink-0 ml-2"
              style={{ background: "rgba(245,158,11,0.15)", color: "var(--accent-gym)" }}
            >
              {idx + 1}/{workout.exercises.length}
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "16px" }}>
            {exe.targetSets} sets × {exe.targetReps || "?"} reps
            {exe.lastWeight ? (
              <span style={{ marginLeft: "8px", color: "var(--accent-gym)", opacity: 0.7 }}>
                · última vez {exe.lastWeight} kg
              </span>
            ) : null}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {Array.from({ length: exe.targetSets }).map((_, i) => {
              const setNum = i + 1;
              const existingLog = exe.logs?.find((l: any) => l.setNumber === setNum);

              if (existingLog) {
                return (
                  <div
                    key={setNum}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl"
                    style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}
                  >
                    <CheckCircle2 size={18} style={{ color: "var(--accent-cycling)", flexShrink: 0 }} />
                    <span style={{ color: "var(--text-secondary)", fontSize: "13px", width: "50px" }}>
                      Set {setNum}
                    </span>
                    <span style={{ color: "var(--accent-cycling)", fontWeight: 700 }}>
                      {existingLog.weight} kg × {existingLog.reps} reps
                    </span>
                  </div>
                );
              }

              return (
                <div key={setNum} className="flex items-center gap-3">
                  <span
                    className="text-sm font-semibold shrink-0"
                    style={{ color: "var(--text-secondary)", width: "50px" }}
                  >
                    Set {setNum}
                  </span>
                  <NumericInput
                    value={logs[`${exe.id}_${setNum}`]?.weight || ""}
                    onChange={(v) => handleChange(exe.id, setNum, "weight", v)}
                    placeholder="kg"
                    step={2.5}
                  />
                  <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>×</span>
                  <NumericInput
                    value={logs[`${exe.id}_${setNum}`]?.reps || ""}
                    onChange={(v) => handleChange(exe.id, setNum, "reps", v)}
                    placeholder="reps"
                    step={1}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Botón guardar visible en desktop */}
      <button
        className="btn hidden md:flex w-full items-center justify-center gap-2 mt-4"
        style={{ backgroundColor: "var(--accent-gym)" }}
        onClick={handleSave}
        disabled={loading}
      >
        {loading ? "Guardando..." : "Guardar Sesión"}
      </button>

      {/* FAB fijo en mobile */}
      <div
        className="md:hidden fixed left-0 right-0 z-40 px-4 pb-2"
        style={{ bottom: "72px" }}
      >
        <button
          className="btn w-full flex items-center justify-center gap-2 shadow-2xl"
          style={{ backgroundColor: "var(--accent-gym)", height: "56px", fontSize: "16px", boxShadow: "0 8px 32px rgba(245,158,11,0.4)" }}
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Guardando..." : "💾 Guardar Sesión"}
        </button>
      </div>
    </div>
  );
}
