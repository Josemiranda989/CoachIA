import { Dumbbell, Clock, Heart, CalendarDays } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { getValidAccessToken, fetchActivities } from "@/lib/strava";
import { prisma } from "@/lib/prisma";

const gymColor = {
  color: "var(--accent-gym)",
  bg: "color-mix(in srgb, var(--accent-gym) 8%, transparent)",
  border: "color-mix(in srgb, var(--accent-gym) 20%, transparent)",
};

export async function GymStravaCards({ userId }: { userId: string }) {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return null;

  let activities: unknown[];
  try {
    activities = await fetchActivities(accessToken, 1, 50);
  } catch {
    // Strava puede devolver 403/429 con un token técnicamente válido (rate
    // limit, scope insuficiente, etc). No crashear /metrics entera por esto.
    return null;
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const gymSessions = (activities as any[]).filter(
    (a) => a.type === "WeightTraining" && new Date(a.start_date) >= cutoff
  );

  if (gymSessions.length === 0) return null;

  const totalMins = Math.round(
    gymSessions.reduce((s, a) => s + (a.moving_time || 0) / 60, 0)
  );
  const avgHrValues = gymSessions
    .map((a) => a.average_heartrate)
    .filter((hr): hr is number => hr != null);
  const avgHr =
    avgHrValues.length > 0
      ? Math.round(
          avgHrValues.reduce((s, hr) => s + hr, 0) / avgHrValues.length
        )
      : null;

  type CardSpec = {
    label: string;
    value: number;
    unit: string;
    description: string;
    icon: typeof Dumbbell;
  };

  const cards: CardSpec[] = [
    {
      label: "Sesiones Gym (30d)",
      value: gymSessions.length,
      unit: "días",
      description: "Sesiones de pesas registradas en Strava vía Hevy",
      icon: CalendarDays,
    },
    {
      label: "Minutos Gym (30d)",
      value: totalMins,
      unit: "min",
      description: `Promedio ${Math.round(totalMins / gymSessions.length)} min por sesión`,
      icon: Clock,
    },
  ];

  if (avgHr !== null) {
    cards.push({
      label: "FC Media Gym",
      value: avgHr,
      unit: "bpm",
      description: `Frecuencia cardíaca promedio en ${gymSessions.length} sesiones`,
      icon: Heart,
    });
  }

  return (
    <>
      {cards.map(({ label, value, unit, description, icon: Icon }) => (
        <div
          key={label}
          className="card"
          style={{
            cursor: "default",
            background: gymColor.bg,
            borderColor: gymColor.border,
          }}
        >
          <div className="flex items-start justify-between mb-3">
            <div
              className="p-2 rounded-xl"
              style={{
                background: `color-mix(in srgb, ${gymColor.color} 13%, transparent)`,
              }}
            >
              <Icon
                size={20}
                style={{ color: gymColor.color }}
                aria-hidden="true"
              />
            </div>
          </div>
          <p
            className="text-sm font-semibold mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {label}
          </p>
          <p
            className="font-bold mb-1 text-xl md:text-3xl"
            style={{ color: gymColor.color }}
          >
            <CountUp value={value} decimals={0} />{" "}
            <span
              className="text-xs md:text-sm"
              style={{
                color: "var(--text-secondary)",
                fontWeight: 400,
              }}
            >
              {unit}
            </span>
          </p>
          <p style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
            {description}
          </p>
        </div>
      ))}
    </>
  );
}

export function GymStravaCardsSkeleton() {
  return (
    <>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="card"
          style={{
            background: gymColor.bg,
            borderColor: gymColor.border,
            opacity: 0.5,
          }}
          aria-hidden="true"
        >
          <div
            className="p-2 rounded-xl mb-3 w-fit"
            style={{
              background: `color-mix(in srgb, ${gymColor.color} 13%, transparent)`,
              height: 36,
              width: 36,
            }}
          />
          <div
            style={{
              height: 14,
              background: "var(--bg-card)",
              borderRadius: 4,
              marginBottom: 6,
              width: "70%",
            }}
          />
          <div
            style={{
              height: 28,
              background: "var(--bg-card)",
              borderRadius: 4,
              marginBottom: 6,
              width: "50%",
            }}
          />
          <div
            style={{
              height: 12,
              background: "var(--bg-card)",
              borderRadius: 4,
              width: "85%",
            }}
          />
        </div>
      ))}
    </>
  );
}
