import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BCRYPT_COST = 10;

// Fixed local-dev password shared by every seeded account except the one seeded specifically to
// exercise the mandatory first-login flow (docs/lab-03/specification.md §6.2). Local development
// only — never a real personal password or production secret. Documented in README.md.
const DEV_PASSWORD = 'DevPass123!';
const DEV_PASSWORD_HASH = bcrypt.hashSync(DEV_PASSWORD, BCRYPT_COST);

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
  mustChangePassword: boolean;
}[] = [
  { email: 'requester@toktickit.local', displayName: 'Nattapong R.', role: 'REQUESTER', isActive: true, mustChangePassword: false },
  { email: 'requester2@toktickit.local', displayName: 'Siriporn K.', role: 'REQUESTER', isActive: true, mustChangePassword: false },
  { email: 'requester3@toktickit.local', displayName: 'Somchai P.', role: 'REQUESTER', isActive: true, mustChangePassword: false },
  { email: 'requester4@toktickit.local', displayName: 'Malee T.', role: 'REQUESTER', isActive: true, mustChangePassword: false },
  { email: 'requester5-inactive@toktickit.local', displayName: 'Wichai S. (inactive)', role: 'REQUESTER', isActive: false, mustChangePassword: false },
  { email: 'itstaff@toktickit.local', displayName: 'IT Support', role: 'IT_STAFF', isActive: true, mustChangePassword: false },
  { email: 'itstaff2@toktickit.local', displayName: 'Pakorn W.', role: 'IT_STAFF', isActive: true, mustChangePassword: false },
  { email: 'itstaff3@toktickit.local', displayName: 'Suda N.', role: 'IT_STAFF', isActive: true, mustChangePassword: false },
  { email: 'itstaff4-inactive@toktickit.local', displayName: 'Anan C. (inactive)', role: 'IT_STAFF', isActive: false, mustChangePassword: false },
  { email: 'admin@toktickit.local', displayName: 'System Admin', role: 'ADMINISTRATOR', isActive: true, mustChangePassword: false },
  { email: 'onboarding@toktickit.local', displayName: 'New Hire (must change password)', role: 'IT_STAFF', isActive: true, mustChangePassword: true },
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
      update: {
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive,
        passwordHash: DEV_PASSWORD_HASH,
        mustChangePassword: user.mustChangePassword,
      },
      create: {
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive,
        passwordHash: DEV_PASSWORD_HASH,
        mustChangePassword: user.mustChangePassword,
      },
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
