import { expect, test } from '@playwright/test';
import { addItem, gotoFresh } from './_helpers';

test.beforeEach(async ({ page }) => {
  await gotoFresh(page);
});

test('search filters items by name', async ({ page }) => {
  await addItem(page, 'Milch');
  await addItem(page, 'Brot');
  await addItem(page, 'Mineralwasser');

  await page.fill('[data-input="search"]', 'mi');
  await expect(page.locator('[data-item]')).toHaveCount(2);
  await expect(page.getByText('Brot')).toHaveCount(0);
});

test('search shows no-results message when nothing matches', async ({ page }) => {
  await addItem(page, 'Milch');
  await page.fill('[data-input="search"]', 'banane');
  await expect(page.getByText(/Keine Treffer|No matches/)).toBeVisible();
});

test('clearing search shows all items again', async ({ page }) => {
  await addItem(page, 'Milch');
  await addItem(page, 'Brot');
  await page.fill('[data-input="search"]', 'mi');
  await expect(page.locator('[data-item]')).toHaveCount(1);
  await page.fill('[data-input="search"]', '');
  await expect(page.locator('[data-item]')).toHaveCount(2);
});

test('items are grouped by category when present', async ({ page }) => {
  await addItem(page, 'Apfel', undefined, 'Obst');
  await addItem(page, 'Banane', undefined, 'Obst');
  await addItem(page, 'Brot', undefined, 'Backwaren');
  // Two distinct group headers visible
  await expect(page.locator('h2', { hasText: 'Obst' })).toBeVisible();
  await expect(page.locator('h2', { hasText: 'Backwaren' })).toBeVisible();
});

test('items without category appear in fallback group', async ({ page }) => {
  await addItem(page, 'Apfel', undefined, 'Obst');
  await addItem(page, 'Sonstiger');
  await expect(page.locator('h2', { hasText: 'Obst' })).toBeVisible();
  await expect(page.locator('h2', { hasText: /Sonstiges|Other/ })).toBeVisible();
});

test('autocomplete datalist contains previously added names', async ({ page }) => {
  await addItem(page, 'Milch');
  await addItem(page, 'Milchreis');
  await expect(page.locator('#suggestions-list option[value="Milch"]')).toHaveCount(1);
  await expect(page.locator('#suggestions-list option[value="Milchreis"]')).toHaveCount(1);
});
