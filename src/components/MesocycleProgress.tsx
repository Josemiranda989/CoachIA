import Link from "next/link";
import { Target, Sparkles, ChevronRight } from "lucide-react";
import {
  getMesocycleProgress,
  type MesocycleWeekProgress,
} from "@/lib/queries/getWeekKPIs";

function adherenceColor(pct: number, hasData: boolean): string {
  if (!hasData) return "var(--text-secondary)";
  if (pct >= 80) return "#10b981";
  if (pct >= 50) return "var(--accent-gym)";
  return "#ef4444";
}

function WeekRow({ w }: { w: MesocycleWeekProgress }) {
  const hasData = w.isPast || w.isCurrent;
  const adherence = adherenceColor(w.adherencePct, hasData);
  const isCurrent = w.isCurrent;

  const label = isCurrent
    ? `Sem ${w.week} · actual`
    : w.isPast
      ? `Sem ${w.week}`
      : `Sem ${w.week} · próxima`;

  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        background: isCurrent
          ? "color-mix(in srgb, var(--accent-primary) 9%, transparent)"
          : "color-mix(in srgb, var(--bg-card) 60%, transparent)",
        border: isCurrent
          ? "1px solid color-mix(in srgb, var(--accent-primary) 35%, transparent)"
          : "1px solid var(--border-color)",
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <p
            className="text-xs uppercase tracking-widest font-bold"
            style={{ color: isCurrent ? "var(--accent-primary)" : "var(--text-secondary)" }}
          >
            {label}
          </p>
          {w.phase && (
            <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
              {w.phase}
            </p>
          )}
        </div>
        <div className="text-right">
          {hasData ? (
            <>
              <p className="font-bold text-lg leading-none" style={{ color: adherence }}>
                {w.adherencePct}%
              </p>
              <p style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                {w.completed}/{w.planned} días
              </p>
            </>
          ) : (
            <p style={{ color: "var(--text-secondary)", fontSize: 12, fontStyle: "italic" }}>
              planeada
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="w-full h-1.5 rounded-full overflow-hidden mb-2"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: hasData ? `${Math.min(w.adherencePct, 100)}%` : "0%",
            background: adherence,
          }}
        />
      </div>

      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span>📅 {w.weekStart}</span>
        {hasData && w.cyclingKm > 0 && <span>🚴 {w.cyclingKm} km</span>}
      </div>
    </div>
  );
}

function RecoveryClosingBanner({ totalWeeks }: { totalWeeks: number }) {
  return (
    <Link
      href="/routine/generate"
      className="card group flex items-center gap-4 mb-3"
      style={{
        background: "linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(24,24,27,0.6) 60%)",
        border: "1px solid color-mix(in srgb, #10b981 35%, transparent)",
      }}
    >
      <div
        className="p-3 rounded-2xl"
        style={{ background: "color-mix(in srgb, #10b981 18%, transparent)" }}
      >
        <Sparkles size={22} style={{ color: "#10b981" }} aria-hidden="true" />
      </div>
      <div className="flex-1">
        <p className="font-bold mb-1" style={{ color: "#10b981" }}>
          Cierra el mesociclo este domingo
        </p>
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          Es semana de RECOVERY. Cuando termine, generá el próximo meso con feedback de cómo
          te fueron estas {totalWeeks} semanas.
        </p>
      </div>
      <ChevronRight
        size={20}
        style={{ color: "#10b981" }}
        className="opacity-50 group-hover:opacity-100 transition-opacity"
        aria-hidden="true"
      />
    </Link>
  );
}

export async function MesocycleProgress({
  userId,
  weekStart,
}: {
  userId: string;
  weekStart: string;
}) {
  const data = await getMesocycleProgress(userId, weekStart);
  if (!data || data.weeks.length === 0) return null;

  const currentWeek = data.weeks.find((w) => w.isCurrent);
  const isRecoveryWeek = currentWeek?.phase === "RECOVERY";

  return (
    <section
      style={{ marginTop: 32 }}
      aria-label="Progreso del mesociclo actual"
      className="animate-fade-up"
    >
      <h2
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: "var(--text-primary)",
          marginBottom: 4,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Target size={22} style={{ color: "var(--accent-primary)" }} aria-hidden="true" />
        Mesociclo actual
      </h2>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 14 }}>
        {data.totalWeeks === 4
          ? "Plan periodizado de 4 semanas: BUILD → BUILD → PEAK → RECOVERY."
          : `Plan de ${data.totalWeeks} ${data.totalWeeks === 1 ? "semana" : "semanas"}.`}
      </p>

      {isRecoveryWeek && <RecoveryClosingBanner totalWeeks={data.totalWeeks} />}

      <div className="flex flex-col gap-2">
        {data.weeks.map((w) => (
          <WeekRow key={w.weekStart} w={w} />
        ))}
      </div>
    </section>
  );
}

export function MesocycleProgressSkeleton() {
  return (
    <section style={{ marginTop: 32 }} aria-hidden="true">
      <div style={{ height: 22, width: 200, background: "var(--bg-card)", borderRadius: 4, marginBottom: 10 }} />
      <div style={{ height: 14, width: 320, background: "var(--bg-card)", borderRadius: 4, marginBottom: 14, opacity: 0.6 }} />
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: 84,
              borderRadius: 10,
              background: "color-mix(in srgb, var(--bg-card) 60%, transparent)",
              border: "1px solid var(--border-color)",
              opacity: 0.5,
            }}
          />
        ))}
      </div>
    </section>
  );
}
