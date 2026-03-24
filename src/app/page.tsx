import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  return (
    <div className="container py-8">
      <h1 className="title">CoachIA Dashboard</h1>
      <p className="subtitle">Bienvenido de vuelta, {session.user.name}. Veamos la rutina de la semana.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        <Link href="/routine/load" className="card hover:scale-105 transition-transform">
          <h2 className="text-xl font-semibold mb-2">🤖 Cargar Rutina</h2>
          <p className="text-text-secondary">Pega el JSON de tu IA con la semana completa.</p>
        </Link>
        <Link href="/routine/week" className="card hover:scale-105 transition-transform">
          <h2 className="text-xl font-semibold mb-2">🗓️ Toda la Semana</h2>
          <p className="text-text-secondary">Resumen completo de tu rutina planificada.</p>
        </Link>
        <Link href="/workout/today" className="card hover:scale-105 transition-transform">
          <h2 className="text-xl font-semibold mb-2">🏃‍♂️ Día de Hoy</h2>
          <p className="text-text-secondary">Ver y anotar tus pesos o métricas de hoy.</p>
        </Link>
        <Link href="/metrics" className="card hover:scale-105 transition-transform">
          <h2 className="text-xl font-semibold mb-2">📊 Métricas</h2>
          <p className="text-text-secondary">Evolución de carga, fatiga en bici, etc.</p>
        </Link>
        <Link href="/help" className="card hover:scale-105 transition-transform">
          <h2 className="text-xl font-semibold mb-2">ℹ️ Ayuda / FAQs</h2>
          <p className="text-text-secondary">Estructura JSON y guías de uso.</p>
        </Link>
      </div>
    </div>
  );
}
