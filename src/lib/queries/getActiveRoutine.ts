import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// "Active routine for this week" with the same fallback used across pages:
// 1) latest routine whose weekStart <= current week (current or any past), then
// 2) earliest routine whose weekStart > current week (e.g. just-approved
//    monthly mesocycle that starts next Monday).
// Wrapped with React.cache() so multiple Server Components in the same render
// share a single query when they call the same preset with the same args.

async function findActiveRoutine<T extends Prisma.RoutineInclude>(
  userId: string,
  weekStart: string,
  include: T
): Promise<Prisma.RoutineGetPayload<{ include: T }> | null> {
  const past = await prisma.routine.findFirst({
    where: { userId, status: "active", weekStart: { lte: weekStart } },
    orderBy: { weekStart: "desc" },
    include,
  });
  if (past) return past as Prisma.RoutineGetPayload<{ include: T }>;
  const future = await prisma.routine.findFirst({
    where: { userId, status: "active", weekStart: { gt: weekStart } },
    orderBy: { weekStart: "asc" },
    include,
  });
  return future as Prisma.RoutineGetPayload<{ include: T }> | null;
}

// Home dashboard: just needs day type + completion flag for the progress bar.
export const getActiveRoutineLight = cache(
  async (userId: string, weekStart: string) =>
    findActiveRoutine(userId, weekStart, {
      days: {
        select: {
          type: true,
          completions: { where: { weekStart }, select: { completed: true } },
        },
      },
    })
);

// Weekly accordion view: needs full day shape, exercises, blocks, completions.
export const getActiveRoutineWithBlocks = cache(
  async (userId: string, weekStart: string) =>
    findActiveRoutine(userId, weekStart, {
      days: {
        include: {
          exercises: true,
          completions: { where: { weekStart } },
          blocks: { orderBy: { order: "asc" } },
        },
      },
    })
);

// Today's workout page: same as withBlocks plus this week's logs per exercise
// (used to prefill the gym tracker).
export const getActiveRoutineWithLogs = cache(
  async (userId: string, weekStart: string) =>
    findActiveRoutine(userId, weekStart, {
      days: {
        include: {
          exercises: { include: { logs: { where: { weekStart } } } },
          completions: { where: { weekStart } },
          blocks: { orderBy: { order: "asc" } },
        },
      },
    })
);

// /api/today: a single day filtered by name, no cycling blocks (n8n / external).
export const getActiveRoutineDay = cache(
  async (userId: string, weekStart: string, dayOfWeek: string) =>
    findActiveRoutine(userId, weekStart, {
      days: {
        where: { dayOfWeek },
        include: {
          exercises: true,
          completions: { where: { weekStart } },
        },
      },
    })
);

export type ActiveRoutineLight = NonNullable<
  Awaited<ReturnType<typeof getActiveRoutineLight>>
>;
export type ActiveRoutineWithBlocks = NonNullable<
  Awaited<ReturnType<typeof getActiveRoutineWithBlocks>>
>;
export type ActiveRoutineWithLogs = NonNullable<
  Awaited<ReturnType<typeof getActiveRoutineWithLogs>>
>;

export type DayWithBlocks = ActiveRoutineWithBlocks["days"][number];
export type DayWithLogs = ActiveRoutineWithLogs["days"][number];
export type ExerciseWithLogs = DayWithLogs["exercises"][number];
