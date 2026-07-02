import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/internal-auth";
import { validateToolCall, applyProposal } from "@/lib/coach-tools";

// POST: aplica propuestas del Chat Coach ya confirmadas por el usuario.
// Se RE-VALIDAN acá (nunca confiar en el payload del cliente) y cada una
// guarda su snapshot en RoutineChangeLog para poder deshacer.
export async function POST(request: Request) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const { routineId, proposals } = body as {
    routineId?: string;
    proposals?: Array<{ name: string; args: unknown }>;
  };

  if (!routineId || !Array.isArray(proposals) || proposals.length === 0) {
    return NextResponse.json(
      { error: "routineId y proposals son requeridos" },
      { status: 400 }
    );
  }

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: { userId: true },
  });
  if (!routine || routine.userId !== auth.userId) {
    return NextResponse.json({ error: "Rutina no encontrada" }, { status: 404 });
  }

  const applied: Array<{ summary: string; changeLogId: string }> = [];
  const errors: string[] = [];

  for (const p of proposals) {
    try {
      const validated = validateToolCall(p.name, JSON.stringify(p.args));
      const result = await applyProposal(routineId, validated);
      applied.push(result);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (applied.length === 0) {
    return NextResponse.json(
      { error: errors.join("; ") || "No se aplicó ningún cambio" },
      { status: 422 }
    );
  }

  return NextResponse.json({ applied, errors: errors.length ? errors : undefined });
}
