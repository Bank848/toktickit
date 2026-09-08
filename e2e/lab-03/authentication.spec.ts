import { expect, test } from '@playwright/test';
import { saveEvidenceScreenshot, assertNoHorizontalOverflow } from '../support/evidence';

// Fixture emails/password confirmed against Task 3's real server/prisma/seed.ts (Issue #35).
const MUST_CHANGE_USER = { email: 'onboarding@toktickit.local', password: 'DevPass123!' };
const NEW_PASSWORD = 'Sw1tched!Pass';
const DEACTIVATED_USER = { email: 'itstaff4-inactive@toktickit.local', password: 'DevPass123!' };
const WRONG_PASSWORD = 'DefinitelyWrong!1';

test('mandatory first-login password change, then logout invalidates the session', async ({ page }, testInfo) => {
  const projectName = testInfo.project.name;

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in to your account.' })).toBeVisible();
  await page.getByLabel('Email address', { exact: true }).fill(MUST_CHANGE_USER.email);
  await page.getByLabel('Password', { exact: true }).fill(MUST_CHANGE_USER.password);
  await saveEvidenceScreenshot(page, 'lab-03', 'authentication', projectName, 'login-filled');
  await assertNoHorizontalOverflow(page, 'Login (filled)');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();

  await expect(page).toHaveURL(/\/change-password$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Change Your Password.' })).toBeVisible();
  await saveEvidenceScreenshot(page, 'lab-03', 'authentication', projectName, 'change-password-initial');

  await page.getByLabel('Current (temporary) password', { exact: true }).fill(MUST_CHANGE_USER.password);
  await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirm new password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  // Mandatory-change users land on their role's home route without a second login (AC-09).
  await expect(page).toHaveURL(/\/(tickets|staff\/tickets|admin\/users)$/, { timeout: 30_000 });
  await assertNoHorizontalOverflow(page, 'Role home (post change-password)');

  // --- Logout invalidates the session (AC-07) ---
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });

  // Going "back" must not resurrect the authenticated view from bfcache.
  await page.goBack();
  await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
});

test('invalid credentials and a deactivated account get distinct error messages', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email address', { exact: true }).fill('no-such-user@toktickit.local');
  await page.getByLabel('Password', { exact: true }).fill(WRONG_PASSWORD);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password. Please try again.');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Email address', { exact: true })).toHaveValue('no-such-user@toktickit.local');

  await page.getByLabel('Password', { exact: true }).fill(WRONG_PASSWORD);
  await page.getByLabel('Email address', { exact: true }).fill(DEACTIVATED_USER.email);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  // Same generic message for a real deactivated email + wrong password -- only the *correct*
  // password on a deactivated account reveals BR-07's distinct message (next assertion).
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password. Please try again.');

  await page.getByLabel('Password', { exact: true }).fill(DEACTIVATED_USER.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'This account has been deactivated. Contact an administrator.',
  );
  await expect(page).toHaveURL(/\/login$/);
});

test('wrong current password on the mandatory change screen blocks the change', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(MUST_CHANGE_USER.email);
  await page.getByLabel('Password', { exact: true }).fill(MUST_CHANGE_USER.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/change-password$/, { timeout: 30_000 });

  await page.getByLabel('Current (temporary) password', { exact: true }).fill(WRONG_PASSWORD);
  await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirm new password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(page.getByText('Current password is incorrect.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/change-password$/);
});

test('a Lab-2-seeded Requester logs in after the Lab 3 migration and sees their existing tickets unchanged (AC-12)', async ({
  page,
}) => {
  // requester@toktickit.local is one of Lab 2's original seeded Requesters (Task 3, #35) --
  // it must keep its id, its tickets, and its ability to log in once auth moves to sessions.
  const LAB2_SEEDED_REQUESTER = { email: 'requester@toktickit.local', password: 'DevPass123!' };

  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(LAB2_SEEDED_REQUESTER.email);
  await page.getByLabel('Password', { exact: true }).fill(LAB2_SEEDED_REQUESTER.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();

  await expect(page).toHaveURL(/\/tickets$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'My Tickets' })).toBeVisible();

  // The seed baseline (specification.md §6.2) guarantees this Requester has at least one
  // pre-existing ticket carried over from Lab 2 -- the list must not come back empty.
  await expect(page.getByText('No tickets found', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('table').or(page.getByTestId('ticket-card'))).toBeVisible();
});
