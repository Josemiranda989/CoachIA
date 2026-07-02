import { NextResponse } from "next/server";
import { resolveAuth } from "@/lib/internal-auth";
import { computeFitnessForUser } from "@/lib/fitness-data";

export async function GET(request: Request) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") ?? "90");

  try {
    const snapshot = await computeFitnessForUser(auth.userId, days);

    if (snapshot.history.length === 0 && snapshot.current === null) {
      // Strava puede no estar conectado — respuesta amable, no error duro
      return NextResponse.json({
        error: "Strava not connected",
        ...snapshot,
      });
    }

    return NextResponse.json(snapshot);
  } catch (err: any) {
    console.error("Fitness stats error:", err);
    return NextResponse.json(
      { error: err.message, history: [], current: null, settings: null },
      { status: 500 }
    );
  }
}
