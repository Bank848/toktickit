import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.category.count({ where: { isActive: true } });
  const relatedSystemsActive = await prisma.relatedSystem.count({ where: { isActive: true } });
  const relatedSystemsInactive = await prisma.relatedSystem.count({ where: { isActive: false } });
  const users = await prisma.user.count();
  const requestersActive = await prisma.user.count({ where: { role: 'REQUESTER', isActive: true } });
  const requestersInactive = await prisma.user.count({ where: { role: 'REQUESTER', isActive: false } });

  console.log(`Active categories: ${categories} (expect 4)`);
  console.log(`Active related systems: ${relatedSystemsActive} (expect 5)`);
  console.log(`Inactive related systems: ${relatedSystemsInactive} (expect 1)`);
  console.log(`Total users: ${users} (expect 7)`);
  console.log(`Active requesters: ${requestersActive} (expect 4, labsheet Section 5.3 minimum)`);
  console.log(`Inactive requesters: ${requestersInactive} (expect 1, labsheet Section 5.3 minimum)`);

  if (
    categories !== 4 ||
    relatedSystemsActive !== 5 ||
    relatedSystemsInactive !== 1 ||
    users !== 7 ||
    requestersActive !== 4 ||
    requestersInactive !== 1
  ) {
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
