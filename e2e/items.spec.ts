import { expect, test } from '@playwright/test';
import { addItem, gotoFresh, itemByName } from './_helpers';

test.beforeEach(async ({ page }) => {
  await gotoFresh(page);
});

test('shows version badge in header', async ({ page }) => {
  const badge = page.locator('[data-version]');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText(/^v\d+\.\d+\.\d+$/);
});

test('empty state visible on first load', async ({ page }) => {
  await expect(page.getByText(/Noch keine Artikel|No items yet/)).toBeVisible();
});

test('add an item', async ({ page }) => {
  await addItem(page, 'Milch', '1 L');
  await expect(page.locator('[data-item]')).toHaveCount(1);
  const li = itemByName(page, 'Milch');
  await expect(li).toContainText('Milch');
  await expect(li).toContainText('1 L');
});

test('add multiple items', async ({ page }) => {
  await addItem(page, 'Milch');
  await addItem(page, 'Brot');
  await addItem(page, 'Käse');
  await expect(page.locator('[data-item]')).toHaveCount(3);
});

test('toggle done strikes through', async ({ page }) => {
  await addItem(page, 'Brot');
  const li = itemByName(page, 'Brot');
  await li.locator('[data-action="toggle"]').check();
  await expect(li.locator('span', { hasText: 'Brot' }).first()).toHaveClass(/line-through/);
});

test('edit in place renames item', async ({ page }) => {
  await addItem(page, 'Brot');
  const li = itemByName(page, 'Brot');
  await li.locator('[data-action="edit"]').click();
  const form = page.locator('[data-form="edit"]');
  await expect(form).toBeVisible();
  await form.locator('input[name="name"]').fill('Vollkornbrot');
  await form.locator('button[type="submit"]').click();
  await expect(page.getByText('Vollkornbrot')).toBeVisible();
  await expect(page.locator('text=^Brot$')).toHaveCount(0);
});

test('cancel edit keeps original', async ({ page }) => {
  await addItem(page, 'Brot');
  const li = itemByName(page, 'Brot');
  await li.locator('[data-action="edit"]').click();
  await page.locator('[data-form="edit"] input[name="name"]').fill('NIE');
  await page.locator('[data-action="cancel-edit"]').click();
  await expect(page.locator('[data-form="edit"]')).toHaveCount(0);
  await expect(itemByName(page, 'Brot')).toBeVisible();
});

test('delete tombstones item (hidden from list)', async ({ page }) => {
  await addItem(page, 'Brot');
  await itemByName(page, 'Brot').locator('[data-action="delete"]').click();
  await expect(page.locator('[data-item]')).toHaveCount(0);
});

test('clear-checked button removes all done items in active shop', async ({ page }) => {
  await addItem(page, 'A');
  await addItem(page, 'B');
  await addItem(page, 'C');
  await itemByName(page, 'A').locator('[data-action="toggle"]').check();
  await itemByName(page, 'C').locator('[data-action="toggle"]').check();
  await page.locator('[data-action="clear-checked"]').click();
  await expect(page.locator('[data-item]')).toHaveCount(1);
  await expect(itemByName(page, 'B')).toBeVisible();
});

test('undo restores after delete', async ({ page }) => {
  await addItem(page, 'Brot');
  await itemByName(page, 'Brot').locator('[data-action="delete"]').click();
  await expect(page.locator('[data-item]')).toHaveCount(0);
  await page.locator('[data-action="undo"]').click();
  await expect(itemByName(page, 'Brot')).toBeVisible();
});

test('undo restores after add', async ({ page }) => {
  await addItem(page, 'Milch');
  await page.locator('[data-action="undo"]').click();
  await expect(page.locator('[data-item]')).toHaveCount(0);
});

test('escapes HTML in item name', async ({ page }) => {
  await addItem(page, '<script>alert(1)</script>');
  await expect(page.locator('[data-item] script')).toHaveCount(0);
  await expect(page.getByText('<script>alert(1)</script>')).toBeVisible();
});
