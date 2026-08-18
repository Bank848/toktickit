import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.category.count({ where: { isActive: true } });
  const relatedSystemsActive = await prisma.relatedSystem.count({ where: { isActive: true } });
  const relatedSystemsInactive = await prisma.relatedSystem.count({ where: { isActive: false } });
  const users = await prisma.user.count();
  const requesters = await prisma.user.count({ where: { role: 'REQUESTER' } });

  console.log(`Active categories: ${categories} (expect 4)`);
  console.log(`Active related systems: ${relatedSystemsActive} (expect 5)`);
  console.log(`Inactive related systems: ${relatedSystemsInactive} (expect 1)`);
  console.log(`Total users: ${users} (expect 4)`);
  console.log(`Requesters: ${requesters} (expect 2 — needed for the FR-007 cross-requester 403 test)`);

  if (categories !== 4 || relatedSystemsActive !== 5 || relatedSystemsInactive !== 1 || users !== 4 || requesters !== 2) {
    console.error('Seed verification FAILED — counts do not match expectations.');
    process.exit(1);
  }
  console.log('Seed verification passed.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
