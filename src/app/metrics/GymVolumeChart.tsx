import { prisma } from "@/lib/prisma";
import { GymVolumeChartView, type GymSessionData } from "./GymVolumeChartView";

export async function GymVolumeChart({ userId }: { userId: string }) {
  // Pull the last 200 logs as a sliding window; we group them into sessions
  // (one DailyWorkout = one session) and keep the most recent 20 sessions.
  // Done by date desc on DailyWorkout, then assembled in JS — Prisma can't
  // group + order + take across a relation in a single query.
  const logs = await prisma.workoutLog.findMany({
    where: {
      exercise: { dailyWorkout: { routine: { userId } } },
    },
    select: {
      reps: true,
      weight: true,
      exercise: {
        select: {
          dailyWorkout: { select: { id: true, date: true, dayOfWeek: true } },
        },
      },
    },
    orderBy: { id: "desc" },
    take: 800,
  });

  type SessionAccum = {
    id: string;
    date: Date | null;
    dayOfWeek: string;
    volume: number;
    sets: number;
  };
  const bySession = new Map<string, SessionAccum>();
  for (const log of logs) {
    const dw = log.exercise.dailyWorkout;
    const existing = bySession.get(dw.id);
    if (existing) {
      existing.volume += log.reps * log.weight;
      existing.sets += 1;
    } else {
      bySession.set(dw.id, {
        id: dw.id,
        date: dw.date,
        dayOfWeek: dw.dayOfWeek,
        volume: log.reps * log.weight,
        sets: 1,
      });
    }
  }

  // Newest first; sessions without a date sort last. Keep the 20 most recent,
  // then flip to chronological for the chart (oldest on the left).
  const sessions = [...bySession.values()]
    .sort((a, b) => {
      const ta = a.date ? a.date.getTime() : 0;
      const tb = b.date ? b.date.getTime() : 0;
      return tb - ta;
    })
    .slice(0, 20)
    .reverse();

  const data: GymSessionData[] = sessions.map((s, idx) => ({
    id: s.id,
    label: s.date
      ? s.date.toLocaleDateString("es-AR", { day: "numeric", month: "short" })
      : s.dayOfWeek.slice(0, 3),
    volume: Math.round(s.volume),
    sets: s.sets,
    // 3-session trailing average — smooths week-to-week noise.
    movingAvg: (() => {
      const window = sessions.slice(Math.max(0, idx - 2), idx + 1);
      const sum = window.reduce((acc, w) => acc + w.volume, 0);
      return Math.round(sum / window.length);
    })(),
  }));

  return <GymVolumeChartView data={data} />;
}

export { GymVolumeChartSkeleton } from "./GymVolumeChartView";
