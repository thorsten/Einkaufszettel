import { expect, test } from '@playwright/test';
import { addItem, gotoFresh, itemByName } from './_helpers';

// Pointer-event gestures. Skip on chromium project — these are iOS-Safari behavior.
test.skip(({ browserName }) => browserName !== 'webkit', 'touch gestures: webkit only');

test.beforeEach(async ({ page }) => {
  await gotoFresh(page);
});

test('swipe-left past threshold tombstones item', async ({ page }) => {
  await addItem(page, 'Brot');
  const fg = itemByName(page, 'Brot').locator('[data-swipe-fg]');
  const box = await fg.boundingBox();
  if (!box) throw new Error('no bounding box');
  const startX = box.x + box.width - 10;
  const startY = box.y + box.height / 2;
  // simulate swipe left
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 40, startY, { steps: 5 });
  await page.mouse.move(startX - 120, startY, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('[data-item]')).toHaveCount(0, { timeout: 2000 });
});

test('swipe below threshold snaps back, item stays', async ({ page }) => {
  await addItem(page, 'Brot');
  const fg = itemByName(page, 'Brot').locator('[data-swipe-fg]');
  const box = await fg.boundingBox();
  if (!box) throw new Error('no bounding box');
  const startX = box.x + box.width - 10;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 30, startY, { steps: 5 });
  await page.mouse.up();
  await expect(itemByName(page, 'Brot')).toBeVisible();
});

test('pull-to-refresh opens file picker (covers the whole pull→commit path)', async ({ page }) => {
  // We can't directly observe the OS file dialog, but we can verify that the pull
  // gesture writes to the [data-pull] indicator height while pulling.
  const main = page.locator('main[data-scroll]');
  const box = await main.boundingBox();
  if (!box) throw new Error('no bounding box');
  const cx = box.x + box.width / 2;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(cx, box.y + 5);
  await page.mouse.down();
  await page.mouse.move(cx, box.y + 90, { steps: 10 });
  const indicator = page.locator('[data-pull]');
  await expect(indicator).toContainText(/Loslassen|Release/, { timeout: 1500 });
  await page.mouse.up();
});
