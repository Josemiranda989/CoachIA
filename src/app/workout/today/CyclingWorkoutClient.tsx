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
    <div className="pb-24 md:pb-0">
      <div className="card" style={{ cursor: "default" }}>
        <h3 className="text-lg font-bold mb-2" style={{ color: "var(--accent-cycling)" }}>
          Objetivo: {workout.targetDuration} min - {workout.targetPower}
        </h3>

        <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label className="block mb-2 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Duración Real (minutos)
            </label>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              style={{ minHeight: "48px", fontSize: "16px" }}
              value={actualDuration}
              onChange={(e) => setActualDuration(e.target.value)}
            />
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Distancia (km)
            </label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="0.1"
              style={{ minHeight: "48px", fontSize: "16px" }}
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
            />
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Frecuencia Cardíaca Promedio (bpm)
            </label>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              style={{ minHeight: "48px", fontSize: "16px" }}
              value={averageHeartRate}
              onChange={(e) => setAverageHeartRate(e.target.value)}
            />
          </div>
        </div>

        {/* Desktop save button */}
        <button
          className="btn hidden md:flex w-full items-center justify-center gap-2 mt-6"
          style={{ backgroundColor: "var(--accent-cycling)" }}
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Guardando..." : "Guardar Resultados"}
        </button>
      </div>

      {/* FAB fijo en mobile */}
      <div
        className="md:hidden fixed left-0 right-0 z-40 px-4 pb-2"
        style={{ bottom: "72px" }}
      >
        <button
          className="btn w-full flex items-center justify-center gap-2 shadow-2xl"
          style={{ backgroundColor: "var(--accent-cycling)", height: "56px", fontSize: "16px", boxShadow: "0 8px 32px rgba(16,185,129,0.4)" }}
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Guardando..." : "💾 Guardar Resultados"}
        </button>
      </div>
    </div>
  );
}
