import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { BackLink } from "@/components/BackLink";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllExerciseDefinitions } from "@/lib/exercise-cache";

export const metadata: Metadata = { title: "Wiki de ejercicios" };

export default async function WikiPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");

  const exercises = await getAllExerciseDefinitions();

  return (
    <div className="app-container py-10">
      <BackLink href="/" />

      <div className="mb-6">
        <h1 className="title text-3xl mb-1">Wiki de Ejercicios</h1>
        <p className="subtitle">
          Referencia rápida de los {exercises.length} ejercicios de tu rutina. Tap
          uno para ver descripción e instrucciones.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {exercises.map((ex) => (
          <Link
            key={ex.id}
            href={`/wiki/${ex.slug}`}
            className="card block card-hover-lift"
            style={{ cursor: "pointer" }}
          >
            <div className="flex gap-3 items-center">
              <div
                className="shrink-0 rounded-lg overflow-hidden bg-bg-secondary flex items-center justify-center"
                style={{ width: 72, height: 72 }}
              >
                {ex.imagePath ? (
                  <Image
                    src={ex.imagePath}
                    alt={ex.name}
                    width={72}
                    height={72}
                    className="object-cover"
                    style={{ width: 72, height: 72 }}
                  />
                ) : (
                  <span className="text-3xl">🏋️</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-text-primary truncate">{ex.name}</h3>
                <p className="text-xs text-text-secondary truncate">
                  {ex.muscleGroups}
                </p>
                {ex.equipment && (
                  <p className="text-xs text-accent-primary mt-0.5 truncate">
                    {ex.equipment}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <p className="text-xs text-text-secondary text-center mt-8 opacity-60">
        Imágenes: free-exercise-db (public domain)
      </p>
    </div>
  );
}
