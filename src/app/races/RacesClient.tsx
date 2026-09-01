"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Trash2, Plus, MapPin, Mountain, Gauge } from "lucide-react";
import type { RaceWithCountdown } from "@/lib/queries/getRaces";

const DISCIPLINE_LABEL: Record<string, string> = {
  cycling: "Ciclismo",
  running: "Running",
  trail: "Trail",
};

function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function countdownLabel(daysUntil: number): string {
  if (daysUntil === 0) return "¡Es hoy!";
  if (daysUntil === 1) return "Mañana";
  return `Faltan ${daysUntil} días`;
}

export function RacesClient({ initialRaces }: { initialRaces: RaceWithCountdown[] }) {
  const router = useRouter();
  const [races, setRaces] = useState(initialRaces);
  const [showForm, setShowForm] = useState(initialRaces.length === 0);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [elevationM, setElevationM] = useState("");
  const [discipline, setDiscipline] = useState("cycling");

  const resetForm = () => {
    setName(""); setDate(""); setLocation("");
    setDistanceKm(""); setElevationM(""); setDiscipline("cycling");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/races", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          date,
          location: location || undefined,
          distanceKm: distanceKm ? Number(distanceKm) : undefined,
          elevationM: elevationM ? Number(elevationM) : undefined,
          discipline,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "No se pudo guardar la carrera");
      }
      toast.success("Carrera agregada");
      resetForm();
      setShowForm(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/races/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo borrar la carrera");
      setRaces((prev) => prev.filter((r) => r.id !== id));
      toast.success("Carrera eliminada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al borrar");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mt-6">
      {races.length === 0 && !showForm && (
        <div className="card">
          <p className="text-text-secondary">Todavía no cargaste ninguna carrera.</p>
        </div>
      )}

      <div className="flex flex-col gap-4 mb-6">
        {races.map((race) => (
          <div key={race.id} className="card" style={{ position: "relative" }}>
            <div className="flex items-start justify-between gap-4">
              <div style={{ minWidth: 0 }}>
                <span
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: "var(--accent-cycling)" }}
                >
                  {countdownLabel(race.daysUntil)} · {DISCIPLINE_LABEL[race.discipline] ?? race.discipline}
                </span>
                <h2 className="text-xl font-bold mt-1 mb-1" style={{ color: "var(--text-primary)" }}>
                  {race.name}
                </h2>
                <p className="text-sm text-text-secondary mb-2">{formatDate(race.date)}</p>
                <div className="flex flex-wrap gap-3 text-sm text-text-secondary">
                  {race.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={14} aria-hidden="true" /> {race.location}
                    </span>
                  )}
                  {(race.distanceKm || race.elevationM) && (
                    <span className="flex items-center gap-1">
                      <Mountain size={14} aria-hidden="true" />
                      {race.distanceKm ? `${race.distanceKm}km` : ""}
                      {race.distanceKm && race.elevationM ? " · " : ""}
                      {race.elevationM ? `${race.elevationM}m D+` : ""}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {race.distanceKm && (
                  <Link
                    href={`/races/${race.id}/pacing`}
                    className="flex items-center gap-1 text-xs font-semibold"
                    style={{ color: "var(--accent-cycling)" }}
                  >
                    <Gauge size={14} aria-hidden="true" /> Pacing
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(race.id)}
                  disabled={deletingId === race.id}
                  aria-label={`Eliminar ${race.name}`}
                  style={{ color: "var(--text-secondary)", opacity: deletingId === race.id ? 0.4 : 1 }}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!showForm && (
        <button type="button" className="btn" onClick={() => setShowForm(true)}>
          <Plus size={18} aria-hidden="true" style={{ marginRight: 6 }} />
          Agregar carrera
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1" htmlFor="race-name">Nombre</label>
            <input
              id="race-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aguilares → Catamarca"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1" htmlFor="race-date">Fecha</label>
              <input
                id="race-date"
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1" htmlFor="race-discipline">Disciplina</label>
              <select
                id="race-discipline"
                className="input"
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
              >
                <option value="cycling">Ciclismo</option>
                <option value="running">Running</option>
                <option value="trail">Trail</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1" htmlFor="race-location">Ubicación</label>
            <input
              id="race-location"
              className="input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Catamarca"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1" htmlFor="race-distance">Distancia (km)</label>
              <input
                id="race-distance"
                type="number"
                step="0.1"
                className="input"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="159"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1" htmlFor="race-elevation">Desnivel (m)</label>
              <input
                id="race-elevation"
                type="number"
                className="input"
                value={elevationM}
                onChange={(e) => setElevationM(e.target.value)}
                placeholder="1800"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn">
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              className="btn"
              style={{ background: "transparent", color: "var(--text-secondary)" }}
              onClick={() => { setShowForm(false); resetForm(); }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
