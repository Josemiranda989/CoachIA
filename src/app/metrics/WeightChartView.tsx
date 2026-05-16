"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Scale, TrendingDown, TrendingUp, Minus } from "lucide-react";

export interface ChartData {
  date: string;
  label: string;
  weight: number;
  bodyFat: number | null;
  muscle: number | null;
}

export function WeightChartView({ data }: { data: ChartData[] }) {
  if (data.length === 0) {
    return (
      <div
        className="card col-span-2 lg:col-span-3"
        style={{ background: "rgba(139,92,246,0.08)", borderColor: "rgba(139,92,246,0.2)" }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl" style={{ background: "rgba(139,92,246,0.15)" }}>
            <Scale size={20} style={{ color: "#8b5cf6" }} aria-hidden="true" />
          </div>
          <p className="font-bold text-lg" style={{ color: "#8b5cf6" }}>
            Tendencia de Peso
          </p>
        </div>
        <p className="text-text-secondary text-sm">
          Sin datos de peso. Pesate con la Xiaomi S400 para ver la tendencia.
        </p>
      </div>
    );
  }

  const current = data[data.length - 1].weight;
  const first = data[0].weight;
  const delta = current - first;
  const TrendIcon = delta > 0.2 ? TrendingUp : delta < -0.2 ? TrendingDown : Minus;
  const trendColor = delta > 0.2 ? "#ef4444" : delta < -0.2 ? "#10b981" : "#8b5cf6";

  const weights = data.map((d) => d.weight);
  const minW = Math.floor(Math.min(...weights) - 1);
  const maxW = Math.ceil(Math.max(...weights) + 1);

  const fats = data.map((d) => d.bodyFat).filter((v): v is number => v != null);
  const muscles = data.map((d) => d.muscle).filter((v): v is number => v != null);
  const hasFat = fats.length > 0;
  const hasMuscle = muscles.length > 0;
  // Fat and muscle share the right Y-axis. Range covers both so both lines stay visible.
  const pcts = [...fats, ...muscles];
  const hasPct = pcts.length > 0;
  const minF = hasPct ? Math.floor(Math.min(...pcts) - 1) : 0;
  const maxF = hasPct ? Math.ceil(Math.max(...pcts) + 1) : 100;

  return (
    <div
      className="card col-span-2 lg:col-span-3"
      style={{ background: "rgba(139,92,246,0.08)", borderColor: "rgba(139,92,246,0.2)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ background: "rgba(139,92,246,0.15)" }}>
            <Scale size={20} style={{ color: "#8b5cf6" }} aria-hidden="true" />
          </div>
          <div>
            <p className="font-bold text-lg" style={{ color: "#8b5cf6" }}>
              Tendencia de Peso
            </p>
            <p className="text-text-secondary text-xs">
              {data.length} mediciones
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-2xl" style={{ color: "#8b5cf6" }}>
            {current} <span className="text-sm text-text-secondary font-normal">kg</span>
          </p>
          <div className="flex items-center gap-1 justify-end">
            <TrendIcon size={14} style={{ color: trendColor }} aria-hidden="true" />
            <span className="text-xs font-semibold" style={{ color: trendColor }}>
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)} kg
            </span>
          </div>
        </div>
      </div>

      <div className="w-full h-[180px] md:h-[250px]">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="weight"
              domain={[minW, maxW]}
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={35}
            />
            {hasPct && (
              <YAxis
                yAxisId="pct"
                orientation="right"
                domain={[minF, maxF]}
                tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={35}
                tickFormatter={(v) => `${v}%`}
              />
            )}
            <Tooltip
              contentStyle={{
                background: "var(--bg-card)",
                border: "1px solid rgba(139,92,246,0.3)",
                borderRadius: 12,
                fontSize: 13,
              }}
              labelStyle={{ color: "var(--text-secondary)" }}
              formatter={(value, name) =>
                name === "Peso" ? [`${value} kg`, String(name)] : [`${value}%`, String(name)]
              }
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              iconType="circle"
            />
            <Line
              yAxisId="weight"
              type="monotone"
              dataKey="weight"
              name="Peso"
              stroke="#8b5cf6"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#8b5cf6" }}
            />
            {hasFat && (
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="bodyFat"
                name="Grasa"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#f59e0b" }}
                connectNulls
              />
            )}
            {hasMuscle && (
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="muscle"
                name="Músculo"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="2 4"
                dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#10b981" }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function WeightChartSkeleton() {
  return (
    <div
      className="card col-span-2 lg:col-span-3"
      style={{ background: "rgba(139,92,246,0.08)", borderColor: "rgba(139,92,246,0.2)", opacity: 0.5 }}
      aria-hidden="true"
    >
      <div role="status" aria-live="polite" className="text-text-secondary text-sm">
        Cargando peso…
      </div>
      <div className="w-full h-[180px] md:h-[250px]" />
    </div>
  );
}
