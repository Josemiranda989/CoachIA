import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getValidGoogleFitToken, fetchGoogleFitData } from "@/lib/google-fit";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const userId = (session as any).user.id;
  const days = parseInt(request.nextUrl.searchParams.get("days") || "30");

  try {
    const accessToken = await getValidGoogleFitToken(userId);
    if (!accessToken) {
      return NextResponse.json({ error: "Google Fit no conectado" }, { status: 403 });
    }

    const data = await fetchGoogleFitData(accessToken, days);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Google Fit data error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
