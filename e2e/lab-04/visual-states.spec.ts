import { expect, test, type Page } from '@playwright/test';
import { assertNoHorizontalOverflow, saveEvidenceScreenshot } from '../support/evidence';
import { ADMIN, IT_STAFF_1, REQUESTER, createTicket, login, logout } from '../support/session';

// E2E-07 (specification section 10): every new or changed screen at 375, 768 and 1280 px, no clipped
// control, no console error. The widths are set inside the test, so the whole file runs once, under
// the desktop project, instead of three times.
const WIDTHS = [
  { name: 'w375', width: 375, height: 812 },
  { name: 'w768', width: 768, height: 1024 },
  { name: 'w1280', width: 1280, height: 900 },
];

test.beforeEach(({}, testInfo) => {
  testInfo.setTimeout(180_000);
  test.skip(testInfo.project.name !== 'desktop', 'Widths are set inside the test; run once.');
});

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    // The login screen probes /me with no session and gets 401 by design; that browser line is not an app error.
    const isSessionProbe = message.text().includes('status of 401') && message.location().url.includes('/api/v1/me');
    if (message.type() === 'error' && !isSessionProbe) errors.push(`${message.text()} (${message.location().url})`);
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

// No visible control may extend past the viewport edge (a clipped button or card).
async function assertNothingClipped(page: Page, location: string): Promise<void> {
  const clipped = await page.evaluate(() => {
    const limit = window.innerWidth + 1;
    return Array.from(document.querySelectorAll('a, button, select, input, textarea'))
      .filter((el) => {
        const box = el.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && (box.right > limit || box.left < -1);
      })
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}"`);
  });
  expect(clipped, `${location} has controls outside the viewport`).toEqual([]);
}

async function eachWidth(page: Page, group: string, name: string, ready: () => Promise<void>): Promise<void> {
  for (const size of WIDTHS) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await ready();
    await saveEvidenceScreenshot(page, 'lab-04', group, size.name, name);
    await assertNoHorizontalOverflow(page, `${group}/${name}`);
    await assertNothingClipped(page, `${group}/${name} at ${size.width}px`);
  }
}

test('dashboards and Actions Taken screens fit at 375, 768 and 1280 px with a clean console', async ({ page }, testInfo) => {
  const errors = collectConsoleErrors(page);
  const summary = `Lab 4 visual ${Date.now()}-${testInfo.project.name}`;

  // Requester dashboard, then a Ticket that will get one Action Taken.
  await login(page, REQUESTER);
  await expect(page).toHaveURL(/\/dashboard$/);
  await eachWidth(page, 'requester-dashboard', 'loaded', async () => {
    await expect(page.getByRole('link', { name: /^Open \d+$/ })).toBeVisible({ timeout: 30_000 });
  });
  const { ticketId } = await createTicket(page, summary);
  await logout(page);

  await login(page, IT_STAFF_1);
  await expect(page).toHaveURL(/\/staff\/dashboard$/);
  await eachWidth(page, 'staff-dashboard', 'it-staff-loaded', async () => {
    await expect(page.getByRole('link', { name: /^Unassigned \d+$/ })).toBeVisible({ timeout: 30_000 });
  });

  await page.goto(`/staff/tickets/${ticketId}`);
  await expect(page.getByRole('heading', { name: 'Actions Taken' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Record Action Taken' }).click();
  await page.getByLabel('Description', { exact: false }).last().fill('Replaced the faulty network cable.');
  await page.getByLabel('Attachment Notes (optional)').fill('Photo kept on the shared drive.');
  await eachWidth(page, 'actions-taken', 'staff-form-open', async () => {
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('action-row')).toHaveCount(1, { timeout: 30_000 });
  await eachWidth(page, 'actions-taken', 'staff-recorded', async () => {
    await expect(page.getByTestId('action-row')).toHaveCount(1);
  });
  await logout(page);

  await login(page, ADMIN);
  await expect(page).toHaveURL(/\/staff\/dashboard$/);
  await eachWidth(page, 'staff-dashboard', 'admin-loaded', async () => {
    await expect(page.getByText('User accounts by role')).toBeVisible({ timeout: 30_000 });
  });
  await logout(page);

  await login(page, REQUESTER);
  await page.goto(`/tickets/${ticketId}`);
  await expect(page.getByRole('heading', { name: 'Actions Taken' })).toBeVisible({ timeout: 30_000 });
  await eachWidth(page, 'actions-taken', 'requester-read-only', async () => {
    await expect(page.getByTestId('action-row-readonly')).toHaveCount(1, { timeout: 30_000 });
  });

  expect(errors, 'console errors on the screens above').toEqual([]);
});

// The error and empty states are reachable and fit. The failing response is mocked, so the browser's
// own "Failed to load resource" console line is expected here and not asserted on.
test('dashboard error and empty states fit at 375 px', async ({ page }) => {
  await login(page, REQUESTER);
  await page.setViewportSize({ width: 375, height: 812 });

  await page.route('**/api/v1/dashboard', (route) =>
    route.fulfill({ status: 500, json: { error: { code: 'INTERNAL', message: 'x' } } }),
  );
  await page.goto('/dashboard');
  await expect(page.getByRole('alert')).toContainText('Failed to load your dashboard.', { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await saveEvidenceScreenshot(page, 'lab-04', 'requester-dashboard', 'w375', 'error');
  await assertNothingClipped(page, 'requester dashboard error');

  await page.unroute('**/api/v1/dashboard');
  const zero = { OPEN: 0, WAITING_FOR_REQUESTER: 0, RESOLVED: 0, CLOSED: 0, NEW: 0, IN_PROGRESS: 0, CANCELLED: 0, REOPENED: 0 };
  await page.route('**/api/v1/dashboard', (route) =>
    route.fulfill({ status: 200, json: { statusCounts: zero, recentTickets: [] } }),
  );
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('link', { name: 'Open 0' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('No recent tickets.')).toBeVisible();
  await saveEvidenceScreenshot(page, 'lab-04', 'requester-dashboard', 'w375', 'empty');
  await assertNothingClipped(page, 'requester dashboard empty');
});

// Focus visible and keyboard order (specification section 10): Tab reaches the four Requester cards in
// order, then the two quick actions, and every one of them shows an outline when focused.
test('dashboard cards and actions are reachable by keyboard in order with a visible focus ring', async ({ page }) => {
  await login(page, REQUESTER);
  await expect(page.getByRole('link', { name: /^Open \d+$/ })).toBeVisible({ timeout: 30_000 });

  const wanted = [/^Open \d+$/, /^Waiting \d+$/, /^Resolved \d+$/, /^Closed \d+$/, /^Create Ticket$/, /^View My Tickets$/];
  const seen: string[] = [];
  for (let i = 0; i < 40 && seen.length < wanted.length; i += 1) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const style = getComputedStyle(el);
      return {
        name: (el.innerText || '').replace(/\s+/g, ' ').trim(),
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });
    if (!focused) continue;
    if (wanted[seen.length].test(focused.name)) {
      seen.push(focused.name);
      expect(focused.outlineStyle, `${focused.name} focus outline`).not.toBe('none');
      expect(parseFloat(focused.outlineWidth), `${focused.name} focus outline width`).toBeGreaterThan(0);
    }
  }
  expect(seen.length, `focus order reached: ${seen.join(' | ')}`).toBe(wanted.length);
});
