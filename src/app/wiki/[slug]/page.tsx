import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getAllExerciseSlugs, getExerciseBySlug } from "@/lib/exercise-cache";

export default async function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");

  const { slug } = await params;

  const allSlugs = await getAllExerciseSlugs();

  const idx = allSlugs.findIndex((e) => e.slug === slug);
  if (idx === -1) notFound();

  const exercise = await getExerciseBySlug(allSlugs[idx].slug);
  if (!exercise) notFound();

  // Wrap-around navigation
  const prev = allSlugs[(idx - 1 + allSlugs.length) % allSlugs.length];
  const next = allSlugs[(idx + 1) % allSlugs.length];

  const steps = exercise.instructions
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const tipLines = (exercise.tips ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const muscleChips = exercise.muscleGroups
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  return (
    <div className="app-container py-8 pb-16">
      {/* Top nav strip: back + compact prev/next + counter */}
      <div className="flex items-center justify-between mb-4">
        <BackLink href="/wiki" />
        <div className="flex items-center gap-1">
          <Link
            href={`/wiki/${prev.slug}`}
            aria-label={`Anterior: ${prev.name}`}
            className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
          >
            <ChevronLeft size={20} className="text-text-secondary" />
          </Link>
          <span className="text-xs text-text-secondary px-2 tabular-nums">
            {idx + 1} / {allSlugs.length}
          </span>
          <Link
            href={`/wiki/${next.slug}`}
            aria-label={`Siguiente: ${next.name}`}
            className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
          >
            <ChevronRight size={20} className="text-text-secondary" />
          </Link>
        </div>
      </div>

      <h1 className="title text-3xl mb-3 text-center sm:text-left">
        {exercise.name}
      </h1>

      {/* Muscle chips */}
      <div className="flex flex-wrap gap-2 mb-6 justify-center sm:justify-start">
        {muscleChips.map((m, i) => (
          <span
            key={i}
            className={`text-xs px-3 py-1 rounded-full ${
              i === 0
                ? "text-accent-primary font-semibold"
                : "text-text-secondary"
            }`}
            style={
              i === 0
                ? { background: "color-mix(in srgb, var(--accent-primary) 20%, transparent)" }
                : { background: "var(--glass-bg)" }
            }
          >
            {m}
          </span>
        ))}
      </div>

      {/* Centered image */}
      {exercise.imagePath && (
        <div className="flex justify-center mb-6">
          <div
            className="w-full rounded-2xl overflow-hidden bg-bg-secondary"
            style={{ maxWidth: 640, aspectRatio: "4 / 3" }}
          >
            <Image
              src={exercise.imagePath}
              alt={exercise.name}
              width={640}
              height={480}
              className="object-cover w-full h-full"
              priority
              unoptimized
            />
          </div>
        </div>
      )}

      <div className="card mb-4">
        <p className="text-xs uppercase tracking-widest text-text-secondary mb-2">
          Descripción
        </p>
        <p className="text-sm text-text-primary leading-relaxed">
          {exercise.description}
        </p>
      </div>

      {exercise.equipment && (
        <div className="card mb-4">
          <p className="text-xs uppercase tracking-widest text-text-secondary mb-1">
            Equipo
          </p>
          <p className="text-sm text-text-primary">{exercise.equipment}</p>
        </div>
      )}

      <div className="card mb-4">
        <p className="text-xs uppercase tracking-widest text-text-secondary mb-3">
          Ejecución
        </p>
        <ol className="space-y-3">
          {steps.map((step, i) => {
            const cleaned = step.replace(/^\d+\.\s*/, "");
            return (
              <li key={i} className="flex gap-3 text-sm">
                <span className="shrink-0 w-6 h-6 rounded-full bg-accent-primary text-black flex items-center justify-center font-bold text-xs">
                  {i + 1}
                </span>
                <span className="text-text-primary leading-relaxed">{cleaned}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {tipLines.length > 0 && (
        <div className="card mb-6">
          <p className="text-xs uppercase tracking-widest text-accent-gym mb-2">
            Tips del coach
          </p>
          <ul className="space-y-2">
            {tipLines.map((tip, i) => (
              <li key={i} className="text-sm text-text-primary leading-relaxed">
                {tip.replace(/^•\s*/, "• ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bottom nav: named prev/next */}
      <div className="grid grid-cols-2 gap-3 mt-8">
        <Link
          href={`/wiki/${prev.slug}`}
          className="card group hover:border-red-500/50 transition-all flex items-center gap-3"
        >
          <ChevronLeft size={20} className="text-text-secondary shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-text-secondary">Anterior</p>
            <p className="text-sm font-semibold text-text-primary truncate">
              {prev.name}
            </p>
          </div>
        </Link>

        <Link
          href={`/wiki/${next.slug}`}
          className="card group hover:border-red-500/50 transition-all flex items-center gap-3 justify-end text-right"
        >
          <div className="min-w-0">
            <p className="text-xs text-text-secondary">Siguiente</p>
            <p className="text-sm font-semibold text-text-primary truncate">
              {next.name}
            </p>
          </div>
          <ChevronRight size={20} className="text-text-secondary shrink-0" />
        </Link>
      </div>

      <p className="text-xs text-text-secondary text-center mt-8 opacity-60">
        Imágenes: ExerciseGymGifsDB + free-exercise-db
      </p>
    </div>
  );
}
