import { expect, test, type Page } from '@playwright/test';
import { saveEvidenceScreenshot, assertNoHorizontalOverflow } from '../support/evidence';

// Fixture emails/password confirmed against Task 3's real server/prisma/seed.ts (Issue #35).
const REQUESTER = { email: 'requester@toktickit.local', password: 'DevPass123!' };
const IT_STAFF = { email: 'itstaff@toktickit.local', password: 'DevPass123!' };
const ADMIN = { email: 'admin@toktickit.local', password: 'DevPass123!' };

async function login(page: Page, creds: { email: string; password: string }): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(creds.email);
  await page.getByLabel('Password', { exact: true }).fill(creds.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 30_000 });
}

test('a Requester is redirected away from Staff and Admin routes', async ({ page }, testInfo) => {
  const projectName = testInfo.project.name;
  await login(page, REQUESTER);

  await page.goto('/staff/tickets');
  await expect(page).toHaveURL(/\/tickets$/, { timeout: 30_000 });
  await saveEvidenceScreenshot(page, 'lab-03', 'staff-queue', projectName, 'forbidden-redirect');

  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/tickets$/, { timeout: 30_000 });
  await saveEvidenceScreenshot(page, 'lab-03', 'user-management', projectName, 'forbidden-redirect');
});

test('an IT Staff member is redirected away from Admin routes', async ({ page }, testInfo) => {
  const projectName = testInfo.project.name;
  await login(page, IT_STAFF);
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/staff\/tickets$/, { timeout: 30_000 });
  await saveEvidenceScreenshot(page, 'lab-03', 'user-management', projectName, 'staff-forbidden-redirect');
});

test('Ticket Queue shows a loading skeleton, then a no-match empty state', async ({ page }, testInfo) => {
  const projectName = testInfo.project.name;
  await login(page, IT_STAFF);

  await page.route('**/api/v1/staff/tickets**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  const navigation = page.goto('/staff/tickets');
  await expect(page.getByTestId('staff-queue-skeleton')).toBeVisible({ timeout: 5_000 });
  await saveEvidenceScreenshot(page, 'lab-03', 'staff-queue', projectName, 'loading');
  await navigation;

  // "Search by ticket number or summary" is only the input's placeholder text; the accessible
  // label (via <label for="staff-queue-search">) is just "Search" (StaffTicketQueuePage.tsx:112).
  await page.getByLabel('Search', { exact: true }).fill('no-such-ticket-xyz');
  await expect(page.getByText('No tickets match your filters.', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await saveEvidenceScreenshot(page, 'lab-03', 'staff-queue', projectName, 'no-match');
  await assertNoHorizontalOverflow(page, 'Staff Ticket Queue (no-match)');
});

test('User Management shows an empty search result', async ({ page }, testInfo) => {
  const projectName = testInfo.project.name;
  await login(page, ADMIN);
  await page.goto('/admin/users');
  // The search input has no <label>/aria-label at all on the real page -- it's a bare
  // <input placeholder="Search users…"> (AdminUserManagementPage.tsx:215), so getByLabel would
  // never match it.
  await page.getByPlaceholder('Search users…', { exact: true }).fill('no-such-user-xyz');
  await expect(page.getByText('No users match your search.', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await saveEvidenceScreenshot(page, 'lab-03', 'user-management', projectName, 'no-match');
  await assertNoHorizontalOverflow(page, 'User Management (no-match)');
});
