import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import {
  ArrowRight,
  Dumbbell,
  Flame,
  TrendingDown,
  TrendingUp,
  Bike,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { redirect } from "next/navigation";
import { StravaActivities, StravaActivitiesSkeleton } from "@/components/StravaActivities";
import { isStravaConfigured, getStravaAuthUrl } from "@/lib/strava";
import { getStravaContext } from "@/lib/strava-cached";
import { WeightChart } from "./WeightChart";
import { WeightChartSkeleton } from "./WeightChartView";
import { CyclingCards, CyclingCardsSkeleton } from "./CyclingCards";
import { GymStravaCards, GymStravaCardsSkeleton } from "./GymStravaCards";
import { CyclingTrendChart, CyclingTrendChartSkeleton } from "./CyclingTrendChart";
import { GymVolumeChart, GymVolumeChartSkeleton } from "./GymVolumeChart";
import { CountUp } from "@/components/CountUp";
import { BackLink } from "@/components/BackLink";
import { MesocycleProgress, MesocycleProgressSkeleton } from "@/components/MesocycleProgress";
import { FitnessChart } from "@/components/FitnessChart";
import { getCurrentWeekStart } from "@/lib/week";

export const metadata: Metadata = { title: "Métricas" };

const TIMEZONE_ART = "America/Argentina/Tucuman";
const MONTH_NAMES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function artDateParts(d: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE_ART,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
  };
}

function artDateString(d: Date): string {
  const { year, month, day } = artDateParts(d);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function prevYearMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function formatWeight(n: number): string {
  return n % 1 !== 0
    ? n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : String(n);
}

type SectionHeaderProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  color?: string;
};

function SectionHeader({ icon: Icon, title, subtitle, color = "var(--text-primary)" }: SectionHeaderProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: "var(--text-primary)",
          marginBottom: 6,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Icon size={22} style={{ color }} aria-hidden="true" />
        {title}
      </h2>
      <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>{subtitle}</p>
    </div>
  );
}

export default async function MetricsPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id as string | undefined;

  if (!userId) {
    redirect("/auth/login");
  }

  const stravaConfigured = isStravaConfigured();
  const stravaAuthUrl = stravaConfigured ? getStravaAuthUrl() : null;
  const currentWeekStart = getCurrentWeekStart();

  const stravaConnected = stravaConfigured
    ? !!(await prisma.user.findUnique({ where: { id: userId }, select: { stravaAthleteId: true } }))?.stravaAthleteId
    : false;

  // Token health check — uses React.cache(), so the cycling Suspense boundaries
  // below reuse this single resolution. When stravaTokenInvalid is true, the
  // athlete connected at some point but the refresh_token was revoked/expired
  // and getValidAccessToken cleared the dead tokens. We surface a re-auth
  // banner instead of letting the cycling cards render empty.
  const stravaCtx = stravaConfigured && stravaConnected ? await getStravaContext(userId) : null;
  const stravaTokenInvalid = stravaConnected && !stravaCtx;
  const stravaReady = stravaConnected && !stravaTokenInvalid;

  // Gym stats — always synchronous, scoped to current user
  const allLogs = await prisma.workoutLog.findMany({
    where: {
      exercise: { dailyWorkout: { routine: { userId } } },
    },
    select: {
      reps: true,
      weight: true,
      weekStart: true,
      exercise: { select: { name: true } },
    },
  });

  const totalVolume = allLogs.reduce((acc, log) => acc + (log.reps * log.weight), 0);

  // Month buckets in ART for "este mes" vs "mes anterior" comparisons.
  const now = new Date();
  const todayParts = artDateParts(now);
  const currentMonthKey = monthKey(todayParts.year, todayParts.month);
  const prev = prevYearMonth(todayParts.year, todayParts.month);
  const prevMonthKey = monthKey(prev.year, prev.month);
  const prevMonthName = MONTH_NAMES_ES[prev.month - 1];

  const thisMonthLogs = allLogs.filter((l) => l.weekStart.startsWith(currentMonthKey));
  const prevMonthLogs = allLogs.filter((l) => l.weekStart.startsWith(prevMonthKey));

  const maxByExercise = (logs: typeof allLogs): Map<string, number> => {
    const m = new Map<string, number>();
    for (const log of logs) {
      if (log.weight <= 0) continue;
      const cur = m.get(log.exercise.name) ?? 0;
      if (log.weight > cur) m.set(log.exercise.name, log.weight);
    }
    return m;
  };
  const thisMax = maxByExercise(thisMonthLogs);
  const prevMax = maxByExercise(prevMonthLogs);

  // Pick the exercise with the largest positive weight delta vs last month.
  // Fallback: highest absolute weight this month when no prior reference exists.
  let topExercise: { name: string; current: number; previous: number | null; delta: number } | null = null;
  for (const [name, curWeight] of thisMax) {
    const prevWeight = prevMax.get(name);
    if (prevWeight !== undefined && curWeight > prevWeight) {
      const delta = curWeight - prevWeight;
      if (!topExercise || delta > topExercise.delta) {
        topExercise = { name, current: curWeight, previous: prevWeight, delta };
      }
    }
  }
  if (!topExercise && thisMax.size > 0) {
    let best: { name: string; weight: number } | null = null;
    for (const [name, w] of thisMax) {
      if (!best || w > best.weight) best = { name, weight: w };
    }
    if (best) topExercise = { name: best.name, current: best.weight, previous: null, delta: 0 };
  }

  const volumeThisMonth = thisMonthLogs.reduce((acc, l) => acc + l.reps * l.weight, 0);
  const volumePrevMonth = prevMonthLogs.reduce((acc, l) => acc + l.reps * l.weight, 0);
  const volumeDeltaPct = volumePrevMonth > 0
    ? Math.round(((volumeThisMonth - volumePrevMonth) / volumePrevMonth) * 100)
    : null;

  // Streak: consecutive ART days with a completed Gym session, counting back from today.
  const gymCompletions = await prisma.workoutCompletion.findMany({
    where: {
      completed: true,
      completedAt: { not: null },
      dailyWorkout: { type: "Gym", routine: { userId } },
    },
    select: { completedAt: true },
    orderBy: { completedAt: "desc" },
    take: 365,
  });
  const completedDates = new Set(
    gymCompletions
      .map((c) => (c.completedAt ? artDateString(c.completedAt) : null))
      .filter((s): s is string => s !== null),
  );
  let streak = 0;
  {
    const cursor = new Date(now);
    // If today has no session yet, start counting from yesterday so the streak doesn't reset mid-day.
    if (!completedDates.has(artDateString(cursor))) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    while (completedDates.has(artDateString(cursor))) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
  }

  const gymColor = {
    color: "var(--accent-gym)",
    bg: "color-mix(in srgb, var(--accent-gym) 8%, transparent)",
    border: "color-mix(in srgb, var(--accent-gym) 20%, transparent)",
  };

  type Metric = {
    label: string;
    value: number;
    displayFallback?: string;
    unit: string;
    description: string;
    icon: LucideIcon;
    decimals?: number;
  };

  const topExerciseDescription = !topExercise
    ? "Sin entrenamientos este mes"
    : topExercise.previous !== null && topExercise.delta > 0
      ? `${topExercise.name} · ${formatWeight(topExercise.previous)}kg → ${formatWeight(topExercise.current)}kg (+${formatWeight(topExercise.delta)}kg)`
      : `${topExercise.name} · máximo del mes`;

  const volumeIsDown = volumeDeltaPct !== null && volumeDeltaPct < 0;
  const volumeDescription = volumeDeltaPct === null
    ? volumeThisMonth > 0
      ? "Sin datos del mes anterior para comparar"
      : "Aún no entrenaste este mes"
    : `${volumeDeltaPct > 0 ? "+" : ""}${volumeDeltaPct}% vs ${prevMonthName}`;

  const streakDescription = streak === 0
    ? "Hoy es buen día para empezar"
    : "Sesiones de gym consecutivas";

  const gymMetrics: Metric[] = [
    {
      label: "Volumen Histórico",
      value: totalVolume,
      unit: "kg",
      description: "Peso total levantado sumando todos tus sets",
      icon: TrendingUp,
    },
    {
      label: "Ejercicio Top del Mes",
      value: topExercise?.current ?? 0,
      displayFallback: topExercise ? undefined : "—",
      unit: topExercise ? "kg" : "",
      decimals: topExercise && topExercise.current % 1 !== 0 ? 1 : 0,
      description: topExerciseDescription,
      icon: TrendingUp,
    },
    {
      label: "Racha Actual",
      value: streak,
      unit: streak === 0 ? "" : streak === 1 ? "día" : "días",
      description: streakDescription,
      icon: Flame,
    },
    {
      label: "Volumen Este Mes",
      value: volumeThisMonth,
      displayFallback: volumeThisMonth > 0 ? undefined : "—",
      unit: volumeThisMonth > 0 ? "kg" : "",
      description: volumeDescription,
      icon: volumeIsDown ? TrendingDown : TrendingUp,
    },
  ];

  return (
    <div className="app-container">
      <BackLink href="/" />
      <h1 className="title">Métricas</h1>
      <p className="subtitle">Tu progreso general</p>

      {stravaTokenInvalid && stravaAuthUrl && (
        <div
          role="alert"
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{
            background: "color-mix(in srgb, var(--accent-gym) 8%, transparent)",
            borderColor: "color-mix(in srgb, var(--accent-gym) 40%, transparent)",
            marginBottom: 16,
          }}
        >
          <Bike size={24} style={{ color: "var(--accent-gym)", flexShrink: 0 }} aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold mb-1" style={{ color: "var(--accent-gym)" }}>
              Reconectá tu Strava
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              El acceso a Strava expiró o fue revocado. Tus métricas de ciclismo no se están actualizando.
            </p>
          </div>
          <a
            href={stravaAuthUrl}
            style={{
              background: "#FC4C02",
              color: "#fff",
              padding: "10px 16px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            Reconectar
          </a>
        </div>
      )}

      {/* ─── Gym ─────────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <SectionHeader
          icon={Dumbbell}
          title="Gym"
          subtitle="Volumen levantado, récords y sesiones registradas"
          color="var(--accent-gym)"
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {gymMetrics.map(({ label, value, displayFallback, unit, description, icon: Icon, decimals }) => (
            <div
              key={label}
              className="rounded-2xl p-5 md:p-7"
              style={{ cursor: "default", background: "var(--bg-card)", border: "1px solid var(--glass-border)" }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="p-2 rounded-xl"
                  style={{ background: `color-mix(in srgb, ${gymColor.color} 13%, transparent)` }}
                >
                  <Icon size={20} style={{ color: gymColor.color }} aria-hidden="true" />
                </div>
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                {label}
              </p>
              <p className="font-bold mb-1 text-xl md:text-3xl" style={{ color: gymColor.color }}>
                {displayFallback ?? <CountUp value={value} decimals={decimals ?? 0} />}{" "}
                {unit && (
                  <span className="text-xs md:text-sm" style={{ color: "var(--text-secondary)", fontWeight: 400 }}>{unit}</span>
                )}
              </p>
              <p style={{ color: "var(--text-secondary)", fontSize: "12px" }}>{description}</p>
            </div>
          ))}

          {/* Records link */}
          <Link
            href="/metrics/records"
            className="card group flex flex-col justify-between"
            style={{ border: "1px solid color-mix(in srgb, var(--accent-gym) 40%, transparent)", background: "color-mix(in srgb, var(--accent-gym) 6%, transparent)" }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-xl" style={{ background: "color-mix(in srgb, var(--accent-gym) 15%, transparent)" }}>
                <Dumbbell size={20} style={{ color: "var(--accent-gym)" }} aria-hidden="true" />
              </div>
              <ArrowRight
                size={18}
                className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                style={{ color: "var(--accent-gym)" }}
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="font-bold text-lg mb-1" style={{ color: "var(--accent-gym)" }}>
                Todos los Récords
              </p>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                Máximo peso y reps en cada ejercicio.
              </p>
            </div>
          </Link>

          {/* Gym-related Strava data (sessions, minutos, FC media) — gated on a valid Strava token */}
          {stravaReady && (
            <Suspense fallback={<GymStravaCardsSkeleton />}>
              <GymStravaCards userId={userId} />
            </Suspense>
          )}
        </div>
      </section>

      {/* ─── Ciclismo ─────────────────────────────────────────────────────── */}
      {stravaReady && (
        <section style={{ marginBottom: 40 }}>
          <SectionHeader
            icon={Bike}
            title="Ciclismo"
            subtitle="Datos en tiempo real desde Strava"
            color="var(--accent-cycling)"
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Suspense fallback={<CyclingCardsSkeleton />}>
              <CyclingCards userId={userId} />
            </Suspense>
          </div>
        </section>
      )}

      {/* ─── Tendencias ───────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <SectionHeader
          icon={Activity}
          title="Tendencias"
          subtitle="Evolución a lo largo del tiempo"
        />
        <div className="flex flex-col gap-4">
          {stravaReady && (
            <Suspense fallback={<CyclingTrendChartSkeleton />}>
              <CyclingTrendChart userId={userId} />
            </Suspense>
          )}

          {stravaReady && (
            <Suspense
              fallback={
                <div
                  className="card"
                  style={{ padding: 24, textAlign: "center", opacity: 0.5 }}
                >
                  <p style={{ color: "var(--text-secondary)" }}>
                    Cargando fitness...
                  </p>
                </div>
              }
            >
              <FitnessChart userId={userId} />
            </Suspense>
          )}

          <Suspense fallback={<GymVolumeChartSkeleton />}>
            <GymVolumeChart userId={userId} />
          </Suspense>

          <Suspense fallback={<WeightChartSkeleton />}>
            <WeightChart userId={userId} />
          </Suspense>
        </div>
      </section>

      {/* Mesocycle progress — streams in independently; depende de Strava para los km */}
      <Suspense fallback={<MesocycleProgressSkeleton />}>
        <MesocycleProgress userId={userId} weekStart={currentWeekStart} />
      </Suspense>

      {/* Strava Section */}
      <div style={{ marginTop: 40 }}>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: "var(--text-primary)",
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Bike size={22} style={{ color: "#FC4C02" }} aria-hidden="true" />
          Strava
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>
          Conectá tu cuenta de Strava para ver tus actividades de ciclismo y métricas en tiempo real.
        </p>

        {!stravaConfigured && (
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Strava no configurado en el servidor.
          </p>
        )}

        {stravaConfigured && !stravaConnected && stravaAuthUrl && (
          <a
            href={stravaAuthUrl}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              padding: "16px 24px", borderRadius: 12, background: "#FC4C02", color: "#fff",
              fontWeight: 700, fontSize: 15, textDecoration: "none",
              boxShadow: "0 4px 16px rgba(252,76,2,0.3)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
              <path d="M41.03 47.852l-5.572-10.976h-8.172L41.03 64l13.736-27.124h-8.18" />
              <path d="M27.898 21.944l7.564 14.928h11.124L27.898 0 9.234 36.876H20.35" opacity=".6" />
            </svg>
            Autorizar Strava (activity:read_all)
          </a>
        )}

        {stravaConfigured && stravaConnected && !stravaTokenInvalid && (
          <Suspense fallback={<StravaActivitiesSkeleton />}>
            <StravaActivities userId={userId} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
