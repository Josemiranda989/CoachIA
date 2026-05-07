import { Route, Timer, Trophy, Mountain } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { getStravaStats } from "@/lib/strava-cached";

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
};

export async function CyclingCards({ userId }: { userId: string }) {
  const stats = await getStravaStats(userId);
  const ytd = stats?.ytd_ride_totals;
  if (!ytd) return null;

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

  return (
    <>
      {cards.map(({ label, value, unit, description, icon: Icon, decimals }) => (
        <div
          key={label}
          className="card"
          style={{ cursor: "default", background: cyclingColor.bg, borderColor: cyclingColor.border }}
        >
          <div className="flex items-start justify-between mb-3">
            <div
              className="p-2 rounded-xl"
              style={{ background: `color-mix(in srgb, ${cyclingColor.color} 13%, transparent)` }}
            >
              <Icon size={20} style={{ color: cyclingColor.color }} aria-hidden="true" />
            </div>
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
            {label}
          </p>
          <p className="font-bold mb-1 text-xl md:text-3xl" style={{ color: cyclingColor.color }}>
            <CountUp value={value} decimals={decimals ?? 0} />{" "}
            <span className="text-xs md:text-sm" style={{ color: "var(--text-secondary)", fontWeight: 400 }}>{unit}</span>
          </p>
          <p style={{ color: "var(--text-secondary)", fontSize: "12px" }}>{description}</p>
        </div>
      ))}
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
