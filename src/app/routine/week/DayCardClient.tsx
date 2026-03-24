"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function DayCardClient({ day }: { day: any }) {
  const router = useRouter();
  const [completed, setCompleted] = useState(day.completed || false);
  const [creatine, setCreatine] = useState(day.creatineTaken || false);
  const [loading, setLoading] = useState(false);

  const toggleField = async (field: "completed" | "creatineTaken", currentValue: boolean) => {
    const newValue = !currentValue;
    if (field === "completed") setCompleted(newValue);
    if (field === "creatineTaken") setCreatine(newValue);
    
    setLoading(true);
    try {
      await fetch("/api/workouts/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutId: day.id, field, value: newValue })
      });
      router.refresh();
    } catch (err) {
      console.error(err);
      if (field === "completed") setCompleted(currentValue);
      if (field === "creatineTaken") setCreatine(currentValue);
    } finally {
      setLoading(false);
    }
  };

  const isRest = day.type.includes("Rest");
  const hasGym = day.type.includes("Gym");
  const hasCycling = day.type.includes("Cycling");

  return (
    <div className="card" style={{ marginBottom: "16px", backgroundColor: "var(--bg-card)", transition: "opacity 0.2s", opacity: completed ? 0.6 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "12px" }}>
        <h2 style={{ fontSize: "20px", color: isRest ? "var(--text-secondary)" : "var(--text-primary)", minWidth: "120px" }}>
          {day.dayOfWeek}
        </h2>
        
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: creatine ? "var(--accent-gym)" : "var(--text-secondary)", fontWeight: creatine ? "bold" : "normal" }}>
            <input 
              type="checkbox" 
              checked={creatine} 
              onChange={() => toggleField("creatineTaken", creatine)}
              disabled={loading}
              style={{ width: "16px", height: "16px", accentColor: "var(--accent-gym)", cursor: "pointer" }}
            />
            Creatina
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: completed ? "var(--accent-cycling)" : "var(--text-secondary)", fontWeight: completed ? "bold" : "normal" }}>
            <input 
              type="checkbox" 
              checked={completed} 
              onChange={() => toggleField("completed", completed)}
              disabled={loading}
              style={{ width: "16px", height: "16px", accentColor: "var(--accent-cycling)", cursor: "pointer" }}
            />
            {isRest ? "Recuperado" : "Finalizado"}
          </label>
        </div>
      </div>

      <p style={{ fontWeight: "bold", color: "var(--accent-primary)", marginBottom: "8px" }}>
        {day.type}
      </p>

      {day.notes && (
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", fontStyle: "italic", marginBottom: "12px" }}>
          &quot;{day.notes}&quot;
        </p>
      )}

      {!isRest && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {hasGym && day.exercises?.length > 0 && (
            <div>
              <strong style={{ color: "var(--accent-gym)", fontSize: "14px" }}>Gym:</strong>
              <ul style={{ listStyleType: "none", margin: 0, paddingLeft: "12px", fontSize: "14px", color: "var(--text-secondary)" }}>
                {day.exercises.map((ex: any) => (
                  <li key={ex.id}>• {ex.name} ({ex.targetSets}x{ex.targetReps || "?"})</li>
                ))}
              </ul>
            </div>
          )}

          {hasCycling && day.targetDuration && (
            <div style={{ fontSize: "14px" }}>
              <strong style={{ color: "var(--accent-cycling)" }}>Bici:</strong> {day.targetDuration} min - {day.targetPower}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
