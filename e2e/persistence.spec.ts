import { expect, test } from '@playwright/test';
import { addItem, gotoFresh, itemByName } from './_helpers';

test.beforeEach(async ({ page }) => {
  await gotoFresh(page);
});

test('items survive reload (localStorage round-trip)', async ({ page }) => {
  await addItem(page, 'Milch', '1 L', 'Milch');
  await addItem(page, 'Brot');
  await page.reload();
  await expect(page.locator('[data-item]')).toHaveCount(2);
  await expect(itemByName(page, 'Milch')).toContainText('1 L');
});

test('checked state survives reload', async ({ page }) => {
  await addItem(page, 'Brot');
  await itemByName(page, 'Brot').locator('[data-action="toggle"]').check();
  await page.reload();
  await expect(itemByName(page, 'Brot').locator('[data-action="toggle"]')).toBeChecked();
});

test('theme choice survives reload', async ({ page }) => {
  await page.locator('[data-action="theme"]').click(); // → light
  await page.locator('[data-action="theme"]').click(); // → dark
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('custom shop survives reload', async ({ page }) => {
  await page.locator('[data-action="settings"]').click();
  await page.fill('[data-form="shop-add"] input[name="name"]', 'DM');
  await page.locator('[data-form="shop-add"] button[type="submit"]').click();
  await page.locator('[data-action="settings-close"]').click();
  await page.reload();
  await expect(page.locator('[data-shop="DM"]')).toBeVisible();
});

test('per-shop items isolated', async ({ page }) => {
  await addItem(page, 'Milch'); // V-MARKT (default first tab)
  await page.locator('[data-shop="REWE"]').click();
  await expect(page.locator('[data-item]')).toHaveCount(0);
  await addItem(page, 'Brot');
  await expect(page.locator('[data-item]')).toHaveCount(1);
  await page.locator('[data-shop="V-MARKT"]').click();
  await expect(page.locator('[data-item]')).toHaveCount(1);
  await expect(page.getByText('Milch')).toBeVisible();
});
