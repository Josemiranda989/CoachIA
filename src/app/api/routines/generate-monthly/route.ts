import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/internal-auth";
import { sendTelegramMessage } from "@/lib/telegram";
import { getCurrentWeekStart } from "@/lib/week";
import { getValidAccessToken, fetchActivities, fetchStats } from "@/lib/strava";
import hevyPool from "@/data/hevy-template-pool.json";
import { openCodeMonthlyChat } from "@/lib/opencode";
import { hrZonesSummary } from "@/lib/hr-zones";

const VALID_DAY_TYPES = ["Gym", "Cycling", "Rest", "Gym + Cycling"] as const;
type DayType = (typeof VALID_DAY_TYPES)[number];

type HevyPoolEntry = { id: string; title: string; muscle: string; equipment: string };

function buildHevyPoolBlock(): string {
  const pool = hevyPool as HevyPoolEntry[];
  const byMuscle = new Map<string, HevyPoolEntry[]>();
  for (const ex of pool) {
    const m = ex.muscle || "other";
    if (!byMuscle.has(m)) byMuscle.set(m, []);
    byMuscle.get(m)!.push(ex);
  }
  const muscleOrder = [
    "chest","upper_back","lats","traps","shoulders","biceps","triceps","forearms",
    "quadriceps","hamstrings","glutes","adductors","abductors","calves",
    "abdominals","lower_back","full_body","cardio",
  ];
  const orderedKeys = [
    ...muscleOrder.filter((m) => byMuscle.has(m)),
    ...[...byMuscle.keys()].filter((m) => !muscleOrder.includes(m)),
  ];
  const lines: string[] = [];
  for (const m of orderedKeys) {
    const list = byMuscle.get(m)!;
    lines.push(`# ${m}`);
    for (const ex of list) {
      lines.push(`${ex.id}|${ex.title}|${ex.equipment}`);
    }
  }
  return lines.join("\n");
}

function getNextFourMondays(): string[] {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const first = new Date(now);
  first.setDate(now.getDate() + daysUntilMonday);
  first.setHours(0, 0, 0, 0);

  const mondays: string[] = [];
  for (let i = 0; i < 4; i++) {
    const m = new Date(first);
    m.setDate(first.getDate() + i * 7);
    const y = m.getFullYear();
    const mo = String(m.getMonth() + 1).padStart(2, "0");
    const d = String(m.getDate()).padStart(2, "0");
    mondays.push(`${y}-${mo}-${d}`);
  }
  return mondays;
}

async function gatherAthleteData(userId: string) {
  const hrUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { fcMax: true, lthr: true },
  });
  const hrSection = hrUser ? hrZonesSummary({ fcMax: hrUser.fcMax, lthr: hrUser.lthr }) : null;

  const allLogs = await prisma.workoutLog.findMany({
    include: { exercise: { select: { name: true } } },
    orderBy: { id: "desc" },
    take: 500,
  });

  const prs: Record<string, { weight: number; reps: number }> = {};
  for (const log of allLogs) {
    const name = log.exercise.name;
    if (!prs[name] || log.weight > prs[name].weight) {
      prs[name] = { weight: log.weight, reps: log.reps };
    }
  }
  const prLines = Object.entries(prs)
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, 15)
    .map(([name, { weight, reps }]) => `  - ${name}: ${weight} kg x ${reps} reps`)
    .join("\n");

  const totalVolume = allLogs.reduce((acc, l) => acc + l.weight * l.reps, 0);

  const gymSection = prLines
    ? `\nDATOS DE GYM (historial real):\n- Volumen total histórico: ${totalVolume.toLocaleString()} kg\n- Récords personales (top 15):\n${prLines}`
    : "";

  let stravaSection = "";
  try {
    const stravaToken = await getValidAccessToken(userId);
    if (stravaToken) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { stravaAthleteId: true },
      });

      const [recentActivities, stats] = await Promise.all([
        fetchActivities(stravaToken, 1, 5),
        user?.stravaAthleteId ? fetchStats(stravaToken, user.stravaAthleteId) : null,
      ]);

      const rides = (recentActivities || []).filter(
        (a: any) => a.type === "Ride" || a.type === "VirtualRide"
      );

      if (stats || rides.length > 0) {
        stravaSection = "\nDATOS DE CICLISMO (Strava):";

        if (stats?.ytd_ride_totals) {
          const ytd = stats.ytd_ride_totals;
          stravaSection += `\n- Este año: ${ytd.count} rides, ${(ytd.distance / 1000).toFixed(0)} km, ${Math.round(ytd.moving_time / 3600)} horas, ${Math.round(ytd.elevation_gain)} m desnivel`;
        }
        if (stats?.all_ride_totals) {
          const all = stats.all_ride_totals;
          stravaSection += `\n- Totales históricos: ${all.count} rides, ${(all.distance / 1000).toFixed(0)} km`;
        }

        if (rides.length > 0) {
          stravaSection += "\n- Últimas salidas:";
          for (const ride of rides.slice(0, 5)) {
            const dist = (ride.distance / 1000).toFixed(1);
            const hrs = Math.floor(ride.moving_time / 3600);
            const mins = Math.floor((ride.moving_time % 3600) / 60);
            const speed = (ride.average_speed * 3.6).toFixed(1);
            let line = `  - ${ride.name}: ${dist} km, ${hrs}h${mins}m, ${speed} km/h avg`;
            if (ride.average_heartrate) line += `, FC ${Math.round(ride.average_heartrate)} bpm`;
            if (ride.average_watts) line += `, ${Math.round(ride.average_watts)} W`;
            if (ride.average_cadence) line += `, ${Math.round(ride.average_cadence)} rpm`;
            stravaSection += `\n${line}`;
          }
        }
      }
    }
  } catch {
    // Strava not available
  }

  return { gymSection, stravaSection, hrSection };
}

async function alertAndRespond(msg: string, status: number) {
  await sendTelegramMessage(`⚠️ Mesociclo mensual: ${msg}`).catch(() => {});
  return NextResponse.json({ error: msg }, { status });
}

// POST: Generate monthly plan (4 weeks: same gym template, progressive cycling) — called by cron/n8n
export async function POST(request: Request) {
  try {
    const auth = await resolveAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!process.env.OPENCODE_API_KEY) {
      return alertAndRespond("OPENCODE_API_KEY not configured", 500);
    }

    const body = await request.json().catch(() => ({}));
    const goal = body.goal || "Hipertrofia";
    const daysPerWeek = body.daysPerWeek || 3;
    const cyclingDays = body.cyclingDays || 3;
    const focusAreas = body.focusAreas || [];
    const notes = body.notes || "";

    const mondays = getNextFourMondays();
    const { gymSection, stravaSection, hrSection } = await gatherAthleteData(auth.userId);
    const hevyLibraryBlock = buildHevyPoolBlock();

    const systemPrompt = "Eres un entrenador personal experto en fuerza y ciclismo. Genera un MESOCICLO DE 4 SEMANAS en formato JSON. Devolves EXCLUSIVAMENTE el JSON pedido, sin texto adicional, sin markdown, sin comentarios.";
    const userPrompt = `Genera un MESOCICLO DE 4 SEMANAS: la rutina de gym es FIJA y se repite cada semana (el atleta progresa carga manualmente), y el ciclismo PROGRESA semana a semana (mesociclo build/build/build/recovery).

FORMATO DE RESPUESTA EXACTO — el JSON debe tener EXACTAMENTE esta forma. Todos los campos listados son OBLIGATORIOS:

{
  "gymTemplate": [
    {
      "dayOfWeek": "Monday",
      "type": "Gym",
      "exercises": [
        {"hevy_template_id": "<8 hex chars del listado>", "name": "<Title exacto del listado>", "targetSets": 4, "targetReps": "8-10"}
      ],
      "notes": "Empuje/jalón, sin piernas"
    },
    {"dayOfWeek": "Tuesday",   "type": "Cycling",         "exercises": [], "notes": null},
    {"dayOfWeek": "Wednesday", "type": "Gym",             "exercises": [/* 5-8 ej */], "notes": "Leg day"},
    {"dayOfWeek": "Thursday",  "type": "Cycling",         "exercises": [], "notes": null},
    {"dayOfWeek": "Friday",    "type": "Gym",             "exercises": [/* 5-8 ej */], "notes": "Empuje/jalón"},
    {"dayOfWeek": "Saturday",  "type": "Cycling",         "exercises": [], "notes": null},
    {"dayOfWeek": "Sunday",    "type": "Rest",            "exercises": [], "notes": null}
  ],
  "cyclingByWeek": [
    [ /* semana 1: array de cycling days, uno por cada día Cycling de gymTemplate */
      {"dayOfWeek": "Tuesday", "totalDuration": 75, "totalPower": "Z2 + 3x3'Z3",
       "blocks": [
         {"kind": "warmup",   "duration": 15, "targetPower": "Z1-Z2"},
         {"kind": "interval", "duration": 3,  "targetPower": "Z3", "repetitions": 3, "recoveryDuration": 3, "recoveryPower": "Z1"},
         {"kind": "cooldown", "duration": 42, "targetPower": "Z1"}
       ],
       "notes": "Sesión clave de la semana"}
    ],
    [ /* semana 2 */ ],
    [ /* semana 3 */ ],
    [ /* semana 4 — recovery */ ]
  ]
}

CAMPOS OBLIGATORIOS — VERIFICÁ ANTES DE RESPONDER:
- gymTemplate: array de EXACTAMENTE 7 elementos
- Cada elemento de gymTemplate: {dayOfWeek, type, exercises, notes}. type DEBE ser uno de: "Gym", "Cycling", "Rest", "Gym + Cycling". exercises siempre array (vacío para Rest/Cycling).
- Cada exercise (en días Gym): {hevy_template_id, name, targetSets, targetReps}
- cyclingByWeek: array de EXACTAMENTE 4 elementos (uno por semana)
- Cada elemento de cyclingByWeek es un ARRAY (puede estar vacío en semana de recovery, pero el slot debe existir).
- Cada cycling day: {dayOfWeek, totalDuration, totalPower, blocks, notes}

CONTEXTO Y REGLAS:

DATOS DEL ATLETA:
- Objetivo principal: ${goal}
- Días de gimnasio por semana: ${daysPerWeek}
- Días de ciclismo por semana: ${cyclingDays}
- Áreas de enfoque en gym: ${focusAreas.length ? focusAreas.join(", ") : "General (todo el cuerpo)"}
${notes ? `- Notas adicionales: ${notes}` : ""}
${gymSection}
${stravaSection}
${hrSection ? `\n${hrSection}` : ""}

USA LOS DATOS REALES del atleta para:
- Ajustar pesos y reps de gym basándote en sus PRs. Para el primer set sugerí ~70-80% del PR como punto de partida (el atleta progresa carga manualmente).
- Diseñar la PROGRESIÓN de ciclismo según su nivel real (distancias, velocidad, FC y potencia).
- Si hay average_watts en las rides Strava, estimá FTP ≈ mejor average_watts sostenido en ~60-90min × 0.95. Usá ese FTP para calibrar las zonas. Podés opcionalmente anotar watts entre paréntesis en targetPower (ej "Z4 (~230W)").
- Si no hay datos de ciclismo, usá valores conservadores pensando en alguien en su primer año de entreno estructurado.

ZONAS DE POTENCIA (Coggan 7-zone model, %FTP):
- Z1 Recovery activo: <55% FTP — rides post-piernas, very easy
- Z2 Endurance: 56-75% FTP — base, la mayoría del volumen semanal
- Z3 Tempo: 76-90% FTP — ritmo "confortable rápido", conversación entrecortada
- Z4 Threshold: 91-105% FTP — umbral, sostenible 30-60min máximo
- Z5 VO2max: 106-120% FTP — máximo aeróbico, sostenible 3-8min
- Z6+ Anaeróbico: >120% — sprints/all-out, sostenible segundos a 1-2min

ESTRUCTURA DE RESPUESTA — DOS PARTES:

1. **gymTemplate**: 7 días Monday→Sunday, estructura SEMANAL FIJA. Para días "Cycling" o "Gym + Cycling" → exercises vacío, NO incluyas duración/potencia (va en cyclingByWeek). Para "Gym" → ejercicios con sets/reps. Para "Rest" → exercises vacío.

2. **cyclingByWeek**: 4 arrays (uno por semana). Cada array contiene los días Cycling con **totalDuration**, **totalPower** (label), **blocks** (detalle ordenado), y **notes** (propósito).

FORMATO DE BLOCKS (OBLIGATORIO para cada día Cycling):
- Cada ride tiene 3-5 bloques ordenados: warmup → (steady|interval) × N → cooldown.
- **warmup**: kind="warmup", duration 10-20min, targetPower Z1 o Z1-Z2 progresivo.
- **steady**: kind="steady", duration, targetPower. Un bloque sostenido en UNA zona.
- **interval**: kind="interval" formato COMPRIMIDO: duration=duración DE CADA rep, repetitions=cantidad, recoveryDuration=min entre reps, recoveryPower=zona recovery. Ej "4x4min Z4 con 3min Z2 rec" → {kind:"interval", duration:4, targetPower:"Z4", repetitions:4, recoveryDuration:3, recoveryPower:"Z2"}.
- **cooldown**: kind="cooldown", duration 8-15min, targetPower Z1.

DURACIONES DE REP POR ZONA (fisiológicamente realistas — NO VIOLAR):
- Z3 Tempo: 8-20min por rep, 3-5min recovery Z1-Z2
- Z4 Threshold: 5-15min por rep, 3-5min recovery Z2
- Z5 VO2max: 2-5min por rep, 2-3x la duración en recovery Z1
- Z6+ Anaeróbico: 30s-2min por rep, 2-4x recovery Z1

REGLA DURA — kind="steady" SOLO permitido en Z1, Z2 o Z3.
- Z4 SIEMPRE como kind="interval" con mínimo 2 reps.
- Z5 SIEMPRE como kind="interval" con mínimo 3 reps.
- Un bloque steady de 6min en Z4 o Z5 NO es un entreno, es un test. PROHIBIDO.

CADENCIA (campo opcional targetCadence por bloque — usar cuando aporta, omitir si es el default):
- Default Z2/Z3 self-paced (~85-95 rpm): omitir targetCadence.
- **Spin-ups** (neuromuscular): bloques Z2 con targetCadence "100+ rpm". Útil en warmups o como bloque separado al inicio de la temporada.
- **Big gear / fuerza-resistencia**: intervals Z3-Z4 con targetCadence "55-65 rpm big gear". Alternativa al VO2max para mesociclos con foco en fuerza pedalística — semana 2 o 3 puede sustituir el VO2max por fuerza-resistencia si el atleta carga gym de piernas pesado y los datos Strava muestran cadencia auto-seleccionada baja (<80rpm).
- Recovery rides post-piernas: targetCadence "90+ rpm" para no cargar piernas.

DURACIONES TOTALES TÍPICAS DE RIDE:
- Recovery ride (post-leg day, ej Thursday si leg day fue Wednesday): 40-80min Z1-Z2
- Ride con intervals (VO2max/Threshold, Tuesday típico): 45-90min total, duración ideal 1:15-1:30
- Tempo/sub-umbral sostenido: 60-90min
- Long ride sábado: 90-180min (no pasarse de 180)

ORDEN DE BLOCKS (guías):
- Después de un bloque de intervals, ir DIRECTO al cooldown. No intercalar "steady" entre intervals y cooldown salvo que haya 2 sets distintos de intervals separados.
- Recovery rides: warmup + steady Z1-Z2 + cooldown. SIN intervals.
- Rides con intensidad: warmup + (interval) + cooldown. O: warmup + steady Z2 + interval + cooldown.
- La suma de warmup + Σ(rep × (duration + recoveryDuration) para intervals) + Σ(steady.duration) + cooldown DEBE igualar totalDuration exactamente.

USO DEL CAMPO "notes" EN CYCLING:
- Explicar el PROPÓSITO de la sesión (qué adaptación busca, qué priorizar, qué evitar).
- Máximo 1 oración útil al atleta durante el entreno. Ej:
  - "Fondo base del mesociclo. Z2 bajo todo el ride, no acelerar al final."
  - "Sesión clave VO2max. Primer rep suave, últimos 2 a 120%FTP."
  - "Recovery post-piernas. Cadencia alta >90rpm, NO subir pulsaciones."

EJEMPLOS COMPLETOS DE DÍAS CYCLING:

Ejemplo A — Saturday long ride BUILD (120min total):
{
  "dayOfWeek":"Saturday", "totalDuration":120, "totalPower":"Z2",
  "blocks":[
    {"kind":"warmup","duration":15,"targetPower":"Z1"},
    {"kind":"steady","duration":90,"targetPower":"Z2"},
    {"kind":"cooldown","duration":15,"targetPower":"Z1"}
  ],
  "notes":"Fondo base del mesociclo. Z2 bajo todo el ride, no acelerar al final."
}

Ejemplo B — Wednesday VO2max PEAK (60min total):
{
  "dayOfWeek":"Wednesday", "totalDuration":60, "totalPower":"Z2 + 4xZ5",
  "blocks":[
    {"kind":"warmup","duration":15,"targetPower":"Z1-Z2"},
    {"kind":"interval","duration":4,"targetPower":"Z5","repetitions":4,"recoveryDuration":4,"recoveryPower":"Z1"},
    {"kind":"cooldown","duration":13,"targetPower":"Z1"}
  ],
  "notes":"Sesión clave. 4x4 VO2max. Primer rep suave, últimos 2 a 120%FTP."
}

Ejemplo C — Thursday recovery post-leg day (60min total, Z2 volumen):
{
  "dayOfWeek":"Thursday", "totalDuration":60, "totalPower":"Z2",
  "blocks":[
    {"kind":"warmup","duration":10,"targetPower":"Z1"},
    {"kind":"steady","duration":40,"targetPower":"Z2"},
    {"kind":"cooldown","duration":10,"targetPower":"Z1"}
  ],
  "notes":"Volumen suave post-leg day del miércoles. Cadencia alta >90rpm, NO acelerar, piernas ligeras."
}

PERIODIZACIÓN SEMANAL (para gymTemplate — OBLIGATORIA):

Distribución preferida del atleta cuando hay 3 gym + 3 cycling + 1 rest (Opción A, fija):
- Monday: Gym (empuje/jalón, SIN piernas)
- Tuesday: Cycling — INTERVAL day (piernas frescas)
- Wednesday: Gym — LEG DAY (sentadilla, prensa, peso muerto, zancadas, hip thrust)
- Thursday: Cycling Z2 volumen (puede incluir tramos tempo si aplica, sin intervals duros)
- Friday: Gym (empuje/jalón, SIN piernas)
- Saturday: Cycling — LONG RIDE suave (Z1-Z2)
- Sunday: Rest

Si daysPerWeek ≠ 3 o cyclingDays ≠ 3, adaptá manteniendo las REGLAS FISIOLÓGICAS abajo. No inventes distribuciones que las violen.

REGLAS FISIOLÓGICAS (OBLIGATORIAS, no negociables):
A. Saturday es el ride MÁS LARGO de la semana PERO SIEMPRE en intensidad SUAVE (Z1-Z2). NUNCA meter intervals, Z4 ni Z5 el sábado. Notes del sábado: énfasis en mantener Z2 bajo y NO acelerar al final.
A2. La intensidad del cycling vive en UNA sola sesión INTERVAL entre semana, preferentemente Tuesday. Regla dura: **1 solo día de calidad de cycling por semana**. Los otros cycling days son Z2/Z1 volumen o recovery.
B. Las piernas pesadas en gym (sentadilla, prensa, peso muerto, zancadas, hip thrust) deben respetar **72hs mínimo antes del sábado**. Ventana válida: Monday, Tuesday, Wednesday. NUNCA Thursday/Friday/Saturday.
C. El día siguiente a leg day debe ser "Rest" o "Cycling" Z1-Z2 volumen/recovery (≤90min). NUNCA intensidad alta ni piernas otra vez al día siguiente.
D. El interval day de cycling SIEMPRE con piernas frescas. Si leg day cae el mismo día o el anterior al interval day → mover leg day.
E. Sunday → Rest post-sábado largo. Rest absoluto, no "cycling Z1 muy suave" — el long ride del sábado ya es la carga aeróbica del fin de semana.
F. Gym upper (empuje/jalón) se distribuye en los días no-leg y no-interval — típicamente Monday y Friday.
G. Viernes: si hay gym upper, OK. Si no hay gym ese día, puede ser cycling suave o Rest — NUNCA cycling INTERVAL ni leg day.

ESTILO DEL ATLETA (preferencias extraídas de un plan real que le funcionó):
- Vocabulario de intensidad por RPE — úsalo en "notes" para que el atleta entienda el feel (además del targetPower):
  - "suave" = Z1-Z2 bajo, conversación fluida
  - "ligero" = Z2 cómodo
  - "medio exigido" = Z3 tempo
  - "fuerte sostenible" = Z4 umbral (clave: **SOSTENIBLE** = podés mantenerlo toda la rep, NO es all-out)
  - "fuerte" / "máximo" = Z5+ (raro, solo si el objetivo lo pide)
- Concepto ancla "SOSTENIBLE": el atleta puede MANTENER el esfuerzo todos los minutos que dura la rep. Si la última rep tiene que bajar de ritmo → se pasó. Si al terminar podría hacer una más → quedó corto. Usá esta palabra siempre que prescribas Z3-Z4.

- Ratios recovery/trabajo en intervals (REGLA DURA, respetá exactamente):
  - **Default: 1:1** — la recovery dura IGUAL que la rep. Aplica a reps de 2', 3', 4', 5'. Ej: 4x4' → recovery 4'.
  - **Excepción: 2:1 SOLO cuando la rep dura ≥10 minutos**. Ej: 2x10' → recovery 5'.
  - NO inventar ratios distintos (1:2, 3:1, etc). Si el bloque no encaja en 1:1 o 2:1 → repensalo.

- Descanso estructural del plan (del coach real):
  - **Domingo SIEMPRE Rest** (post-long ride del sábado).
  - Semanas 1-3: 1-2 días Rest/semana (según daysPerWeek).
  - Semana 4 (RECOVERY): agregar 1 día extra de Rest vs las semanas previas.

PROGRESIÓN MENSUAL DE CICLISMO (para cyclingByWeek):
- **Principio (del coach real)**: el volumen semanal se mantiene ESTABLE (~7-9hs típicas para atleta intermedio). Lo que escala semana a semana es la INTENSIDAD y el tipo de estímulo, NO las horas. No subir volumen sem a sem.
- Semana 1 (BUILD base): volumen base, mayoría Z2. Interval day con reps cortos (3-5min) a Z3-Z4 bajo, ratio 1:1. Ej: 3x3' medio exigido o 2x5' sostenible.
- Semana 2 (BUILD): MISMO volumen que sem 1. Subir ligeramente la intensidad del interval day (más reps O intensidad mayor dentro del mismo formato). Ej: 4x4' medio exigido.
- Semana 3 (PEAK): MISMO volumen. Estímulo más duro: reps más largas (hasta 10min con ratio 2:1) O más fuertes (Z4 sostenible con reps de 4'). Elegir UNA de las dos cosas, no ambas.
- Semana 4 (RECOVERY): -25-30% volumen, todo Z1-Z2. Sin interval day (el Tuesday pasa a Z2 volumen o Rest). Sábado más corto (-20%).

BIBLIOTECA HEVY DE EJERCICIOS (OBLIGATORIO elegir EXCLUSIVAMENTE de esta lista):

Formato de cada línea: \`id|title|equipment\`
Los títulos están en inglés (es la biblioteca oficial de Hevy). Copialos EXACTOS en el campo "name" — no traduzcas.
El "hevy_template_id" de cada ejercicio DEBE ser el \`id\` exacto (8 caracteres hex) de la línea elegida.

${hevyLibraryBlock}

REGLAS DE SELECCIÓN DE EJERCICIOS:
- Cada ejercicio del gymTemplate DEBE incluir "hevy_template_id" (del listado de arriba) y "name" (el title EXACTO en inglés).
- NO inventes IDs. Si el ID no está en la lista, NO lo uses.
- Priorizá equipment tipo \`machine\`, \`dumbbell\`, \`barbell\`, \`cable\`. El atleta prefiere ejercicios con máquinas y mancuernas.
- NO generes ejercicios de movilidad, warmup, stretching. Para calentar, el atleta hace 1-2 sets de approach del primer ejercicio del día (no los incluyas en el output).
- Elegí variantes estándar de gym (no versiones "Single Leg", "Pause", "Feet Up" salvo que tengan razón específica).

REGLAS ESTRICTAS:
1. gymTemplate SIEMPRE tiene los 7 días (Monday a Sunday)
2. Distribuir ${daysPerWeek} días "Gym" y ${cyclingDays} días "Cycling". Resto "Rest". Si día tiene gym Y bici, usar "Gym + Cycling".
3. Días Gym: 5-8 ejercicios, cada uno con hevy_template_id + name (del listado), targetSets (3-5), targetReps como rango ("8-10", "12-15")
4. Días Rest: NO incluir exercises
5. cyclingByWeek tiene EXACTAMENTE 4 arrays. Cada uno con tantas entries como días Cycling/Gym + Cycling tengas en gymTemplate.
6. dayOfWeek en cyclingByWeek debe matchear los días Cycling de gymTemplate.
7. Variar grupos musculares entre días gym (no repetir el mismo grupo seguido)
8. Ejercicios realistas y progresivos para el objetivo "${goal}"`;

    const text = await openCodeMonthlyChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.3 },
    );

    if (!text) {
      return alertAndRespond("OpenCode no devolvió respuesta", 502);
    }

    let generated: any;
    // Algunos modelos (incluso con response_format json_object) wrappean en
    // ```json ... ``` o agregan texto antes/después. Recortamos defensivamente.
    let jsonText = text.trim();

    // Intentar extraer de ```json ... ```
    const blockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (blockMatch) jsonText = blockMatch[1].trim();

    // Si hay texto antes del primer { o después del último }, recortar
    const firstBrace = jsonText.indexOf("{");
    const lastBrace = jsonText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonText = jsonText.slice(firstBrace, lastBrace + 1);
    }

    try {
      generated = JSON.parse(jsonText);
    } catch (parseErr: any) {
      console.error("OpenCode raw response (first 1000 chars):", text.slice(0, 1000));
      console.error("JSON parse error at position:", parseErr.message);
      return alertAndRespond(
        `OpenCode devolvió JSON inválido: ${parseErr.message}`,
        502,
      );
    }
    const gymTemplate: any[] = generated.gymTemplate;
    const cyclingByWeek: any[][] = generated.cyclingByWeek;

    if (!Array.isArray(gymTemplate) || gymTemplate.length !== 7) {
      console.error("Invalid gymTemplate shape:", JSON.stringify(generated).slice(0, 800));
      return alertAndRespond(
        `gymTemplate inválido: esperaba array de 7, recibí ${Array.isArray(gymTemplate) ? `array de ${gymTemplate.length}` : typeof gymTemplate}`,
        502,
      );
    }
    if (!Array.isArray(cyclingByWeek) || cyclingByWeek.length !== 4) {
      console.error("Invalid cyclingByWeek shape:", JSON.stringify(generated).slice(0, 800));
      return alertAndRespond(
        `cyclingByWeek inválido: esperaba array de 4, recibí ${Array.isArray(cyclingByWeek) ? `array de ${cyclingByWeek.length}` : typeof cyclingByWeek}`,
        502,
      );
    }

    // Per-day validation: each day must have dayOfWeek + valid type. Missing fields
    // are the failure mode after losing Gemini's responseSchema enforcement.
    for (let i = 0; i < gymTemplate.length; i++) {
      const d = gymTemplate[i];
      if (!d || typeof d !== "object") {
        console.error("gymTemplate day is not object:", JSON.stringify(gymTemplate).slice(0, 800));
        return alertAndRespond(`gymTemplate[${i}] no es un objeto`, 502);
      }
      if (!d.dayOfWeek || typeof d.dayOfWeek !== "string") {
        console.error("Day missing dayOfWeek:", JSON.stringify(d).slice(0, 400));
        return alertAndRespond(`gymTemplate[${i}] sin dayOfWeek`, 502);
      }
      if (!d.type || !VALID_DAY_TYPES.includes(d.type as DayType)) {
        console.error("Day with invalid type:", JSON.stringify(d).slice(0, 400));
        return alertAndRespond(
          `gymTemplate[${i}] (${d.dayOfWeek}) type inválido: "${d.type}". Válidos: ${VALID_DAY_TYPES.join(", ")}`,
          502,
        );
      }
      if (d.type === "Gym" || d.type === "Gym + Cycling") {
        if (!Array.isArray(d.exercises) || d.exercises.length === 0) {
          console.error("Gym day without exercises:", JSON.stringify(d).slice(0, 400));
          return alertAndRespond(`gymTemplate[${i}] (${d.dayOfWeek}) es ${d.type} pero sin ejercicios`, 502);
        }
      }
    }

    // Archive previous routines + create the 4 new ones atomically. If any
    // routine fails, the whole batch rolls back — no zombie routines in DB.
    const currentWeekMonday = getCurrentWeekStart();
    const created = await prisma.$transaction(async (tx) => {
      // Archive active routines whose week has strictly passed. The in-progress
      // week survives until it naturally ends, so there is no gap between
      // generation day and the first new week of the mesocycle.
      await tx.routine.updateMany({
        where: {
          userId: auth.userId,
          status: "active",
          weekStart: { lt: currentWeekMonday },
        },
        data: { status: "archived" },
      });

      // Archive any stale pending_approval to avoid duplicates after approval.
      await tx.routine.updateMany({
        where: { userId: auth.userId, status: "pending_approval" },
        data: { status: "archived" },
      });

      const acc: { id: string; weekStart: string }[] = [];
      for (let weekIdx = 0; weekIdx < 4; weekIdx++) {
        const weekStart = mondays[weekIdx];
        const cyclingForWeek = cyclingByWeek[weekIdx] ?? [];
        const cyclingByDay: Record<string, any> = {};
        for (const c of cyclingForWeek) cyclingByDay[c.dayOfWeek] = c;

        const days = gymTemplate.map((d: any) => {
          const cycling = cyclingByDay[d.dayOfWeek];
          const blocksRaw: any[] = Array.isArray(cycling?.blocks) ? cycling.blocks : [];

          return {
            dayOfWeek: d.dayOfWeek,
            type: d.type,
            notes: cycling?.notes ?? d.notes ?? null,
            targetDuration: cycling?.totalDuration ?? cycling?.targetDuration ?? null,
            targetPower: cycling?.totalPower ?? cycling?.targetPower ?? null,
            exercises: {
              create: (d.exercises ?? []).map((ex: any) => ({
                name: ex.name,
                targetSets: ex.targetSets,
                targetReps: ex.targetReps ?? null,
                hevyTemplateId: ex.hevy_template_id ?? null,
              })),
            },
            blocks: {
              create: blocksRaw.map((b: any, idx: number) => ({
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
          };
        });

        const saved = await tx.routine.create({
          data: {
            userId: auth.userId,
            weekStart,
            status: "pending_approval",
            days: { create: days },
          },
        });

        acc.push({ id: saved.id, weekStart });
      }
      return acc;
    }, { timeout: 30_000 });

    // Telegram summary: gym template once + cycling progression per week
    const dayNames: Record<string, string> = {
      Monday: "Lun", Tuesday: "Mar", Wednesday: "Mié",
      Thursday: "Jue", Friday: "Vie", Saturday: "Sáb", Sunday: "Dom",
    };

    const gymSummary = gymTemplate
      .filter((d: any) => (d.exercises?.length ?? 0) > 0)
      .map((d: any) => {
        const lines = d.exercises.map((e: any) => `   • ${e.name} ${e.targetSets}x${e.targetReps}`).join("\n");
        return `<b>${dayNames[d.dayOfWeek] ?? d.dayOfWeek}</b> (${d.type})\n${lines}`;
      })
      .join("\n\n");

    const cyclingSummary = cyclingByWeek
      .map((week, idx) => {
        const monday = mondays[idx];
        const lines = week
          .map((c: any) => {
            const total = c.totalDuration ?? c.targetDuration ?? 0;
            const power = c.totalPower ?? c.targetPower ?? "";
            return `   • ${dayNames[c.dayOfWeek] ?? c.dayOfWeek}: ${total}min ${power}`;
          })
          .join("\n");
        return `<b>Semana ${idx + 1}</b> (desde ${monday})\n${lines}`;
      })
      .join("\n\n");

    await sendTelegramMessage(
      `🏋️🚴 Mesociclo de 4 semanas generado!\n\nDesde: ${mondays[0]} hasta domingo ${mondays[3]} +6d\n\n<b>GYM (mismo todas las semanas)</b>\n\n${gymSummary}\n\n<b>CICLISMO (progresivo)</b>\n\n${cyclingSummary}\n\n👉 Aprobá o rechazá en CoachIA.`
    );

    return NextResponse.json({
      message: "Mesociclo de 4 semanas generado, guardado y notificado por Telegram.",
      routines: created,
    });
  } catch (err: any) {
    console.error("Monthly generation error:", err);

    await sendTelegramMessage(
      `⚠️ Error generando mesociclo mensual: ${err.message}`
    ).catch(() => {});

    return NextResponse.json(
      { error: "Error al generar rutina", details: err.message },
      { status: 500 }
    );
  }
}
