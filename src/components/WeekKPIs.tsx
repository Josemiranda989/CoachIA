import { Suspense } from "react";
import Link from "next/link";
import { Scale, Bike, Dumbbell, Target, type LucideIcon } from "lucide-react";
import {
  getWeightDelta,
  getGymWeek,
  getCyclingWeek,
  getMesocycle,
} from "@/lib/queries/getWeekKPIs";

type Accent = "primary" | "gym" | "cycling";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

type KPICardProps = {
  label: string;
  icon: LucideIcon;
  accent: Accent;
  href: string;
  value: string;
  unit: string;
  hint: string;
};

function KPICard({ label, icon: Icon, accent, href, value, unit, hint }: KPICardProps) {
  const accentVar = `var(--accent-${accent})`;
  return (
    <Link
      href={href}
      className="card group block transition-transform hover:scale-[1.02]"
      style={{
        background: `color-mix(in srgb, ${accentVar} 7%, transparent)`,
        borderColor: `color-mix(in srgb, ${accentVar} 22%, transparent)`,
        padding: 14,
      }}
      aria-label={`${label}: ${value} ${unit}. ${hint}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div
          className="p-2 rounded-xl"
          style={{ background: `color-mix(in srgb, ${accentVar} 13%, transparent)` }}
        >
          <Icon size={18} style={{ color: accentVar }} aria-hidden="true" />
        </div>
        <span
          className="text-[10px] uppercase tracking-widest font-bold"
          style={{ color: "var(--text-secondary)" }}
        >
          {label}
        </span>
      </div>
      <p className="font-bold mb-1 text-2xl md:text-3xl" style={{ color: accentVar }}>
        {value}
        {unit && (
          <span
            className="text-xs ml-1"
            style={{ color: "var(--text-secondary)", fontWeight: 400 }}
          >
            {unit}
          </span>
        )}
      </p>
      <p style={{ color: "var(--text-secondary)", fontSize: 11 }}>{hint}</p>
    </Link>
  );
}

function KPICardSkeleton({ accent }: { accent: Accent }) {
  const accentVar = `var(--accent-${accent})`;
  return (
    <div
      className="card"
      style={{
        background: `color-mix(in srgb, ${accentVar} 5%, transparent)`,
        borderColor: `color-mix(in srgb, ${accentVar} 15%, transparent)`,
        padding: 14,
        opacity: 0.6,
      }}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between mb-2">
        <div
          className="rounded-xl"
          style={{
            background: `color-mix(in srgb, ${accentVar} 13%, transparent)`,
            width: 34,
            height: 34,
          }}
        />
        <div style={{ width: 56, height: 10, background: "var(--bg-card)", borderRadius: 3 }} />
      </div>
      <div style={{ width: "55%", height: 24, background: "var(--bg-card)", borderRadius: 4, marginBottom: 6 }} />
      <div style={{ width: "75%", height: 11, background: "var(--bg-card)", borderRadius: 3 }} />
    </div>
  );
}

async function WeightCard({ userId }: { userId: string }) {
  const data = await getWeightDelta(userId);
  if (!data) {
    return (
      <KPICard
        label="Peso"
        icon={Scale}
        accent="primary"
        href="/metrics"
        value="—"
        unit=""
        hint="Subí tu primer pesaje"
      />
    );
  }
  const deltaHint =
    data.delta === null
      ? "Sin dato previo"
      : Math.abs(data.delta) < 0.05
        ? "Estable vs sem"
        : `${data.delta > 0 ? "↑" : "↓"} ${Math.abs(data.delta).toFixed(1)} kg vs sem`;
  return (
    <KPICard
      label="Peso"
      icon={Scale}
      accent="primary"
      href="/metrics"
      value={data.current.toFixed(1)}
      unit="kg"
      hint={deltaHint}
    />
  );
}

async function GymWeekCard({ userId, weekStart }: { userId: string; weekStart: string }) {
  const { sessions, volume } = await getGymWeek(userId, weekStart);
  const volumeHint =
    sessions === 0
      ? "Sin sesiones esta sem"
      : volume >= 1000
        ? `${(volume / 1000).toFixed(1)}t volumen`
        : `${Math.round(volume)} kg volumen`;
  return (
    <KPICard
      label="Gym esta sem"
      icon={Dumbbell}
      accent="gym"
      href="/metrics"
      value={String(sessions)}
      unit={sessions === 1 ? "sesión" : "sesiones"}
      hint={volumeHint}
    />
  );
}

async function CyclingWeekCard({ userId, weekStart }: { userId: string; weekStart: string }) {
  const data = await getCyclingWeek(userId, weekStart);
  if (!data) {
    return (
      <KPICard
        label="Bici esta sem"
        icon={Bike}
        accent="cycling"
        href="/metrics"
        value="—"
        unit=""
        hint="Conectá Strava en Métricas"
      />
    );
  }
  const hint =
    data.count === 0
      ? "Sin salidas esta sem"
      : `${formatDuration(data.durationSec)} · ${data.count} ${data.count === 1 ? "salida" : "salidas"}`;
  return (
    <KPICard
      label="Bici esta sem"
      icon={Bike}
      accent="cycling"
      href="/metrics"
      value={data.distance.toFixed(0)}
      unit="km"
      hint={hint}
    />
  );
}

async function MesocycleCard({ userId, weekStart }: { userId: string; weekStart: string }) {
  const data = await getMesocycle(userId, weekStart);
  if (!data) {
    return (
      <KPICard
        label="Mesociclo"
        icon={Target}
        accent="primary"
        href="/routine/generate"
        value="—"
        unit=""
        hint="Generá tu rutina"
      />
    );
  }
  const valueStr = data.total > 1 ? `${data.week}/${data.total}` : String(data.week);
  return (
    <KPICard
      label="Mesociclo"
      icon={Target}
      accent="primary"
      href="/routine/week"
      value={valueStr}
      unit={data.total > 1 ? "sem" : "sem única"}
      hint={data.phase ?? "Semana actual"}
    />
  );
}

export function WeekKPIs({ userId, weekStart }: { userId: string; weekStart: string }) {
  return (
    <section
      className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 mb-6 animate-fade-up"
      style={{ animationDelay: "45ms" }}
      aria-label="Resumen de la semana"
    >
      <WeightCard userId={userId} />
      <GymWeekCard userId={userId} weekStart={weekStart} />
      <MesocycleCard userId={userId} weekStart={weekStart} />
      <Suspense fallback={<KPICardSkeleton accent="cycling" />}>
        <CyclingWeekCard userId={userId} weekStart={weekStart} />
      </Suspense>
    </section>
  );
}
