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
    <div className={`card mb-4 transition-opacity ${completed ? 'opacity-60' : 'opacity-100'}`}>
      <div className="flex justify-between items-start mb-3 flex-wrap gap-3">
        <h2 className={`text-xl ${isRest ? 'text-text-secondary' : 'text-text-primary'} min-w-[120px]`}>
          {day.dayOfWeek}
        </h2>
        
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium" style={{ color: creatine ? 'var(--accent-gym)' : 'var(--text-secondary)' }}>
            <input 
              type="checkbox" 
              checked={creatine} 
              onChange={() => toggleField("creatineTaken", creatine)}
              disabled={loading}
              className="w-4 h-4 accent-current cursor-pointer"
              aria-label={`Marcar creatina tomada para ${day.dayOfWeek}`}
            />
            Creatina
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium" style={{ color: completed ? 'var(--accent-cycling)' : 'var(--text-secondary)' }}>
            <input 
              type="checkbox" 
              checked={completed} 
              onChange={() => toggleField("completed", completed)}
              disabled={loading}
              className="w-4 h-4 accent-current cursor-pointer"
              aria-label={`${isRest ? 'Marcar recuperado' : 'Marcar finalizado'} para ${day.dayOfWeek}`}
            />
            {isRest ? "Recuperado" : "Finalizado"}
          </label>
        </div>
      </div>

      <p className="font-bold text-accent-primary mb-2">
        {day.type}
      </p>

      {day.notes && (
        <p className="text-text-secondary text-sm italic mb-3">
          "{day.notes}"
        </p>
      )}

      {!isRest && (
        <div className="flex flex-col gap-3">
          {hasGym && day.exercises?.length > 0 && (
            <div>
              <strong className="text-accent-gym text-sm">Gym:</strong>
              <ul className="list-none ml-3 text-sm text-text-secondary">
                {day.exercises.map((ex: any) => (
                  <li key={ex.id}>• {ex.name} ({ex.targetSets}x{ex.targetReps || "?"})</li>
                ))}
              </ul>
            </div>
          )}

          {hasCycling && day.targetDuration && (
            <div className="text-sm">
              <strong className="text-accent-cycling">Bici:</strong> {day.targetDuration} min - {day.targetPower}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
