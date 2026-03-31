import { prisma } from "@/lib/prisma";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_FIT_API = "https://www.googleapis.com/fitness/v1/users/me";

const SCOPES = [
  "https://www.googleapis.com/auth/fitness.activity.read",
  "https://www.googleapis.com/auth/fitness.body.read",
  "https://www.googleapis.com/auth/fitness.heart_rate.read",
].join(" ");

function getClientId(): string {
  const id = process.env.GOOGLE_FIT_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_FIT_CLIENT_ID no configurado");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.GOOGLE_FIT_CLIENT_SECRET;
  if (!secret) throw new Error("GOOGLE_FIT_CLIENT_SECRET no configurado");
  return secret;
}

export function getGoogleFitAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent", // fuerza siempre a devolver refresh_token
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error intercambiando código Google: ${err}`);
  }

  return res.json();
}

async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error refrescando token Google: ${err}`);
  }

  return res.json();
}

export async function getValidGoogleFitToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleFitAccessToken: true,
      googleFitRefreshToken: true,
      googleFitTokenExpiry: true,
    },
  });

  if (!user?.googleFitAccessToken || !user?.googleFitRefreshToken) return null;

  const nowSecs = Math.floor(Date.now() / 1000);
  const isExpired = user.googleFitTokenExpiry
    ? user.googleFitTokenExpiry < nowSecs + 60
    : false;

  if (!isExpired) return user.googleFitAccessToken;

  // Refrescar token
  const refreshed = await refreshGoogleToken(user.googleFitRefreshToken);
  const newExpiry = Math.floor(Date.now() / 1000) + refreshed.expires_in;

  await prisma.user.update({
    where: { id: userId },
    data: {
      googleFitAccessToken: refreshed.access_token,
      googleFitTokenExpiry: newExpiry,
    },
  });

  return refreshed.access_token;
}

// Rango de tiempo: últimos N días
function timeRangeMillis(days: number): { startMs: number; endMs: number } {
  const endMs = Date.now();
  const startMs = endMs - days * 24 * 60 * 60 * 1000;
  return { startMs, endMs };
}

export async function fetchGoogleFitData(
  accessToken: string,
  days = 30
): Promise<GoogleFitData> {
  const { startMs, endMs } = timeRangeMillis(days);

  const body = {
    aggregateBy: [
      { dataTypeName: "com.google.step_count.delta" },
      { dataTypeName: "com.google.heart_rate.bpm" },
      { dataTypeName: "com.google.weight" },
      { dataTypeName: "com.google.active_minutes" },
      { dataTypeName: "com.google.calories.expended" },
    ],
    bucketByTime: { durationMillis: 86400000 }, // 1 día
    startTimeMillis: startMs,
    endTimeMillis: endMs,
  };

  const res = await fetch(`${GOOGLE_FIT_API}/dataset:aggregate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error llamando Google Fit API: ${err}`);
  }

  const raw = await res.json();
  return parseGoogleFitResponse(raw);
}

export interface DailyFitData {
  date: string; // YYYY-MM-DD
  steps: number;
  heartRateAvg: number | null;
  weightKg: number | null;
  activeMinutes: number;
  caloriesBurned: number;
}

export interface GoogleFitData {
  days: DailyFitData[];
  totals: {
    steps: number;
    activeMinutes: number;
    caloriesBurned: number;
  };
}

function parseGoogleFitResponse(raw: any): GoogleFitData {
  const days: DailyFitData[] = [];

  for (const bucket of raw.bucket ?? []) {
    const startMs = parseInt(bucket.startTimeMillis);
    const date = new Date(startMs).toISOString().split("T")[0];

    let steps = 0;
    let heartRateAvg: number | null = null;
    let weightKg: number | null = null;
    let activeMinutes = 0;
    let caloriesBurned = 0;

    for (const dataset of bucket.dataset ?? []) {
      const type = dataset.dataSourceId ?? "";

      for (const point of dataset.point ?? []) {
        const val = point.value?.[0];
        if (!val) continue;

        if (type.includes("step_count")) {
          steps += val.intVal ?? 0;
        } else if (type.includes("heart_rate")) {
          heartRateAvg = val.fpVal ?? null;
        } else if (type.includes("weight")) {
          weightKg = val.fpVal ?? null;
        } else if (type.includes("active_minutes")) {
          activeMinutes += val.intVal ?? 0;
        } else if (type.includes("calories")) {
          caloriesBurned += val.fpVal ?? 0;
        }
      }
    }

    days.push({ date, steps, heartRateAvg, weightKg, activeMinutes, caloriesBurned });
  }

  const totals = days.reduce(
    (acc, d) => ({
      steps: acc.steps + d.steps,
      activeMinutes: acc.activeMinutes + d.activeMinutes,
      caloriesBurned: acc.caloriesBurned + d.caloriesBurned,
    }),
    { steps: 0, activeMinutes: 0, caloriesBurned: 0 }
  );

  return { days, totals };
}
