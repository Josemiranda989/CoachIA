export interface LogWithRoutineContext {
  id: string;
  routineWeekStart: string | null | undefined;
}

export interface BackfillResult {
  updates: { id: string; weekStart: string }[];
  orphans: string[];
}

export function computeWorkLogBackfill(
  logs: LogWithRoutineContext[],
): BackfillResult {
  const updates: { id: string; weekStart: string }[] = [];
  const orphans: string[] = [];
  for (const log of logs) {
    if (log.routineWeekStart) {
      updates.push({ id: log.id, weekStart: log.routineWeekStart });
    } else {
      orphans.push(log.id);
    }
  }
  return { updates, orphans };
}
