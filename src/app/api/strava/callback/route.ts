import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeCode } from "@/lib/strava";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/metrics?strava=denied", request.url));
  }

  try {
    const data = await exchangeCode(code);

    await prisma.user.update({
      where: { id: (session as any).user.id },
      data: {
        stravaAthleteId: data.athlete.id.toString(),
        stravaAccessToken: data.access_token,
        stravaRefreshToken: data.refresh_token,
        stravaTokenExpiry: data.expires_at,
      },
    });

    return NextResponse.redirect(new URL("/metrics?strava=ok", request.url));
  } catch (e: any) {
    console.error("[Strava callback]", e);
    return NextResponse.redirect(new URL("/metrics?strava=error", request.url));
  }
}
