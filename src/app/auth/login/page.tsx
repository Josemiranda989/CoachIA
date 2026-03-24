"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn, Lock, Mail, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Credenciales inválidas. Verifica tu correo y contraseña.");
    } else {
      router.push("/");
    }

    setLoading(false);
  };

  return (
    <div className="container py-20 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
      <div className="w-full max-w-md">
        <header className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="text-accent-primary" size={24} />
            <span className="text-accent-primary font-semibold uppercase tracking-widest text-xs">Acceso</span>
          </div>
          <h1 className="title text-4xl mb-4">Iniciar Sesión</h1>
          <p className="subtitle">Bienvenido a CoachIA. Ingresa tus datos para continuar.</p>
        </header>

        <form onSubmit={handleSubmit} className="card space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}
          
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

          <button type="submit" disabled={loading} className="btn w-full py-4 text-base mt-2 shadow-lg shadow-accent-primary/20">
            {loading ? (
              "Iniciando sesión..."
            ) : (
              <>
                <LogIn size={20} />
                <span>Entrar al Dashboard</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-10 space-y-4">
          <p className="text-text-secondary text-sm">
            ¿No tienes cuenta? <Link href="/auth/register" className="text-accent-primary font-semibold hover:underline">Regístrate gratis</Link>
          </p>
          <Link href="/" className="text-text-secondary text-xs hover:text-text-primary transition-colors block italic">
            &larr; Volver al sitio principal
          </Link>
        </div>
      </div>
    </div>
  );
}