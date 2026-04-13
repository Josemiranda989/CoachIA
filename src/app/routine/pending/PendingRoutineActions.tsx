"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";

export function PendingRoutineActions({ routineId }: { routineId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  async function handleAction(action: "approve" | "reject") {
    setLoading(action);
    try {
      const res = await fetch(`/api/routines/${routineId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Error al procesar");
        return;
      }

      if (action === "approve") {
        router.push("/routine/week");
      } else {
        router.push("/");
      }
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-50" style={{ background: "linear-gradient(to top, var(--bg-primary) 70%, transparent)" }}>
      <div className="app-container flex gap-3">
        <button
          onClick={() => handleAction("reject")}
          disabled={loading !== null}
          className="flex-1 py-4 rounded-2xl font-bold text-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading === "reject" ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <X size={20} />
          )}
          Rechazar
        </button>
        <button
          onClick={() => handleAction("approve")}
          disabled={loading !== null}
          className="flex-1 py-4 rounded-2xl font-bold text-lg text-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, var(--accent-gym), #fcd34d)" }}
        >
          {loading === "approve" ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <Check size={20} />
          )}
          Aprobar y Activar
        </button>
      </div>
    </div>
  );
}
