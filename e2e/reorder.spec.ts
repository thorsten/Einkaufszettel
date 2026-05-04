import { expect, test } from '@playwright/test';
import { addItem, gotoFresh, itemByName } from './_helpers';

test.beforeEach(async ({ page }) => {
  await gotoFresh(page);
});

// Adding A then B then C makes C the top item (newest = lowest pos).
// Render order top → bottom: C, B, A.

test('move-down swaps with next neighbor', async ({ page }) => {
  await addItem(page, 'A');
  await addItem(page, 'B');
  await addItem(page, 'C');

  const orderBefore = await page.locator('[data-item] span').allTextContents();
  expect(orderBefore[0]).toContain('C');

  await itemByName(page, 'C').locator('[data-action="move-down"]').click();
  const orderAfter = await page.locator('[data-item] span').allTextContents();
  expect(orderAfter[0]).toContain('B');
  expect(orderAfter[1]).toContain('C');
});

test('move-up swaps with previous neighbor', async ({ page }) => {
  await addItem(page, 'A');
  await addItem(page, 'B');
  await addItem(page, 'C');
  // A is at bottom; move up → swaps with B
  await itemByName(page, 'A').locator('[data-action="move-up"]').click();
  const order = await page.locator('[data-item] span').allTextContents();
  const aIdx = order.findIndex((t) => t.includes('A'));
  const bIdx = order.findIndex((t) => t.includes('B'));
  expect(aIdx).toBeLessThan(bIdx);
});

test('move-up on top item is disabled', async ({ page }) => {
  await addItem(page, 'A');
  await addItem(page, 'B');
  const top = page.locator('[data-item]').first();
  await expect(top.locator('[data-action="move-up"]')).toBeDisabled();
});

test('move-down on bottom item is disabled', async ({ page }) => {
  await addItem(page, 'A');
  await addItem(page, 'B');
  const last = page.locator('[data-item]').last();
  await expect(last.locator('[data-action="move-down"]')).toBeDisabled();
});
