import { Heart, CheckCircle2, ArrowUpRight, ArrowDownRight, Circle, AlertCircle, Link2 } from "lucide-react";
import { getCyclingExecutionReport } from "@/lib/queries/getCyclingExecution";
import type { BlockExecution } from "@/lib/cycling-execution";

const KIND_LABEL: Record<string, string> = {
  warmup: "Calentamiento",
  steady: "Sostenido",
  interval: "Intervalos",
  cooldown: "Vuelta a la calma",
};

const STATUS_TONE: Record<BlockExecution["status"], { color: string; icon: typeof Heart; label: string }> = {
  in_zone: { color: "#10b981", icon: CheckCircle2, label: "En zona" },
  above: { color: "var(--accent-gym)", icon: ArrowUpRight, label: "Por encima" },
  below: { color: "var(--accent-cycling)", icon: ArrowDownRight, label: "Por debajo" },
  skipped_interval: { color: "var(--text-secondary)", icon: Circle, label: "Intervalos (variable)" },
  no_zone_config: { color: "var(--text-secondary)", icon: AlertCircle, label: "Sin zona" },
  no_data: { color: "var(--text-secondary)", icon: AlertCircle, label: "Sin datos FC" },
};

function fmtMin(sec: number): string {
  return `${Math.round(sec / 60)}min`;
}

function BlockRow({ block }: { block: BlockExecution }) {
  const tone = STATUS_TONE[block.status];
  const Icon = tone.icon;
  const kindLabel = KIND_LABEL[block.kind] ?? block.kind;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 8,
        background: `color-mix(in srgb, ${tone.color} 6%, transparent)`,
        border: `1px solid color-mix(in srgb, ${tone.color} 20%, transparent)`,
      }}
    >
      <Icon size={18} style={{ color: tone.color, flexShrink: 0 }} aria-hidden="true" />
      <div className="flex-1" style={{ minWidth: 0 }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {kindLabel} <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>· {fmtMin(block.windowSec)} · {block.prescribedZone}</span>
        </p>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
          {block.actualAvgHr !== null && block.prescribedRangeBpm
            ? `Tu avg: ${block.actualAvgHr}bpm · target ${block.prescribedRangeBpm.low}-${block.prescribedRangeBpm.high}bpm`
            : block.status === "skipped_interval"
              ? "HR variable entre work y recovery — no analizado"
              : block.status === "no_zone_config"
                ? "Configurá FCmax/LTHR en /profile para analizar"
                : "Sin samples de FC en este bloque"}
        </p>
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: tone.color,
          flexShrink: 0,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {tone.label}
      </span>
    </div>
  );
}

function CardWrapper({ children, accent = "neutral" as "neutral" | "danger" | "warning" }: { children: React.ReactNode; accent?: "neutral" | "danger" | "warning" }) {
  const tones = {
    neutral: { bg: "color-mix(in srgb, var(--accent-cycling) 7%, transparent)", border: "color-mix(in srgb, var(--accent-cycling) 22%, transparent)" },
    danger:  { bg: "color-mix(in srgb, #ef4444 9%, transparent)", border: "color-mix(in srgb, #ef4444 30%, transparent)" },
    warning: { bg: "color-mix(in srgb, var(--accent-gym) 9%, transparent)", border: "color-mix(in srgb, var(--accent-gym) 30%, transparent)" },
  };
  const t = tones[accent];
  return (
    <div className="card mb-4" style={{ background: t.bg, borderColor: t.border, padding: 14 }}>
      {children}
    </div>
  );
}

export async function CyclingExecutionCard({
  userId,
  dailyWorkoutId,
}: {
  userId: string;
  dailyWorkoutId: string;
}) {
  const report = await getCyclingExecutionReport(userId, dailyWorkoutId);
  if (!report) return null;

  // Day has no cycling blocks (probably a Gym-only day). Don't render anything.
  if (report.reason === "no_blocks") return null;

  if (report.reason === "no_hr_config") {
    return (
      <CardWrapper>
        <div className="flex items-center gap-3">
          <AlertCircle size={20} style={{ color: "var(--text-secondary)" }} aria-hidden="true" />
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Configurá tu <strong style={{ color: "var(--text-primary)" }}>FCmax</strong> o <strong style={{ color: "var(--text-primary)" }}>LTHR</strong> en /profile para ver ejecución vs receta por bloque.
          </p>
        </div>
      </CardWrapper>
    );
  }

  if (report.reason === "no_strava") {
    return (
      <CardWrapper>
        <div className="flex items-center gap-3">
          <Link2 size={20} style={{ color: "var(--accent-cycling)" }} aria-hidden="true" />
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Conectá Strava en /metrics para ver la ejecución de cada bloque post-ride.
          </p>
        </div>
      </CardWrapper>
    );
  }

  if (report.reason === "no_activity") {
    return (
      <CardWrapper>
        <div className="flex items-center gap-3">
          <Circle size={20} style={{ color: "var(--text-secondary)" }} aria-hidden="true" />
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Sin ride registrado en Strava todavía. Al terminar, esta tarjeta te muestra cómo te fue contra la receta.
          </p>
        </div>
      </CardWrapper>
    );
  }

  if (report.reason === "no_hr_stream") {
    return (
      <CardWrapper>
        <div className="flex items-center gap-3">
          <AlertCircle size={20} style={{ color: "var(--accent-gym)" }} aria-hidden="true" />
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            El ride en Strava no tiene datos de FC (sensor desconectado o ride sin pulsómetro).
          </p>
        </div>
      </CardWrapper>
    );
  }

  if (!report.blocks || !report.activity) return null;

  const { blocks, activity } = report;
  const hasComparable = blocks.some((b) => b.actualAvgHr !== null);
  const offTarget = blocks.filter((b) => b.status === "above" || b.status === "below").length;

  return (
    <CardWrapper accent={offTarget >= 2 ? "warning" : "neutral"}>
      <div className="flex items-center gap-3 mb-3">
        <Heart size={20} style={{ color: "var(--accent-cycling)" }} aria-hidden="true" />
        <div className="flex-1">
          <p className="font-bold text-sm" style={{ color: "var(--accent-cycling)" }}>
            Ejecución por bloque
          </p>
          <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 2 }}>
            {activity.name} · {activity.distanceKm}km · {activity.durationMin}min
            {activity.avgHr !== null && ` · avg ${activity.avgHr}bpm`}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {blocks.map((b) => (
          <BlockRow key={b.blockOrder} block={b} />
        ))}
      </div>
      {!hasComparable && (
        <p style={{ color: "var(--text-secondary)", fontSize: 11, marginTop: 8, fontStyle: "italic" }}>
          Ningún bloque tuvo HR comparable (intervals o sin datos).
        </p>
      )}
    </CardWrapper>
  );
}

export function CyclingExecutionCardSkeleton() {
  return (
    <div
      className="card mb-4"
      style={{
        background: "color-mix(in srgb, var(--accent-cycling) 7%, transparent)",
        borderColor: "color-mix(in srgb, var(--accent-cycling) 22%, transparent)",
        padding: 14,
        opacity: 0.6,
      }}
      aria-hidden="true"
    >
      <div className="flex items-center gap-3 mb-3">
        <div style={{ width: 36, height: 36, borderRadius: 12, background: "color-mix(in srgb, var(--accent-cycling) 18%, transparent)" }} />
        <div className="flex-1">
          <div style={{ width: 160, height: 12, background: "var(--bg-card)", borderRadius: 3, marginBottom: 6 }} />
          <div style={{ width: 220, height: 11, background: "var(--bg-card)", borderRadius: 3 }} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ height: 52, borderRadius: 8, background: "color-mix(in srgb, var(--accent-cycling) 5%, transparent)", border: "1px solid var(--border-color)" }} />
        ))}
      </div>
    </div>
  );
}
