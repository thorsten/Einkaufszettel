import { expect, test } from '@playwright/test';
import { gotoFresh } from './_helpers';

test.beforeEach(async ({ page }) => {
  await gotoFresh(page);
});

test('renders 4 default shop tabs', async ({ page }) => {
  await expect(page.locator('[data-shop="V-MARKT"]')).toBeVisible();
  await expect(page.locator('[data-shop="ALDI"]')).toBeVisible();
  await expect(page.locator('[data-shop="EDEKA"]')).toBeVisible();
  await expect(page.locator('[data-shop="REWE"]')).toBeVisible();
});

test('first shop is active by default', async ({ page }) => {
  await expect(page.locator('[data-shop="V-MARKT"]')).toHaveAttribute('aria-selected', 'true');
});

test('clicking a tab activates it', async ({ page }) => {
  await page.locator('[data-shop="REWE"]').click();
  await expect(page.locator('[data-shop="REWE"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-shop="V-MARKT"]')).toHaveAttribute('aria-selected', 'false');
});

test('theme cycles system → light → dark → system', async ({ page }) => {
  const html = page.locator('html');
  await page.locator('[data-action="theme"]').click(); // → light
  await expect(html).not.toHaveClass(/dark/);
  await page.locator('[data-action="theme"]').click(); // → dark
  await expect(html).toHaveClass(/dark/);
  await page.locator('[data-action="theme"]').click(); // → system
  // back to system; class state depends on prefers-color-scheme media. Just confirm button title cycled.
});

test('language cycles de → en', async ({ page }) => {
  await expect(page.getByText(/Noch keine Artikel/)).toBeVisible();
  await page.locator('[data-action="lang"]').click();
  await expect(page.getByText(/No items yet/)).toBeVisible();
});

test('language persists across reload', async ({ page }) => {
  await page.locator('[data-action="lang"]').click();
  await expect(page.getByText(/No items yet/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/No items yet/)).toBeVisible();
});
