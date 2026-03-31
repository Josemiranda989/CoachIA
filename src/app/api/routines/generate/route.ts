import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

// Schema that forces Gemini to return exactly the format /api/routines expects
const routineResponseSchema = {
  type: Type.OBJECT,
  properties: {
    weekStart: {
      type: Type.STRING,
      description: 'ISO 8601 date string for the next Monday, e.g. "2026-03-30T00:00:00Z"',
    },
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dayOfWeek: {
            type: Type.STRING,
            description: 'Day name in English: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday',
          },
          type: {
            type: Type.STRING,
            description: 'Workout type: Gym, Cycling, Rest, or Gym + Cycling',
          },
          exercises: {
            type: Type.ARRAY,
            description: 'List of exercises for Gym days. Omit for Cycling or Rest days.',
            items: {
              type: Type.OBJECT,
              properties: {
                name: {
                  type: Type.STRING,
                  description: 'Exercise name in Spanish',
                },
                targetSets: {
                  type: Type.NUMBER,
                  description: 'Number of sets (positive integer)',
                },
                targetReps: {
                  type: Type.STRING,
                  description: 'Target reps as a string range, e.g. "8-10", "12-15", "5"',
                },
              },
              required: ['name', 'targetSets', 'targetReps'],
            },
          },
          targetDuration: {
            type: Type.NUMBER,
            description: 'Target duration in minutes for Cycling days',
          },
          targetPower: {
            type: Type.STRING,
            description: 'Target power zone for Cycling days, e.g. "Z2 Endurance", "Z3 Tempo"',
          },
          notes: {
            type: Type.STRING,
            description: 'Optional notes for the day',
          },
        },
        required: ['dayOfWeek', 'type'],
      },
    },
  },
  required: ['weekStart', 'days'],
};

function getNextMonday(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday.toISOString();
}

export async function POST(request: Request) {
  try {
    // Auth check (same pattern as /api/routines)
    const session = await getServerSession(authOptions);
    let userId: string | null = null;

    if ((session as any)?.user?.id) {
      userId = (session as any).user.id as string;
    } else {
      const firstUser = await prisma.user.findFirst();
      if (firstUser) userId = firstUser.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: please login first' }, { status: 401 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY no está configurada en el servidor' }, { status: 500 });
    }

    const body = await request.json();
    const { goal, daysPerWeek, cyclingDays, focusAreas, notes } = body;

    if (!goal || !daysPerWeek) {
      return NextResponse.json({ error: 'goal y daysPerWeek son requeridos' }, { status: 400 });
    }

    const nextMonday = getNextMonday();

    const prompt = `Eres un entrenador personal experto en fuerza y ciclismo. Genera una rutina semanal COMPLETA de 7 días (de Monday a Sunday).

DATOS DEL ATLETA:
- Objetivo principal: ${goal}
- Días de gimnasio por semana: ${daysPerWeek}
- Días de ciclismo por semana: ${cyclingDays || 0}
- Áreas de enfoque en gym: ${focusAreas?.length ? focusAreas.join(', ') : 'General (todo el cuerpo)'}
${notes ? `- Notas adicionales: ${notes}` : ''}

REGLAS ESTRICTAS:
1. weekStart DEBE ser exactamente: "${nextMonday}"
2. SIEMPRE incluir los 7 días de la semana (Monday a Sunday)
3. Distribuir ${daysPerWeek} días de tipo "Gym" y ${cyclingDays || 0} días de tipo "Cycling". Los demás son "Rest". Si un día tiene gym Y ciclismo, usar tipo "Gym + Cycling".
4. Para días Gym: incluir entre 5-8 ejercicios con nombre en ESPAÑOL, targetSets (3-5), y targetReps como rango (ej: "8-10", "12-15")
5. Para días Cycling: incluir targetDuration (60-120 minutos) y targetPower (zona como "Z2 Endurance", "Z3 Tempo", "Z4 Threshold")
6. Para días Rest: NO incluir exercises, targetDuration ni targetPower
7. Variar los grupos musculares entre días de gym (no repetir el mismo grupo dos días seguidos)
8. Los ejercicios deben ser realistas y progresivos para el objetivo "${goal}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: routineResponseSchema,
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json({ error: 'Gemini no devolvió una respuesta válida' }, { status: 502 });
    }

    const routine = JSON.parse(text);

    // Ensure weekStart is correct (override if Gemini changed it)
    routine.weekStart = nextMonday;

    return NextResponse.json(routine);
  } catch (err: any) {
    console.error('Gemini generation error:', err);
    return NextResponse.json(
      { error: 'Error al generar la rutina', details: err.message },
      { status: 500 }
    );
  }
}
