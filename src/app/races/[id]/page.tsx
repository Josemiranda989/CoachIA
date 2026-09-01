import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/BackLink";
import { getRaceById } from "@/lib/queries/getRaces";
import { buildPacingPlan, climbingNote } from "@/lib/pacing";
import { buildNutritionPlan, buildEquipmentChecklist } from "@/lib/race-nutrition";

export const metadata: Metadata = { title: "Día de carrera" };

const DISCIPLINE_LABEL: Record<string, string> = {
  cycling: "Ciclismo",
  running: "Running",
  trail: "Trail",
};

export default async function RaceDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/login");
  }

  const { id } = await params;
  const [race, user] = await Promise.all([
    getRaceById(id, session.user.id),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { ftp: true } }),
  ]);

  if (!race) {
    return (
      <div className="app-container py-10">
        <BackLink href="/races" />
        <h1 className="title">Día de carrera</h1>
        <p className="subtitle">No encontramos esa carrera.</p>
      </div>
    );
  }

  const nutritionPlan = buildNutritionPlan({
    discipline: race.discipline,
    distanceKm: race.distanceKm,
    elevationM: race.elevationM,
    estimatedHours: race.estimatedHours,
    startTime: race.startTime,
  });
  const checklist = buildEquipmentChecklist(race.discipline);
  const pacingPlan = race.distanceKm && user?.ftp
    ? buildPacingPlan({ distanceKm: race.distanceKm, elevationM: race.elevationM, ftp: user.ftp })
    : null;
  const climbNote = race.distanceKm ? climbingNote(race.distanceKm, race.elevationM) : null;

  const missing: string[] = [];
  if (!race.startTime) missing.push("hora de salida");
  if (!race.distanceKm) missing.push("distancia");
  if (!user?.ftp) missing.push("tu FTP (en tu perfil)");

  return (
    <div className="app-container py-10">
      <BackLink href="/races" />
      <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--accent-cycling)" }}>
        {race.daysUntil === 0 ? "¡Es hoy!" : race.daysUntil === 1 ? "Mañana" : `Faltan ${race.daysUntil} días`}
        {" · "}{DISCIPLINE_LABEL[race.discipline] ?? race.discipline}
      </p>
      <h1 className="title">{race.name}</h1>
      <p className="subtitle">
        {race.location ? `${race.location} · ` : ""}
        {new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
          new Date(`${race.date}T00:00:00Z`),
        )}
        {race.startTime ? ` · ${race.startTime}` : ""}
        {race.distanceKm ? ` · ${race.distanceKm}km` : ""}
        {race.elevationM ? ` · ${race.elevationM}m D+` : ""}
      </p>

      {missing.length > 0 && (
        <div
          className="card mt-4"
          style={{ background: "color-mix(in srgb, var(--accent-gym) 8%, transparent)", borderColor: "color-mix(in srgb, var(--accent-gym) 30%, transparent)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            Con {missing.join(", ")} completo{missing.length > 1 ? "s" : ""}, este plan se afina más
            (horarios reales y/o plan de potencia). Editalo desde <Link href="/races" className="underline">Carreras</Link>.
          </p>
        </div>
      )}

      {/* ── Qué comer ── */}
      <section className="mt-8">
        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>Qué comer</h2>
        <div className="flex flex-col gap-3">
          {nutritionPlan.map((ev, i) => (
            <div key={i} className="card">
              <div className="flex items-baseline gap-3 mb-1">
                <span
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: "var(--accent-cycling)", fontVariantNumeric: "tabular-nums" }}
                >
                  {ev.time}
                </span>
                <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{ev.title}</span>
              </div>
              <p className="text-sm text-text-secondary">{ev.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Plan de potencia ── */}
      {pacingPlan && (
        <section className="mt-8">
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>Plan de potencia</h2>
          <div className="flex flex-col gap-3">
            {pacingPlan.map((seg) => (
              <div key={seg.fromPct} className="card">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--accent-cycling)" }}>
                    km {seg.fromKm}–{seg.toKm}
                  </span>
                  <span className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>{seg.zone}</span>
                </div>
                <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {seg.wattsLow}–{seg.wattsHigh}W <span className="text-sm font-normal text-text-secondary">({seg.pctFtpLow}–{seg.pctFtpHigh}% FTP)</span>
                </p>
                <p className="text-sm text-text-secondary">{seg.guidance}</p>
              </div>
            ))}
          </div>
          {climbNote && (
            <div className="card mt-3" style={{ background: "color-mix(in srgb, var(--accent-gym) 8%, transparent)", borderColor: "color-mix(in srgb, var(--accent-gym) 30%, transparent)" }}>
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>⛰️ {climbNote}</p>
            </div>
          )}
          <p className="text-xs text-text-secondary mt-3">
            Guía por tramo de distancia, no un perfil de elevación real de la carrera — ajustá siempre por sensación.
          </p>
        </section>
      )}

      {/* ── Checklist de equipo ── */}
      <section className="mt-8 mb-4">
        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>Checklist de equipo</h2>
        <div className="flex flex-col gap-5">
          {checklist.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-secondary)" }}>
                {group.title}
              </h3>
              <div className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <div key={item} className="card flex items-center gap-2" style={{ padding: "10px 14px" }}>
                    <span
                      style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-cycling)", flexShrink: 0 }}
                      aria-hidden="true"
                    />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
