import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES: { name: string; code: string }[] = [
  { name: 'Account and Access', code: 'ACCESS' },
  { name: 'Hardware', code: 'HARDWARE' },
  { name: 'Software', code: 'SOFTWARE' },
  { name: 'Network', code: 'NETWORK' },
];

const RELATED_SYSTEMS: { code: string; name: string; isActive: boolean }[] = [
  { code: 'CORP_LAPTOP', name: 'Corporate Laptop', isActive: true },
  { code: 'EMAIL', name: 'Email', isActive: true },
  { code: 'VPN', name: 'VPN', isActive: true },
  { code: 'PRINTER', name: 'Printer', isActive: true },
  { code: 'ERP', name: 'ERP', isActive: true },
  { code: 'LEGACY_FS', name: 'Legacy File Server', isActive: false },
];

const USERS: {
  email: string;
  displayName: string;
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
  isActive: boolean;
}[] = [
  { email: 'requester@toktickit.local', displayName: 'Nattapong R.', role: 'REQUESTER', isActive: true },
  { email: 'requester2@toktickit.local', displayName: 'Siriporn K.', role: 'REQUESTER', isActive: true },
  { email: 'requester3@toktickit.local', displayName: 'Somchai P.', role: 'REQUESTER', isActive: true },
  { email: 'requester4@toktickit.local', displayName: 'Malee T.', role: 'REQUESTER', isActive: true },
  {
    email: 'requester5-inactive@toktickit.local',
    displayName: 'Wichai S. (inactive)',
    role: 'REQUESTER',
    isActive: false,
  },
  { email: 'itstaff@toktickit.local', displayName: 'IT Support', role: 'IT_STAFF', isActive: true },
  { email: 'admin@toktickit.local', displayName: 'System Admin', role: 'ADMINISTRATOR', isActive: true },
];

async function main() {
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: { code: category.code, isActive: true },
      create: { name: category.name, code: category.code, isActive: true },
    });
  }

  for (const system of RELATED_SYSTEMS) {
    await prisma.relatedSystem.upsert({
      where: { code: system.code },
      update: { name: system.name, isActive: system.isActive },
      create: system,
    });
  }

  for (const user of USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { displayName: user.displayName, role: user.role, isActive: user.isActive },
      create: user,
    });
  }
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
