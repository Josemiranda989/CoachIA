import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/internal-auth";
import { generateErgXml, generateTxtSummary, CyclingDay } from "@/lib/erg";

const DAY_ORDER: Record<string, number> = {
  Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4,
  Friday: 5, Saturday: 6, Sunday: 7,
};

export async function GET(request: Request) {
  try {
    const auth = await resolveAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Find all active routines (mesocycle can span multiple weeks)
    const routines = await prisma.routine.findMany({
      where: {
        userId: auth.userId,
        status: "active",
      },
      orderBy: { weekStart: "asc" },
      include: {
        days: {
          include: {
            blocks: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    if (routines.length === 0) {
      return NextResponse.json({ error: "No hay rutinas activas" }, { status: 404 });
    }

    // Extract cycling days from all routines
    const cyclingDays: CyclingDay[] = [];

    for (let weekIdx = 0; weekIdx < routines.length; weekIdx++) {
      const r = routines[weekIdx];
      const weekLabel = routines.length > 1 ? `Semana ${weekIdx + 1}` : "";

      const cycling = r.days
        .filter((d) => d.targetDuration != null && d.blocks.length > 0)
        .sort((a, b) => (DAY_ORDER[a.dayOfWeek] ?? 8) - (DAY_ORDER[b.dayOfWeek] ?? 8));

      for (const day of cycling) {
        cyclingDays.push({
          dayOfWeek: day.dayOfWeek,
          weekLabel,
          weekStart: r.weekStart,
          totalDuration: day.targetDuration ?? 0,
          totalPower: day.targetPower ?? "",
          blocks: day.blocks.map((b) => ({
            kind: b.kind,
            duration: b.duration,
            targetPower: b.targetPower,
            repetitions: b.repetitions,
            recoveryDuration: b.recoveryDuration,
            recoveryPower: b.recoveryPower,
            targetCadence: b.targetCadence,
            notes: b.notes,
          })),
        });
      }
    }

    if (cyclingDays.length === 0) {
      return NextResponse.json(
        { error: "No hay entrenamientos de ciclismo en las rutinas activas" },
        { status: 404 }
      );
    }

    // Build ZIP archive (JSZip is async-ready)
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const ergFolder = zip.folder("entrenamientos-erg")!;
    const txtFolder = zip.folder("entrenamientos-txt")!;

    for (const day of cyclingDays) {
      const prefix = sanitizeFile(day.weekLabel ? `${day.weekLabel}-` : "");
      const suffix = sanitizeFile(day.dayOfWeek);
      const base = `${prefix}${suffix}`;

      // .erg file
      const ergXml = generateErgXml(day);
      ergFolder.file(`${base}.erg`, ergXml);

      // .txt summary
      const txt = generateTxtSummary(day);
      txtFolder.file(`${base}.txt`, txt);
    }

    // Add a README
    zip.file(
      "LEEME.txt",
      `Exportación de entrenamientos de ciclismo - CoachIA
=============================================
Generado el ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Tucuman" })}
Rutinas activas: ${routines.length}
Entrenamientos exportados: ${cyclingDays.length}

📁 carpeta /entrenamientos-erg/ — formato .erg (TrainerRoad/Zwift)
   - Subí estos archivos a TrainingPeaks, TrainerRoad, o Zwift
   - Convertilos a .fit con erg2fit para Garmin/Wahoo

📁 carpeta /entrenamientos-txt/ — resumen legible
   - Abrí con cualquier editor de texto para ver la sesión
`
    );

    const zipData = await zip.generateAsync({ type: "uint8array" });
    // slice() returns Uint8Array<ArrayBuffer> (not ArrayBufferLike), compatible with Blob/Response
    const blob = new Blob([zipData.slice()], { type: "application/zip" });

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="coachia-ciclismo-${new Date().toISOString().slice(0, 10)}.zip"`,
      },
    });
  } catch (err: any) {
    console.error("Export cycling error:", err);
    return NextResponse.json(
      { error: "Error al exportar entrenamientos", details: err.message },
      { status: 500 }
    );
  }
}

function sanitizeFile(s: string): string {
  return s.replace(/[^a-zA-Z0-9_\-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").toLowerCase();
}
