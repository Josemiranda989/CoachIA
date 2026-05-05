import https from "node:https";

const HEVY_API_HOST = "api.hevyapp.com";

export interface HevyApiSet {
  index?: number;
  type?: string;
  weight_kg?: number | null;
  reps?: number | null;
  distance_meters?: number | null;
  duration_seconds?: number | null;
}

export interface HevyApiExercise {
  index?: number;
  title?: string;
  notes?: string;
  exercise_template_id: string;
  superset_id?: string | null;
  sets?: HevyApiSet[];
}

export interface HevyApiWorkout {
  id: string;
  title?: string;
  routine_id?: string | null;
  description?: string;
  start_time?: string;
  end_time?: string;
  updated_at?: string;
  created_at?: string;
  exercises?: HevyApiExercise[];
}

export async function fetchHevyWorkout(workoutId: string): Promise<HevyApiWorkout> {
  const apiKey = process.env.HEVY_API_KEY;
  if (!apiKey) throw new Error("HEVY_API_KEY no configurada");

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: HEVY_API_HOST,
        path: `/v1/workouts/${encodeURIComponent(workoutId)}`,
        method: "GET",
        headers: { "api-key": apiKey, Accept: "application/json" },
        timeout: 15_000,
        family: 4,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const data = Buffer.concat(chunks).toString("utf-8");
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Hevy API ${res.statusCode}: ${data.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(data) as HevyApiWorkout);
          } catch {
            reject(new Error(`Hevy API JSON inválido: ${data.slice(0, 200)}`));
          }
        });
      },
    );
    req.on("error", (e) => reject(e));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Hevy API timeout"));
    });
    req.end();
  });
}
