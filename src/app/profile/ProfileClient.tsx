"use client";
import { useState } from "react";
import { Lock, User, Mail, KeyRound, Eye, EyeOff, Save, Heart, Unlink, Link, Zap } from "lucide-react";
import toast from "react-hot-toast";

type Props = {
  user: {
    name: string | null;
    email: string;
    fcMax: number | null;
    lthr: number | null;
    ftp: number | null;
    hasStrava: boolean;
  };
};

export function ProfileClient({ user }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [fcMax, setFcMax] = useState<string>(user.fcMax?.toString() ?? "");
  const [lthr, setLthr] = useState<string>(user.lthr?.toString() ?? "");
  const [ftp, setFtp] = useState<string>(user.ftp?.toString() ?? "");
  const [savingHr, setSavingHr] = useState(false);

  const [stravaConnected, setStravaConnected] = useState(user.hasStrava);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleSaveHr = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHr(true);
    try {
      const res = await fetch("/api/profile/athlete", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fcMax: fcMax === "" ? null : Number(fcMax),
          lthr: lthr === "" ? null : Number(lthr),
          ftp: ftp === "" ? null : Number(ftp),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error al guardar datos del atleta");
      } else {
        toast.success("Datos del atleta actualizados");
      }
    } catch {
      toast.error("Error de red. Intentá de nuevo.");
    } finally {
      setSavingHr(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas nuevas no coinciden");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (newPassword === currentPassword) {
      toast.error("La nueva contraseña debe ser distinta a la actual");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Error al cambiar la contraseña");
      } else {
        toast.success("Contraseña actualizada correctamente");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      toast.error("Error de red. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    window.location.href = "/api/strava/connect";
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/strava/disconnect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error al desconectar Strava");
      } else {
        toast.success("Strava desconectado");
        setStravaConnected(false);
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setDisconnecting(false);
    }
  };

  const cardClass = "rounded-2xl border p-6 space-y-5";
  const cardStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    borderColor: "var(--glass-border)",
  };

  function InputRow({ label, value, onChange, placeholder, type = "text", autoComplete, required, min, max, helper, icon: Icon, showToggle, showValue, onToggleShow, inputMode }: any) {
    return (
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          {Icon && <Icon size={14} />}
          <span>{label}</span>
        </label>
        <div style={{ position: "relative" }}>
          <input
            type={showToggle ? (showValue ? "text" : "password") : type}
            inputMode={inputMode}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
              paddingRight: showToggle ? 44 : undefined,
            }}
            autoComplete={autoComplete}
            minLength={min ? 8 : undefined}
            min={min}
            max={max}
            required={required}
          />
          {showToggle && (
            <button
              type="button"
              onClick={onToggleShow}
              aria-label={showValue ? "Ocultar" : "Mostrar"}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "transparent", border: "none", cursor: "pointer",
                color: "var(--text-secondary)", padding: 4, display: "flex",
              }}
            >
              {showValue ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
        {helper && <p style={{ color: "var(--text-secondary)", fontSize: 12 }}>{helper}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-lg space-y-6">
        
        {/* Header */}
        <header className="text-center pb-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4" style={{ background: "color-mix(in srgb, var(--accent-primary) 15%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)" }}>
            <User size={14} style={{ color: "var(--accent-primary)" }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent-primary)" }}>Mi Perfil</span>
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>{user.name || "Atleta"}</h1>
          <p className="flex items-center justify-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <Mail size={13} />
            {user.email}
          </p>
        </header>

        {/* Strava */}
        <div className={cardClass} style={cardStyle}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--accent-cycling) 15%, transparent)" }}>
                {stravaConnected ? <Unlink size={16} style={{ color: "var(--accent-cycling)" }} /> : <Link size={16} style={{ color: "var(--accent-cycling)" }} />}
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Strava</h3>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {stravaConnected ? "Conectado — sincronizando actividades" : "Conectá tu cuenta para ver tus rides"}
                </p>
              </div>
            </div>
            {stravaConnected ? (
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
                style={{
                  background: "transparent",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-secondary)",
                }}
              >
                {disconnecting ? "Desconectando…" : "Desconectar"}
              </button>
            ) : (
              <button
                onClick={handleConnect}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all"
                style={{ background: "var(--accent-cycling)" }}
              >
                <Link size={14} />
                Conectar
              </button>
            )}
          </div>
        </div>

        {/* Datos del atleta */}
        <form onSubmit={handleSaveHr} className={cardClass} style={cardStyle}>
          <div className="flex items-center gap-2.5 pb-4" style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--accent-cycling) 15%, transparent)" }}>
              <Heart size={16} style={{ color: "var(--accent-cycling)" }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Datos del atleta</h2>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Zonas de frecuencia cardíaca y potencia</p>
            </div>
          </div>

          <InputRow
            icon={Heart}
            label="FC máxima (bpm)"
            value={fcMax}
            onChange={(e: any) => setFcMax(e.target.value)}
            placeholder="ej. 188"
            inputMode="numeric"
            min={120}
            max={230}
            helper="El valor más alto que registraste en una salida dura."
          />

          <InputRow
            icon={Heart}
            label="LTHR — Umbral (bpm)"
            value={lthr}
            onChange={(e: any) => setLthr(e.target.value)}
            placeholder="ej. 165"
            inputMode="numeric"
            min={100}
            max={210}
            helper={<>Test de Friel: 30 min warmup + 30 min TT. Promedio FC últimos 20 min. <span style={{ opacity: 0.6 }}>Opcional — gana sobre FCmax</span></> as any}
          />

          <InputRow
            icon={Zap}
            label="FTP — Umbral de potencia (W)"
            value={ftp}
            onChange={(e: any) => setFtp(e.target.value)}
            placeholder="ej. 230"
            inputMode="numeric"
            min={80}
            max={500}
            helper="Usado para calcular fitness (CTL/ATL/TSB) y la estrategia de pacing de tus carreras."
          />

          <button
            type="submit"
            disabled={savingHr}
            className="flex items-center justify-center gap-2 w-full rounded-lg py-3 text-sm font-semibold text-white transition-all"
            style={{ background: "var(--accent-cycling)" }}
          >
            {savingHr ? "Guardando…" : <><Save size={15} /> Guardar datos del atleta</>}
          </button>
        </form>

        {/* Cambiar contraseña */}
        <form onSubmit={handleSubmit} className={cardClass} style={cardStyle}>
          <div className="flex items-center gap-2.5 pb-4" style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--accent-primary) 15%, transparent)" }}>
              <Lock size={16} style={{ color: "var(--accent-primary)" }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Seguridad</h2>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Cambiá tu contraseña</p>
            </div>
          </div>

          <InputRow
            icon={Lock}
            label="Contraseña actual"
            value={currentPassword}
            onChange={(e: any) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            showToggle
            showValue={showCurrent}
            onToggleShow={() => setShowCurrent(v => !v)}
          />

          <InputRow
            icon={Lock}
            label="Nueva contraseña"
            value={newPassword}
            onChange={(e: any) => setNewPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            min={8}
            required
            showToggle
            showValue={showNew}
            onToggleShow={() => setShowNew(v => !v)}
          />

          <InputRow
            icon={Lock}
            label="Confirmar nueva contraseña"
            value={confirmPassword}
            onChange={(e: any) => setConfirmPassword(e.target.value)}
            placeholder="Repetí la nueva contraseña"
            autoComplete="new-password"
            min={8}
            required
          />

          <input
            type="email"
            name="username"
            value={user.email}
            autoComplete="username"
            readOnly
            aria-hidden="true"
            tabIndex={-1}
            style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
          />

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full rounded-lg py-3 text-sm font-semibold text-white transition-all"
            style={{ background: "var(--accent-primary)" }}
          >
            {loading ? "Guardando…" : <><Save size={15} /> Actualizar contraseña</>}
          </button>
        </form>

      </div>
    </div>
  );
}
