const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const idx = await p.$queryRaw`SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='BodyWeight'`;
  console.log(JSON.stringify(idx, null, 2));
  await p.$disconnect();
})();
