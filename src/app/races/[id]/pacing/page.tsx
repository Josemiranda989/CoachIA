import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/BackLink";
import { buildPacingPlan, climbingNote } from "@/lib/pacing";

export const metadata: Metadata = { title: "Pacing" };

export default async function RacePacingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/login");
  }

  const { id } = await params;
  const [race, user] = await Promise.all([
    prisma.race.findUnique({ where: { id } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { ftp: true } }),
  ]);

  if (!race || race.userId !== session.user.id) {
    return (
      <div className="app-container py-10">
        <BackLink href="/races" />
        <h1 className="title">Pacing</h1>
        <p className="subtitle">No encontramos esa carrera.</p>
      </div>
    );
  }

  if (!race.distanceKm) {
    return (
      <div className="app-container py-10">
        <BackLink href="/races" />
        <h1 className="title">{race.name}</h1>
        <div className="card mt-6">
          <p className="text-text-secondary">
            Esta carrera no tiene distancia cargada. El pacing se calcula por tramos de la distancia total —
            volvé a <Link href="/races" className="underline">Carreras</Link> y cargala con el campo &quot;Distancia (km)&quot; completo.
          </p>
        </div>
      </div>
    );
  }

  if (!user?.ftp) {
    return (
      <div className="app-container py-10">
        <BackLink href="/races" />
        <h1 className="title">{race.name}</h1>
        <div className="card mt-6">
          <p className="text-text-secondary">
            Todavía no cargaste tu FTP (umbral de potencia). El pacing se calcula como %FTP por tramo de carrera —
            cargalo en <Link href="/profile" className="underline">tu perfil</Link> y volvé acá.
          </p>
        </div>
      </div>
    );
  }

  const plan = buildPacingPlan({ distanceKm: race.distanceKm, elevationM: race.elevationM, ftp: user.ftp });
  const climbNote = climbingNote(race.distanceKm, race.elevationM);

  return (
    <div className="app-container py-10">
      <BackLink href="/races" />
      <h1 className="title">{race.name}</h1>
      <p className="subtitle">
        Estrategia de pacing — {race.distanceKm}km
        {race.elevationM ? ` · ${race.elevationM}m D+` : ""} · FTP {user.ftp}W
      </p>

      <div className="flex flex-col gap-4 mt-6">
        {plan.map((seg) => (
          <div key={seg.fromPct} className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--accent-cycling)" }}>
                km {seg.fromKm}–{seg.toKm} ({seg.fromPct}–{seg.toPct}%)
              </span>
              <span
                className="text-xs font-bold px-2 py-1 rounded-full"
                style={{ background: "var(--accent-cycling-soft, transparent)", color: "var(--accent-cycling)" }}
              >
                {seg.zone}
              </span>
            </div>
            <p className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
              {seg.wattsLow}–{seg.wattsHigh}W
              <span className="text-sm font-normal text-text-secondary"> ({seg.pctFtpLow}–{seg.pctFtpHigh}% FTP)</span>
            </p>
            <p className="text-sm text-text-secondary">{seg.guidance}</p>
          </div>
        ))}
      </div>

      {climbNote && (
        <div
          className="card mt-6"
          style={{ background: "color-mix(in srgb, var(--accent-gym) 8%, transparent)", borderColor: "color-mix(in srgb, var(--accent-gym) 30%, transparent)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>⛰️ {climbNote}</p>
        </div>
      )}

      <div className="card mt-6">
        <p className="text-xs text-text-secondary">
          Esta tabla es una guía por tramo de distancia, no un perfil de elevación real de la carrera —
          no tenemos el GPX del recorrido. Ajustá siempre por sensación: si un tramo pide menos potencia
          de la sugerida, priorizá terminar bien sobre cumplir el número.
        </p>
      </div>
    </div>
  );
}
