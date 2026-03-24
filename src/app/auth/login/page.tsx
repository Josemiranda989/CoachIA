"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
      setError("Credenciales inválidas");
    } else {
      router.push("/");
    }

    setLoading(false);
  };

  return (
    <div className="container py-8 max-w-md mx-auto">
      <h1 className="title text-center">Iniciar Sesión</h1>
      <form onSubmit={handleSubmit} className="card space-y-4">
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border border-border-color rounded bg-bg-card text-text-primary"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border border-border-color rounded bg-bg-card text-text-primary"
            required
          />
        </div>
        <button type="submit" disabled={loading} className="btn w-full">
          {loading ? "Cargando..." : "Iniciar Sesión"}
        </button>
      </form>
      <p className="text-center mt-4">
        ¿No tienes cuenta? <Link href="/auth/register" className="text-accent-primary hover:underline">Regístrate</Link>
      </p>
    </div>
  );
}