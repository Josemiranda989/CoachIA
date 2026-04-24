const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = !process.argv.includes('--apply');

const SLUGS_TO_GIF = [
  'curl-femoral-maquina',
  'curl-martillo',
  'curl-de-biceps-barra-z',
  'elevaciones-laterales',
  'elevacion-de-talones',
  'extensiones-de-triceps-en-polea',
  'jalon-al-pecho',
  'peso-muerto-rumano',
  'prensa-45',
  'press-militar-con-mancuernas',
  'press-de-banca-con-mancuernas',
  'remo-serrucho',
  'remo-con-barra',
  'sillon-de-cuadriceps',
];

(async () => {
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}\n`);

  const defs = await prisma.exerciseDefinition.findMany({
    where: { slug: { in: SLUGS_TO_GIF } },
    select: { slug: true, imagePath: true },
  });

  const updates = defs.map((d) => ({
    slug: d.slug,
    from: d.imagePath,
    to: `/exercises/${d.slug}.gif`,
  }));

  console.log('Planned updates:');
  updates.forEach((u) => console.log(`  ${u.slug}: ${u.from} -> ${u.to}`));

  if (DRY_RUN) {
    console.log('\nRe-run with --apply to write.');
    await prisma.$disconnect();
    return;
  }

  const result = await prisma.$transaction(
    updates.map((u) =>
      prisma.exerciseDefinition.update({
        where: { slug: u.slug },
        data: { imagePath: u.to },
      }),
    ),
  );
  console.log(`\n✅ Updated ${result.length} rows.`);
  await prisma.$disconnect();
})();
