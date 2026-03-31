import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeGoogleCode } from "@/lib/google-fit";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/metrics?googlefit=error", request.url));
  }

  try {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/google-fit/callback`;

    const tokens = await exchangeGoogleCode(code, redirectUri);

    const expiryAt = Math.floor(Date.now() / 1000) + tokens.expires_in;

    await prisma.user.update({
      where: { id: (session as any).user.id },
      data: {
        googleFitAccessToken: tokens.access_token,
        googleFitRefreshToken: tokens.refresh_token,
        googleFitTokenExpiry: expiryAt,
      },
    });

    return NextResponse.redirect(new URL("/metrics?googlefit=connected", request.url));
  } catch (err: any) {
    console.error("Google Fit callback error:", err);
    return NextResponse.redirect(new URL("/metrics?googlefit=error", request.url));
  }
}
