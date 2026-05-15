"use client";
import { useState } from "react";
import { Lock, User, Mail, KeyRound, Eye, EyeOff, Save, Heart } from "lucide-react";
import toast from "react-hot-toast";

type Props = {
  user: {
    name: string | null;
    email: string;
    fcMax: number | null;
    lthr: number | null;
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
  const [savingHr, setSavingHr] = useState(false);

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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error al guardar zonas FC");
      } else {
        toast.success("Zonas FC actualizadas");
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

  const eyeButtonStyle: React.CSSProperties = {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--text-secondary)",
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div className="container py-20 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
      <div className="w-full max-w-md">
        <header className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <User className="text-accent-primary" size={24} />
            <span className="text-accent-primary font-semibold uppercase tracking-widest text-xs">
              Mi Perfil
            </span>
          </div>
          <h1 className="title text-4xl mb-4">{user.name || "Atleta"}</h1>
          <p className="subtitle flex items-center justify-center gap-2">
            <Mail size={14} />
            {user.email}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="card space-y-6">
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

          <div
            className="flex items-center gap-2 pb-4"
            style={{ borderBottom: "1px solid var(--glass-border)" }}
          >
            <KeyRound size={18} className="text-accent-primary" />
            <h2 className="text-lg font-semibold">Cambiar contraseña</h2>
          </div>

          <div className="space-y-2">
            <label htmlFor="profile-current-password" className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <Lock size={16} aria-hidden="true" />
              <span>Contraseña actual</span>
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="profile-current-password"
                type={showCurrent ? "text" : "password"}
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input"
                autoComplete="current-password"
                required
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                aria-label={showCurrent ? "Ocultar contraseña" : "Mostrar contraseña"}
                style={eyeButtonStyle}
              >
                {showCurrent ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="profile-new-password" className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <Lock size={16} aria-hidden="true" />
              <span>Nueva contraseña</span>
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="profile-new-password"
                type={showNew ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
                autoComplete="new-password"
                minLength={8}
                required
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? "Ocultar contraseña" : "Mostrar contraseña"}
                style={eyeButtonStyle}
              >
                {showNew ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="profile-confirm-password" className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <Lock size={16} aria-hidden="true" />
              <span>Confirmar nueva contraseña</span>
            </label>
            <input
              id="profile-confirm-password"
              type={showNew ? "text" : "password"}
              placeholder="Repetí la nueva contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn w-full py-4 text-base mt-2 shadow-lg shadow-accent-primary/20"
          >
            {loading ? (
              "Guardando..."
            ) : (
              <>
                <Save size={20} />
                <span>Actualizar contraseña</span>
              </>
            )}
          </button>
        </form>

        <form onSubmit={handleSaveHr} className="card space-y-6 mt-6">
          <div
            className="flex items-center gap-2 pb-4"
            style={{ borderBottom: "1px solid var(--glass-border)" }}
          >
            <Heart size={18} style={{ color: "var(--accent-cycling)" }} />
            <h2 className="text-lg font-semibold">Datos del atleta</h2>
          </div>

          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: -8 }}>
            Tus zonas de FC se calculan desde estos valores y se usan para resolver
            los targets de tus entrenos al exportar el .fit al ciclocomputer.
            LTHR (umbral) gana cuando está seteado; FCmax es el fallback.
          </p>

          <div className="space-y-2">
            <label htmlFor="profile-fcmax" className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <Heart size={16} aria-hidden="true" />
              <span>FC máxima (bpm)</span>
            </label>
            <input
              id="profile-fcmax"
              type="number"
              inputMode="numeric"
              min={120}
              max={230}
              placeholder="ej. 188"
              value={fcMax}
              onChange={(e) => setFcMax(e.target.value)}
              className="input"
            />
            <p style={{ color: "var(--text-secondary)", fontSize: 12 }}>
              El valor más alto que registraste en una salida dura. Mirá tu pico de
              FC en Strava de los últimos rides con intervals.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="profile-lthr" className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <Heart size={16} aria-hidden="true" />
              <span>LTHR — Umbral (bpm) <span style={{ opacity: 0.6 }}>opcional</span></span>
            </label>
            <input
              id="profile-lthr"
              type="number"
              inputMode="numeric"
              min={100}
              max={210}
              placeholder="ej. 165"
              value={lthr}
              onChange={(e) => setLthr(e.target.value)}
              className="input"
            />
            <p style={{ color: "var(--text-secondary)", fontSize: 12 }}>
              Test de Friel: 30 min warmup + 30 min TT all-out. Promedio de FC de
              los últimos 20 min = LTHR. Más preciso que FCmax para prescribir
              intervals (Z4 = 94-99% LTHR).
            </p>
          </div>

          <button
            type="submit"
            disabled={savingHr}
            className="btn w-full py-4 text-base mt-2"
          >
            {savingHr ? (
              "Guardando..."
            ) : (
              <>
                <Save size={20} />
                <span>Guardar zonas FC</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
