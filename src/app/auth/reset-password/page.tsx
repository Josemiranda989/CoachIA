"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, KeyRound, CheckCircle2, Sparkles, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="card text-center" style={{ padding: 40 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <AlertTriangle size={36} style={{ color: "#ef4444" }} />
        </div>
        <h1 className="title text-3xl mb-4">Link inválido</h1>
        <p className="subtitle mb-6">
          Este link no es válido o ya fue usado. Pedí uno nuevo desde la página de recuperación.
        </p>
        <Link
          href="/auth/forgot-password"
          className="btn inline-flex py-3 px-6 text-sm"
        >
          Pedir nuevo link
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Error al restablecer la contraseña");
      } else {
        setSuccess(true);
        toast.success("Contraseña restablecida");
        setTimeout(() => router.push("/auth/login"), 2000);
      }
    } catch {
      toast.error("Error de red. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="card text-center" style={{ padding: 40 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background: "rgba(34, 197, 94, 0.1)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <CheckCircle2 size={36} style={{ color: "#22c55e" }} />
        </div>
        <h1 className="title text-3xl mb-4">¡Listo!</h1>
        <p className="subtitle mb-6">
          Tu contraseña fue actualizada. Te redirigimos al login...
        </p>
      </div>
    );
  }

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
    <>
      <header className="text-center mb-10">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="text-accent-primary" size={24} />
          <span className="text-accent-primary font-semibold uppercase tracking-widest text-xs">
            Nueva contraseña
          </span>
        </div>
        <h1 className="title text-4xl mb-4">Elegí una nueva contraseña</h1>
        <p className="subtitle">
          Mínimo 8 caracteres. Usá algo que recuerdes.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div className="flex items-center gap-2 pb-4" style={{ borderBottom: "1px solid var(--glass-border)" }}>
          <KeyRound size={18} className="text-accent-primary" />
          <h2 className="text-lg font-semibold">Restablecer contraseña</h2>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
            <Lock size={16} />
            <span>Nueva contraseña</span>
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
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
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              style={eyeButtonStyle}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
            <Lock size={16} />
            <span>Confirmar contraseña</span>
          </label>
          <input
            type={showPassword ? "text" : "password"}
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
              <KeyRound size={20} />
              <span>Restablecer contraseña</span>
            </>
          )}
        </button>
      </form>

      <div className="text-center mt-10">
        <Link href="/auth/login" className="text-text-secondary text-sm hover:text-text-primary transition-colors italic">
          ← Volver al login
        </Link>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="container py-20 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
      <div className="w-full max-w-md">
        <Suspense fallback={<div className="card text-center" style={{ padding: 40 }}>Cargando...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
