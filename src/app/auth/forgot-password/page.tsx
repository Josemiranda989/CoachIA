"use client";
import { useState } from "react";
import Link from "next/link";
import { Mail, Send, MailCheck, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Error al procesar la solicitud");
      } else {
        setSent(true);
        toast.success("Revisa tu casilla de email");
      }
    } catch {
      toast.error("Error de red. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="container py-20 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
        <div className="w-full max-w-md">
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
              <MailCheck size={36} style={{ color: "#22c55e" }} />
            </div>
            <h1 className="title text-3xl mb-4">Revisá tu email</h1>
            <p className="subtitle mb-6">
              Si existe una cuenta con <strong style={{ color: "var(--text-primary)" }}>{email}</strong>, te enviamos un link para restablecer tu contraseña.
            </p>
            <p className="text-text-secondary text-sm mb-6">
              El link expira en <strong>1 hora</strong>. Revisá también tu carpeta de spam.
            </p>
            <Link
              href="/auth/login"
              className="text-accent-primary font-semibold hover:underline text-sm"
            >
              ← Volver al login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-20 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
      <div className="w-full max-w-md">
        <header className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="text-accent-primary" size={24} />
            <span className="text-accent-primary font-semibold uppercase tracking-widest text-xs">
              Recuperar acceso
            </span>
          </div>
          <h1 className="title text-4xl mb-4">¿Olvidaste tu contraseña?</h1>
          <p className="subtitle">
            Ingresá tu email y te mandamos un link para elegir una nueva.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="card space-y-6">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <Mail size={16} />
              <span>Email</span>
            </label>
            <input
              type="email"
              placeholder="atleta@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              autoComplete="email"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn w-full py-4 text-base mt-2 shadow-lg shadow-accent-primary/20"
          >
            {loading ? (
              "Enviando..."
            ) : (
              <>
                <Send size={20} />
                <span>Enviar link de recuperación</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-10 space-y-4">
          <p className="text-text-secondary text-sm">
            ¿Te acordaste?{" "}
            <Link href="/auth/login" className="text-accent-primary font-semibold hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
