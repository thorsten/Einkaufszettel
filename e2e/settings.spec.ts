import { expect, test } from '@playwright/test';
import { addItem, closeSettings, gotoFresh, openSettings } from './_helpers';

test.beforeEach(async ({ page }) => {
  await gotoFresh(page);
});

test('settings drawer opens and closes', async ({ page }) => {
  await openSettings(page);
  await closeSettings(page);
});

test('add custom shop', async ({ page }) => {
  await openSettings(page);
  await page.fill('[data-form="shop-add"] input[name="name"]', 'DM');
  await page.locator('[data-form="shop-add"] button[type="submit"]').click();
  await closeSettings(page);
  await expect(page.locator('[data-shop="DM"]')).toBeVisible();
});

test('rename shop migrates items', async ({ page }) => {
  await addItem(page, 'Milch');
  await openSettings(page);
  const input = page.locator('[data-shop-input="V-MARKT"]');
  await input.fill('V-Markt-Süd');
  await page.locator('[data-action="shop-rename"][data-shop-name="V-MARKT"]').click();
  await closeSettings(page);
  await expect(page.locator('[data-shop="V-Markt-Süd"]')).toBeVisible();
  await expect(page.getByText('Milch')).toBeVisible();
});

test('remove shop drops it (when not the last)', async ({ page }) => {
  await openSettings(page);
  await page.locator('[data-action="shop-remove"][data-shop-name="REWE"]').click();
  await closeSettings(page);
  await expect(page.locator('[data-shop="REWE"]')).toHaveCount(0);
});

test('save and apply a template', async ({ page }) => {
  await addItem(page, 'Milch');
  await addItem(page, 'Brot');
  await openSettings(page);
  await page.fill('[data-form="template-save"] input[name="name"]', 'Wochen');
  await page.locator('[data-form="template-save"] button[type="submit"]').click();
  await expect(
    page.locator('[data-action="template-apply"][data-template-name="Wochen"]'),
  ).toBeVisible();

  // wipe items, then apply template
  await closeSettings(page);
  // Use clear-checked path: mark all done and clear
  await page.locator('[data-item]').first().locator('[data-action="toggle"]').check();
  await page.locator('[data-item]').last().locator('[data-action="toggle"]').check();
  await page.locator('[data-action="clear-checked"]').click();
  await expect(page.locator('[data-item]')).toHaveCount(0);

  await openSettings(page);
  await page.locator('[data-action="template-apply"][data-template-name="Wochen"]').click();
  // settingsOpen flips off after apply
  await expect(page.locator('[data-item]')).toHaveCount(2);
  await expect(page.getByText('Milch')).toBeVisible();
  await expect(page.getByText('Brot')).toBeVisible();
});

test('remove template drops entry', async ({ page }) => {
  await addItem(page, 'X');
  await openSettings(page);
  await page.fill('[data-form="template-save"] input[name="name"]', 'T');
  await page.locator('[data-form="template-save"] button[type="submit"]').click();
  await page.locator('[data-action="template-remove"][data-template-name="T"]').click();
  await expect(page.locator('[data-action="template-apply"][data-template-name="T"]')).toHaveCount(
    0,
  );
});
