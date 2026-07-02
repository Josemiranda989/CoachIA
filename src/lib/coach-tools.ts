import { prisma } from "@/lib/prisma";

/**
 * Capa de tools del Chat Coach (ADR-001).
 *
 * El LLM PROPONE mutaciones vía tool calls (formato OpenAI); acá se validan los
 * arguments a mano (sin dependencias extra) y se aplican transaccionalmente
 * sobre DailyWorkout/CyclingBlock. El modelo nunca escribe en la DB directo.
 */

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
export type DayName = (typeof DAYS)[number];

export const DAY_ES: Record<DayName, string> = {
  Monday: "Lunes",
  Tuesday: "Martes",
  Wednesday: "Miércoles",
  Thursday: "Jueves",
  Friday: "Viernes",
  Saturday: "Sábado",
  Sunday: "Domingo",
};

const BLOCK_KINDS = ["warmup", "steady", "interval", "cooldown"] as const;

export interface CyclingBlockInput {
  kind: (typeof BLOCK_KINDS)[number];
  duration: number; // minutos; para interval, duración de CADA rep
  targetPower: string;
  repetitions?: number;
  recoveryDuration?: number;
  recoveryPower?: string;
  targetCadence?: string;
  notes?: string;
}

// ─── Tool definitions (formato OpenAI, consumidas por openCodeChatWithTools) ──

export const COACH_TOOLS = [
  {
    type: "function",
    function: {
      name: "move_workout",
      description:
        "Mueve un día de la semana actual a otro día. Si el destino ya tiene entrenamiento, se intercambian. Preserva todo el contenido (ejercicios, bloques, mapeo Hevy). Usar para gym y para bici.",
      parameters: {
        type: "object",
        properties: {
          day: { type: "string", enum: [...DAYS], description: "Día origen" },
          toDay: { type: "string", enum: [...DAYS], description: "Día destino" },
        },
        required: ["day", "toDay"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_rest_day",
      description:
        "Convierte un día de CICLISMO en descanso (elimina los bloques de la sesión). Solo válido para días Cycling — los días de gym se mueven, no se borran.",
      parameters: {
        type: "object",
        properties: {
          day: { type: "string", enum: [...DAYS] },
        },
        required: ["day"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "replace_cycling_blocks",
      description:
        "Reemplaza COMPLETOS los bloques de un día de ciclismo de la semana actual (bajar intensidad, acortar por tiempo, pasar a rodillo, etc). El totalDuration se calcula automáticamente de los bloques.",
      parameters: {
        type: "object",
        properties: {
          day: { type: "string", enum: [...DAYS] },
          totalPower: {
            type: "string",
            description: 'Label resumen de la sesión, ej "Z2" o "Z2 + 3x3\'Z3"',
          },
          notes: {
            type: "string",
            description: "Propósito de la sesión ajustada (1 oración útil durante el entreno)",
          },
          blocks: {
            type: "array",
            minItems: 2,
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: [...BLOCK_KINDS] },
                duration: {
                  type: "integer",
                  minimum: 1,
                  description: "Minutos. Para interval: duración de CADA rep.",
                },
                targetPower: { type: "string", description: '"Z2", "Z4", "88-94% FTP", etc.' },
                repetitions: { type: "integer", minimum: 2, description: "Solo interval" },
                recoveryDuration: { type: "integer", minimum: 1, description: "Solo interval, min entre reps" },
                recoveryPower: { type: "string", description: 'Solo interval. Nunca "Z1" (piso Z2 del atleta).' },
                targetCadence: { type: "string", description: 'Opcional, ej "90+ rpm", "55-65 rpm big gear"' },
                notes: { type: "string" },
              },
              required: ["kind", "duration", "targetPower"],
              additionalProperties: false,
            },
          },
        },
        required: ["day", "totalPower", "blocks"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_day_notes",
      description: "Actualiza solo las notas/indicaciones de un día, sin tocar la estructura.",
      parameters: {
        type: "object",
        properties: {
          day: { type: "string", enum: [...DAYS] },
          notes: { type: "string" },
        },
        required: ["day", "notes"],
        additionalProperties: false,
      },
    },
  },
];

// ─── Validación ──────────────────────────────────────────────────────────────

export type ToolName =
  | "move_workout"
  | "set_rest_day"
  | "replace_cycling_blocks"
  | "update_day_notes";

export interface ValidatedProposal {
  name: ToolName;
  args: Record<string, unknown>;
  /** Resumen humano para la card de confirmación, ej "Jueves → Z2 60min" */
  summary: string;
}

function isDay(v: unknown): v is DayName {
  return typeof v === "string" && (DAYS as readonly string[]).includes(v);
}

function fail(msg: string): never {
  throw new Error(msg);
}

function validateBlocks(raw: unknown): CyclingBlockInput[] {
  if (!Array.isArray(raw) || raw.length < 2) fail("blocks debe ser un array de al menos 2 bloques");
  return raw.map((b, i) => {
    if (!b || typeof b !== "object") fail(`blocks[${i}] no es un objeto`);
    const blk = b as Record<string, unknown>;
    if (!BLOCK_KINDS.includes(blk.kind as never)) fail(`blocks[${i}].kind inválido: ${blk.kind}`);
    if (!Number.isInteger(blk.duration) || (blk.duration as number) < 1)
      fail(`blocks[${i}].duration debe ser entero positivo`);
    if (typeof blk.targetPower !== "string" || !blk.targetPower.trim())
      fail(`blocks[${i}].targetPower requerido`);
    if (blk.kind === "interval") {
      if (!Number.isInteger(blk.repetitions) || (blk.repetitions as number) < 2)
        fail(`blocks[${i}]: interval requiere repetitions >= 2`);
    }
    const out: CyclingBlockInput = {
      kind: blk.kind as CyclingBlockInput["kind"],
      duration: blk.duration as number,
      targetPower: blk.targetPower as string,
    };
    if (blk.repetitions != null) out.repetitions = blk.repetitions as number;
    if (blk.recoveryDuration != null) out.recoveryDuration = blk.recoveryDuration as number;
    if (blk.recoveryPower != null) out.recoveryPower = String(blk.recoveryPower);
    if (blk.targetCadence != null) out.targetCadence = String(blk.targetCadence);
    if (blk.notes != null) out.notes = String(blk.notes);
    return out;
  });
}

export function blocksTotalMinutes(blocks: CyclingBlockInput[]): number {
  return blocks.reduce((acc, b) => {
    if (b.kind === "interval" && b.repetitions) {
      return acc + b.repetitions * (b.duration + (b.recoveryDuration ?? 0));
    }
    return acc + b.duration;
  }, 0);
}

/**
 * Valida una tool call cruda del modelo. Lanza Error con mensaje descriptivo si
 * los args no cumplen el contrato (se loguea para medir confiabilidad — Fase 5).
 */
export function validateToolCall(name: string, rawArgs: string): ValidatedProposal {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArgs);
  } catch {
    fail(`arguments de ${name} no es JSON válido`);
  }

  switch (name) {
    case "move_workout": {
      if (!isDay(args.day)) fail(`move_workout: day inválido (${args.day})`);
      if (!isDay(args.toDay)) fail(`move_workout: toDay inválido (${args.toDay})`);
      if (args.day === args.toDay) fail("move_workout: day y toDay son iguales");
      return {
        name,
        args: { day: args.day, toDay: args.toDay },
        summary: `Mover ${DAY_ES[args.day]} → ${DAY_ES[args.toDay]}`,
      };
    }
    case "set_rest_day": {
      if (!isDay(args.day)) fail(`set_rest_day: day inválido (${args.day})`);
      return {
        name,
        args: { day: args.day },
        summary: `${DAY_ES[args.day]} → descanso`,
      };
    }
    case "replace_cycling_blocks": {
      if (!isDay(args.day)) fail(`replace_cycling_blocks: day inválido (${args.day})`);
      if (typeof args.totalPower !== "string" || !args.totalPower.trim())
        fail("replace_cycling_blocks: totalPower requerido");
      const blocks = validateBlocks(args.blocks);
      const total = blocksTotalMinutes(blocks);
      return {
        name,
        args: {
          day: args.day,
          totalPower: args.totalPower,
          notes: args.notes != null ? String(args.notes) : undefined,
          blocks,
        },
        summary: `${DAY_ES[args.day]} → ${args.totalPower} (${total} min)`,
      };
    }
    case "update_day_notes": {
      if (!isDay(args.day)) fail(`update_day_notes: day inválido (${args.day})`);
      if (typeof args.notes !== "string" || !args.notes.trim())
        fail("update_day_notes: notes requerido");
      return {
        name,
        args: { day: args.day, notes: args.notes },
        summary: `Notas de ${DAY_ES[args.day]}`,
      };
    }
    default:
      fail(`Tool desconocida: ${name}`);
  }
}

// ─── Aplicación transaccional + snapshot para undo ──────────────────────────

interface DaySnapshot {
  dailyWorkoutId: string;
  dayOfWeek: string;
  type: string;
  targetDuration: number | null;
  targetPower: string | null;
  notes: string | null;
  blocks: Array<{
    order: number;
    kind: string;
    duration: number;
    targetPower: string;
    repetitions: number | null;
    recoveryDuration: number | null;
    recoveryPower: string | null;
    targetCadence: string | null;
    notes: string | null;
  }>;
}

async function snapshotDays(routineId: string, dayNames: string[]): Promise<DaySnapshot[]> {
  const days = await prisma.dailyWorkout.findMany({
    where: { routineId, dayOfWeek: { in: dayNames } },
    include: { blocks: { orderBy: { order: "asc" } } },
  });
  return days.map((d) => ({
    dailyWorkoutId: d.id,
    dayOfWeek: d.dayOfWeek,
    type: d.type,
    targetDuration: d.targetDuration,
    targetPower: d.targetPower,
    notes: d.notes,
    blocks: d.blocks.map((b) => ({
      order: b.order,
      kind: b.kind,
      duration: b.duration,
      targetPower: b.targetPower,
      repetitions: b.repetitions,
      recoveryDuration: b.recoveryDuration,
      recoveryPower: b.recoveryPower,
      targetCadence: b.targetCadence,
      notes: b.notes,
    })),
  }));
}

async function getDayOrThrow(routineId: string, day: string) {
  const dw = await prisma.dailyWorkout.findFirst({
    where: { routineId, dayOfWeek: day },
    include: { exercises: { select: { id: true } } },
  });
  if (!dw) fail(`No existe el día ${day} en la rutina de esta semana`);
  return dw;
}

/**
 * Aplica una proposal validada sobre la rutina. Devuelve el ChangeLog creado
 * (con el snapshot previo) para permitir deshacer.
 */
export async function applyProposal(
  routineId: string,
  proposal: ValidatedProposal
): Promise<{ changeLogId: string; summary: string }> {
  const { name, args, summary } = proposal;

  switch (name) {
    case "move_workout": {
      const day = args.day as string;
      const toDay = args.toDay as string;
      const source = await getDayOrThrow(routineId, day);
      const target = await prisma.dailyWorkout.findFirst({
        where: { routineId, dayOfWeek: toDay },
      });
      const before = await snapshotDays(routineId, [day, toDay]);
      const log = await prisma.$transaction(async (tx) => {
        await tx.dailyWorkout.update({
          where: { id: source.id },
          data: { dayOfWeek: toDay },
        });
        if (target) {
          await tx.dailyWorkout.update({
            where: { id: target.id },
            data: { dayOfWeek: day },
          });
        }
        return tx.routineChangeLog.create({
          data: { routineId, summary, beforeJson: JSON.stringify(before) },
        });
      });
      return { changeLogId: log.id, summary };
    }

    case "set_rest_day": {
      const day = args.day as string;
      const dw = await getDayOrThrow(routineId, day);
      if (dw.exercises.length > 0)
        fail(`${day} tiene ejercicios de gym — los días de gym se mueven, no se convierten en descanso`);
      const before = await snapshotDays(routineId, [day]);
      const log = await prisma.$transaction(async (tx) => {
        await tx.cyclingBlock.deleteMany({ where: { dailyWorkoutId: dw.id } });
        await tx.dailyWorkout.update({
          where: { id: dw.id },
          data: { type: "Rest", targetDuration: null, targetPower: null },
        });
        return tx.routineChangeLog.create({
          data: { routineId, summary, beforeJson: JSON.stringify(before) },
        });
      });
      return { changeLogId: log.id, summary };
    }

    case "replace_cycling_blocks": {
      const day = args.day as string;
      const blocks = args.blocks as CyclingBlockInput[];
      const dw = await getDayOrThrow(routineId, day);
      const before = await snapshotDays(routineId, [day]);
      const totalDuration = blocksTotalMinutes(blocks);
      const log = await prisma.$transaction(async (tx) => {
        await tx.cyclingBlock.deleteMany({ where: { dailyWorkoutId: dw.id } });
        await tx.dailyWorkout.update({
          where: { id: dw.id },
          data: {
            type: dw.exercises.length > 0 ? "Gym + Cycling" : "Cycling",
            targetDuration: totalDuration,
            targetPower: args.totalPower as string,
            ...(args.notes != null ? { notes: args.notes as string } : {}),
            blocks: {
              create: blocks.map((b, idx) => ({
                order: idx,
                kind: b.kind,
                duration: b.duration,
                targetPower: b.targetPower,
                repetitions: b.repetitions ?? null,
                recoveryDuration: b.recoveryDuration ?? null,
                recoveryPower: b.recoveryPower ?? null,
                targetCadence: b.targetCadence ?? null,
                notes: b.notes ?? null,
              })),
            },
          },
        });
        return tx.routineChangeLog.create({
          data: { routineId, summary, beforeJson: JSON.stringify(before) },
        });
      });
      return { changeLogId: log.id, summary };
    }

    case "update_day_notes": {
      const day = args.day as string;
      const dw = await getDayOrThrow(routineId, day);
      const before = await snapshotDays(routineId, [day]);
      const log = await prisma.$transaction(async (tx) => {
        await tx.dailyWorkout.update({
          where: { id: dw.id },
          data: { notes: args.notes as string },
        });
        return tx.routineChangeLog.create({
          data: { routineId, summary, beforeJson: JSON.stringify(before) },
        });
      });
      return { changeLogId: log.id, summary };
    }
  }
}

/** Restaura el snapshot de un RoutineChangeLog (deshacer). */
export async function undoChangeLog(changeLogId: string, userId: string): Promise<string> {
  const log = await prisma.routineChangeLog.findUnique({ where: { id: changeLogId } });
  if (!log) fail("Cambio no encontrado");
  if (log.undoneAt) fail("Este cambio ya fue deshecho");

  const routine = await prisma.routine.findUnique({
    where: { id: log.routineId },
    select: { userId: true },
  });
  if (!routine || routine.userId !== userId) fail("Cambio no encontrado");

  const snapshots = JSON.parse(log.beforeJson) as DaySnapshot[];

  await prisma.$transaction(async (tx) => {
    for (const snap of snapshots) {
      await tx.cyclingBlock.deleteMany({ where: { dailyWorkoutId: snap.dailyWorkoutId } });
      await tx.dailyWorkout.update({
        where: { id: snap.dailyWorkoutId },
        data: {
          dayOfWeek: snap.dayOfWeek,
          type: snap.type,
          targetDuration: snap.targetDuration,
          targetPower: snap.targetPower,
          notes: snap.notes,
          blocks: {
            create: snap.blocks.map((b) => ({
              order: b.order,
              kind: b.kind,
              duration: b.duration,
              targetPower: b.targetPower,
              repetitions: b.repetitions,
              recoveryDuration: b.recoveryDuration,
              recoveryPower: b.recoveryPower,
              targetCadence: b.targetCadence,
              notes: b.notes,
            })),
          },
        },
      });
    }
    await tx.routineChangeLog.update({
      where: { id: changeLogId },
      data: { undoneAt: new Date() },
    });
  });

  return log.summary;
}
