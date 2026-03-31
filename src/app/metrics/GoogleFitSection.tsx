"use client";

import { useState, useEffect } from "react";

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

export default function GoogleFitSection({ isConnected }: Props) {
  const [data, setData] = useState<GoogleFitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (!isConnected) return;
    setLoading(true);
    fetch("/api/google-fit/data?days=30")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Error al cargar datos de Google Fit"))
      .finally(() => setLoading(false));
  }, [isConnected]);

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/google-fit/disconnect", { method: "POST" });
    window.location.reload();
  }

  // --- No conectado ---
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

  // --- Cargando ---
  if (loading) {
    return (
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <h3 style={{ color: "var(--accent-gym)" }}>🏃 Google Fit — Cargando datos...</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Obteniendo datos del Galaxy Watch 7</p>
      </div>
    );
  }

  // --- Error ---
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

  // --- Conectado con datos ---
  const last7 = data?.days.slice(-7) ?? [];
  const latestWeight = data?.days.filter((d) => d.weightKg).pop()?.weightKg ?? null;
  const avgHR = (() => {
    const withHR = last7.filter((d) => d.heartRateAvg);
    if (!withHR.length) return null;
    return Math.round(withHR.reduce((a, d) => a + d.heartRateAvg!, 0) / withHR.length);
  })();
  const stepsAvg7 = last7.length
    ? Math.round(last7.reduce((a, d) => a + d.steps, 0) / last7.length)
    : 0;

  return (
    <>
      {/* Header row */}
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

      {/* Métricas */}
      <div className="card">
        <h3 style={{ color: "var(--accent-gym)" }}>Pasos (promedio 7d)</h3>
        <p style={{ fontSize: "32px", fontWeight: "bold", margin: "12px 0" }}>
          {stepsAvg7.toLocaleString()} <span style={{ fontSize: "16px", color: "var(--text-secondary)" }}>pasos/día</span>
        </p>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Últimos 7 días</p>
      </div>

      <div className="card">
        <h3 style={{ color: "var(--accent-gym)" }}>FC Media (7d)</h3>
        <p style={{ fontSize: "32px", fontWeight: "bold", margin: "12px 0" }}>
          {avgHR ?? "—"} <span style={{ fontSize: "16px", color: "var(--text-secondary)" }}>bpm</span>
        </p>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Frecuencia cardíaca promedio</p>
      </div>

      <div className="card">
        <h3 style={{ color: "var(--accent-gym)" }}>Minutos Activos (30d)</h3>
        <p style={{ fontSize: "32px", fontWeight: "bold", margin: "12px 0" }}>
          {data?.totals.activeMinutes ?? 0} <span style={{ fontSize: "16px", color: "var(--text-secondary)" }}>min</span>
        </p>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Últimos 30 días acumulado</p>
      </div>

      {latestWeight && (
        <div className="card">
          <h3 style={{ color: "var(--accent-gym)" }}>Peso Corporal</h3>
          <p style={{ fontSize: "32px", fontWeight: "bold", margin: "12px 0" }}>
            {latestWeight.toFixed(1)} <span style={{ fontSize: "16px", color: "var(--text-secondary)" }}>kg</span>
          </p>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Último registro sincronizado</p>
        </div>
      )}

      <div className="card">
        <h3 style={{ color: "var(--accent-gym)" }}>Calorías (30d)</h3>
        <p style={{ fontSize: "32px", fontWeight: "bold", margin: "12px 0" }}>
          {Math.round(data?.totals.caloriesBurned ?? 0).toLocaleString()} <span style={{ fontSize: "16px", color: "var(--text-secondary)" }}>kcal</span>
        </p>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Total quemado en 30 días</p>
      </div>
    </>
  );
}
