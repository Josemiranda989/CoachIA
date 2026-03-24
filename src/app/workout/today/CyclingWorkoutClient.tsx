"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function CyclingWorkoutClient({ workout }: { workout: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [actualDuration, setActualDuration] = useState(workout.actualDuration || "");
  const [distance, setDistance] = useState(workout.distance || "");
  const [averageHeartRate, setAverageHeartRate] = useState(workout.averageHeartRate || "");

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workouts/log-cycling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          workoutId: workout.id, 
          actualDuration: parseInt(actualDuration),
          distance: parseFloat(distance),
          averageHeartRate: parseInt(averageHeartRate)
        })
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
    <div className="card" style={{ backgroundColor: "var(--bg-card)" }}>
      <h3 style={{ fontSize: "18px", marginBottom: "8px", color: "var(--accent-cycling)" }}>
        Objetivo: {workout.targetDuration} min - {workout.targetPower}
      </h3>
      
      <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "8px", color: "var(--text-secondary)" }}>
            Duración Real (minutos)
          </label>
          <input 
            className="input" 
            type="number" 
            value={actualDuration}
            onChange={(e) => setActualDuration(e.target.value)}
          />
        </div>
        
        <div>
          <label style={{ display: "block", marginBottom: "8px", color: "var(--text-secondary)" }}>
            Distancia (km)
          </label>
          <input 
            className="input" 
            type="number" 
            step="0.1"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
          />
        </div>
        
        <div>
          <label style={{ display: "block", marginBottom: "8px", color: "var(--text-secondary)" }}>
            Frecuencia Cardíaca Promedio (bpm)
          </label>
          <input 
            className="input" 
            type="number" 
            value={averageHeartRate}
            onChange={(e) => setAverageHeartRate(e.target.value)}
          />
        </div>
      </div>

      <button className="btn" style={{ width: "100%", marginTop: "24px", backgroundColor: "var(--accent-cycling)" }} onClick={handleSave} disabled={loading}>
        {loading ? "Guardando..." : "Guardar Resultados"}
      </button>
    </div>
  );
}
