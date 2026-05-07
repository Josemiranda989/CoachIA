import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

// ExerciseDefinition is global (not per-user). Cache for 1h with tag "exercises"
// so admin/migration scripts can invalidate via revalidateTag("exercises").

export const getAllExerciseDefinitions = unstable_cache(
  async () =>
    prisma.exerciseDefinition.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        muscleGroups: true,
        equipment: true,
        imagePath: true,
      },
      orderBy: { name: "asc" },
    }),
  ["exercise-definitions-list"],
  { revalidate: 3600, tags: ["exercises"] }
);

export const getAllExerciseSlugs = unstable_cache(
  async () =>
    prisma.exerciseDefinition.findMany({
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ["exercise-slugs"],
  { revalidate: 3600, tags: ["exercises"] }
);

export const getExerciseBySlug = unstable_cache(
  async (slug: string) =>
    prisma.exerciseDefinition.findUnique({ where: { slug } }),
  ["exercise-by-slug"],
  { revalidate: 3600, tags: ["exercises"] }
);
