import { expect, test, type Page } from '@playwright/test';

// Fixture accounts come from server/prisma/seed.ts.
const REQUESTER = { email: 'requester@toktickit.local', password: 'DevPass123!' };
const IT_STAFF_1 = { email: 'itstaff@toktickit.local', password: 'DevPass123!', displayName: 'IT Support' };
const IT_STAFF_2 = { email: 'itstaff2@toktickit.local', password: 'DevPass123!', displayName: 'Pakorn W.' };

async function login(page: Page, creds: { email: string; password: string }): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(creds.email);
  await page.getByLabel('Password', { exact: true }).fill(creds.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 30_000 });
}

async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
}

// One journey covers E2E-01 (record, then a second IT Staff edits) and E2E-03 (the Requester sees the
// records read only). They share one Ticket, so the Requester check sees the edited record.
test('IT Staff records an Action Taken, a second IT Staff edits it, and the Requester sees it read only', async ({
  page,
}, testInfo) => {
  const summary = `Lab 4 actions flow ${Date.now()}-${testInfo.project.name}`;
  const description = 'Replaced the faulty network cable.';
  const editedDescription = 'Replaced the faulty network cable and tested the port.';

  // Requester creates the Ticket this journey needs.
  await login(page, REQUESTER);
  await page.goto('/tickets/new');
  await page.getByLabel('Category').selectOption({ label: 'Hardware' });
  await page.getByLabel('Related System').selectOption({ index: 1 });
  await page.getByLabel('Summary', { exact: true }).fill(summary);
  await page.getByLabel('Description', { exact: true }).fill('Actions Taken E2E fixture ticket.');
  await page.getByRole('button', { name: 'Create Ticket', exact: true }).click();
  await page.waitForURL(/\/tickets\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const ticketId = page.url().split('/').pop() ?? '';
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^TKT-/, { timeout: 30_000 });
  await logout(page);

  // E2E-01, first half: IT Staff records an Action Taken.
  await login(page, IT_STAFF_1);
  await page.goto(`/staff/tickets/${ticketId}`);
  await expect(page.getByRole('heading', { name: 'Actions Taken' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('No Actions Taken yet.')).toBeVisible();

  await page.getByRole('button', { name: 'Record Action Taken' }).click();
  await page.getByLabel('Description', { exact: false }).last().fill(description);
  await page.getByLabel('Result', { exact: false }).selectOption({ label: 'Escalated' });
  await page.getByLabel('Attachment Notes (optional)').fill('Photo kept on the shared drive.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  const row = page.getByTestId('action-row');
  await expect(row).toHaveCount(1, { timeout: 30_000 });
  await expect(row.getByText(IT_STAFF_1.displayName)).toBeVisible();
  await expect(row.getByText(description)).toBeVisible();
  await expect(row.getByText('Escalated')).toBeVisible();
  await expect(row.getByText('Attachment: Photo kept on the shared drive.')).toBeVisible();
  await expect(page.getByText(/^Edited by /)).toHaveCount(0);
  await logout(page);

  // E2E-01, second half: a second IT Staff edits it. The performer stays, the editor is shown.
  await login(page, IT_STAFF_2);
  await page.goto(`/staff/tickets/${ticketId}`);
  await expect(page.getByTestId('action-row')).toHaveCount(1, { timeout: 30_000 });
  await page.getByTestId('action-row').getByRole('button', { name: /^Edit/ }).click();
  const descriptionField = page.getByLabel('Description', { exact: false }).last();
  await expect(descriptionField).toHaveValue(description);
  await descriptionField.fill(editedDescription);
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  const editedRow = page.getByTestId('action-row');
  await expect(editedRow.getByText(editedDescription)).toBeVisible({ timeout: 30_000 });
  await expect(editedRow.getByText(IT_STAFF_1.displayName)).toBeVisible();
  await expect(editedRow.getByText(`Edited by ${IT_STAFF_2.displayName}`)).toBeVisible();
  await expect(page.getByTestId('action-row')).toHaveCount(1);
  await logout(page);

  // E2E-03: the Requester opens the owned Ticket and sees the records with no create or edit control.
  await login(page, REQUESTER);
  await page.goto(`/tickets/${ticketId}`);
  await expect(page.getByRole('heading', { name: 'Actions Taken' })).toBeVisible({ timeout: 30_000 });
  const requesterRow = page.getByTestId('action-row-readonly');
  await expect(requesterRow).toHaveCount(1, { timeout: 30_000 });
  await expect(requesterRow.getByText(editedDescription)).toBeVisible();
  await expect(requesterRow.getByText(IT_STAFF_1.displayName)).toBeVisible();
  await expect(requesterRow.getByText(`Edited by ${IT_STAFF_2.displayName}`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record Action Taken' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Edit/ })).toHaveCount(0);
});
