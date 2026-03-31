import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  Sparkles, Calendar, BarChart3, HelpCircle,
  ArrowRight, Bot, Upload, Zap,
} from "lucide-react";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  const userName = (session as any).user.name || "Atleta";
  const now = new Date();
  const today = now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const hour = now.getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  // Progreso semanal: días completados esta semana (lunes→domingo)
  const dayOfWeek = now.getDay(); // 0=domingo
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const latestRoutine = await prisma.routine.findFirst({
    where: { userId: (session as any).user.id },
    orderBy: { createdAt: "desc" },
    include: { days: { select: { completed: true, type: true } } },
  });

  const weekDays = latestRoutine?.days ?? [];
  const totalTrainingDays = weekDays.filter((d) => !d.type.includes("Rest")).length;
  const completedDays = weekDays.filter((d) => d.completed && !d.type.includes("Rest")).length;
  const progressPct = totalTrainingDays > 0 ? Math.round((completedDays / totalTrainingDays) * 100) : 0;

  return (
    <div className="app-container py-10">

      {/* ── Hero ── */}
      <header className="mb-10 animate-fade-up" style={{ animationDelay: "0ms" }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="text-accent-primary" size={16} />
          <span className="text-accent-primary font-semibold uppercase tracking-widest text-xs">
            Panel de Control
          </span>
        </div>
        <h1 className="title text-4xl md:text-5xl mb-2">
          {greeting}, {userName}.
        </h1>
        <p className="subtitle text-base md:text-lg">
          {today.charAt(0).toUpperCase() + today.slice(1)} — ¿Listo para superar tus límites?
        </p>

        {/* Barra de progreso semanal */}
        {totalTrainingDays > 0 && (
          <div
            className="mt-5 p-4 rounded-2xl"
            style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.18)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                Progreso semanal
              </span>
              <span className="text-sm font-bold" style={{ color: "var(--accent-gym)" }}>
                {completedDays}/{totalTrainingDays} días completados
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progressPct}%`,
                  background: "linear-gradient(90deg, var(--accent-gym), #fcd34d)",
                }}
              />
            </div>
          </div>
        )}
      </header>

      {/* ── Featured: Día de Hoy ── */}
      <Link
        href="/workout/today"
        className="card group relative overflow-hidden mb-6 block hover:border-blue-500/50 animate-fade-up"
        style={{
          background: "linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(24,24,27,0.7) 60%)",
          animationDelay: "60ms",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-accent-primary/20 rounded-2xl group-hover:bg-accent-primary/30 transition-colors">
              <Zap className="text-accent-primary" size={32} />
            </div>
            <div>
              <p className="text-accent-primary text-xs font-bold uppercase tracking-widest mb-1">
                Acción principal
              </p>
              <h2 className="text-2xl md:text-3xl font-bold">Entrenamiento de Hoy</h2>
              <p className="text-text-secondary mt-1 text-sm md:text-base">
                Anotá pesos, reps y métricas de tu sesión de hoy.
              </p>
            </div>
          </div>
          <ArrowRight
            className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-accent-primary shrink-0 hidden md:block"
            size={28}
          />
        </div>
      </Link>

      {/* ── Grid de accesos ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">

        {/* Generar con IA */}
        <Link
          href="/routine/generate"
          className="card group relative overflow-hidden hover:border-blue-500/50 animate-fade-up"
          style={{ animationDelay: "120ms" }}
        >
          <div className="absolute top-3 right-3 badge-pulse bg-accent-primary/20 text-accent-primary text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full">
            Nuevo
          </div>
          <div className="mb-4 p-3 bg-accent-primary/20 rounded-xl w-fit group-hover:bg-accent-primary/30 transition-colors">
            <Bot className="text-accent-primary" size={26} />
          </div>
          <h2 className="text-lg md:text-xl font-bold mb-2 flex items-center justify-between">
            Generar con IA
            <ArrowRight className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" size={18} />
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed hidden sm:block">
            Describí tus objetivos y Gemini genera tu rutina semanal completa.
          </p>
        </Link>

        {/* Toda la Semana */}
        <Link
          href="/routine/week"
          className="card group hover:border-amber-500/50 animate-fade-up"
          style={{ animationDelay: "180ms" }}
        >
          <div className="mb-4 p-3 bg-accent-gym/20 rounded-xl w-fit group-hover:bg-accent-gym/30 transition-colors">
            <Calendar className="text-accent-gym" size={26} />
          </div>
          <h2 className="text-lg md:text-xl font-bold mb-2 flex items-center justify-between">
            Toda la Semana
            <ArrowRight className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" size={18} />
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed hidden sm:block">
            Resumen completo de tu rutina planificada y objetivos semanales.
          </p>
        </Link>

        {/* Métricas */}
        <Link
          href="/metrics"
          className="card group hover:border-emerald-500/50 animate-fade-up"
          style={{ animationDelay: "240ms" }}
        >
          <div className="mb-4 p-3 bg-accent-cycling/20 rounded-xl w-fit group-hover:bg-accent-cycling/30 transition-colors">
            <BarChart3 className="text-accent-cycling" size={26} />
          </div>
          <h2 className="text-lg md:text-xl font-bold mb-2 flex items-center justify-between">
            Métricas
            <ArrowRight className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" size={18} />
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed hidden sm:block">
            Evolución de carga, fatiga en bici, récords personales y más.
          </p>
        </Link>

        {/* Cargar JSON */}
        <Link
          href="/routine/load"
          className="card group hover:border-violet-500/50 animate-fade-up"
          style={{ animationDelay: "300ms" }}
        >
          <div className="mb-4 p-3 bg-violet-500/20 rounded-xl w-fit group-hover:bg-violet-500/30 transition-colors">
            <Upload className="text-violet-400" size={26} />
          </div>
          <h2 className="text-lg md:text-xl font-bold mb-2 flex items-center justify-between">
            Cargar JSON
            <ArrowRight className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" size={18} />
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed hidden sm:block">
            Pegá manualmente un JSON de rutina generado por cualquier IA.
          </p>
        </Link>

        {/* Ayuda */}
        <Link
          href="/help"
          className="card group hover:border-indigo-500/50 animate-fade-up"
          style={{ animationDelay: "360ms" }}
        >
          <div className="mb-4 p-3 bg-indigo-500/20 rounded-xl w-fit group-hover:bg-indigo-500/30 transition-colors">
            <HelpCircle className="text-indigo-400" size={26} />
          </div>
          <h2 className="text-lg md:text-xl font-bold mb-2 flex items-center justify-between">
            Ayuda / FAQs
            <ArrowRight className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" size={18} />
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed hidden sm:block">
            Guías de uso, estructura JSON y preguntas frecuentes.
          </p>
        </Link>

        {/* Spacer para alinear grid en desktop */}
        <div className="hidden lg:block" />

      </div>
    </div>
  );
}
