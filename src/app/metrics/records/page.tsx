import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BackLink } from "@/components/BackLink";

export const metadata: Metadata = { title: "Récords" };

// Epley formula — most common, works for any rep count.
function epley1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type RecordEntry = {
  maxWeight: number;
  maxWeightReps: number;
  date: Date | null;
  current1RM: number;
  past1RM: number | null;
};

export default async function RecordsPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id as string | undefined;

  if (!userId) {
    redirect("/auth/login");
  }

  const allLogs = await prisma.workoutLog.findMany({
    where: {
      exercise: {
        dailyWorkout: {
          routine: { userId },
          completions: { some: { completed: true } },
        },
      },
    },
    include: {
      exercise: {
        include: { dailyWorkout: { select: { date: true } } },
      },
    },
  });

  // Cutoff: 28 days ago. Logs whose weekStart is strictly before this count as "past"
  // for the 1RM delta. weekStart is YYYY-MM-DD so lexicographic compare === date compare.
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const cutoffYmd = ymd(fourWeeksAgo);

  const records: Record<string, RecordEntry> = {};

  for (const log of allLogs) {
    const name = log.exercise.name;
    const est = epley1RM(log.weight, log.reps);
    const entry = records[name] ?? {
      maxWeight: 0,
      maxWeightReps: 0,
      date: null,
      current1RM: 0,
      past1RM: null,
    };

    // Heaviest absolute weight (with tie-break by reps).
    if (
      log.weight > entry.maxWeight ||
      (log.weight === entry.maxWeight && log.reps > entry.maxWeightReps)
    ) {
      entry.maxWeight = log.weight;
      entry.maxWeightReps = log.reps;
      entry.date = log.exercise.dailyWorkout.date;
    }

    // Best estimated 1RM across all logs.
    if (est > entry.current1RM) {
      entry.current1RM = est;
    }

    // Best estimated 1RM strictly older than the 28-day cutoff.
    if (log.weekStart < cutoffYmd && (entry.past1RM === null || est > entry.past1RM)) {
      entry.past1RM = est;
    }

    records[name] = entry;
  }

  const sortedNames = Object.keys(records).sort();

  return (
    <div className="container" style={{ paddingBottom: "60px" }}>
      <BackLink href="/metrics" label="Volver a Métricas" />
      <h1 className="title">Récords Personales (PRs) 🏆</h1>
      <p className="subtitle">Peso máximo + 1RM estimado (fórmula Epley)</p>

      {/* Desktop: tabla */}
      <div className="hidden md:block card" style={{ padding: 0, overflow: "hidden", cursor: "default" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text-primary)" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--bg-card-hover)", textAlign: "left" }}>
              <th style={{ padding: "16px", borderBottom: "1px solid var(--border-color)" }}>Ejercicio</th>
              <th style={{ padding: "16px", borderBottom: "1px solid var(--border-color)" }}>Peso Máx</th>
              <th style={{ padding: "16px", borderBottom: "1px solid var(--border-color)" }}>Reps</th>
              <th style={{ padding: "16px", borderBottom: "1px solid var(--border-color)" }}>1RM est.</th>
              <th style={{ padding: "16px", borderBottom: "1px solid var(--border-color)" }}>Δ 4 sem</th>
              <th style={{ padding: "16px", borderBottom: "1px solid var(--border-color)" }}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {sortedNames.map((name) => {
              const r = records[name];
              return (
                <tr key={name} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={{ padding: "16px", fontWeight: 600 }}>{name}</td>
                  <td style={{ padding: "16px", color: "var(--accent-gym)", fontWeight: "bold" }}>
                    {r.maxWeight} kg
                  </td>
                  <td style={{ padding: "16px" }}>{r.maxWeightReps}</td>
                  <td style={{ padding: "16px", fontWeight: 600 }}>
                    {Math.round(r.current1RM)} kg
                  </td>
                  <td style={{ padding: "16px" }}>
                    <DeltaBadge current={r.current1RM} past={r.past1RM} />
                  </td>
                  <td style={{ padding: "16px", fontSize: "13px", color: "var(--text-secondary)" }}>
                    {r.date ? new Date(r.date).toLocaleDateString() : "-"}
                  </td>
                </tr>
              );
            })}
            {sortedNames.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>
                  Aún no tienes récords registrados. ¡Empezá a entrenar!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden flex flex-col gap-3">
        {sortedNames.map((name) => {
          const r = records[name];
          return (
            <div key={name} className="card" style={{ cursor: "default" }}>
              <h3 style={{ fontWeight: 600, marginBottom: 8 }}>{name}</h3>
              <div className="flex items-center gap-4 text-sm flex-wrap">
                <span style={{ color: "var(--accent-gym)", fontWeight: 700, fontSize: "18px" }}>
                  {r.maxWeight} kg
                </span>
                <span style={{ color: "var(--text-secondary)" }}>× {r.maxWeightReps} reps</span>
                <span style={{ color: "var(--text-secondary)", fontSize: "12px", marginLeft: "auto" }}>
                  {r.date ? new Date(r.date).toLocaleDateString() : "-"}
                </span>
              </div>
              <div
                className="flex items-center gap-3 mt-2 pt-2"
                style={{ borderTop: "1px solid var(--border-color)", fontSize: 13 }}
              >
                <span style={{ color: "var(--text-secondary)" }}>1RM est.</span>
                <span style={{ fontWeight: 700 }}>{Math.round(r.current1RM)} kg</span>
                <span style={{ marginLeft: "auto" }}>
                  <DeltaBadge current={r.current1RM} past={r.past1RM} />
                </span>
              </div>
            </div>
          );
        })}
        {sortedNames.length === 0 && (
          <div className="card" style={{ textAlign: "center", color: "var(--text-secondary)", cursor: "default" }}>
            Aún no tienes récords registrados. ¡Empezá a entrenar!
          </div>
        )}
      </div>
    </div>
  );
}

function DeltaBadge({ current, past }: { current: number; past: number | null }) {
  if (past === null) {
    return <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>—</span>;
  }
  const diff = current - past;
  const rounded = Math.round(diff);
  if (Math.abs(rounded) < 1) {
    return <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>≈ 0 kg</span>;
  }
  const color = rounded > 0 ? "#10b981" : "#ef4444";
  const arrow = rounded > 0 ? "↑" : "↓";
  return (
    <span style={{ color, fontWeight: 600, fontSize: 13 }}>
      {arrow} {Math.abs(rounded)} kg
    </span>
  );
}
