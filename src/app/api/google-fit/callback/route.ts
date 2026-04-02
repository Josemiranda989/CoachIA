import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeGoogleCode } from "@/lib/google-fit";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/url";

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl();

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.redirect(new URL("/auth/login", baseUrl));
  }

  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/metrics?googlefit=error", baseUrl));
  }

  try {
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

    return NextResponse.redirect(new URL("/metrics?googlefit=connected", baseUrl));
  } catch (err: any) {
    console.error("Google Fit callback error:", err);
    return NextResponse.redirect(new URL("/metrics?googlefit=error", baseUrl));
  }
}
