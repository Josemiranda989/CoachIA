"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { FitnessPoint } from "@/lib/fitness";

interface Props {
  data: FitnessPoint[];
  current: FitnessPoint | null;
}

const COLORS = {
  ctl: "var(--accent-cycling)", // fitness → teal
  atl: "var(--accent-gym)",     // fatigue → amber  
  tsb: "var(--accent-primary)", // balance → red (attention)
};

export function FitnessChartView({ data, current }: Props) {
  if (!data.length) {
    return (
      <div className="card" style={{ padding: 24, textAlign: "center" }}>
        <p style={{ color: "var(--text-secondary)" }}>
          No hay suficientes datos de entrenamiento. Conectá Strava y registrá
          algunas salidas en bici.
        </p>
      </div>
    );
  }

  const chartData = data.slice(-60).map((p) => ({
    date: p.date.slice(5), // MM-DD
    ctl: p.ctl,
    atl: p.atl,
    tsb: p.tsb,
  }));

  return (
    <div
      className="card"
      style={{ padding: "20px 16px 8px", overflow: "hidden" }}
    >
      {/* Current values badge */}
      {current && (
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              color: COLORS.ctl,
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            CTL {current.ctl}
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-secondary)", marginLeft: 4 }}>
              (Fitness · media 42 días)
            </span>
          </span>
          <span
            style={{
              color: COLORS.atl,
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            ATL {current.atl}
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-secondary)", marginLeft: 4 }}>
              (Fatiga · media 7 días)
            </span>
          </span>
          <span
            style={{
              color: current.tsb >= 0 ? "var(--accent-cycling)" : "var(--accent-primary)",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            TSB {current.tsb > 0 ? "+" : ""}
            {current.tsb}
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-secondary)", marginLeft: 4 }}>
              ({current.tsb >= 0 ? "Fresco" : "Fatigado"} · CTL−ATL)
            </span>
          </span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-card)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--text-primary)",
            }}
            formatter={(value: any, name: any): any => [
              value,
              String(name).toUpperCase(),
            ]}
            labelFormatter={(label: any) => `Fecha: ${label}`}
          />
          <ReferenceLine y={0} stroke="var(--border-card)" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="ctl"
            stroke={COLORS.ctl}
            strokeWidth={2}
            dot={false}
            name="Fitness (CTL)"
          />
          <Line
            type="monotone"
            dataKey="atl"
            stroke={COLORS.atl}
            strokeWidth={1.5}
            dot={false}
            name="Fatiga (ATL)"
          />
          <Line
            type="monotone"
            dataKey="tsb"
            stroke={COLORS.tsb}
            strokeWidth={1.5}
            dot={false}
            name="Balance (TSB)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
