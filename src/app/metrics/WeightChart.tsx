"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Scale, TrendingDown, TrendingUp, Minus } from "lucide-react";

interface WeightRecord {
  id: string;
  date: string;
  weight: number;
  bodyFat: number | null;
}

interface ChartData {
  date: string;
  label: string;
  weight: number;
  bodyFat: number | null;
}

export function WeightChart() {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/weight?limit=60")
      .then((res) => res.json())
      .then((records: WeightRecord[]) => {
        const sorted = records
          .sort(
            (a: WeightRecord, b: WeightRecord) =>
              new Date(a.date).getTime() - new Date(b.date).getTime()
          )
          .map((r: WeightRecord) => ({
            date: r.date,
            label: new Date(r.date).toLocaleDateString("es-AR", {
              day: "numeric",
              month: "short",
            }),
            weight: r.weight,
            bodyFat: r.bodyFat,
          }));
        setData(sorted);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        className="card col-span-2 lg:col-span-3"
        style={{ background: "rgba(139,92,246,0.08)", borderColor: "rgba(139,92,246,0.2)" }}
      >
        <p className="text-text-secondary text-sm">Cargando peso...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className="card col-span-2 lg:col-span-3"
        style={{ background: "rgba(139,92,246,0.08)", borderColor: "rgba(139,92,246,0.2)" }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl" style={{ background: "rgba(139,92,246,0.15)" }}>
            <Scale size={20} style={{ color: "#8b5cf6" }} />
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

  return (
    <div
      className="card col-span-2 lg:col-span-3"
      style={{ background: "rgba(139,92,246,0.08)", borderColor: "rgba(139,92,246,0.2)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ background: "rgba(139,92,246,0.15)" }}>
            <Scale size={20} style={{ color: "#8b5cf6" }} />
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
            <TrendIcon size={14} style={{ color: trendColor }} />
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
              domain={[minW, maxW]}
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={35}
            />
            <Tooltip
              contentStyle={{
                background: "var(--bg-card)",
                border: "1px solid rgba(139,92,246,0.3)",
                borderRadius: 12,
                fontSize: 13,
              }}
              labelStyle={{ color: "var(--text-secondary)" }}
              formatter={(value: number) => [`${value} kg`, "Peso"]}
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke="#8b5cf6"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#8b5cf6" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
