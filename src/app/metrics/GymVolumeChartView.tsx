"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Dumbbell, TrendingUp } from "lucide-react";

export interface GymSessionData {
  id: string;
  label: string;
  volume: number;
  sets: number;
  movingAvg: number;
}

const GYM = "var(--accent-gym)";

function formatVolume(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

export function GymVolumeChartView({ data }: { data: GymSessionData[] }) {
  if (data.length === 0) {
    return (
      <div
        className="card col-span-2 lg:col-span-3"
        style={{
          background: "color-mix(in srgb, var(--accent-gym) 8%, transparent)",
          borderColor: "color-mix(in srgb, var(--accent-gym) 20%, transparent)",
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className="p-2 rounded-xl"
            style={{ background: "color-mix(in srgb, var(--accent-gym) 15%, transparent)" }}
          >
            <Dumbbell size={20} style={{ color: GYM }} aria-hidden="true" />
          </div>
          <p className="font-bold text-lg" style={{ color: GYM }}>
            Volumen por Sesión
          </p>
        </div>
        <p className="text-text-secondary text-sm">
          Registrá tus sets en el workout de hoy para ver la tendencia de volumen levantado.
        </p>
      </div>
    );
  }

  const lastVolume = data[data.length - 1].volume;
  const lastAvg = data[data.length - 1].movingAvg;
  const delta = lastVolume - lastAvg;
  // With < 3 sessions the trailing-3 average is basically a copy of the bars
  // and clutters the chart, so we hide the moving-average line in that case.
  const showMovingAvg = data.length >= 3;

  return (
    <div
      className="card col-span-2 lg:col-span-3"
      style={{
        background: "color-mix(in srgb, var(--accent-gym) 8%, transparent)",
        borderColor: "color-mix(in srgb, var(--accent-gym) 20%, transparent)",
      }}
    >
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-xl"
            style={{ background: "color-mix(in srgb, var(--accent-gym) 15%, transparent)" }}
          >
            <Dumbbell size={20} style={{ color: GYM }} aria-hidden="true" />
          </div>
          <div>
            <p className="font-bold text-lg" style={{ color: GYM }}>
              Volumen por Sesión
            </p>
            <p className="text-text-secondary text-xs">
              Últimas {data.length} sesiones{showMovingAvg ? " · media móvil 3" : ""}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-2xl" style={{ color: GYM }}>
            {formatVolume(lastVolume)}{" "}
            <span className="text-sm text-text-secondary font-normal">kg</span>
          </p>
          {showMovingAvg && (
            <div className="flex items-center gap-1 justify-end">
              <TrendingUp size={14} style={{ color: GYM }} aria-hidden="true" />
              <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                {delta >= 0 ? "+" : ""}
                {formatVolume(Math.round(delta))} vs media
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="w-full h-[200px] md:h-[280px]">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={45}
              tickFormatter={formatVolume}
            />
            <Tooltip
              contentStyle={{
                background: "var(--bg-card)",
                border: "1px solid color-mix(in srgb, var(--accent-gym) 30%, transparent)",
                borderRadius: 12,
                fontSize: 13,
              }}
              labelStyle={{ color: "var(--text-secondary)" }}
              formatter={(value, name) => {
                if (name === "Volumen") return [`${Number(value).toLocaleString("es-AR")} kg`, "Volumen"];
                if (name === "Media móvil") return [`${Number(value).toLocaleString("es-AR")} kg`, "Media móvil"];
                return [String(value), String(name)];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
            <Bar
              dataKey="volume"
              name="Volumen"
              fill={GYM}
              radius={[6, 6, 0, 0]}
              maxBarSize={28}
            />
            {showMovingAvg && (
              <Line
                type="monotone"
                dataKey="movingAvg"
                name="Media móvil"
                stroke="#f59e0b"
                strokeWidth={2.5}
                strokeDasharray="4 3"
                dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#f59e0b" }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function GymVolumeChartSkeleton() {
  return (
    <div
      className="card col-span-2 lg:col-span-3"
      style={{
        background: "color-mix(in srgb, var(--accent-gym) 8%, transparent)",
        borderColor: "color-mix(in srgb, var(--accent-gym) 20%, transparent)",
        opacity: 0.5,
      }}
      aria-hidden="true"
    >
      <div role="status" aria-live="polite" className="text-text-secondary text-sm">
        Cargando volumen de gym…
      </div>
      <div className="w-full h-[200px] md:h-[280px]" />
    </div>
  );
}
