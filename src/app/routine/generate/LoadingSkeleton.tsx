import { Loader2 } from "lucide-react";

export function GenerateLoadingSkeleton() {
  return (
    <div className="mb-6" aria-busy="true" aria-live="polite">
      <div
        className="card flex items-center gap-4 mb-6"
        style={{
          background: "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(24,24,27,0.7) 60%)",
          border: "1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)",
          cursor: "default",
        }}
      >
        <div className="p-3 rounded-xl" style={{ background: "rgba(245,158,11,0.2)" }}>
          <Loader2 size={28} className="animate-spin text-accent-primary" />
        </div>
        <div>
          <p className="text-accent-primary text-xs font-bold uppercase tracking-widest mb-1">
            IA en acción
          </p>
          <h2 className="text-xl md:text-2xl font-bold text-text-primary">
            Analizando tu historial
          </h2>
          <p className="text-text-secondary text-sm mt-1">
            Leyendo tus PRs de gym y últimas salidas de Strava para armar tu semana...
          </p>
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="card animate-pulse"
            style={{
              animationDelay: `${i * 80}ms`,
              opacity: 0.6,
              cursor: "default",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div style={{ width: 18, height: 18, borderRadius: 4, background: "rgba(255,255,255,0.08)" }} />
                <div style={{ width: 80, height: 20, borderRadius: 6, background: "rgba(255,255,255,0.08)" }} />
              </div>
              <div style={{ width: 72, height: 22, borderRadius: 999, background: "rgba(255,255,255,0.06)" }} />
            </div>
            <div className="mt-3 space-y-2">
              {Array.from({ length: 3 }).map((__, j) => (
                <div
                  key={j}
                  className="flex items-center justify-between py-2 px-3 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                >
                  <div style={{ width: `${40 + j * 15}%`, height: 14, borderRadius: 4, background: "rgba(255,255,255,0.07)" }} />
                  <div style={{ width: 48, height: 14, borderRadius: 4, background: "rgba(255,255,255,0.05)" }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
