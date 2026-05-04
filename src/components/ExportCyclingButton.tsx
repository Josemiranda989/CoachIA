"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export function ExportCyclingButton({ cyclingCount }: { cyclingCount: number }) {
  const [loading, setLoading] = useState(false);

  if (cyclingCount === 0) return null;

  function handleDownload() {
    setLoading(true);
    // Navigate to the export API — the browser sends the session cookie automatically
    window.location.href = "/api/workouts/export-cycling";
    // Reset loading after a short delay (download may trigger before we reset)
    setTimeout(() => setLoading(false), 3000);
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-2xl font-bold text-sm transition-all disabled:opacity-50"
      style={{
        background: "linear-gradient(135deg, var(--accent-cycling), #06b6d4)",
        color: "#000",
      }}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={18} />
      ) : (
        <Download size={18} />
      )}
      Exportar entrenamientos de ciclismo ({cyclingCount})
    </button>
  );
}
