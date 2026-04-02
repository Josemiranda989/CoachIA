import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGoogleFitAuthUrl } from "@/lib/google-fit";
import { getBaseUrl } from "@/lib/url";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const baseUrl = getBaseUrl();
  const redirectUri = `${baseUrl}/api/google-fit/callback`;
  const authUrl = getGoogleFitAuthUrl(redirectUri);

  return NextResponse.redirect(authUrl);
}
