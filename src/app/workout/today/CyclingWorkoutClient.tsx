"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Download } from "lucide-react";
import { CyclingBlocks } from "@/components/CyclingBlocks";
import { suggestMyWhooshCategory } from "@/lib/mywhoosh-catalog";
import type { DayWithLogs } from "@/lib/queries/getActiveRoutine";

export type CyclingWorkoutData = DayWithLogs & { completed: boolean };

export function CyclingWorkoutClient({ workout }: { workout: CyclingWorkoutData }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState<boolean>(!!workout.completed);

  const mywhoosh =
    workout.blocks && workout.blocks.length > 0
      ? suggestMyWhooshCategory(workout.blocks, {
          totalDuration: workout.targetDuration ?? undefined,
        })
      : null;

  const handleMarkComplete = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workouts/mark-cycling-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutId: workout.id }),
      });
      if (!res.ok) throw new Error("Error");
      setCompleted(true);
      router.refresh();
    } catch {
      toast.error("Error al marcar como completado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-24 md:pb-0">
      <div className="card" style={{ cursor: "default" }}>
        <h3 className="text-lg font-bold mb-2" style={{ color: "var(--accent-cycling)" }}>
          Objetivo: {workout.targetDuration} min — {workout.targetPower}
        </h3>

        <CyclingBlocks
          blocks={workout.blocks}
          variant="detailed"
          fallbackDuration={workout.targetDuration}
          fallbackPower={workout.targetPower}
        />

        {mywhoosh && (
          <div
            className="mt-4 p-3 rounded-lg"
            style={{
              background: "color-mix(in srgb, var(--accent-cycling) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent-cycling) 25%, transparent)",
            }}
          >
            <p style={{ fontWeight: 700, color: "var(--accent-cycling)", marginBottom: 4 }}>
              🚴 En el rodillo (MyWhoosh)
            </p>
            <p style={{ color: "var(--text-primary)", fontSize: 14, lineHeight: 1.5 }}>
              Abrí la colección <strong>{mywhoosh.label}</strong> y elegí un workout de{" "}
              {mywhoosh.durationHint}. Usar uno de la biblioteca no gasta créditos.
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 4 }}>
              {mywhoosh.reason}
            </p>
          </div>
        )}

        {workout.blocks?.length > 0 && (
          <>
            <a
              href={`/api/workouts/${workout.id}/export-fit`}
              download
              onClick={() => toast.success("Descargado. Copialo a /Workouts/ de tu iGS", { duration: 5000 })}
              className="btn-outline-cycling w-full justify-center mt-4"
            >
              <Download size={16} />
              Descargar .fit para iGPSPORT
            </a>
            <a
              href="/api/workouts/export-zwo"
              download
              onClick={() => toast.success("Descargando .zwo para subir a MyWhoosh (días de calidad)...", { duration: 4000 })}
              className="btn-outline-cycling w-full justify-center mt-2"
            >
              <Download size={14} />
              Descargar .zwo para MyWhoosh
            </a>
            <a
              href="/api/workouts/export-all-fit"
              download
              onClick={() => toast.success("Descargando todos los entrenamientos de ciclismo...", { duration: 3000 })}
              className="btn-outline-cycling w-full justify-center mt-2"
            >
              <Download size={14} />
              Descargar todos los entrenamientos (ZIP)
            </a>
          </>
        )}

        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 12 }}>
          Los datos reales (distancia, tiempo, FC, potencia) se sincronizan automáticamente desde Strava.
          Revisalos en Métricas.
        </p>

        {/* Desktop button */}
        <button
          className="btn hidden md:flex w-full items-center justify-center gap-2 mt-6"
          style={{
            backgroundColor: completed ? "var(--accent-success, #10b981)" : "var(--accent-cycling)",
            opacity: completed ? 0.85 : 1,
          }}
          onClick={handleMarkComplete}
          disabled={loading || completed}
        >
          {completed ? "✓ Completado" : loading ? "Guardando..." : "Marcar como completado"}
        </button>
      </div>

      {/* Mobile FAB */}
      <div
        className="md:hidden fixed left-0 right-0 z-40 px-4 pb-2"
        style={{ bottom: "72px" }}
      >
        <button
          className="btn w-full flex items-center justify-center gap-2 shadow-2xl"
          style={{
            backgroundColor: completed ? "var(--accent-success, #10b981)" : "var(--accent-cycling)",
            height: "56px",
            fontSize: "16px",
            boxShadow: completed
              ? "0 8px 32px rgba(16,185,129,0.4)"
              : "0 8px 32px rgba(59,130,246,0.4)",
            opacity: completed ? 0.85 : 1,
          }}
          onClick={handleMarkComplete}
          disabled={loading || completed}
        >
          {completed ? "✓ Completado" : loading ? "Guardando..." : "✓ Marcar como completado"}
        </button>
      </div>
    </div>
  );
}
