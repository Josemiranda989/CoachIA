export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { ArrowRight, Dumbbell, Trophy, Clock, Bike, Heart, TrendingUp } from "lucide-react";
import { StravaActivities } from "@/components/StravaActivities";
import { isStravaConfigured, getStravaAuthUrl } from "@/lib/strava";
import GoogleFitSection from "./GoogleFitSection";

export default async function MetricsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id as string | undefined;

  const stravaConfigured = isStravaConfigured();
  const stravaAuthUrl = stravaConfigured ? getStravaAuthUrl() : null;

  const stravaConnected = userId && stravaConfigured
    ? !!(await prisma.user.findUnique({ where: { id: userId }, select: { stravaAthleteId: true } }))?.stravaAthleteId
    : false;

  const googleFitConnected = userId
    ? !!(await prisma.user.findUnique({
        where: { id: userId },
        select: { googleFitAccessToken: true },
      }))?.googleFitAccessToken
    : false;

  const allLogs = await prisma.workoutLog.findMany({
    include: {
      exercise: {
        include: {
          dailyWorkout: {
            include: { routine: true }
          }
        }
      }
    }
  });

  const cyclingWorkouts = await prisma.dailyWorkout.findMany({
    where: { type: "Cycling", completed: true }
  });

  const totalVolume = allLogs.reduce((acc, log) => acc + (log.reps * log.weight), 0);
  const maxSquat = allLogs
    .filter(l => l.exercise.name.toLowerCase().includes("sentadilla") || l.exercise.name.toLowerCase().includes("squat"))
    .reduce((max, log) => log.weight > max ? log.weight : max, 0);

  const avgCyclingDistance = cyclingWorkouts.length > 0
    ? (cyclingWorkouts.reduce((acc, w) => acc + (w.distance || 0), 0) / cyclingWorkouts.length).toFixed(1)
    : "N/A";

  const avgCyclingHR = cyclingWorkouts.length > 0
    ? Math.round(cyclingWorkouts.reduce((acc, w) => acc + (w.averageHeartRate || 0), 0) / cyclingWorkouts.length)
    : "N/A";

  const totalCyclingMins = cyclingWorkouts.reduce((acc, w) => acc + (w.actualDuration || 0), 0);

  const metrics = [
    {
      label: "Volumen Histórico",
      value: totalVolume,
      unit: "kg",
      description: "Peso total levantado sumando todos tus sets",
      icon: TrendingUp,
      color: "var(--accent-gym)",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.2)",
    },
    {
      label: "Récord Sentadilla",
      value: maxSquat || "—",
      unit: maxSquat ? "kg" : "",
      description: "Tu peso máximo registrado en sentadilla",
      icon: Trophy,
      color: "var(--accent-gym)",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.2)",
    },
    {
      label: "Tiempo Total Bici",
      value: totalCyclingMins,
      unit: "min",
      description: "Tiempo total acumulado sobre la bici",
      icon: Clock,
      color: "var(--accent-cycling)",
      bg: "rgba(16,185,129,0.08)",
      border: "rgba(16,185,129,0.2)",
    },
    {
      label: "Distancia Media",
      value: avgCyclingDistance,
      unit: avgCyclingDistance !== "N/A" ? "km" : "",
      description: "Distancia promedio por sesión de bici",
      icon: Bike,
      color: "var(--accent-cycling)",
      bg: "rgba(16,185,129,0.08)",
      border: "rgba(16,185,129,0.2)",
    },
    {
      label: "FC Promedio",
      value: avgCyclingHR,
      unit: avgCyclingHR !== "N/A" ? "bpm" : "",
      description: "Frecuencia cardíaca media en bici",
      icon: Heart,
      color: "var(--accent-cycling)",
      bg: "rgba(16,185,129,0.08)",
      border: "rgba(16,185,129,0.2)",
    },
  ];

  return (
    <div className="app-container">
      <Link href="/" className="back-btn">
        ← Volver
      </Link>
      <h1 className="title">Métricas</h1>
      <p className="subtitle">Tu progreso general</p>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map(({ label, value, unit, description, icon: Icon, color, bg, border }) => (
          <div
            key={label}
            className="card"
            style={{ cursor: "default", background: bg, borderColor: border }}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="p-2 rounded-xl"
                style={{ background: `${color}22` }}
              >
                <Icon size={20} style={{ color }} />
              </div>
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
              {label}
            </p>
            <p className="font-bold mb-1" style={{ fontSize: "28px", color }}>
              {value}{" "}
              <span style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: 400 }}>{unit}</span>
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: "12px" }}>{description}</p>
          </div>
        ))}

        {/* Records link */}
        <Link
          href="/metrics/records"
          className="card group flex flex-col justify-between"
          style={{ border: "1px solid rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.06)" }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 rounded-xl" style={{ background: "rgba(245,158,11,0.15)" }}>
              <Dumbbell size={20} style={{ color: "var(--accent-gym)" }} />
            </div>
            <ArrowRight
              size={18}
              className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
              style={{ color: "var(--accent-gym)" }}
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

        <GoogleFitSection isConnected={googleFitConnected} />
      </div>

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
          <Bike size={22} style={{ color: "#FC4C02" }} />
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
            <svg width="20" height="20" viewBox="0 0 64 64" fill="currentColor">
              <path d="M41.03 47.852l-5.572-10.976h-8.172L41.03 64l13.736-27.124h-8.18" />
              <path d="M27.898 21.944l7.564 14.928h11.124L27.898 0 9.234 36.876H20.35" opacity=".6" />
            </svg>
            Autorizar Strava (activity:read_all)
          </a>
        )}

        {stravaConfigured && stravaConnected && (
          <StravaActivities />
        )}
      </div>
    </div>
  );
}
