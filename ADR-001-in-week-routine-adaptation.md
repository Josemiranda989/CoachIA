# ADR-001: Adaptación de rutina en caliente (chat + reordenamiento)

**Status:** Proposed
**Date:** 2026-06-30
**Deciders:** José

## Context

CoachIA genera rutinas **mensualmente** (tarea programada el 1° a las 8am) y trata a **Strava como source of truth** del ciclismo. El gym usa un mesociclo fijo (D1/D3 superior, D2 piernas) cuyo template es idéntico durante las 4 semanas y se reutiliza mes a mes; cada slot mapea a una rutina Hevy persistente vía `HevyGymSlot` (PUT en vez de POST para no acumular rutinas basura).

El problema es la **adaptación intra-semana**, que hoy no tiene buena solución:

1. **Gym — los días se corren.** La estructura no cambia (D1/D3 superior, D2 piernas), pero el día de calendario sí varía por feriados, clima y trabajo. Hoy no hay forma limpia de mover un día sin tocar JSON manualmente (`routine/load`).
2. **Bici — falta flexibilidad de modificación.** Las decisiones son de criterio y abiertas ("vengo fundido, bajá el jueves a Z2", "hace frío, pasá a rodillo", "tengo 40 min"). Regenerar la rutina entera es demasiado y pierde el contexto de lo que realmente pasó en la semana.

Restricción adicional de stack: **ya no se usa Google Gemini**. Se migró a **DeepSeek V4 (flash/pro)** vía suscripción OpenCode. DeepSeek V4 es OpenAI-compatible y soporta function/tool calling (incluido `strict` mode beta).

Valores de referencia actuales del atleta (para el contexto que consume el LLM): **FTP 140 W**, **LTHR 155 bpm**, 86.5 kg (1.62 W/kg).

## Decision

Separar la adaptación en **dos mecanismos distintos** según la naturaleza del cambio, en vez de resolver todo con un único chat freeform:

1. **Gym → reordenamiento determinista (sin LLM).** Una acción "mover día" que solo actualiza `DailyWorkout.dayOfWeek`/`date`, preservando el `hevyRoutineId` y el mapeo `HevyGymSlot`. Opcionalmente, autodetección desde Strava: si aparece un `WeightTraining` en un día que no tocaba, se marca completado y se corre el resto.

2. **Bici → chat conversacional con tool calling.** Un endpoint de chat que arma contexto (semana actual `Routine` + actividades Strava recientes + FTP/LTHR), llama a **DeepSeek V4 flash** con **tools que mapean 1:1 al schema**, y aplica las mutaciones de forma transaccional sobre `DailyWorkout`/`CyclingBlock`. El modelo **propone** (tool calls), nunca escribe en la DB directo; se validan con **Zod** y se aplican con un **propose/confirm liviano** (aprobar/deshacer inline en el chat), reutilizando el patrón de estado `pending`.

Cliente LLM: **SDK de OpenAI apuntado a OpenCode Zen o a `api.deepseek.com`**. `deepseek-v4-flash` para el chat en caliente; `deepseek-v4-pro` para la generación mensual pesada. Se elimina `@google/genai`.

## Options Considered

### Option A: Chat freeform que regenera el JSON completo de la rutina

| Dimension | Assessment |
|-----------|------------|
| Complexity | Med (parsing + re-validación pesada) |
| Cost | Med-High (tokens de toda la rutina por edit) |
| Scalability | Baja — cada cambio re-procesa todo |
| Team familiarity | Alta |

**Pros:** un solo flujo para todo; flexible.
**Cons:** no determinista; difícil de validar/persistir; rompe el mapeo `HevyGymSlot` con facilidad; matar una mosca con un cañón para algo tan simple como mover un día de gym.

### Option B: Híbrido — reorden determinista (gym) + chat con tool calling (bici) — **ELEGIDA**

| Dimension | Assessment |
|-----------|------------|
| Complexity | Med (dos caminos, pero cada uno simple) |
| Cost | Bajo (flash + tokens acotados a la semana) |
| Scalability | Alta — mutaciones puntuales |
| Team familiarity | Alta (OpenAI-compatible) |

**Pros:** cada problema con la herramienta adecuada; mutaciones deterministas y validables; preserva `HevyGymSlot`; el chat aprovecha la ventaja real de CoachIA (datos de Strava); barato.
**Cons:** dos mecanismos a mantener; requiere capa de tools + validación Zod + UI de confirmación.

### Option C: Solo UI (drag & drop / formularios), sin chat

| Dimension | Assessment |
|-----------|------------|
| Complexity | Baja |
| Cost | Nulo (sin LLM) |
| Scalability | Alta |
| Team familiarity | Alta |

**Pros:** previsible, sin costos de inferencia, sin alucinaciones.
**Cons:** para la bici, las modificaciones son abiertas y de criterio (intensidad, duración, indoor/outdoor según fatiga real) — un formulario no captura eso bien ni razona con la carga de Strava.

## Trade-off Analysis

El eje central es **determinismo vs. flexibilidad**. Mover días de gym es un problema cerrado (reordenar contenido fijo) donde el determinismo gana: más rápido, sin costo, sin riesgo de romper el mapeo Hevy. Adaptar la bici es un problema abierto y de criterio donde la flexibilidad del chat — alimentado por Strava — aporta valor real.

Option A colapsa ambos en un flujo no determinista y caro. Option C es ideal para el gym pero insuficiente para la bici. **Option B usa la herramienta correcta para cada caso**: UI determinista donde alcanza, LLM con tool calling (no JSON libre) donde hace falta criterio. El tool calling con `strict` + Zod acota el riesgo del LLM a "proponer", manteniendo a la DB protegida.

## Consequences

- **Más fácil:** mover días de gym sin tocar JSON; ajustar la bici en lenguaje natural con contexto real de carga; cambios revisables (propose/confirm) y reversibles (undo).
- **Más difícil:** hay que mantener dos caminos; el chat necesita ensamblado de contexto (semana + Strava + FTP/LTHR), capa de tools, validación Zod y UI de confirmación.
- **A revisar:** confiabilidad del tool calling de DeepSeek V4 bajo carga real (medir tasa de tool calls inválidas); si OpenCode Go habilita API key server-side o si hay que ir a DeepSeek directo; si conviene mover la generación mensual a `pro` por el mismo cliente.

## Action Items

1. [ ] Confirmar acceso server-side a la API (OpenCode Zen key usable desde el backend vs. DeepSeek directo). Setear `LLM_BASE_URL` / `LLM_API_KEY`.
2. [ ] Reemplazar `@google/genai` por el SDK de OpenAI; crear `src/lib/llm.ts` con cliente configurable (flash/pro).
3. [ ] Gym: endpoint + UI "mover día" que actualiza `DailyWorkout.dayOfWeek`/`date` preservando `hevyRoutineId`/`HevyGymSlot`.
4. [ ] Gym: autodetección opcional desde Strava (WeightTraining en día no planeado → completar + reordenar).
5. [ ] Bici: definir tools (`moveWorkout`, `swapWorkoutType`, `setCyclingBlocks`, `adjustIntensity`) con `strict: true` y schemas Zod espejo.
6. [ ] Bici: ensamblar contexto del chat (semana actual `Routine` + `list_activities` Strava + FTP 140 / LTHR 155).
7. [ ] Bici: capa `applyMutation()` transaccional sobre `DailyWorkout`/`CyclingBlock` con propose/confirm + undo.
8. [ ] UI de chat (inline approve/undo), reutilizando el patrón de estado `pending`.
9. [ ] Actualizar `CLAUDE.md`: stack dice "Google Gemini (routine generation)" — reemplazar por DeepSeek V4 (flash/pro) vía OpenCode/DeepSeek.
10. [ ] Métrica: loguear tool calls inválidas para evaluar confiabilidad.
