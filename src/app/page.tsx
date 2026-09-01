import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentWeekStart } from "@/lib/week";
import { getActiveRoutineLight } from "@/lib/queries/getActiveRoutine";
import { getNextRace } from "@/lib/queries/getRaces";
import { DashboardCard, type DashboardCardProps } from "@/components/DashboardCard";
import { WeekKPIs } from "@/components/WeekKPIs";
import {
  Sparkles, Calendar, BarChart3, HelpCircle,
  ArrowRight, Bot, Upload, Zap, Bell, Apple, BookOpen, Mountain, Trophy,
} from "lucide-react";

const dashboardCards: Omit<DashboardCardProps, "delayMs">[] = [
  {
    href: "/routine/generate",
    icon: Bot,
    iconBgClass: "bg-accent-primary-soft",
    iconColorClass: "text-accent-primary",
    hoverBorderClass: "hover:border-accent-primary-soft",
    title: "Generar con IA",
    description: "Describí tus objetivos y la IA genera tu rutina semanal completa.",
    badge: {
      label: "Nuevo",
      textClass: "text-accent-primary",
      bgStyle: { background: "color-mix(in srgb, var(--accent-primary) 20%, transparent)" },
    },
  },
  {
    href: "/routine/week",
    icon: Calendar,
    iconBgClass: "bg-accent-gym-soft",
    iconColorClass: "text-accent-gym",
    hoverBorderClass: "hover:border-accent-gym-soft",
    title: "Toda la Semana",
    description: "Resumen completo de tu rutina planificada y objetivos semanales.",
  },
  {
    href: "/metrics",
    icon: BarChart3,
    iconBgClass: "bg-accent-cycling-soft",
    iconColorClass: "text-accent-cycling",
    hoverBorderClass: "hover:border-accent-cycling-soft",
    title: "Métricas",
    description: "Evolución de carga, fatiga en bici, récords personales y más.",
  },
  {
    href: "/routine/load",
    icon: Upload,
    iconBgClass: "bg-accent-primary-soft",
    iconColorClass: "text-[var(--accent-primary)]",
    hoverBorderClass: "hover:border-accent-primary-soft",
    title: "Cargar JSON",
    description: "Pegá manualmente un JSON de rutina generado por cualquier IA.",
  },
  {
    href: "/help",
    icon: HelpCircle,
    iconBgClass: "bg-accent-gym-soft",
    iconColorClass: "text-[var(--accent-gym)]",
    hoverBorderClass: "hover:border-accent-gym-soft",
    title: "Ayuda / FAQs",
    description: "Guías de uso, estructura JSON y preguntas frecuentes.",
  },
  {
    href: "/nutrition",
    icon: Apple,
    iconBgClass: "bg-accent-cycling-soft",
    iconColorClass: "text-[var(--accent-cycling)]",
    hoverBorderClass: "hover:border-accent-cycling-soft",
    title: "Nutrición Bici",
    description: "Guía de combustible: qué comer, cuánto y cuándo en tus salidas.",
  },
  {
    href: "/wiki",
    icon: BookOpen,
    iconBgClass: "bg-accent-cycling-soft",
    iconColorClass: "text-[var(--accent-cycling)]",
    hoverBorderClass: "hover:border-accent-cycling-soft",
    title: "Wiki de Ejercicios",
    description: "Referencia visual: descripción, ejecución y tips para cada ejercicio.",
  },
  {
    href: "/races",
    icon: Trophy,
    iconBgClass: "bg-accent-cycling-soft",
    iconColorClass: "text-[var(--accent-cycling)]",
    hoverBorderClass: "hover:border-accent-cycling-soft",
    title: "Carreras",
    description: "Tus próximos objetivos, con cuenta regresiva.",
  },
];

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  const userName = session.user.name || "Atleta";
  const now = new Date();
  const today = now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const hour = now.getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  const weekStart = getCurrentWeekStart(now);
  const userId = session.user.id;

  const latestRoutine = await getActiveRoutineLight(userId, weekStart);

  const pendingRoutine = await prisma.routine.findFirst({
    where: { userId, status: "pending_approval" },
  });

  const nextRace = await getNextRace(userId);

  const weekDays = latestRoutine?.days ?? [];
  const totalTrainingDays = weekDays.filter((d) => !d.type.includes("Rest")).length;
  const completedDays = weekDays.filter(
    (d) => !d.type.includes("Rest") && d.completions[0]?.completed
  ).length;
  const progressPct = totalTrainingDays > 0 ? Math.round((completedDays / totalTrainingDays) * 100) : 0;

  return (
    <div className="app-container py-10">

      {/* ── Hero ── */}
      <header className="mb-10 animate-fade-up" style={{ animationDelay: "0ms" }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles aria-hidden="true" className="text-accent-primary" size={16} />
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
            style={{ background: "color-mix(in srgb, var(--accent-gym) 7%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-gym) 18%, transparent)" }}
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

      {/* ── KPIs de la semana — strip clickable a /metrics y /routine/week ── */}
      <WeekKPIs userId={userId} weekStart={weekStart} />

      {/* ── Rutina pendiente de aprobación ── */}
      {pendingRoutine && (
        <Link
          href="/routine/pending"
          className="card group relative overflow-hidden mb-6 block animate-fade-up border-amber-500/40 hover:border-amber-500/70"
          style={{
            background: "linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(24,24,27,0.7) 60%)",
            animationDelay: "30ms",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-amber-500/20 rounded-2xl badge-pulse">
                <Bell aria-hidden="true" className="text-amber-400" size={28} />
              </div>
              <div>
                <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">
                  Requiere tu aprobación
                </p>
                <h2 className="text-xl md:text-2xl font-bold">
                  Nueva Rutina Generada por IA
                </h2>
                <p className="text-text-secondary mt-1 text-sm">
                  Revisá la rutina del próximo mes y aprobala o rechazala.
                </p>
              </div>
            </div>
            <ArrowRight
              aria-hidden="true"
              className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-amber-400 shrink-0 hidden md:block"
              size={28}
            />
          </div>
        </Link>
      )}

      {/* ── Featured: Día de Hoy ── */}
      <Link
        href="/workout/today"
        className="card group relative overflow-hidden mb-6 block hover:border-accent-primary-soft animate-fade-up"
        style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 12%, transparent) 0%, rgba(24,24,27,0.7) 60%)",
          animationDelay: "60ms",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-accent-primary-soft rounded-2xl">
              <Zap aria-hidden="true" className="text-accent-primary" size={32} />
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
            aria-hidden="true"
            className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-accent-primary shrink-0 hidden md:block"
            size={28}
          />
        </div>
      </Link>

      {/* ── Próxima carrera — ancla del objetivo largo plazo ── */}
      {nextRace && (
        <Link
          href="/races"
          className="card group relative overflow-hidden mb-6 block hover:border-accent-cycling-soft animate-fade-up"
          style={{
            background: "linear-gradient(135deg, color-mix(in srgb, var(--accent-cycling) 12%, transparent) 0%, rgba(24,24,27,0.7) 60%)",
            animationDelay: "90ms",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-accent-cycling-soft rounded-2xl">
                <Mountain aria-hidden="true" className="text-[var(--accent-cycling)]" size={32} />
              </div>
              <div>
                <p className="text-[var(--accent-cycling)] text-xs font-bold uppercase tracking-widest mb-1">
                  {nextRace.daysUntil === 0 ? "¡Es hoy!" : nextRace.daysUntil === 1 ? "Mañana" : `Faltan ${nextRace.daysUntil} días`}
                </p>
                <h2 className="text-2xl md:text-3xl font-bold">{nextRace.name}</h2>
                <p className="text-text-secondary mt-1 text-sm md:text-base">
                  {nextRace.location ? `${nextRace.location} — ` : ""}
                  {nextRace.distanceKm ? `${nextRace.distanceKm}km` : ""}
                  {nextRace.distanceKm && nextRace.elevationM ? ` · ${nextRace.elevationM}m D+` : ""}
                </p>
              </div>
            </div>
            <ArrowRight
              aria-hidden="true"
              className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[var(--accent-cycling)] shrink-0 hidden md:block"
              size={28}
            />
          </div>
        </Link>
      )}

      {/* ── Grid de accesos ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {dashboardCards.map((card, idx) => (
          <DashboardCard
            key={card.href}
            {...card}
            delayMs={120 + idx * 60}
          />
        ))}
      </div>
    </div>
  );
}
