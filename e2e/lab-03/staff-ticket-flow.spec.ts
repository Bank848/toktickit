import { expect, test, type Locator, type Page } from '@playwright/test';
import { saveEvidenceScreenshot, assertNoHorizontalOverflow } from '../support/evidence';

// Fixture emails/password confirmed against Task 3's real server/prisma/seed.ts (Issue #35).
// itstaff@toktickit.local's displayName ("IT Support") is confirmed against seed.ts too -- the
// Ticket Owner <select> lists each assignable owner's displayName, there is no separate
// "Claim for myself" option (StaffTicketDetailPage.tsx).
const REQUESTER = { email: 'requester@toktickit.local', password: 'DevPass123!' };
const REQUESTER_2 = { email: 'requester2@toktickit.local', password: 'DevPass123!' };
const IT_STAFF = { email: 'itstaff@toktickit.local', password: 'DevPass123!', displayName: 'IT Support' };

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

// StaffTicketQueuePage/MyTicketsPage render the same row twice at all times -- a desktop
// `<table>` (`d-none d-md-block`) and a mobile stacked-card list (`d-md-none`), both present in
// the DOM regardless of viewport (CSS-only toggle, not a resize listener, per those pages'
// comments). `getByRole('button').filter({ hasText })` always matches both; only one is actually
// visible for the current project. Copied from e2e/lab-02/requester-ticket-flow.spec.ts.
async function clickVisible(locator: Locator): Promise<void> {
  const candidates = await locator.all();
  for (const candidate of candidates) {
    if (await candidate.isVisible()) {
      await candidate.click();
      return;
    }
  }
  throw new Error('No visible matching element was found.');
}

// Scopes to the `data-testid="ticket-status-badge"` wrapper around the header's
// <TicketStatusBadge/> on StaffTicketDetailPage.tsx, reading the badge's visible label text
// (TicketStatusBadge.tsx's STATUS_META).
function statusParagraph(page: Page): Locator {
  return page.getByTestId('ticket-status-badge');
}

// The queue/list search boxes debounce 300ms (SEARCH_DEBOUNCE_MS in
// StaffTicketQueuePage.tsx/MyTicketsPage.tsx) before re-fetching with the `q` filter applied --
// filling the box and immediately screenshotting/asserting races that debounce and usually wins
// (row order puts a just-created ticket first anyway), but it is not reliable: when this suite's
// shared dev database already holds another long-summary ticket row from an earlier project's
// run in the same `playwright test` invocation, the still-unfiltered table can be wide enough to
// overflow the 834px tablet viewport for the brief instant before the filtered re-fetch lands.
// Waiting for that request's response makes "filtered" screenshots/overflow-checks deterministic.
async function searchAndWaitForFilter(page: Page, apiPathSegment: string, query: string): Promise<void> {
  const filtered = page.waitForResponse(
    (response) =>
      response.url().includes(apiPathSegment) &&
      response.url().includes(`q=${query}`) &&
      response.status() === 200,
  );
  await page.getByLabel('Search', { exact: true }).fill(query);
  await filtered;
}

test('IT Staff claims, works, and resolves a ticket; Requester sees comments but never notes', async ({
  page,
}, testInfo) => {
  const projectName = testInfo.project.name;
  const summary = `Lab 3 staff flow ${Date.now()}-${projectName}`;

  // --- Requester creates the fixture ticket this journey needs ------------------------------
  await login(page, REQUESTER);
  await page.goto('/tickets/new');
  await page.getByLabel('Category').selectOption({ label: 'Hardware' });
  await page.getByLabel('Related System').selectOption({ index: 1 });
  await page.getByLabel('Summary', { exact: true }).fill(summary);
  await page.getByLabel('Description', { exact: true }).fill('Staff-flow E2E fixture ticket.');
  await page.getByRole('button', { name: 'Create Ticket', exact: true }).click();
  await page.waitForURL(/\/tickets\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const ticketId = page.url().split('/').pop() ?? '';
  const ticketHeading = page.getByRole('heading', { level: 1 });
  await expect(ticketHeading).toHaveText(/^TKT-/, { timeout: 30_000 });
  const ticketNumber = (await ticketHeading.textContent())?.trim() ?? '';
  await logout(page);

  // --- IT Staff finds the ticket in the queue and claims it (AC-17, AC-18) ------------------
  await login(page, IT_STAFF);
  await page.goto('/staff/tickets');
  await expect(page.getByRole('heading', { name: 'My Queue' })).toBeVisible();
  // The queue's search field is labelled "Search" -- "Search by ticket number or summary" is
  // only the input's placeholder text, not its accessible label.
  await searchAndWaitForFilter(page, '/api/v1/staff/tickets', ticketNumber);
  await saveEvidenceScreenshot(page, 'lab-03', 'staff-queue', projectName, 'filtered');
  await assertNoHorizontalOverflow(page, 'Staff Ticket Queue (filtered)');

  await clickVisible(page.getByRole('button').filter({ hasText: ticketNumber }));
  await expect(page).toHaveURL(/\/staff\/tickets\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  // Wait for the detail page's own settled content before screenshotting -- a URL match alone
  // races the client-side route transition's first paint, and previously caught the outgoing
  // queue page (or a mid-fetch loading state) instead of the ticket detail screen.
  await expect(page.getByLabel('Ticket Owner', { exact: true })).toBeVisible({ timeout: 30_000 });
  await saveEvidenceScreenshot(page, 'lab-03', 'staff-ticket-detail', projectName, 'unowned-new');

  // AC-18: status select is disabled pre-claim (NEW, unowned).
  await expect(page.getByLabel('Current Status', { exact: true })).toBeDisabled();

  // AC-17: claiming sets owner AND flips status to OPEN, one action. There is no "Ticket
  // claimed" toast on the real page -- assert the actual visible state change instead: the
  // status select becomes enabled and the Status paragraph shows "Open".
  await page.getByLabel('Ticket Owner', { exact: true }).selectOption({ label: IT_STAFF.displayName });
  await expect(page.getByLabel('Current Status', { exact: true })).not.toBeDisabled({ timeout: 30_000 });
  await expect(statusParagraph(page)).toContainText('Open');

  // --- Priority change, status walk OPEN -> IN_PROGRESS -> RESOLVED -> REOPENED (AC-19, AC-21) --
  // IT Priority's <option> text is a humanized label (PriorityBadge's PRIORITY_META), not the
  // raw enum -- there is no "Saved" toast either, so assert the select's own value instead.
  await page.getByLabel('IT Priority', { exact: true }).selectOption({ label: 'High' });
  await expect(page.getByLabel('IT Priority', { exact: true })).toHaveValue('HIGH');

  // Current Status's <option> text is likewise a humanized label (TicketStatusBadge's STATUS_META).
  await page.getByLabel('Current Status', { exact: true }).selectOption({ label: 'In Progress' });
  await expect(statusParagraph(page)).toContainText('In Progress');

  // --- Public comment + internal note (AC-22, AC-23) -----------------------------------------
  // Both sections are always-visible on StaffTicketDetailPage.tsx -- there is no tab UI and
  // nothing to click to switch between them.
  await page.getByPlaceholder('Type your comment here…').fill('Staff public comment for E2E.');
  await page.getByRole('button', { name: 'Post Comment', exact: true }).click();
  await expect(page.getByText('Staff public comment for E2E.', { exact: false })).toBeVisible();

  await expect(page.getByText('Internal — visible only to IT Staff and Administrators')).toBeVisible();
  await page.getByPlaceholder('Write an internal note…').fill('Internal-only note for E2E.');
  await page.getByRole('button', { name: 'Add Internal Note', exact: true }).click();
  await expect(page.getByText('Internal-only note for E2E.', { exact: false })).toBeVisible();
  await saveEvidenceScreenshot(page, 'lab-03', 'staff-ticket-detail', projectName, 'notes-and-comments');

  await page.getByLabel('Current Status', { exact: true }).selectOption({ label: 'Resolved' });
  await expect(statusParagraph(page)).toContainText('Resolved');

  // AC-21: RESOLVED -> REOPENED succeeds.
  await page.getByLabel('Current Status', { exact: true }).selectOption({ label: 'Reopened' });
  await expect(statusParagraph(page)).toContainText('Reopened');
  await logout(page);

  // --- A different Requester still gets D-24's 404, never a "not yours" message (AC-03/BR-22) --
  await login(page, REQUESTER_2);
  await page.goto(`/tickets/${ticketId}`);
  await expect(page.getByText('Ticket not found.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await logout(page);

  // --- The owning Requester sees the Public Comment but never the Internal Note (AC-13, AC-24, BR-04) --
  await login(page, REQUESTER);
  await page.goto('/tickets');
  await searchAndWaitForFilter(page, '/api/v1/tickets', ticketNumber);
  await clickVisible(page.getByRole('button').filter({ hasText: ticketNumber }));
  await expect(page.getByText('Staff public comment for E2E.', { exact: false })).toBeVisible();
  await expect(page.getByText('Internal-only note for E2E.', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Internal Notes', { exact: false })).toHaveCount(0);
  await saveEvidenceScreenshot(page, 'lab-03', 'staff-ticket-detail', projectName, 'requester-view-no-notes');
  await assertNoHorizontalOverflow(page, 'Requester Ticket Detail (post staff flow)');

  // AC-14/A-08 (E2E-03): posting with "problem appears resolved" checked stores the
  // fixed server-controlled prefix, and the UI renders a flagged tag while stripping the raw
  // marker text from the displayed body (client-side behavior confirmed unit-level in Task 16's
  // CommentSection.test.tsx; this proves it end-to-end against the real API).
  await page.getByPlaceholder('Type your comment here…').fill('Reconnects fine now, thanks!');
  await page.getByLabel('This also indicates the reported problem appears resolved', { exact: true }).check();
  await page.getByRole('button', { name: 'Post Comment', exact: true }).click();
  await expect(page.getByText('Reconnects fine now, thanks!', { exact: false })).toBeVisible({ timeout: 30_000 });
  // The static checkbox label ("This also indicates the reported problem appears resolved")
  // also matches a loose /problem appears resolved/i text search, so this must be scoped to the
  // flagged-comment badge's own exact text (CommentSection.tsx's "Problem Appears Resolved" tag),
  // not a page-wide text search.
  await expect(page.getByText('Problem Appears Resolved', { exact: true })).toBeVisible();
  await expect(page.getByText('[Requester marked:', { exact: false })).toHaveCount(0);
});
