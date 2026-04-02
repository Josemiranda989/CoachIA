import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/url";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API_URL = "https://www.strava.com/api/v3";

export function getStravaAuthUrl() {
  const base = getBaseUrl();
  const redirectUri = `${base}/api/strava/callback`;
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "read,activity:read_all",
    approval_prompt: "force",
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}

async function refreshToken(refreshTokenStr: string) {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshTokenStr,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  return res.json();
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user?.stravaAccessToken || !user?.stravaRefreshToken) return null;

  const now = Math.floor(Date.now() / 1000);

  if (user.stravaTokenExpiry && user.stravaTokenExpiry > now + 60) {
    return user.stravaAccessToken;
  }

  // Token expirado — refrescamos
  const data = await refreshToken(user.stravaRefreshToken);
  await prisma.user.update({
    where: { id: userId },
    data: {
      stravaAccessToken: data.access_token,
      stravaRefreshToken: data.refresh_token,
      stravaTokenExpiry: data.expires_at,
    },
  });
  return data.access_token as string;
}

export async function exchangeCode(code: string) {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Code exchange failed: ${res.status}`);
  return res.json();
}

export async function fetchActivities(accessToken: string, page = 1, perPage = 10) {
  const params = new URLSearchParams({ page: page.toString(), per_page: perPage.toString() });
  const res = await fetch(`${STRAVA_API_URL}/athlete/activities?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Activities error: ${res.status}`);
  return res.json();
}

export async function fetchStats(accessToken: string, athleteId: string) {
  const res = await fetch(`${STRAVA_API_URL}/athletes/${athleteId}/stats`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Stats error: ${res.status}`);
  return res.json();
}

export function isStravaConfigured() {
  return !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);
}
