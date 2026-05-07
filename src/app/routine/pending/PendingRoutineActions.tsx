"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Check, X, Loader2, type LucideIcon } from "lucide-react";

type ActionVariant = "approve" | "reject";

function ActionButton({
  variant,
  label,
  loading,
  disabled,
  onClick,
}: {
  variant: ActionVariant;
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon: LucideIcon = variant === "approve" ? Check : X;
  const baseClass =
    "flex-1 py-4 rounded-2xl font-bold text-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2";
  const variantClass =
    variant === "approve"
      ? "text-black"
      : "border border-red-500/30 text-red-400 hover:bg-red-500/10";
  const variantStyle =
    variant === "approve"
      ? { background: "linear-gradient(135deg, var(--accent-gym), #fcd34d)" }
      : undefined;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClass} ${variantClass}`}
      style={variantStyle}
    >
      {loading ? <Loader2 className="animate-spin" size={20} aria-hidden="true" /> : <Icon size={20} aria-hidden="true" />}
      {label}
    </button>
  );
}

export function PendingRoutineActions({ count }: { count: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState<ActionVariant | null>(null);

  async function handleAction(action: ActionVariant) {
    setLoading(action);
    try {
      const res = await fetch(`/api/routines/pending-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al procesar");
        return;
      }

      const data = await res.json();
      toast.success(data.message);

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

  const approveLabel =
    count > 1 ? `Aprobar mesociclo (${count} semanas)` : "Aprobar y Activar";
  const rejectLabel = count > 1 ? `Rechazar las ${count}` : "Rechazar";

  return (
    <div
      className="fixed left-0 right-0 p-4 z-40"
      style={{
        bottom: 72,
        background: "linear-gradient(to top, var(--bg-main) 70%, transparent)",
      }}
    >
      <div className="app-container flex gap-3">
        <ActionButton
          variant="reject"
          label={rejectLabel}
          loading={loading === "reject"}
          disabled={loading !== null}
          onClick={() => handleAction("reject")}
        />
        <ActionButton
          variant="approve"
          label={approveLabel}
          loading={loading === "approve"}
          disabled={loading !== null}
          onClick={() => handleAction("approve")}
        />
      </div>
    </div>
  );
}
