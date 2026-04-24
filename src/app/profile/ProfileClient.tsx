"use client";
import { useState } from "react";
import { Lock, User, Mail, KeyRound, Eye, EyeOff, Save } from "lucide-react";
import toast from "react-hot-toast";

type Props = {
  user: { name: string | null; email: string };
};

export function ProfileClient({ user }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

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
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <Lock size={16} />
              <span>Contraseña actual</span>
            </label>
            <div style={{ position: "relative" }}>
              <input
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
                {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <Lock size={16} />
              <span>Nueva contraseña</span>
            </label>
            <div style={{ position: "relative" }}>
              <input
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
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <Lock size={16} />
              <span>Confirmar nueva contraseña</span>
            </label>
            <input
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
      </div>
    </div>
  );
}
