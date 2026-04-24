const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = !process.argv.includes('--apply');

function computeBackfill(logs) {
  const updates = [];
  const orphans = [];
  for (const log of logs) {
    const ws = log.exercise?.dailyWorkout?.routine?.weekStart;
    if (ws) updates.push({ id: log.id, weekStart: ws });
    else orphans.push(log.id);
  }
  return { updates, orphans };
}

(async () => {
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'APPLY (will write)'}\n`);

  const logs = await prisma.workoutLog.findMany({
    where: { weekStart: null },
    include: {
      exercise: {
        include: {
          dailyWorkout: {
            include: { routine: { select: { weekStart: true } } },
          },
        },
      },
    },
  });

  console.log(`Logs with NULL weekStart: ${logs.length}`);

  const { updates, orphans } = computeBackfill(logs);

  const byWeek = {};
  for (const u of updates) byWeek[u.weekStart] = (byWeek[u.weekStart] || 0) + 1;
  console.log('\nPlanned updates by weekStart:');
  Object.entries(byWeek).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  if (orphans.length > 0) {
    console.log(`\n⚠️  ORPHANS (skip): ${orphans.length} logs without routine.weekStart`);
    orphans.forEach((id) => console.log(`  ${id}`));
  }

  if (DRY_RUN) {
    console.log('\nDry-run complete. Re-run with --apply to write.');
    await prisma.$disconnect();
    return;
  }

  console.log('\nApplying updates...');
  const result = await prisma.$transaction(
    updates.map((u) =>
      prisma.workoutLog.update({
        where: { id: u.id },
        data: { weekStart: u.weekStart },
      }),
    ),
  );
  console.log(`✅ Updated ${result.length} rows.`);

  const remainingNull = await prisma.workoutLog.count({ where: { weekStart: null } });
  console.log(`Remaining NULL weekStart: ${remainingNull}`);

  await prisma.$disconnect();
})();
