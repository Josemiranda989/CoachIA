"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

const DAY_ES: Record<string, string> = {
  Monday: "Lunes",
  Tuesday: "Martes",
  Wednesday: "Miércoles",
  Thursday: "Jueves",
  Friday: "Viernes",
  Saturday: "Sábado",
  Sunday: "Domingo",
};

const TODAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];

export function DayCardClient({ day }: { day: any }) {
  const router = useRouter();
  const [completed, setCompleted] = useState(day.completed || false);
  const [creatine, setCreatine] = useState(day.creatineTaken || false);
  const [loading, setLoading] = useState(false);

  const isToday = day.dayOfWeek === TODAY_EN;
  const [expanded, setExpanded] = useState(isToday);

  const hasGym = (day.exercises?.length ?? 0) > 0;
  const hasCycling = !!day.targetDuration;
  const isRest = !hasGym && !hasCycling;
  const canExpand = !isRest;

  const toggleField = async (field: "completed" | "creatineTaken", currentValue: boolean) => {
    const newValue = !currentValue;
    if (field === "completed") setCompleted(newValue);
    if (field === "creatineTaken") setCreatine(newValue);

    setLoading(true);
    try {
      await fetch("/api/workouts/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutId: day.id, field, value: newValue }),
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

  const dayLabel = DAY_ES[day.dayOfWeek] || day.dayOfWeek;

  const summaryParts: string[] = [];
  if (hasGym) summaryParts.push(`${day.exercises.length} ejercicio${day.exercises.length === 1 ? "" : "s"}`);
  if (hasCycling) summaryParts.push(`${day.targetDuration}min bici`);
  const summary = summaryParts.join(" · ");

  return (
    <div
      className={`card mb-4 transition-opacity ${completed ? "opacity-60" : "opacity-100"}`}
      style={isToday ? {
        border: "1px solid rgba(245,158,11,0.5)",
        boxShadow: "0 0 0 3px rgba(245,158,11,0.1)",
      } : {}}
    >
      <div className="flex justify-between items-start flex-wrap gap-3">
        {/* Left: toggle + day label + summary */}
        <button
          type="button"
          onClick={() => canExpand && setExpanded((v) => !v)}
          disabled={!canExpand}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Colapsar" : "Expandir"} ${dayLabel}`}
          className="flex items-center gap-2 text-left"
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: canExpand ? "pointer" : "default",
            flex: "1 1 auto",
            minWidth: 0,
          }}
        >
          {canExpand && (
            <ChevronDown
              size={18}
              style={{
                transition: "transform 0.2s ease",
                transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
                color: "var(--text-secondary)",
                flexShrink: 0,
              }}
            />
          )}
          {isToday && (
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: "var(--accent-gym)", color: "#000" }}
            >
              Hoy
            </span>
          )}
          <h2 className={`text-xl font-bold ${isRest ? "text-text-secondary" : "text-text-primary"}`}>
            {dayLabel}
          </h2>
          {!expanded && summary && (
            <span className="text-xs text-text-secondary hidden sm:inline">
              · {summary}
            </span>
          )}
        </button>

        {/* Right: checkboxes */}
        <div className="flex gap-5 items-center" onClick={(e) => e.stopPropagation()}>
          <label
            className="flex items-center gap-2 cursor-pointer select-none"
            style={{ color: creatine ? "var(--accent-gym)" : "var(--text-secondary)" }}
          >
            <span className="relative flex items-center justify-center">
              <input
                type="checkbox"
                checked={creatine}
                onChange={() => toggleField("creatineTaken", creatine)}
                disabled={loading}
                className="sr-only"
                aria-label={`Marcar creatina tomada para ${dayLabel}`}
              />
              <span
                className="w-6 h-6 rounded-md flex items-center justify-center transition-all"
                style={{
                  border: `2px solid ${creatine ? "var(--accent-gym)" : "rgba(255,255,255,0.2)"}`,
                  background: creatine ? "var(--accent-gym)" : "transparent",
                  minWidth: "24px",
                }}
              >
                {creatine && <span style={{ color: "#000", fontSize: "13px", fontWeight: 900 }}>✓</span>}
              </span>
            </span>
            <span className="text-sm font-medium">Creatina</span>
          </label>

          <label
            className="flex items-center gap-2 cursor-pointer select-none"
            style={{ color: completed ? "var(--accent-cycling)" : "var(--text-secondary)" }}
          >
            <span className="relative flex items-center justify-center">
              <input
                type="checkbox"
                checked={completed}
                onChange={() => toggleField("completed", completed)}
                disabled={loading}
                className="sr-only"
                aria-label={`${isRest ? "Marcar recuperado" : "Marcar finalizado"} para ${dayLabel}`}
              />
              <span
                className="w-6 h-6 rounded-md flex items-center justify-center transition-all"
                style={{
                  border: `2px solid ${completed ? "var(--accent-cycling)" : "rgba(255,255,255,0.2)"}`,
                  background: completed ? "var(--accent-cycling)" : "transparent",
                  minWidth: "24px",
                }}
              >
                {completed && <span style={{ color: "#fff", fontSize: "13px", fontWeight: 900 }}>✓</span>}
              </span>
            </span>
            <span className="text-sm font-medium">{isRest ? "Recuperado" : "Finalizado"}</span>
          </label>
        </div>
      </div>

      {/* Type label (always visible when not rest) */}
      {!isRest && (
        <p className="font-bold text-accent-primary mt-2 mb-0" style={{ fontSize: 14 }}>
          {day.type}
        </p>
      )}

      {/* Collapsible content */}
      {expanded && !isRest && (
        <div className="mt-3">
          {day.notes && (
            <p className="text-text-secondary text-sm italic mb-3">&ldquo;{day.notes}&rdquo;</p>
          )}

          <div className="flex flex-col gap-3">
            {hasGym && day.exercises?.length > 0 && (
              <div>
                <strong className="text-accent-gym text-sm">Gym:</strong>
                <ul className="list-none ml-3 text-sm text-text-secondary mt-1 space-y-0.5">
                  {day.exercises.map((ex: any) => (
                    <li key={ex.id}>· {ex.name} ({ex.targetSets}×{ex.targetReps || "?"})</li>
                  ))}
                </ul>
              </div>
            )}

            {hasCycling && day.targetDuration && (
              <div className="text-sm">
                <strong className="text-accent-cycling">Bici:</strong>{" "}
                <span className="text-text-secondary">{day.targetDuration} min — {day.targetPower}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
