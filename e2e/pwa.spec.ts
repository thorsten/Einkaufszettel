import { expect, test } from '@playwright/test';
import { gotoFresh } from './_helpers';

test('manifest.webmanifest is reachable and has required fields', async ({ page }) => {
  await page.goto('/');
  const res = await page.request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);
  const manifest = (await res.json()) as Record<string, unknown>;
  expect(manifest.name).toBeTruthy();
  expect(manifest.short_name).toBeTruthy();
  expect(manifest.start_url).toBeTruthy();
  expect(manifest.display).toBe('standalone');
  expect(manifest.theme_color).toBeTruthy();
  expect(Array.isArray(manifest.icons)).toBe(true);
  expect((manifest.icons as unknown[]).length).toBeGreaterThan(0);
});

test('apple-touch-icon link present in HTML', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('link[rel="apple-touch-icon"]');
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute('href', /\.svg$|\.png$/);
});

test('theme-color meta tag present', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
});

test('apple-mobile-web-app-capable meta present (iOS install hint)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
    'content',
    'yes',
  );
});

test('viewport meta enables mobile rendering', async ({ page }) => {
  await page.goto('/');
  const content = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(content).toMatch(/width=device-width/);
});

test('service worker registers (chromium only — webkit headless quirky)', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'SW registration in headless webkit is unreliable');
  await gotoFresh(page);
  const registered = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    return Boolean(reg);
  });
  expect(registered).toBe(true);
});

test('rendered page exposes h1 and main landmark for assistive tech', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('main')).toBeVisible();
});
