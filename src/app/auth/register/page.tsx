"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Mail, Lock, Sparkles, UserPlus, ArrowLeft } from "lucide-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (res.ok) {
      router.push("/auth/login");
    } else {
      const data = await res.json();
      setError(data.error || "Error al registrar");
    }

    setLoading(false);
  };

  return (
    <div className="container py-12 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="text-accent-primary" size={24} />
            <span className="text-accent-primary font-semibold uppercase tracking-widest text-xs">Unirse</span>
          </div>
          <h1 className="title text-4xl mb-4">Crear Cuenta</h1>
          <p className="subtitle">Únete a la comunidad de CoachIA y optimiza tus entrenamientos.</p>
        </header>

        <form onSubmit={handleSubmit} className="card space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <User size={16} />
              <span>Nombre Completo</span>
            </label>
            <input
              type="text"
              placeholder="Tu nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              required
            />
          </div>

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
              required
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <Lock size={16} />
              <span>Contraseña</span>
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <Lock size={16} />
              <span>Confirmar Contraseña</span>
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn w-full py-4 text-base mt-4 shadow-lg shadow-accent-primary/20">
            {loading ? (
              "Creando cuenta..."
            ) : (
              <>
                <UserPlus size={20} />
                <span>Registrarse ahora</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-8 space-y-4">
          <p className="text-text-secondary text-sm">
            ¿Ya tienes una cuenta? <Link href="/auth/login" className="text-accent-primary font-semibold hover:underline">Inicia sesión aquí</Link>
          </p>
          <Link href="/" className="flex items-center justify-center gap-2 text-text-secondary text-xs hover:text-text-primary transition-colors italic">
            <ArrowLeft size={12} />
            <span>Volver al inicio</span>
          </Link>
        </div>
      </div>
    </div>
  );
}