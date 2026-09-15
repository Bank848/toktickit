import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';

export async function saveEvidenceScreenshot(
  page: Page,
  lab: 'lab-02' | 'lab-03',
  group: string,
  projectName: string,
  name: string,
): Promise<void> {
  const directory = path.resolve(`artifacts/${lab}/screenshots`, group);
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${projectName}-${name}.png`), fullPage: true });
}

export async function assertNoHorizontalOverflow(page: Page, location: string): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    dimensions.scrollWidth,
    `${location} overflows horizontally at ${dimensions.innerWidth}px`,
  ).toBeLessThanOrEqual(dimensions.innerWidth + 1);
}
