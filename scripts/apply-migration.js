const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  console.log('Dropping old index BodyWeight_userId_scaleId_key...');
  await p.$executeRawUnsafe('DROP INDEX IF EXISTS "BodyWeight_userId_scaleId_key"');

  console.log('Creating new index BodyWeight_userId_date_key...');
  await p.$executeRawUnsafe('CREATE UNIQUE INDEX "BodyWeight_userId_date_key" ON "BodyWeight"("userId", "date")');

  const idx = await p.$queryRaw`SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='BodyWeight'`;
  console.log('Current indexes:');
  console.log(JSON.stringify(idx, null, 2));

  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
