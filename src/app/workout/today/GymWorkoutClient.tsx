"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function GymWorkoutClient({ workout }: { workout: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const [logs, setLogs] = useState<Record<string, { reps: string, weight: string }>>(() => {
    const initial: Record<string, { reps: string, weight: string }> = {};
    workout.exercises.forEach((ex: any) => {
      const defaultReps = ex.targetReps?.match(/\d+/)?.[0] || "";
      const defaultWeight = ex.lastWeight ? ex.lastWeight.toString() : "";
      for (let i = 1; i <= ex.targetSets; i++) {
        initial[`${ex.id}_${i}`] = { reps: defaultReps, weight: defaultWeight };
      }
    });
    return initial;
  });

  const handleLogChange = (exeId: string, setNum: number, field: string, value: string) => {
    const key = `${exeId}_${setNum}`;
    setLogs(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const logsArray = Object.entries(logs).map(([key, val]) => {
        const [exerciseId, setStr] = key.split('_');
        return {
          exerciseId,
          setNumber: parseInt(setStr),
          reps: parseInt(val.reps),
          weight: parseFloat(val.weight)
        };
      }).filter(log => !isNaN(log.reps) && !isNaN(log.weight));

      const res = await fetch("/api/workouts/log-gym", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutId: workout.id, logs: logsArray })
      });
      if (!res.ok) throw new Error("Error");
      
      router.refresh();
      alert("¡Entrenamiento guardado!");
    } catch (e) {
      alert("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {workout.exercises.map((exe: any) => (
        <div key={exe.id} className="card" style={{ marginBottom: "16px", cursor: "default", backgroundColor: "var(--bg-card)" }}>
          <h3 style={{ fontSize: "18px", marginBottom: "8px", color: "var(--accent-gym)" }}>{exe.name}</h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: "16px", fontSize: "14px" }}>
            Objetivo: {exe.targetSets} sets x {exe.targetReps || "?"} reps
          </p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {Array.from({ length: exe.targetSets }).map((_, i) => {
              const setNum = i + 1;
              const existingLog = exe.logs?.find((l: any) => l.setNumber === setNum);
              
              if (existingLog) {
                return (
                  <div key={setNum} style={{ display: "flex", gap: "12px", alignItems: "center", padding: "8px 0" }}>
                    <span style={{ width: "60px", color: "var(--text-secondary)" }}>Set {setNum}</span>
                    <span style={{ color: "var(--accent-gym)", fontWeight: "bold" }}>✓ {existingLog.weight}kg x {existingLog.reps} reps</span>
                  </div>
                );
              }

              return (
                <div key={setNum} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ width: "60px", color: "var(--text-secondary)" }}>Set {setNum}</span>
                  <input 
                    className="input" 
                    type="number" 
                    placeholder="kg" 
                    style={{ width: "80px", padding: "8px" }}
                    value={logs[`${exe.id}_${setNum}`]?.weight || ""}
                    onChange={(e) => handleLogChange(exe.id, setNum, "weight", e.target.value)}
                  />
                  <input 
                    className="input" 
                    type="number" 
                    placeholder="reps" 
                    style={{ width: "80px", padding: "8px" }}
                    value={logs[`${exe.id}_${setNum}`]?.reps || ""}
                    onChange={(e) => handleLogChange(exe.id, setNum, "reps", e.target.value)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <button className="btn" style={{ width: "100%", marginTop: "16px", backgroundColor: "var(--accent-gym)" }} onClick={handleSave} disabled={loading}>
        {loading ? "Guardando..." : "Guardar Resultados"}
      </button>
    </div>
  );
}
