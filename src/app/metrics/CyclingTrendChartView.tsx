"use client";

import { useState } from "react";
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
import { Bike, Flame, Timer } from "lucide-react";

export interface CyclingWeekData {
  weekStart: string;
  label: string;
  km: number;
  kj: number;
  hours: number;
}

type Overlay = "kj" | "hours";

const CYCLING = "var(--accent-cycling)";

export function CyclingTrendChartView({ data }: { data: CyclingWeekData[] }) {
  const [overlay, setOverlay] = useState<Overlay>("hours");

  const hasRides = data.some((d) => d.km > 0);
  if (!hasRides) {
    return (
      <div
        className="card col-span-2 lg:col-span-3"
        style={{
          background: "color-mix(in srgb, var(--accent-cycling) 8%, transparent)",
          borderColor: "color-mix(in srgb, var(--accent-cycling) 20%, transparent)",
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className="p-2 rounded-xl"
            style={{ background: "color-mix(in srgb, var(--accent-cycling) 15%, transparent)" }}
          >
            <Bike size={20} style={{ color: CYCLING }} aria-hidden="true" />
          </div>
          <p className="font-bold text-lg" style={{ color: CYCLING }}>
            Tendencia Semanal de Ciclismo
          </p>
        </div>
        <p className="text-text-secondary text-sm">
          Sin actividades de Strava en las últimas 12 semanas.
        </p>
      </div>
    );
  }

  const totalKm = data.reduce((s, w) => s + w.km, 0);
  const activeWeeks = data.filter((w) => w.km > 0).length;
  const avgKm = activeWeeks > 0 ? totalKm / activeWeeks : 0;

  const overlayKey: keyof CyclingWeekData = overlay;
  const overlayName = overlay === "kj" ? "Energía (kJ)" : "Horas";
  const overlayUnit = overlay === "kj" ? "kJ" : "hs";
  const overlayColor = overlay === "kj" ? "#f59e0b" : "#10b981";
  const OverlayIcon = overlay === "kj" ? Flame : Timer;

  return (
    <div
      className="card col-span-2 lg:col-span-3"
      style={{
        background: "color-mix(in srgb, var(--accent-cycling) 8%, transparent)",
        borderColor: "color-mix(in srgb, var(--accent-cycling) 20%, transparent)",
      }}
    >
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-xl"
            style={{ background: "color-mix(in srgb, var(--accent-cycling) 15%, transparent)" }}
          >
            <Bike size={20} style={{ color: CYCLING }} aria-hidden="true" />
          </div>
          <div>
            <p className="font-bold text-lg" style={{ color: CYCLING }}>
              Tendencia Semanal de Ciclismo
            </p>
            <p className="text-text-secondary text-xs">
              Últimas 12 semanas · {Math.round(totalKm)} km · prom. {avgKm.toFixed(1)} km/sem activa
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-1 p-1 rounded-xl"
          role="tablist"
          aria-label="Métrica secundaria"
          style={{ background: "color-mix(in srgb, var(--accent-cycling) 10%, transparent)" }}
        >
          {(["hours", "kj"] as const).map((opt) => {
            const active = overlay === opt;
            const Icon = opt === "kj" ? Flame : Timer;
            return (
              <button
                key={opt}
                role="tab"
                aria-selected={active}
                onClick={() => setOverlay(opt)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  background: active
                    ? "color-mix(in srgb, var(--accent-cycling) 22%, transparent)"
                    : "transparent",
                  color: active ? CYCLING : "var(--text-secondary)",
                }}
              >
                <Icon size={12} aria-hidden="true" />
                {opt === "kj" ? "kJ" : "Horas"}
              </button>
            );
          })}
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
              yAxisId="km"
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={35}
            />
            <YAxis
              yAxisId="overlay"
              orientation="right"
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={35}
            />
            <Tooltip
              contentStyle={{
                background: "var(--bg-card)",
                border: "1px solid color-mix(in srgb, var(--accent-cycling) 30%, transparent)",
                borderRadius: 12,
                fontSize: 13,
              }}
              labelStyle={{ color: "var(--text-secondary)" }}
              formatter={(value, name) => {
                if (name === "KM") return [`${value} km`, "KM"];
                if (name === overlayName) return [`${value} ${overlayUnit}`, overlayName];
                return [String(value), String(name)];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
            <Bar
              yAxisId="km"
              dataKey="km"
              name="KM"
              fill={CYCLING}
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
            />
            <Line
              yAxisId="overlay"
              type="monotone"
              dataKey={overlayKey}
              name={overlayName}
              stroke={overlayColor}
              strokeWidth={2.5}
              dot={{ r: 3, fill: overlayColor, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: overlayColor }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-text-secondary text-xs mt-2 flex items-center gap-1">
        <OverlayIcon size={12} aria-hidden="true" style={{ color: overlayColor }} />
        Línea muestra {overlayName.toLowerCase()} por semana.
      </p>
    </div>
  );
}

export function CyclingTrendChartSkeleton() {
  return (
    <div
      className="card col-span-2 lg:col-span-3"
      style={{
        background: "color-mix(in srgb, var(--accent-cycling) 8%, transparent)",
        borderColor: "color-mix(in srgb, var(--accent-cycling) 20%, transparent)",
        opacity: 0.5,
      }}
      aria-hidden="true"
    >
      <div role="status" aria-live="polite" className="text-text-secondary text-sm">
        Cargando tendencia de ciclismo…
      </div>
      <div className="w-full h-[200px] md:h-[280px]" />
    </div>
  );
}
