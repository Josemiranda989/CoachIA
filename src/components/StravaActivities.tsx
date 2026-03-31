"use client";
import { useEffect, useState } from "react";
import { Bike, Clock, TrendingUp, Mountain, Heart, Zap } from "lucide-react";

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  start_date_local: string;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  kilojoules?: number;
  suffer_score?: number;
}

interface StravaStats {
  recent_ride_totals: { count: number; distance: number; moving_time: number; elevation_gain: number };
  ytd_ride_totals: { count: number; distance: number; moving_time: number; elevation_gain: number };
  all_ride_totals: { count: number; distance: number; moving_time: number; elevation_gain: number };
}

function formatDistance(meters: number) {
  return (meters / 1000).toFixed(1);
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatSpeed(metersPerSec: number) {
  return (metersPerSec * 3.6).toFixed(1);
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

function activityIcon(type: string) {
  if (type === "Ride" || type === "VirtualRide") return Bike;
  return TrendingUp;
}

export function StravaActivities() {
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [stats, setStats] = useState<StravaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/strava/activities?per_page=10")
      .then((r) => {
        if (!r.ok) throw new Error("Error al cargar actividades");
        return r.json();
      })
      .then((data) => {
        setActivities(data.activities || []);
        setStats(data.stats || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
        Cargando actividades de Strava...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "16px 20px",
          borderRadius: 12,
          background: "rgba(220,38,38,0.08)",
          border: "1px solid rgba(220,38,38,0.2)",
          color: "var(--accent-primary)",
          fontSize: 14,
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div>
      {/* Stats resumen */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
          <StatCard
            label="Rides este año"
            value={stats.ytd_ride_totals.count.toString()}
            unit="rides"
            icon={Bike}
          />
          <StatCard
            label="Distancia año"
            value={formatDistance(stats.ytd_ride_totals.distance)}
            unit="km"
            icon={TrendingUp}
          />
          <StatCard
            label="Tiempo año"
            value={formatDuration(stats.ytd_ride_totals.moving_time)}
            unit=""
            icon={Clock}
          />
          <StatCard
            label="Desnivel año"
            value={Math.round(stats.ytd_ride_totals.elevation_gain).toString()}
            unit="m"
            icon={Mountain}
          />
        </div>
      )}

      {/* Activity list */}
      <h3
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 12,
        }}
      >
        Últimas actividades
      </h3>

      {activities.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          No hay actividades recientes.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {activities.map((act) => {
            const Icon = activityIcon(act.type);
            return (
              <div
                key={act.id}
                className="card"
                style={{
                  cursor: "default",
                  padding: "16px 20px",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "rgba(252,76,2,0.12)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={16} style={{ color: "#FC4C02" }} />
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                        {act.name}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {formatDate(act.start_date_local)}
                      </p>
                    </div>
                  </div>
                  {act.suffer_score && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "4px 8px",
                        borderRadius: 6,
                        background: "rgba(252,76,2,0.12)",
                        color: "#FC4C02",
                      }}
                    >
                      {act.suffer_score} pts
                    </span>
                  )}
                </div>

                {/* Metrics grid */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                  <Metric icon={Bike} label="Distancia" value={`${formatDistance(act.distance)} km`} />
                  <Metric icon={Clock} label="Tiempo" value={formatDuration(act.moving_time)} />
                  <Metric icon={TrendingUp} label="Vel. media" value={`${formatSpeed(act.average_speed)} km/h`} />
                  <Metric icon={Mountain} label="Desnivel" value={`${Math.round(act.total_elevation_gain)} m`} />
                  {act.average_heartrate && (
                    <Metric icon={Heart} label="FC media" value={`${Math.round(act.average_heartrate)} bpm`} />
                  )}
                  {act.average_watts && (
                    <Metric icon={Zap} label="Potencia" value={`${Math.round(act.average_watts)} W`} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, unit, icon: Icon }: { label: string; value: string; unit: string; icon: any }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        background: "rgba(252,76,2,0.06)",
        border: "1px solid rgba(252,76,2,0.15)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <Icon size={14} style={{ color: "#FC4C02" }} />
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, color: "#FC4C02" }}>
        {value}{" "}
        <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-secondary)" }}>{unit}</span>
      </p>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <Icon size={13} style={{ color: "var(--text-secondary)", opacity: 0.6 }} />
      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}:</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
