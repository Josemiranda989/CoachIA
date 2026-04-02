"use client";

import { useState, useEffect, useMemo } from "react";
import { DEFAULT_FETCH_DAYS } from "@/lib/google-fit";

interface DailyFitData {
  date: string;
  steps: number;
  heartRateAvg: number | null;
  weightKg: number | null;
  activeMinutes: number;
  caloriesBurned: number;
}

interface GoogleFitData {
  days: DailyFitData[];
  totals: {
    steps: number;
    activeMinutes: number;
    caloriesBurned: number;
  };
}

interface Props {
  isConnected: boolean;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  unit: string;
  description: string;
}

function MetricCard({ title, value, unit, description }: MetricCardProps) {
  return (
    <div className="card">
      <h3 style={{ color: "var(--accent-gym)" }}>{title}</h3>
      <p style={{ fontSize: "32px", fontWeight: "bold", margin: "12px 0" }}>
        {value} <span style={{ fontSize: "16px", color: "var(--text-secondary)" }}>{unit}</span>
      </p>
      <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>{description}</p>
    </div>
  );
}

export default function GoogleFitSection({ isConnected }: Props) {
  const [data, setData] = useState<GoogleFitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (!isConnected) return;

    const controller = new AbortController();
    setLoading(true);

    fetch(`/api/google-fit/data?days=${DEFAULT_FETCH_DAYS}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError("Error al cargar datos de Google Fit");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [isConnected]);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/google-fit/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Disconnect failed");
      window.location.reload();
    } catch {
      setDisconnecting(false);
      setError("Error al desconectar Google Fit");
    }
  }

  const { latestWeight, avgHR, stepsAvg7 } = useMemo(() => {
    if (!data) return { latestWeight: null, avgHR: null, stepsAvg7: 0 };

    const last7 = data.days.slice(-DEFAULT_FETCH_DAYS);
    const weight = data.days.filter((d) => d.weightKg).pop()?.weightKg ?? null;
    const withHR = last7.filter((d) => d.heartRateAvg);
    const hr = withHR.length
      ? Math.round(withHR.reduce((a, d) => a + d.heartRateAvg!, 0) / withHR.length)
      : null;
    const steps = last7.length
      ? Math.round(last7.reduce((a, d) => a + d.steps, 0) / last7.length)
      : 0;

    return { latestWeight: weight, avgHR: hr, stepsAvg7: steps };
  }, [data]);

  if (!isConnected) {
    return (
      <div className="card" style={{ borderColor: "var(--accent-gym)", gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
          <span style={{ fontSize: "24px" }}>🏃</span>
          <h3 style={{ color: "var(--accent-gym)", margin: 0 }}>Google Fit — Galaxy Watch 7</h3>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "16px" }}>
          Conectá tu cuenta de Google para importar pasos, frecuencia cardíaca, minutos activos y calorías del Galaxy Watch 7.
        </p>
        <a
          href="/api/google-fit/connect"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            backgroundColor: "var(--accent)",
            color: "white",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: "600",
            fontSize: "14px",
          }}
        >
          Conectar Google Fit
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <h3 style={{ color: "var(--accent-gym)" }}>🏃 Google Fit — Cargando datos...</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Obteniendo datos del Galaxy Watch 7</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ gridColumn: "1 / -1", borderColor: "#ef4444" }}>
        <h3 style={{ color: "#ef4444" }}>🏃 Google Fit — Error</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>{error}</p>
        <button
          onClick={handleDisconnect}
          style={{ marginTop: "12px", padding: "8px 16px", backgroundColor: "#374151", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}
        >
          Desconectar
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="card" style={{ gridColumn: "1 / -1", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "20px" }}>🏃</span>
          <span style={{ fontWeight: "600", color: "var(--accent-gym)" }}>Google Fit — Galaxy Watch 7</span>
          <span style={{ fontSize: "12px", color: "#22c55e", background: "#052e16", padding: "2px 8px", borderRadius: "999px" }}>Conectado</span>
        </div>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          style={{ padding: "6px 14px", backgroundColor: "#374151", color: "var(--text-secondary)", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}
        >
          {disconnecting ? "Desconectando..." : "Desconectar"}
        </button>
      </div>

      <MetricCard
        title={`Pasos (promedio ${DEFAULT_FETCH_DAYS}d)`}
        value={stepsAvg7.toLocaleString()}
        unit="pasos/día"
        description={`Últimos ${DEFAULT_FETCH_DAYS} días`}
      />
      <MetricCard
        title={`FC Media (${DEFAULT_FETCH_DAYS}d)`}
        value={avgHR ?? "—"}
        unit="bpm"
        description="Frecuencia cardíaca promedio"
      />
      <MetricCard
        title={`Minutos Activos (${DEFAULT_FETCH_DAYS}d)`}
        value={data?.totals.activeMinutes ?? 0}
        unit="min"
        description={`Últimos ${DEFAULT_FETCH_DAYS} días acumulado`}
      />
      {latestWeight && (
        <MetricCard
          title="Peso Corporal"
          value={latestWeight.toFixed(1)}
          unit="kg"
          description="Último registro sincronizado"
        />
      )}
      <MetricCard
        title={`Calorías (${DEFAULT_FETCH_DAYS}d)`}
        value={Math.round(data?.totals.caloriesBurned ?? 0).toLocaleString()}
        unit="kcal"
        description={`Total quemado en ${DEFAULT_FETCH_DAYS} días`}
      />
    </>
  );
}
