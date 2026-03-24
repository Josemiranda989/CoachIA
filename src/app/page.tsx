import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sparkles, Calendar, Dumbbell, BarChart3, HelpCircle, ArrowRight } from "lucide-react";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  const userName = (session as any).user.name || "Atleta";
  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="app-container py-12">
      <header className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="text-accent-primary" size={24} />
          <span className="text-accent-primary font-semibold uppercase tracking-widest text-xs">Panel de Control</span>
        </div>
        <h1 className="title text-5xl md:text-6xl mb-4">CoachIA Dashboard</h1>
        <p className="subtitle text-lg md:text-xl max-w-2xl">
          Hola, <span className="text-text-primary font-semibold">{userName}</span>. {today.charAt(0).toUpperCase() + today.slice(1)}. 
          ¿Listo para superar tus límites hoy?
        </p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        <Link href="/routine/load" className="card group">
          <div className="mb-6 p-3 bg-accent-primary/20 rounded-xl w-fit group-hover:bg-accent-primary/30 transition-colors">
            <Sparkles className="text-accent-primary" size={28} />
          </div>
          <h2 className="text-2xl font-bold mb-3 flex items-center justify-between">
            Cargar Rutina
            <ArrowRight className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" size={20} />
          </h2>
          <p className="text-text-secondary leading-relaxed">Pega el JSON de tu IA con la semana completa de entrenamiento.</p>
        </Link>

        <Link href="/routine/week" className="card group">
          <div className="mb-6 p-3 bg-accent-gym/20 rounded-xl w-fit group-hover:bg-accent-gym/30 transition-colors">
            <Calendar className="text-accent-gym" size={28} />
          </div>
          <h2 className="text-2xl font-bold mb-3 flex items-center justify-between">
            Toda la Semana
            <ArrowRight className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" size={20} />
          </h2>
          <p className="text-text-secondary leading-relaxed">Resumen completo de tu rutina planificada y objetivos semanales.</p>
        </Link>

        <Link href="/workout/today" className="card group">
          <div className="mb-6 p-3 bg-accent-primary/20 rounded-xl w-fit group-hover:bg-accent-primary/30 transition-colors">
            <Dumbbell className="text-accent-primary" size={28} />
          </div>
          <h2 className="text-2xl font-bold mb-3 flex items-center justify-between">
            Día de Hoy
            <ArrowRight className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" size={20} />
          </h2>
          <p className="text-text-secondary leading-relaxed">Ver y anotar tus pesos, reps y métricas de la sesión de hoy.</p>
        </Link>

        <Link href="/metrics" className="card group">
          <div className="mb-6 p-3 bg-accent-cycling/20 rounded-xl w-fit group-hover:bg-accent-cycling/30 transition-colors">
            <BarChart3 className="text-accent-cycling" size={28} />
          </div>
          <h2 className="text-2xl font-bold mb-3 flex items-center justify-between">
            Métricas
            <ArrowRight className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" size={20} />
          </h2>
          <p className="text-text-secondary leading-relaxed">Evolución de carga, fatiga en bici, récords personales y más.</p>
        </Link>

        <Link href="/help" className="card group">
          <div className="mb-6 p-3 bg-text-secondary/20 rounded-xl w-fit group-hover:bg-text-secondary/30 transition-colors">
            <HelpCircle className="text-text-secondary" size={28} />
          </div>
          <h2 className="text-2xl font-bold mb-3 flex items-center justify-between">
            Ayuda / FAQs
            <ArrowRight className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" size={20} />
          </h2>
          <p className="text-text-secondary leading-relaxed">Consulta la estructura JSON, guías de uso y preguntas frecuentes.</p>
        </Link>
      </div>
    </div>
  );
}
