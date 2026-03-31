"use client";
import { useState } from "react";

export function StravaConnect({ isConnected }: { isConnected: boolean }) {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(isConnected);

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await fetch("/api/strava/disconnect", { method: "POST" });
      setConnected(false);
    } catch {
      alert("Error al desconectar Strava");
    } finally {
      setLoading(false);
    }
  };

  if (connected) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderRadius: 12,
          background: "rgba(16,185,129,0.08)",
          border: "1px solid rgba(16,185,129,0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <StravaIcon />
          <div>
            <p style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 15 }}>
              Strava conectado
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              Tus actividades se sincronizan automáticamente
            </p>
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          disabled={loading}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid var(--glass-border)",
            background: "var(--glass-bg)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {loading ? "..." : "Desconectar"}
        </button>
      </div>
    );
  }

  return (
    <a
      href="/api/strava/connect"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "16px 24px",
        borderRadius: 12,
        background: "#FC4C02",
        color: "#fff",
        fontWeight: 700,
        fontSize: 15,
        textDecoration: "none",
        transition: "all 0.2s ease",
        boxShadow: "0 4px 16px rgba(252, 76, 2, 0.3)",
      }}
    >
      <StravaIcon />
      Conectar con Strava
    </a>
  );
}

function StravaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 64 64" fill="currentColor">
      <path d="M41.03 47.852l-5.572-10.976h-8.172L41.03 64l13.736-27.124h-8.18" />
      <path d="M27.898 21.944l7.564 14.928h11.124L27.898 0 9.234 36.876H20.35" opacity=".6" />
    </svg>
  );
}
