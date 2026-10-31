import { expect, type Page } from '@playwright/test';

// Fixture accounts come from server/prisma/seed.ts.
export const REQUESTER = { email: 'requester@toktickit.local', password: 'DevPass123!' };
export const IT_STAFF_1 = { email: 'itstaff@toktickit.local', password: 'DevPass123!', displayName: 'IT Support' };
export const ADMIN = { email: 'admin@toktickit.local', password: 'DevPass123!' };

// The API origin the Playwright web server starts the server on (playwright.config.ts).
export const API_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:4001';

export async function login(page: Page, creds: { email: string; password: string }): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(creds.email);
  await page.getByLabel('Password', { exact: true }).fill(creds.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 30_000 });
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
}

// Creates a Ticket as the signed-in Requester and returns its id and number.
export async function createTicket(page: Page, summary: string): Promise<{ ticketId: string; ticketNumber: string }> {
  await page.goto('/tickets/new');
  await page.getByLabel('Category').selectOption({ label: 'Hardware' });
  await page.getByLabel('Related System').selectOption({ index: 1 });
  await page.getByLabel('Summary', { exact: true }).fill(summary);
  await page.getByLabel('Description', { exact: true }).fill('Lab 4 E2E fixture ticket.');
  await page.getByRole('button', { name: 'Create Ticket', exact: true }).click();
  await page.waitForURL(/\/tickets\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const ticketId = page.url().split('/').pop() ?? '';
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText(/^TKT-/, { timeout: 30_000 });
  return { ticketId, ticketNumber: (await heading.textContent())?.trim() ?? '' };
}

// Reads JSON from the API with the signed-in session's cookie, so a test can compare what a screen
// shows with what the API says through a path that does not touch the screen.
export async function apiGet<T>(page: Page, path: string): Promise<T> {
  const response = await page.request.get(`${API_URL}${path}`);
  expect(response.status(), `GET ${path}`).toBe(200);
  return (await response.json()) as T;
}
