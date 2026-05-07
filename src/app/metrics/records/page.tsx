import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/components/BackLink";

export default async function RecordsPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id as string | undefined;

  if (!userId) {
    redirect("/auth/login");
  }

  const allLogs = await prisma.workoutLog.findMany({
    include: {
      exercise: {
        include: { dailyWorkout: true }
      }
    },
    where: {
      exercise: {
        dailyWorkout: {
          routine: { userId },
          completions: { some: { completed: true } },
        },
      },
    }
  });

  // Group by exercise name and find max weight
  const recordsMap: Record<string, { maxWeight: number, reps: number, date: Date | null }> = {};

  allLogs.forEach(log => {
    const name = log.exercise.name;
    if (!recordsMap[name] || log.weight > recordsMap[name].maxWeight) {
      recordsMap[name] = { 
        maxWeight: log.weight, 
        reps: log.reps, 
        date: log.exercise.dailyWorkout.date 
      };
    } else if (log.weight === recordsMap[name].maxWeight && log.reps > recordsMap[name].reps) {
      // If same weight, more reps is also a record
      recordsMap[name].reps = log.reps;
    }
  });

  const sortedNames = Object.keys(recordsMap).sort();

  return (
    <div className="container" style={{ paddingBottom: "60px" }}>
      <BackLink href="/metrics" label="Volver a Métricas" />
      <h1 className="title">Récords Personales (PRs) 🏆</h1>
      <p className="subtitle">Tu máximo peso levantado por ejercicio</p>

      {/* Desktop: tabla | Mobile: tarjetas */}
      <div className="hidden md:block card" style={{ padding: 0, overflow: "hidden", cursor: "default" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text-primary)" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--bg-card-hover)", textAlign: "left" }}>
              <th style={{ padding: "16px", borderBottom: "1px solid var(--border-color)" }}>Ejercicio</th>
              <th style={{ padding: "16px", borderBottom: "1px solid var(--border-color)" }}>Peso Máx</th>
              <th style={{ padding: "16px", borderBottom: "1px solid var(--border-color)" }}>Reps</th>
              <th style={{ padding: "16px", borderBottom: "1px solid var(--border-color)" }}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {sortedNames.map(name => {
              const record = recordsMap[name];
              return (
                <tr key={name} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={{ padding: "16px", fontWeight: "600" }}>{name}</td>
                  <td style={{ padding: "16px", color: "var(--accent-gym)", fontWeight: "bold" }}>{record.maxWeight} kg</td>
                  <td style={{ padding: "16px" }}>{record.reps}</td>
                  <td style={{ padding: "16px", fontSize: "13px", color: "var(--text-secondary)" }}>
                    {record.date ? new Date(record.date).toLocaleDateString() : "-"}
                  </td>
                </tr>
              );
            })}
            {sortedNames.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>
                  Aún no tienes récords registrados. ¡Empieza a entrenar!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: card layout */}
      <div className="md:hidden flex flex-col gap-3">
        {sortedNames.map(name => {
          const record = recordsMap[name];
          return (
            <div key={name} className="card" style={{ cursor: "default" }}>
              <h3 style={{ fontWeight: 600, marginBottom: 8 }}>{name}</h3>
              <div className="flex items-center gap-4 text-sm">
                <span style={{ color: "var(--accent-gym)", fontWeight: 700, fontSize: "18px" }}>
                  {record.maxWeight} kg
                </span>
                <span style={{ color: "var(--text-secondary)" }}>
                  × {record.reps} reps
                </span>
                <span style={{ color: "var(--text-secondary)", fontSize: "12px", marginLeft: "auto" }}>
                  {record.date ? new Date(record.date).toLocaleDateString() : "-"}
                </span>
              </div>
            </div>
          );
        })}
        {sortedNames.length === 0 && (
          <div className="card" style={{ textAlign: "center", color: "var(--text-secondary)", cursor: "default" }}>
            Aún no tienes récords registrados. ¡Empieza a entrenar!
          </div>
        )}
      </div>
    </div>
  );
}
