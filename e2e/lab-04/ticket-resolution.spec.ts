import { expect, test } from '@playwright/test';
import { IT_STAFF_1, REQUESTER, createTicket, login, logout } from '../support/session';

// E2E-02 (AC-04, AC-05): resolving a Ticket that has no Action Taken is refused with a directed
// message and leaves the status unchanged; once an Action Taken is recorded the same change works.
test.beforeEach(({}, testInfo) => {
  testInfo.setTimeout(120_000);
});

test('IT Staff cannot resolve a Ticket until an Action Taken is recorded', async ({ page }, testInfo) => {
  const summary = `Lab 4 resolution gate ${Date.now()}-${testInfo.project.name}`;

  await login(page, REQUESTER);
  const { ticketId } = await createTicket(page, summary);
  await logout(page);

  await login(page, IT_STAFF_1);
  await page.goto(`/staff/tickets/${ticketId}`);
  const status = page.getByLabel('Current Status', { exact: true });
  const badge = page.getByTestId('ticket-status-badge');
  await expect(page.getByLabel('Ticket Owner', { exact: true })).toBeVisible({ timeout: 30_000 });

  // Claim the Ticket (NEW -> OPEN), then start work.
  await page.getByLabel('Ticket Owner', { exact: true }).selectOption({ label: IT_STAFF_1.displayName });
  await expect(status).not.toBeDisabled({ timeout: 30_000 });
  await status.selectOption({ label: 'In Progress' });
  await expect(badge).toContainText('In Progress');

  // AC-04: no Action Taken yet, so Resolved is refused with the directed message.
  await expect(page.getByText('No Actions Taken yet.')).toBeVisible({ timeout: 30_000 });
  await status.selectOption({ label: 'Resolved' });
  await expect(page.getByRole('alert').filter({ hasText: 'record an Action Taken first' })).toBeVisible({ timeout: 30_000 });
  await expect(badge).toContainText('In Progress');
  await expect(badge).not.toContainText('Resolved');

  // Record one Action Taken, then AC-05: the same change now succeeds.
  await page.getByRole('button', { name: 'Record Action Taken' }).click();
  await page.getByLabel('Description', { exact: false }).last().fill('Replaced the faulty network cable.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('action-row')).toHaveCount(1, { timeout: 30_000 });

  await status.selectOption({ label: 'Resolved' });
  await expect(badge).toContainText('Resolved', { timeout: 30_000 });
});
