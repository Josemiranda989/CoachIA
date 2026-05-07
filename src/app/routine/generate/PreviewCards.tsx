import { Dumbbell, Bike, Moon } from "lucide-react";
import { DAY_LABELS, type DayType } from "./constants";

export function DayTypeIcon({ type }: { type: string }) {
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

export function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Gym: "bg-accent-gym-soft text-accent-gym border-accent-gym-soft",
    Cycling: "bg-accent-cycling-soft text-accent-cycling border-accent-cycling-soft",
    Rest: "bg-glass-bg text-text-secondary border-glass-border",
    "Gym + Cycling": "bg-accent-primary-soft text-accent-primary border-accent-primary-soft",
  };
  return (
    <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${colors[type] || colors.Rest}`}>
      {type}
    </span>
  );
}

export function DayPreviewCard({ day }: { day: DayType }) {
  return (
    <div className="card" style={{ cursor: "default" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <DayTypeIcon type={day.type} />
          <span className="font-bold text-lg">{DAY_LABELS[day.dayOfWeek] || day.dayOfWeek}</span>
        </div>
        <TypeBadge type={day.type} />
      </div>

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

      {day.notes && (
        <p className="mt-2 text-xs text-text-secondary italic">{day.notes}</p>
      )}
    </div>
  );
}
