"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
    <div className="container py-8 max-w-md mx-auto">
      <h1 className="title text-center">Registro</h1>
      <form onSubmit={handleSubmit} className="card space-y-4">
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border border-border-color rounded bg-bg-card text-text-primary"
            required
          />
        </div>
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
        <div>
          <label className="block text-sm font-medium mb-1">Confirmar Contraseña</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-2 border border-border-color rounded bg-bg-card text-text-primary"
            required
          />
        </div>
        <button type="submit" disabled={loading} className="btn w-full">
          {loading ? "Cargando..." : "Registrarse"}
        </button>
      </form>
      <p className="text-center mt-4">
        ¿Ya tienes cuenta? <Link href="/auth/login" className="text-accent-primary hover:underline">Inicia sesión</Link>
      </p>
    </div>
  );
}