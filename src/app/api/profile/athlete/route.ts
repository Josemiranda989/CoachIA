import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session as { user?: { id?: string } } | null)?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fcMax: true, lthr: true },
  });
  return NextResponse.json({ fcMax: user?.fcMax ?? null, lthr: user?.lthr ?? null });
}

function parseIntOrNull(v: unknown): number | null | undefined {
  if (v === null || v === "") return null;
  if (v === undefined) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session as { user?: { id?: string } } | null)?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { fcMax?: unknown; lthr?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const fcMax = parseIntOrNull(body.fcMax);
  const lthr = parseIntOrNull(body.lthr);

  // Plausibility bounds — protect against fat-finger typos. A cyclist's FCmax
  // sits in 140-220 territory; LTHR rarely outside 120-200.
  if (fcMax !== undefined && fcMax !== null && (fcMax < 120 || fcMax > 230)) {
    return NextResponse.json({ error: "FCmax fuera de rango (120-230 bpm)" }, { status: 400 });
  }
  if (lthr !== undefined && lthr !== null && (lthr < 100 || lthr > 210)) {
    return NextResponse.json({ error: "LTHR fuera de rango (100-210 bpm)" }, { status: 400 });
  }
  if (fcMax && lthr && lthr >= fcMax) {
    return NextResponse.json(
      { error: "LTHR debe ser menor que FCmax" },
      { status: 400 },
    );
  }

  const data: { fcMax?: number | null; lthr?: number | null } = {};
  if (fcMax !== undefined) data.fcMax = fcMax;
  if (lthr !== undefined) data.lthr = lthr;

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { fcMax: true, lthr: true },
  });

  return NextResponse.json(updated);
}
