import { expect, test } from '@playwright/test';

test.describe('Aviation Readiness workspace', () => {
  test('loads the Aviation page with the professional command layout', async ({ page }) => {
    await page.goto('/#/aviation-travel-readiness');

    await expect(page.getByRole('heading', { name: 'Aviation Readiness' })).toBeVisible();
    await expect(page.getByText('Plan, scan, assess risk, and produce executive-ready trip materials')).toBeVisible();
    await expect(page.getByLabel('Current aviation workspace summary')).toContainText('Controlled pilot');
    await expect(page.getByRole('navigation', { name: 'Aviation operations navigation' })).toBeVisible();
    await expect(page.getByRole('button', { name: /01\s+Overview\s+Command summary/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Operational Workflow' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trips Requiring Attention' })).toBeVisible();
  });

  test('switches between Aviation tabs', async ({ page }) => {
    await page.goto('/#/aviation-travel-readiness');

    await page.getByRole('button', { name: /02\s+Plan\s+Trip setup/i }).click();
    await expect(page.getByRole('heading', { name: /Trip Planner|Plan/i })).toBeVisible();

    await page.getByRole('button', { name: /04\s+Risk\s+Score & actions/i }).click();
    await expect(page.getByText(/No selected airport|Risk/i)).toBeVisible();

    await page.getByRole('button', { name: /01\s+Overview\s+Command summary/i }).click();
    await expect(page.getByRole('heading', { name: 'Operational Workflow' })).toBeVisible();
  });
});
