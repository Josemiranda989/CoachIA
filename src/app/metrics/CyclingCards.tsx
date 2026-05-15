import { Route, Timer, Trophy, Mountain, RotateCw, Heart } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { getStravaStats, getStravaActivities } from "@/lib/strava-cached";
import { prisma } from "@/lib/prisma";

const cyclingColor = {
  color: "var(--accent-cycling)",
  bg: "color-mix(in srgb, var(--accent-cycling) 8%, transparent)",
  border: "color-mix(in srgb, var(--accent-cycling) 20%, transparent)",
};

type CardSpec = {
  label: string;
  value: number;
  unit: string;
  description: string;
  icon: typeof Route;
  decimals?: number;
  warn?: boolean;
};

export async function CyclingCards({ userId }: { userId: string }) {
  // Both stats + activities are deduplicated via React.cache() — shared with
  // StravaActivities in a different Suspense boundary on the same page.
  const [stats, recentActivities, hrUser] = await Promise.all([
    getStravaStats(userId),
    getStravaActivities(userId, 1, 30),
    prisma.user.findUnique({ where: { id: userId }, select: { fcMax: true } }),
  ]);
  const ytd = stats?.ytd_ride_totals;
  if (!ytd) return null;

  const rides = ((recentActivities as any[]) ?? []).filter(
    (a) => a.type === "Ride" || a.type === "VirtualRide",
  );

  // Average cadence across recent rides that recorded it (sensor connected).
  // ytd_ride_totals doesn't expose cadence, so we sample from the last ~30 activities.
  const cadenceSamples = rides
    .filter((a) => typeof a.average_cadence === "number")
    .map((a) => a.average_cadence as number);
  const avgCadence = cadenceSamples.length > 0
    ? Math.round(cadenceSamples.reduce((s, c) => s + c, 0) / cadenceSamples.length)
    : null;

  // Peak HR observed in recent rides — useful to detect stale FCmax settings.
  const peakHrSamples = rides
    .map((a) => (typeof a.max_heartrate === "number" ? a.max_heartrate : null))
    .filter((v): v is number => v !== null);
  const observedFcMax = peakHrSamples.length > 0 ? Math.max(...peakHrSamples) : null;
  const configuredFcMax = hrUser?.fcMax ?? null;
  const fcMaxStale =
    observedFcMax !== null && configuredFcMax !== null && observedFcMax > configuredFcMax + 3;

  const cards: CardSpec[] = [
    {
      label: "KM Este Año",
      value: ytd.distance / 1000,
      unit: "km",
      description: "Distancia total recorrida en bici este año",
      icon: Route,
    },
    {
      label: "Horas Este Año",
      value: ytd.moving_time / 3600,
      decimals: 1,
      unit: "hs",
      description: "Tiempo total en bici este año",
      icon: Timer,
    },
    {
      label: "Ride Más Largo",
      value: (stats?.biggest_ride_distance || 0) / 1000,
      decimals: 1,
      unit: "km",
      description: "Tu salida más larga registrada en Strava",
      icon: Trophy,
    },
    {
      label: "Desnivel Año",
      value: ytd.elevation_gain || 0,
      unit: "m",
      description: "Metros de desnivel positivo acumulados",
      icon: Mountain,
    },
  ];

  if (avgCadence !== null) {
    cards.push({
      label: "Cadencia Media",
      value: avgCadence,
      unit: "rpm",
      description: `Promedio de tus últimas ${cadenceSamples.length} salidas con sensor`,
      icon: RotateCw,
    });
  }

  if (observedFcMax !== null) {
    const description = configuredFcMax
      ? fcMaxStale
        ? `Tu FCmax configurada es ${configuredFcMax} — actualizá en Perfil.`
        : `FCmax configurada: ${configuredFcMax} bpm.`
      : `Configurá tu FCmax en Perfil para que las zonas FC se ajusten.`;
    cards.push({
      label: "FC Máx Observada",
      value: observedFcMax,
      unit: "bpm",
      description,
      icon: Heart,
      warn: fcMaxStale || configuredFcMax === null,
    });
  }

  return (
    <>
      {cards.map(({ label, value, unit, description, icon: Icon, decimals, warn }) => {
        const tone = warn
          ? {
              color: "var(--accent-gym)",
              bg: "color-mix(in srgb, var(--accent-gym) 8%, transparent)",
              border: "color-mix(in srgb, var(--accent-gym) 35%, transparent)",
            }
          : cyclingColor;
        return (
          <div
            key={label}
            className="card"
            style={{ cursor: "default", background: tone.bg, borderColor: tone.border }}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="p-2 rounded-xl"
                style={{ background: `color-mix(in srgb, ${tone.color} 13%, transparent)` }}
              >
                <Icon size={20} style={{ color: tone.color }} aria-hidden="true" />
              </div>
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
              {label}
            </p>
            <p className="font-bold mb-1 text-xl md:text-3xl" style={{ color: tone.color }}>
              <CountUp value={value} decimals={decimals ?? 0} />{" "}
              <span className="text-xs md:text-sm" style={{ color: "var(--text-secondary)", fontWeight: 400 }}>{unit}</span>
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: "12px" }}>{description}</p>
          </div>
        );
      })}
    </>
  );
}

export function CyclingCardsSkeleton() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="card"
          style={{ background: cyclingColor.bg, borderColor: cyclingColor.border, opacity: 0.5 }}
          aria-hidden="true"
        >
          <div className="p-2 rounded-xl mb-3 w-fit" style={{ background: `color-mix(in srgb, ${cyclingColor.color} 13%, transparent)`, height: 36, width: 36 }} />
          <div style={{ height: 14, background: "var(--bg-card)", borderRadius: 4, marginBottom: 6, width: "70%" }} />
          <div style={{ height: 28, background: "var(--bg-card)", borderRadius: 4, marginBottom: 6, width: "50%" }} />
          <div style={{ height: 12, background: "var(--bg-card)", borderRadius: 4, width: "85%" }} />
        </div>
      ))}
    </>
  );
}
