import { expect, test, type Page } from '@playwright/test';
import { saveEvidenceScreenshot, assertNoHorizontalOverflow } from '../support/evidence';

// Fixture emails/password/displayName confirmed against Task 3's real server/prisma/seed.ts
// (Issue #35). displayName is needed because Edit buttons are named "Edit <displayName>", not
// "Edit <email>" (AdminUserManagementPage.tsx: aria-label={`Edit ${target.displayName}`}).
const ADMIN = { email: 'admin@toktickit.local', password: 'DevPass123!', displayName: 'System Admin' };

async function login(page: Page, creds: { email: string; password: string }): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(creds.email);
  await page.getByLabel('Password', { exact: true }).fill(creds.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 30_000 });
}

test('Administrator creates, edits, and password-resets a user; safety rails hold', async ({
  page,
}, testInfo) => {
  const projectName = testInfo.project.name;
  const uniqueEmail = `e2e.user.${Date.now()}@toktickit.local`;
  const displayName = `E2E Fixture User ${Date.now()}`;
  const secondAdminName = `E2E Second Admin ${Date.now()}`;

  await login(page, ADMIN);
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  await saveEvidenceScreenshot(page, 'lab-03', 'user-management', projectName, 'list-initial');
  await assertNoHorizontalOverflow(page, 'User Management (initial)');

  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await page.getByLabel('Full Name', { exact: true }).fill(displayName);
  await page.getByLabel('Email Address', { exact: true }).fill(uniqueEmail);
  await page.getByLabel('Role', { exact: true }).selectOption({ label: 'IT Staff' });
  await page.getByLabel('Initial Password', { exact: true }).fill('Fixture!Pass1');
  await saveEvidenceScreenshot(page, 'lab-03', 'user-management', projectName, 'create-filled');
  await page.getByRole('button', { name: 'Save User', exact: true }).click();
  await expect(page.getByText('User created', { exact: false })).toBeVisible({ timeout: 30_000 });

  // AC-27: duplicate email rejected, no row created/changed. This is a plain HttpError with no
  // fieldErrors (adminUsers.ts's POST handler throws HttpError(409, 'EMAIL_ALREADY_EXISTS', ...)
  // with the default empty fieldErrors array), so applyApiError's fieldErrors.length===0 branch
  // routes it to the panel-level role="alert" (panelAlert), not a per-field error -- a plain
  // page-wide getByText still finds it either way, but it's worth noting this is the alert path.
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await page.getByLabel('Full Name', { exact: true }).fill('Duplicate Attempt');
  await page.getByLabel('Email Address', { exact: true }).fill(uniqueEmail);
  await page.getByLabel('Role', { exact: true }).selectOption({ label: 'Requester' });
  await page.getByLabel('Initial Password', { exact: true }).fill('Fixture!Pass1');
  await page.getByRole('button', { name: 'Save User', exact: true }).click();
  await expect(page.getByText('This email is already in use', { exact: true })).toBeVisible();
  await saveEvidenceScreenshot(page, 'lab-03', 'user-management', projectName, 'duplicate-email-error');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  // The search input has no <label>/aria-label at all on the real page -- it's a bare
  // <input placeholder="Search users…">, so getByLabel would never match it.
  await page.getByPlaceholder('Search users…', { exact: true }).fill(displayName);
  await page.getByRole('button', { name: `Edit ${displayName}` }).click();
  await page.getByLabel('Full Name', { exact: true }).fill(`${displayName} (edited)`);
  await page.getByRole('button', { name: 'Save User', exact: true }).click();
  await expect(page.getByText('User updated', { exact: false })).toBeVisible({ timeout: 30_000 });

  // AC-30: reset the edited user's password and prove it forces a change at next login.
  await page.getByRole('button', { name: `Edit ${displayName} (edited)` }).click();
  await page.getByRole('button', { name: 'Set New Password', exact: true }).click();
  // The dialog's accessible name is dynamic and includes the target's displayName
  // (aria-label={`Set new password for ${target.displayName}`}), lowercase "new" -- not the
  // literal string "Set New Password".
  const passwordDialog = page.getByRole('dialog', { name: `Set new password for ${displayName} (edited)` });
  await passwordDialog.getByLabel('Initial Password', { exact: true }).fill('ResetPass!2');
  // The dialog's own submit button is labeled "Save Password", not "Set New Password" -- that
  // text belongs only to the edit-panel button that OPENS the dialog (clicked above).
  await passwordDialog.getByRole('button', { name: 'Save Password', exact: true }).click();
  await expect(page.getByText('Password reset', { exact: false })).toBeVisible({ timeout: 30_000 });
  await saveEvidenceScreenshot(page, 'lab-03', 'user-management', projectName, 'password-reset-success');

  // Confirm the reset actually forces a change (separate browser context = separate cookie jar,
  // proving BR-26's session revocation isn't accidentally masked by a stale cookie on this page).
  const freshContext = await page.context().browser()?.newContext();
  if (!freshContext) throw new Error('Could not open a fresh browser context.');
  const freshPage = await freshContext.newPage();
  await freshPage.goto('/login');
  await freshPage.getByLabel('Email address', { exact: true }).fill(uniqueEmail);
  await freshPage.getByLabel('Password', { exact: true }).fill('ResetPass!2');
  await freshPage.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(freshPage).toHaveURL(/\/change-password$/, { timeout: 30_000 });
  await freshContext.close();

  // Clear the search box -- it's still holding `displayName` from the fill() above, and the
  // list stays filtered on it (fetchUsers ANDs `q` with `role`), which would otherwise hide
  // every row below that isn't the fixture user (System Admin included).
  await page.getByPlaceholder('Search users…', { exact: true }).fill('');
  await expect(page.getByRole('button', { name: `Edit ${ADMIN.displayName}`, exact: false })).toBeVisible({
    timeout: 30_000,
  });

  // AC-28: an Administrator cannot deactivate their own account. The Deactivate button is
  // disabled and carries the reason as a `title` tooltip attribute, never as visible DOM text --
  // AdminUserManagementPage.tsx's isSelf/isLastActiveAdmin ternary always resolves to the isSelf
  // message first whenever the editor is looking at their own row, which is exactly why AC-29
  // below can't be exercised through this same button (see comment there).
  await page.getByRole('button', { name: `Edit ${ADMIN.displayName}`, exact: false }).click();
  const selfDeactivateButton = page.getByRole('button', { name: 'Deactivate User', exact: true });
  await expect(selfDeactivateButton).toBeDisabled();
  await expect(selfDeactivateButton).toHaveAttribute('title', 'You cannot deactivate your own account');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  // AC-29: last-Administrator protection. Create a second, disposable admin (seed.ts has only
  // one ADMINISTRATOR row) so the real seed admin is never the sole administrator at risk before
  // this point, then deactivate the second admin to bring the active-admin count down from 2 to
  // exactly 1 (ADMIN).
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await page.getByLabel('Full Name', { exact: true }).fill(secondAdminName);
  await page.getByLabel('Email Address', { exact: true }).fill(`e2e.admin2.${Date.now()}@toktickit.local`);
  await page.getByLabel('Role', { exact: true }).selectOption({ label: 'Administrator' });
  await page.getByLabel('Initial Password', { exact: true }).fill('SecondAdmin!1');
  await page.getByRole('button', { name: 'Save User', exact: true }).click();
  await expect(page.getByText('User created', { exact: false })).toBeVisible({ timeout: 30_000 });

  // Deactivating a *different* admin while 2 are active is allowed (not the last one) -- this
  // confirms the guard is count-sensitive, not a blanket "can't deactivate any admin" rule.
  // Note: a Deactivate/Activate click's success message is "User deactivated"/"User activated"
  // (handleToggleActive), NOT the generic "User updated" the Save User form shows -- those are
  // two different code paths with two different success strings.
  await page.getByRole('button', { name: `Edit ${secondAdminName}`, exact: false }).click();
  await page.getByRole('button', { name: 'Deactivate User', exact: true }).click();
  await expect(page.getByText('User deactivated', { exact: false })).toBeVisible({ timeout: 30_000 });

  // ADMIN is now the sole active Administrator. Because isSelf always wins the Deactivate
  // button's title for a self-edit (AC-28 above), the last-admin message can never actually
  // surface through that button when target === actor -- the only way to observe it for real is
  // to attempt changing your OWN role away from Administrator while staying active. That does
  // NOT trip the self-deactivation guard (server-side: `!isActive && target.id === req.user!.id`
  // only fires on deactivation, not a plain role change), so it falls through to the
  // wouldLoseAdmin / LAST_ADMIN_PROTECTED check in adminUsers.ts's PATCH handler, exercising the
  // real end-to-end guard instead of a button state that structurally can't reach this message.
  await page.getByRole('button', { name: `Edit ${ADMIN.displayName}`, exact: false }).click();
  await page.getByLabel('Role', { exact: true }).selectOption({ label: 'Requester' });
  await page.getByRole('button', { name: 'Save User', exact: true }).click();
  await expect(
    page.getByText('At least one active Administrator is required', { exact: false }),
  ).toBeVisible({ timeout: 30_000 });
  await saveEvidenceScreenshot(page, 'lab-03', 'user-management', projectName, 'last-admin-protected');

  // Rejected server-side, so nothing actually changed -- confirm ADMIN is still an active
  // Administrator before moving on.
  const adminRow = page.locator('tr', { hasText: ADMIN.displayName });
  await expect(adminRow).toContainText('Administrator');
  await expect(adminRow).toContainText('Active');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  // Finish: role-filter list coverage (AC-25) and final cleanup -- deactivate the original
  // fixture user created above. The role-filter <select>'s accessible name is its own
  // aria-label="Role filter" -- "Any role" is only the visible text of its default <option>, not
  // an accessible name Playwright's getByLabel would match.
  await page.getByLabel('Role filter', { exact: false }).selectOption({ label: 'IT Staff' });
  // The list row now renders once in a desktop table and once in a mobile card
  // (AdminUserManagementPage.tsx, CSS-only toggled like MyTicketsPage/StaffTicketQueuePage) --
  // getByText matches the DOM directly and would resolve the CSS-hidden branch too on a narrow
  // viewport, tripping strict mode; the Edit button's accessible name carries the same text and
  // role locators exclude CSS-hidden elements from the accessibility tree.
  await expect(page.getByRole('button', { name: `Edit ${displayName} (edited)`, exact: false })).toBeVisible();
  await saveEvidenceScreenshot(page, 'lab-03', 'user-management', projectName, 'role-filter-it-staff');
  await assertNoHorizontalOverflow(page, 'User Management (role filter)');

  await page.getByRole('button', { name: `Edit ${displayName} (edited)`, exact: false }).click();
  await page.getByRole('button', { name: 'Deactivate User', exact: true }).click();
  await expect(page.getByText('User deactivated', { exact: false })).toBeVisible({ timeout: 30_000 });
});
