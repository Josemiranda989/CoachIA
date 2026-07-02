# Plan de implementación — Adaptación de rutina en caliente

> Deriva de [ADR-001](./ADR-001-in-week-routine-adaptation.md). Ordenado por fases; cada fase es entregable y testeable por separado.

Recordatorio de flujo (de `CLAUDE.md`): tras cambios de código `docker compose up -d --build`; tras cambios de schema `docker exec coachia-coach-ia-1 npx prisma db push`. Notificaciones con `toast`, nunca `alert()`. Auth interna con `X-Internal-Key` (`src/lib/internal-auth.ts`).

---

## Fase 0 — Cliente LLM (fundación)

**Objetivo:** un cliente único, configurable, OpenAI-compatible (DeepSeek V4 vía OpenCode Zen o DeepSeek directo). Reemplaza `@google/genai`.

1. Confirmar acceso server-side: ¿la key de OpenCode Go sirve desde el backend, o hay que usar OpenCode Zen / `api.deepseek.com`? Setear envs:
   ```
   LLM_BASE_URL=https://api.deepseek.com/v1   # o el endpoint de OpenCode Zen
   LLM_API_KEY=...
   LLM_MODEL_CHAT=deepseek-v4-flash
   LLM_MODEL_GEN=deepseek-v4-pro
   ```
2. `npm i openai` y quitar `@google/genai` del `package.json`.
3. `src/lib/llm.ts`:
   ```ts
   import OpenAI from "openai";

   export const llm = new OpenAI({
     baseURL: process.env.LLM_BASE_URL,
     apiKey:  process.env.LLM_API_KEY,
   });

   export const MODELS = {
     chat: process.env.LLM_MODEL_CHAT ?? "deepseek-v4-flash",
     gen:  process.env.LLM_MODEL_GEN  ?? "deepseek-v4-pro",
   };
   ```
4. Migrar la generación mensual existente a `llm` + `MODELS.gen` (cambio mínimo: mismo prompt, distinto cliente). Verificar que sigue produciendo rutina válida.

**Done cuando:** la generación mensual funciona con DeepSeek y no queda ninguna referencia a Gemini en el código.

---

## Fase 1 — Gym: reordenar días (determinista, sin LLM)

**Objetivo:** mover un día de gym sin tocar contenido ni romper el mapeo Hevy.

1. **API** `PATCH src/app/api/routine/move-day/route.ts`:
   - Input: `{ dailyWorkoutId, toDayOfWeek }` (o `toDate`).
   - Lógica: actualizar `DailyWorkout.dayOfWeek`/`date`. **No** tocar `hevyRoutineId` ni `HevyGymSlot`. Si el destino ya tiene workout, intercambiar (swap) los dos días.
   - Auth: sesión NextAuth (helper `internal-auth`).
   ```ts
   await prisma.$transaction([
     prisma.dailyWorkout.update({ where: { id: a.id }, data: { dayOfWeek: bDay } }),
     prisma.dailyWorkout.update({ where: { id: b.id }, data: { dayOfWeek: aDay } }),
   ]);
   ```
2. **UI** en `src/app/routine/week/`: botón "mover" en cada day card (o drag & drop). `toast.success("Día movido")`. Revalidar la vista.

**Done cuando:** podés mover/intercambiar días desde la semana, el `hevyRoutineId` se conserva y la próxima sync a Hevy no duplica rutinas.

---

## Fase 2 — Bici: capa de tools + mutaciones

**Objetivo:** definir las herramientas que el LLM puede invocar y la capa que las aplica de forma segura.

1. **Schemas Zod** `src/lib/routine-tools.ts` (fuente de verdad; las tool definitions se derivan de acá):
   ```ts
   import { z } from "zod";

   const Day = z.enum(["Lunes","Martes","Miercoles","Jueves","Viernes","Sabado","Domingo"]);

   export const CyclingBlockInput = z.object({
     kind: z.enum(["warmup","steady","interval","cooldown"]),
     duration: z.number().int().positive(),     // minutos
     targetPower: z.string(),                    // "Z2", "123-132W", etc
     repetitions: z.number().int().optional(),
     recoveryDuration: z.number().int().optional(),
     recoveryPower: z.string().optional(),
     targetCadence: z.string().optional(),
     notes: z.string().optional(),
   });

   export const Tools = {
     moveWorkout:     z.object({ day: Day, toDay: Day }),
     swapWorkoutType: z.object({ day: Day, type: z.enum(["Gym","Cycling","Rest"]) }),
     setCyclingBlocks:z.object({ day: Day, blocks: z.array(CyclingBlockInput) }),
     adjustIntensity: z.object({ day: Day, target: z.enum(["Z2","SS","Z4"]), minutes: z.number().int().optional() }),
   };
   ```
2. **Tool definitions** para la API (formato OpenAI, `strict: true`). Generarlas desde los Zod (con `zod-to-json-schema`) para no duplicar.
3. **`applyMutation(name, args, routineId)`** — capa transaccional sobre `DailyWorkout`/`CyclingBlock`:
   - `moveWorkout`/`swapWorkoutType`: reusa lo de Fase 1 + cambia `type`.
   - `setCyclingBlocks`: borra los `CyclingBlock` del día y crea los nuevos (respetando `order`); actualiza `targetDuration`/`targetPower` resumen del `DailyWorkout`.
   - `adjustIntensity`: helper que traduce target+minutos → bloques a FTP **140** (SS=123–132W, Z2=78–105W, Z4=127–147W).
   - Todo dentro de `prisma.$transaction`.

**Done cuando:** podés llamar `applyMutation` desde un test y los cambios se persisten correctamente; args inválidos son rechazados por Zod antes de tocar la DB.

---

## Fase 3 — Bici: endpoint de chat con contexto

**Objetivo:** chat que razona con la semana real + Strava y propone tool calls.

1. **Ensamblado de contexto** `src/lib/coach-context.ts`:
   - Semana actual: `Routine` activa + `DailyWorkout`/`CyclingBlock`.
   - Strava: últimas ~10 actividades (vía la integración existente `src/lib/strava.ts`).
   - Referencias fijas: **FTP 140 W, LTHR 155 bpm, 86.5 kg**, zonas.
   - System prompt: persona de coach (combina ciclismo + pesas), reglas (Strava = source of truth, no inventar datos, proponer no ejecutar).
2. **API** `POST src/app/api/coach/chat/route.ts`:
   ```ts
   const res = await llm.chat.completions.create({
     model: MODELS.chat,
     messages: [{ role: "system", content: systemPrompt }, ...history, userMsg],
     tools, tool_choice: "auto",
   });
   const calls = res.choices[0].message.tool_calls ?? [];
   // NO aplicar todavía: devolver las tool calls como "propuesta" al cliente
   const proposals = calls.map(c => ({
     id: c.id, name: c.function.name,
     args: Tools[c.function.name].parse(JSON.parse(c.function.arguments)), // valida
   }));
   return Response.json({ reply: res.choices[0].message.content, proposals });
   ```
3. **Confirmación**: `POST src/app/api/coach/apply/route.ts` recibe `{ proposals }` aprobadas y llama `applyMutation` para cada una en transacción. Antes de aplicar, guardar snapshot para undo (ver Fase 4).

**Done cuando:** un mensaje tipo "vengo fundido, bajá el jueves a Z2" devuelve una propuesta `adjustIntensity(Jueves, Z2)` validada, sin escribir aún en la DB.

---

## Fase 4 — UI del chat + propose / confirm / undo

**Objetivo:** experiencia de ajuste en caliente, revisable y reversible.

1. **Schema (mínimo)** para undo — `prisma/schema.prisma`:
   ```prisma
   model RoutineChangeLog {
     id         String   @id @default(cuid())
     routineId  String
     summary    String   // "Jueves → Z2 60min"
     beforeJson String   // snapshot del/los DailyWorkout afectados
     createdAt  DateTime @default(now())
   }
   ```
   `docker exec coachia-coach-ia-1 npx prisma db push`.
2. **Componente** `src/app/coach/chat/` (`"use client"`): hilo de chat; cada propuesta se muestra como card con **Aplicar / Descartar**. Al aplicar → `/api/coach/apply` → `toast.success`. Botón **Deshacer** restaura desde `beforeJson`.
3. Reusar estilo glassmorphism + CSS vars (`--accent-cycling`). Nada de `dark:`.

**Done cuando:** desde el celu podés chatear, ver la propuesta, aplicarla y deshacerla, y la semana se actualiza.

---

## Fase 5 — Strava autodetección (opcional) + cierre

1. **Autodetección gym**: job que, si detecta un `WeightTraining` en Strava en un día no planeado, marca `WorkoutCompletion` y sugiere correr el resto (no automático: propone en el chat).
2. **Actualizar `CLAUDE.md`**: stack dice "Google Gemini (routine generation)" → "DeepSeek V4 (flash/pro) vía OpenCode/DeepSeek (cliente OpenAI-compatible, `src/lib/llm.ts`)".
3. **Métrica**: loguear tool calls inválidas (rechazadas por Zod) para medir confiabilidad del modelo y decidir si subir a `pro` o ajustar prompt.

---

## Orden sugerido de PRs

1. Fase 0 (cliente LLM) — desbloquea todo.
2. Fase 1 (mover días) — valor inmediato, sin LLM, bajo riesgo.
3. Fases 2+3 (tools + chat backend) — el corazón.
4. Fase 4 (UI + undo).
5. Fase 5 (autodetección + limpieza).

## Riesgos / decisiones abiertas

- Confiabilidad de tool calling de DeepSeek V4 → mitigado con `strict` + Zod + métrica (Fase 5).
- Endpoint server-side (OpenCode Zen vs DeepSeek directo) → resolver en Fase 0 antes de avanzar.
- Undo simple por snapshot JSON; si crece la complejidad, evaluar event-sourcing más adelante.
