const path = require("path");
const fs = require("fs");

const createJiti = require("jiti");
const jiti = createJiti(__filename, { interopDefault: true });

const { PrismaClient } = require("@prisma/client");
const { blocksToFitWorkout } = jiti(path.resolve(__dirname, "../src/lib/fit-exporter.ts"));
const { createZip } = jiti(path.resolve(__dirname, "../src/lib/zip-export.ts"));
const { generateTxtSummary } = jiti(path.resolve(__dirname, "../src/lib/erg.ts"));

const DAY_SHORT_ES = {
  Monday: "lun", Tuesday: "mar", Wednesday: "mie", Thursday: "jue",
  Friday: "vie", Saturday: "sab", Sunday: "dom",
};
const DAY_OFFSET = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
  Friday: 4, Saturday: 5, Sunday: 6,
};

function addDays(yyyyMmDd, days) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const TARGET_IDS = (process.env.WORKOUT_IDS || "").split(",").filter(Boolean);
const USER_EMAIL = process.env.USER_EMAIL || "josemiranda989@gmail.com";
const OUTPUT_PATH = process.env.OUTPUT_PATH || "/tmp/coachia-pending.zip";

(async () => {
  const prisma = new PrismaClient();

  const user = await prisma.user.findUnique({
    where: { email: USER_EMAIL },
    select: { id: true, fcMax: true, lthr: true },
  });
  if (!user) throw new Error(`User not found: ${USER_EMAIL}`);

  console.log(`User: ${USER_EMAIL} | FCmax=${user.fcMax} | LTHR=${user.lthr}`);
  console.log(`Workout IDs (${TARGET_IDS.length}):`, TARGET_IDS);

  const hrConfig = { fcMax: user.fcMax, lthr: user.lthr };

  const days = await prisma.dailyWorkout.findMany({
    where: { id: { in: TARGET_IDS } },
    include: {
      routine: true,
      blocks: { orderBy: { order: "asc" } },
    },
  });

  if (days.length !== TARGET_IDS.length) {
    console.warn(`Found ${days.length}/${TARGET_IDS.length} workouts`);
  }

  const entries = [];
  for (const day of days) {
    if (day.routine.userId !== user.id) {
      console.warn(`Skipping ${day.id} — belongs to a different user`);
      continue;
    }
    if (day.blocks.length === 0) {
      console.warn(`Skipping ${day.id} — no blocks`);
      continue;
    }

    const dayEs = DAY_SHORT_ES[day.dayOfWeek] ?? day.dayOfWeek.toLowerCase();
    const dayDate = addDays(day.routine.weekStart, DAY_OFFSET[day.dayOfWeek] ?? 0);
    const baseName = `${dayDate}-${dayEs}`;
    const fitName = `${baseName}-coachia.fit`;
    const wktName = `CoachIA ${dayEs}`;

    try {
      const bytes = blocksToFitWorkout({ name: wktName, blocks: day.blocks, hrConfig });
      entries.push({ name: `fit/${fitName}`, data: Buffer.from(bytes) });
      console.log(`  + fit/${fitName} (${bytes.length} bytes)`);
    } catch (err) {
      console.error(`  ! Error encoding ${fitName}:`, err.message);
    }

    try {
      const cyclingDay = {
        dayOfWeek: day.dayOfWeek,
        weekLabel: `Semana del ${day.routine.weekStart}`,
        weekStart: day.routine.weekStart,
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
      };
      const txt = generateTxtSummary(cyclingDay);
      entries.push({ name: `resumen/${baseName}.txt`, data: Buffer.from(txt) });
      console.log(`  + resumen/${baseName}.txt`);
    } catch (err) {
      console.error(`  ! Error generating summary for ${baseName}:`, err.message);
    }
  }

  if (entries.length === 0) throw new Error("No entries produced");

  const zipBuffer = createZip(entries);
  fs.writeFileSync(OUTPUT_PATH, zipBuffer);
  console.log(`\nWrote ${entries.length} entries to ${OUTPUT_PATH} (${zipBuffer.length} bytes)`);

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
