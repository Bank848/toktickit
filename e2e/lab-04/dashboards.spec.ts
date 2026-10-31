import { expect, test, type Page } from '@playwright/test';
import { ADMIN, IT_STAFF_1, REQUESTER, apiGet, login } from '../support/session';

interface ListResponse {
  meta: { total: number };
}
interface StaffDashboard {
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  unassignedCount: number;
  ownedByMeCount: number;
  userCounts?: Record<string, number>;
}
interface AdminUser {
  role: string;
  isActive: boolean;
}

// The count a card shows is read from its link's accessible name ("Open 2"), the same text a screen
// reader announces.
async function cardCount(page: Page, label: string): Promise<number> {
  const name = await page.getByRole('link', { name: new RegExp(`^${label} \\d+$`) }).innerText();
  const match = /(\d+)\s*$/.exec(name);
  if (!match) throw new Error(`No count found on the "${label}" card`);
  return Number(match[1]);
}

// E2E-04 (AC-02, FR-10): the Requester lands on the dashboard and a card opens My Tickets filtered.
test.beforeEach(({}, testInfo) => {
  testInfo.setTimeout(120_000);
});

test('a Requester lands on the dashboard and a status card opens the filtered My Tickets', async ({ page }) => {
  await login(page, REQUESTER);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'My Dashboard', level: 1 })).toBeVisible();

  // Each card matches the total the list endpoint reports for the same status (FR-10).
  const cards = [
    { label: 'Open', status: 'OPEN' },
    { label: 'Waiting', status: 'WAITING_FOR_REQUESTER' },
    { label: 'Resolved', status: 'RESOLVED' },
    { label: 'Closed', status: 'CLOSED' },
  ];
  for (const card of cards) {
    const listed = await apiGet<ListResponse>(page, `/api/v1/tickets?status=${card.status}&pageSize=1`);
    expect(await cardCount(page, card.label), `${card.label} card`).toBe(listed.meta.total);
  }

  // Clicking Open reaches My Tickets with the Open filter applied and the list fetched with it.
  const openTotal = (await apiGet<ListResponse>(page, '/api/v1/tickets?status=OPEN&pageSize=1')).meta.total;
  const filtered = page.waitForResponse(
    (response) => response.url().includes('/api/v1/tickets') && response.url().includes('status=OPEN') && response.status() === 200,
  );
  await page.getByRole('link', { name: /^Open \d+$/ }).click();
  const response = await filtered;
  expect(((await response.json()) as ListResponse).meta.total).toBe(openTotal);
  await expect(page).toHaveURL(/\/tickets\?status=OPEN$/);
  await expect(page.getByLabel('Status', { exact: true })).toHaveValues(['OPEN']);

  // A Requester opening the staff dashboard is sent back to their own (ui-spec section 8).
  await page.goto('/staff/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
});

// E2E-05 (AC-10, AC-11, FR-09): staff dashboards match the data; only the Administrator sees user counts.
test('IT Staff and Administrator dashboards match the data and only the Administrator sees user counts', async ({
  page,
}) => {
  // IT Staff.
  await login(page, IT_STAFF_1);
  await expect(page).toHaveURL(/\/staff\/dashboard$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'IT Staff Dashboard', level: 1 })).toBeVisible();
  await expect(page.getByText('User accounts by role')).toHaveCount(0);

  const staffData = await apiGet<StaffDashboard>(page, '/api/v1/staff/dashboard');
  expect(staffData.userCounts).toBeUndefined();
  expect(await cardCount(page, 'New')).toBe(staffData.statusCounts.NEW);
  expect(await cardCount(page, 'Open')).toBe(staffData.statusCounts.OPEN);
  expect(await cardCount(page, 'Assigned to me')).toBe(staffData.ownedByMeCount);
  expect(await cardCount(page, 'Unassigned')).toBe(staffData.unassignedCount);
  expect(await cardCount(page, 'Urgent')).toBe(staffData.priorityCounts.URGENT);

  // The status cards agree with the Ticket Queue totals for the same filter (FR-10).
  for (const status of ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER']) {
    const listed = await apiGet<ListResponse>(page, `/api/v1/staff/tickets?status=${status}&pageSize=1`);
    expect(staffData.statusCounts[status], status).toBe(listed.meta.total);
  }

  // A card opens the Ticket Queue with its filter.
  await page.getByRole('link', { name: /^Unassigned \d+$/ }).click();
  await expect(page).toHaveURL(/\/staff\/tickets\?ownerId=unassigned$/);
  await expect(page.getByLabel('Owner', { exact: true })).toHaveValue('unassigned', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });

  // Administrator.
  await login(page, ADMIN);
  await expect(page).toHaveURL(/\/staff\/dashboard$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Administrator Dashboard', level: 1 })).toBeVisible();
  await expect(page.getByText('User accounts by role')).toBeVisible();

  const users = await apiGet<AdminUser[]>(page, '/api/v1/admin/users');
  const active = (role: string) => users.filter((u) => u.role === role && u.isActive).length;
  const roleCard = page.getByText('User accounts by role').locator('..');
  await expect(roleCard.getByText(/^Requesters:/)).toHaveText(`Requesters: ${active('REQUESTER')}`);
  await expect(roleCard.getByText(/^IT Staff:/)).toHaveText(`IT Staff: ${active('IT_STAFF')}`);
  await expect(roleCard.getByText(/^Administrators:/)).toHaveText(`Administrators: ${active('ADMINISTRATOR')}`);
});
