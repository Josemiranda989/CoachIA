import { CheckCircle2, AlertCircle, Circle, RotateCw, Link2 } from "lucide-react";
import { getSaturdayDrillReport } from "@/lib/queries/getSaturdayDrill";

type Accent = "success" | "warning" | "danger" | "neutral";

const ACCENTS: Record<Accent, { bg: string; border: string; color: string }> = {
  success: {
    bg: "color-mix(in srgb, #10b981 9%, transparent)",
    border: "color-mix(in srgb, #10b981 35%, transparent)",
    color: "#10b981",
  },
  warning: {
    bg: "color-mix(in srgb, var(--accent-gym) 9%, transparent)",
    border: "color-mix(in srgb, var(--accent-gym) 35%, transparent)",
    color: "var(--accent-gym)",
  },
  danger: {
    bg: "color-mix(in srgb, #ef4444 9%, transparent)",
    border: "color-mix(in srgb, #ef4444 35%, transparent)",
    color: "#ef4444",
  },
  neutral: {
    bg: "color-mix(in srgb, var(--accent-cycling) 7%, transparent)",
    border: "color-mix(in srgb, var(--accent-cycling) 25%, transparent)",
    color: "var(--accent-cycling)",
  },
};

type ShellProps = {
  accent: Accent;
  icon: typeof CheckCircle2;
  title: string;
  body: string;
  hint?: string;
};

function CardShell({ accent, icon: Icon, title, body, hint }: ShellProps) {
  const a = ACCENTS[accent];
  return (
    <div
      className="card mb-4"
      style={{ background: a.bg, borderColor: a.border, padding: 14 }}
    >
      <div className="flex items-center gap-3">
        <div
          className="p-2 rounded-xl flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${a.color} 18%, transparent)` }}
        >
          <Icon size={20} style={{ color: a.color }} aria-hidden="true" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm" style={{ color: a.color }}>
            {title}
          </p>
          <p style={{ color: "var(--text-primary)", fontSize: 13, marginTop: 2 }}>
            {body}
          </p>
          {hint && (
            <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 4 }}>
              {hint}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export async function DrillExecutionCard({
  userId,
  dailyWorkoutId,
}: {
  userId: string;
  dailyWorkoutId: string;
}) {
  const report = await getSaturdayDrillReport(userId, dailyWorkoutId);
  if (!report) return null;
  // No drill prescribed → render nothing. The whole feature is gated on
  // the day actually having a drill block.
  if (report.reason === "no_drill") return null;

  const drill = report.drill!;
  const drillLabel = `${drill.repetitions}×${drill.durationMin}min @ ${drill.targetCadenceLow}-${drill.targetCadenceHigh}rpm`;

  if (report.reason === "no_strava") {
    return (
      <CardShell
        accent="neutral"
        icon={Link2}
        title="Drill prescrito"
        body={drillLabel}
        hint="Conectá Strava en /metrics para chequear la ejecución"
      />
    );
  }

  if (report.reason === "no_activity") {
    return (
      <CardShell
        accent="neutral"
        icon={Circle}
        title={`Drill pendiente: ${drillLabel}`}
        body="Sin ride registrado en Strava todavía"
        hint="Sale a andar y volvé después — el detector mira los primeros 30min del long ride"
      />
    );
  }

  if (report.reason === "no_streams" || !report.detection) {
    return (
      <CardShell
        accent="neutral"
        icon={AlertCircle}
        title="Drill prescrito"
        body={drillLabel}
        hint="El ride no tiene datos de cadencia (sensor desconectado o no grabados)"
      />
    );
  }

  const { detection, activity } = report;
  const ridePrefix = activity ? `${activity.name} · ${activity.distanceKm}km · ` : "";

  if (detection.status === "completed") {
    return (
      <CardShell
        accent="success"
        icon={CheckCircle2}
        title="✅ Drill cumplido"
        body={`${detection.detectedReps}/${detection.expectedReps} reps a ${detection.avgCadenceDuringReps}rpm promedio`}
        hint={`${ridePrefix}Target era ${drill.targetCadenceLow}-${drill.targetCadenceHigh}rpm`}
      />
    );
  }

  if (detection.status === "partial") {
    return (
      <CardShell
        accent="warning"
        icon={RotateCw}
        title="⚠️ Drill parcial"
        body={`${detection.detectedReps}/${detection.expectedReps} reps detectadas, a ${detection.avgCadenceDuringReps}rpm promedio`}
        hint={`${ridePrefix}Faltaron ${detection.expectedReps - detection.detectedReps} reps. La próxima ponele`}
      />
    );
  }

  return (
    <CardShell
      accent="danger"
      icon={AlertCircle}
      title="❌ Drill no detectado"
      body={`No se vio el patrón ${drillLabel} en los primeros 30min del ride`}
      hint={`${ridePrefix}Capaz lo hiciste después del warmup — el detector solo mira al inicio`}
    />
  );
}

export function DrillExecutionCardSkeleton() {
  const a = ACCENTS.neutral;
  return (
    <div
      className="card mb-4"
      style={{ background: a.bg, borderColor: a.border, padding: 14, opacity: 0.6 }}
      aria-hidden="true"
    >
      <div className="flex items-center gap-3">
        <div
          className="rounded-xl flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${a.color} 18%, transparent)`, width: 36, height: 36 }}
        />
        <div className="flex-1">
          <div style={{ width: 120, height: 12, background: "var(--bg-card)", borderRadius: 3, marginBottom: 6 }} />
          <div style={{ width: 200, height: 14, background: "var(--bg-card)", borderRadius: 3 }} />
        </div>
      </div>
    </div>
  );
}
