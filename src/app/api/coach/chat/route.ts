import { NextResponse } from "next/server";
import { resolveAuth } from "@/lib/internal-auth";
import { buildCoachContext } from "@/lib/coach-context";
import { openCodeChatWithTools } from "@/lib/opencode";
import { COACH_TOOLS, validateToolCall } from "@/lib/coach-tools";
import type { ValidatedProposal } from "@/lib/coach-tools";

const MAX_HISTORY = 20;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// POST: un turno del Chat Coach. Stateless: el cliente manda el historial
// completo; acá se arma el contexto fresco (rutina + Strava + balanza +
// fitness), se llama al modelo con tools y se devuelven propuestas VALIDADAS
// sin aplicar — la aplicación pasa por /api/coach/apply tras confirmación.
export async function POST(request: Request) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const history: ChatMessage[] = Array.isArray(body.messages) ? body.messages : [];

  const valid = history.every(
    (m) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string"
  );
  if (!valid || history.length === 0) {
    return NextResponse.json(
      { error: "messages debe ser un array no vacío de {role, content}" },
      { status: 400 }
    );
  }
  if (history[history.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "el último mensaje debe ser del usuario" },
      { status: 400 }
    );
  }

  try {
    const { systemPrompt, routineId } = await buildCoachContext(auth.userId);

    const result = await openCodeChatWithTools(
      [
        { role: "system", content: systemPrompt },
        ...history.slice(-MAX_HISTORY),
      ],
      COACH_TOOLS,
      { timeout: 90_000 }
    );

    const proposals: Array<ValidatedProposal & { id: string }> = [];
    const invalid: string[] = [];

    for (const call of result.toolCalls) {
      try {
        const p = validateToolCall(call.function.name, call.function.arguments);
        proposals.push({ ...p, id: call.id });
      } catch (e) {
        // Métrica de confiabilidad del modelo (ADR-001 Fase 5): tool calls
        // rechazadas por validación se loguean y se informan sin romper el turno.
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("Coach chat: tool call inválida:", call.function.name, msg);
        invalid.push(msg);
      }
    }

    let reply = result.content?.trim() ?? "";
    if (!reply && proposals.length > 0) {
      reply = "Te propongo este ajuste:";
    }
    if (!reply && proposals.length === 0) {
      reply = "No me quedó claro el pedido, ¿me lo repetís de otra forma?";
    }

    return NextResponse.json({
      reply,
      proposals,
      routineId,
      invalidToolCalls: invalid.length ? invalid : undefined,
    });
  } catch (err: any) {
    console.error("Coach chat error:", err);
    return NextResponse.json(
      { error: "Error consultando al coach", details: err.message },
      { status: 500 }
    );
  }
}
