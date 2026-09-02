import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

// Matches server/prisma/seed.ts -- the two active Development Requesters used to prove
// per-requester isolation (AC-11/AC-12/AC-18 in docs/lab-02/specification.md).
const ACTIVE_REQUESTER = 'Nattapong R.';
const SWITCHED_REQUESTER = 'Siriporn K.';
const INITIAL_ATTACHMENT = 'initial-evidence.pdf';

function pdfFile(name: string) {
  return {
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% TokTickIT Lab 2 E2E evidence\n'),
  };
}

// The desktop table row and mobile card for the same Ticket both exist in the DOM at once
// (CSS-only `d-none d-md-table` / `d-md-none` toggle, not a resize listener) so any locator that
// matches "the row/card for this Ticket" always returns two elements. Only one is actually
// visible for the current viewport -- click that one.
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

async function expectVisible(locator: Locator, message: string): Promise<void> {
  await expect
    .poll(
      async () => {
        const candidates = await locator.all();
        for (const candidate of candidates) {
          if (await candidate.isVisible()) return true;
        }
        return false;
      },
      { message, timeout: 30_000 },
    )
    .toBe(true);
}

async function assertNoHorizontalOverflow(page: Page, location: string): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    dimensions.scrollWidth,
    `${location} overflows horizontally at ${dimensions.innerWidth}px`,
  ).toBeLessThanOrEqual(dimensions.innerWidth + 1);
}

async function saveEvidenceScreenshot(page: Page, group: string, projectName: string, name: string): Promise<void> {
  const directory = path.resolve('artifacts/lab-02/screenshots', group);
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${projectName}-${name}.png`), fullPage: true });
}

// The primary nav (My Tickets, Create Ticket) collapses behind a navbar-toggler below the md
// (768px) breakpoint (ui-spec.md §2 mobile navigation rule) -- on the mobile project the link is
// in the DOM but not visible until the toggler is opened first.
async function clickNavLink(page: Page, name: string): Promise<void> {
  const link = page.getByLabel('Main navigation', { exact: true }).getByRole('link', { name, exact: true });
  if (!(await link.isVisible())) {
    await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
    await expect(link).toBeVisible();
  }
  await link.click();
}

async function selectRequester(page: Page, requester: string): Promise<void> {
  const selector = page.getByLabel('Development Requester', { exact: true });
  await expect(selector).toBeVisible();
  await selector.selectOption({ label: requester });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Tickets', level: 1 })).toBeVisible();
}

test('requester can create, find, inspect, upload, remove, and isolate a Ticket', async ({ page }, testInfo) => {
  const projectName = testInfo.project.name;
  const runToken = `${Date.now()}-${projectName}`;
  const summary = `E2E requester flow ${runToken}`;
  const description = `Lab 2 E2E integration evidence generated for ${runToken}.`;
  const followUpAttachment = `follow-up-${projectName}.pdf`;

  // --- Select a Development Requester -------------------------------------------------------
  await page.goto('/select-requester');
  await expect(page.getByRole('heading', { name: 'Select Development Requester', level: 1 })).toBeVisible();
  const requesterSelector = page.getByLabel('Development Requester', { exact: true });
  await expect(requesterSelector.locator('option')).toHaveCount(5, { timeout: 30_000 }); // placeholder + 4 active
  const requesterOptionLabels = await requesterSelector.locator('option').allTextContents();
  expect(requesterOptionLabels.some((label) => label.includes('inactive'))).toBe(false);
  await saveEvidenceScreenshot(page, 'select-requester', projectName, 'initial');
  await assertNoHorizontalOverflow(page, 'Select Requester');

  await selectRequester(page, ACTIVE_REQUESTER);
  await expect(page.getByText(`Testing as: ${ACTIVE_REQUESTER}`, { exact: true })).toBeVisible();
  await assertNoHorizontalOverflow(page, 'My Tickets (initial)');

  // --- Create a Ticket, with an attachment --------------------------------------------------
  await clickNavLink(page, 'Create Ticket');
  await expect(page.getByRole('heading', { name: 'Create Ticket', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Category')).toBeEnabled({ timeout: 30_000 });

  const attachmentsInput = page.getByLabel('Attachments', { exact: true });
  await attachmentsInput.setInputFiles(pdfFile(INITIAL_ATTACHMENT));
  await expect(page.getByText(INITIAL_ATTACHMENT, { exact: true })).toBeVisible();

  await page.getByLabel('Category').selectOption({ label: 'Hardware' });
  await page.getByLabel('Related System').selectOption({ label: 'Corporate Laptop' });
  await page.getByLabel('Summary', { exact: true }).fill(summary);
  await page.getByLabel('Description', { exact: true }).fill(description);
  await saveEvidenceScreenshot(page, 'create-ticket', projectName, 'filled');
  await assertNoHorizontalOverflow(page, 'Create Ticket (filled)');

  await page.getByRole('button', { name: 'Create Ticket', exact: true }).click();

  // Submit navigates straight to the new Ticket's detail page (no separate success screen) --
  // the heading becomes the server-assigned Ticket Number once creation and the attachment
  // upload both finish.
  await page.waitForURL(/\/tickets\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const ticketId = page.url().split('/').pop() ?? '';
  const ticketHeading = page.getByRole('heading', { level: 1 });
  await expect(ticketHeading).toHaveText(/^TKT-/, { timeout: 30_000 });
  const ticketNumber = (await ticketHeading.textContent())?.trim() ?? '';
  expect(ticketNumber).toMatch(/^TKT-\d{4}-\d+$/);

  await expect(page.getByText(summary, { exact: true })).toBeVisible();
  await expect(page.getByText(INITIAL_ATTACHMENT, { exact: true })).toBeVisible();
  await saveEvidenceScreenshot(page, 'ticket-detail', projectName, 'initial');
  await assertNoHorizontalOverflow(page, 'Ticket Detail (initial)');

  // --- Find it in My Tickets ------------------------------------------------------------------
  await clickNavLink(page, 'My Tickets');
  await expect(page.getByRole('heading', { name: 'My Tickets', level: 1 })).toBeVisible();
  await page.getByLabel('Search', { exact: true }).fill(summary);
  await expectVisible(
    page.getByRole('button').filter({ hasText: ticketNumber }),
    `Ticket ${ticketNumber} should be visible in My Tickets after searching for its summary.`,
  );
  await saveEvidenceScreenshot(page, 'my-tickets', projectName, 'filtered');
  await assertNoHorizontalOverflow(page, 'My Tickets (filtered)');

  // --- Open its detail -------------------------------------------------------------------------
  await clickVisible(page.getByRole('button').filter({ hasText: ticketNumber }));
  await expect(page.getByRole('heading', { name: ticketNumber, level: 1 })).toBeVisible();

  // --- Upload another attachment ---------------------------------------------------------------
  await page.getByLabel('Add attachment', { exact: true }).setInputFiles(pdfFile(followUpAttachment));
  await expect(page.getByText(followUpAttachment, { exact: true })).toBeVisible({ timeout: 30_000 });
  const followUpRow = page.locator('li', { hasText: followUpAttachment });
  await expect(followUpRow.getByRole('link', { name: 'Download', exact: true })).toBeVisible();
  await saveEvidenceScreenshot(page, 'ticket-detail', projectName, 'active-attachment');

  // --- Remove an attachment, with a reason ------------------------------------------------------
  await followUpRow.getByRole('button', { name: 'Remove', exact: true }).click();
  const removalDialog = page.getByRole('dialog', { name: `Remove ${followUpAttachment}` });
  await expect(removalDialog).toBeVisible();
  await removalDialog.getByLabel('Reason for removal', { exact: true }).fill('Duplicate follow-up evidence');
  await removalDialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(removalDialog).toBeHidden();
  await expect(followUpRow.locator('.badge.badge-tone-neutral')).toBeVisible();
  await expect(followUpRow.getByText('Duplicate follow-up evidence', { exact: false })).toBeVisible();
  await expect(followUpRow.getByRole('link', { name: 'Download', exact: true })).toHaveCount(0);
  await saveEvidenceScreenshot(page, 'ticket-detail', projectName, 'removed-attachment');
  await assertNoHorizontalOverflow(page, 'Ticket Detail (removed attachment)');

  // --- Switch to a different requester and confirm isolation -----------------------------------
  await page.getByRole('button', { name: 'Change Requester', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Select Development Requester', level: 1 })).toBeVisible();
  await selectRequester(page, SWITCHED_REQUESTER);
  await expect(page.getByText(`Testing as: ${SWITCHED_REQUESTER}`, { exact: true })).toBeVisible();

  await page.getByLabel('Search', { exact: true }).fill(summary);
  await expect(page.getByText('No tickets match your filters.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await saveEvidenceScreenshot(page, 'my-tickets', projectName, 'isolated-empty');
  await assertNoHorizontalOverflow(page, 'My Tickets (switched requester, isolated)');

  // Direct navigation to the first requester's Ticket must not leak it to the new requester.
  await page.goto(`/tickets/${ticketId}`);
  await expect(page.getByText('Ticket not found.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await saveEvidenceScreenshot(page, 'ticket-detail', projectName, 'foreign-not-found');
  await assertNoHorizontalOverflow(page, 'Ticket Detail (foreign, not found)');
});
