import { type Page, expect } from '@playwright/test';

export async function gotoFresh(page: Page, opts: { lang?: 'de' | 'en' } = {}): Promise<void> {
  await page.goto('/');
  const lang = opts.lang ?? 'de';
  await page.evaluate((lang) => {
    localStorage.clear();
    localStorage.setItem('einkaufszettel.lang', lang);
  }, lang);
  await page.reload();
  await expect(page.locator('h1')).toBeVisible();
}

export async function addItem(page: Page, name: string, qty?: string, cat?: string): Promise<void> {
  await page.fill('[data-form="add"] input[name="name"]', name);
  if (qty) await page.fill('[data-form="add"] input[name="qty"]', qty);
  if (cat) await page.fill('[data-form="add"] input[name="cat"]', cat);
  await page.locator('[data-form="add"] button[type="submit"]').click();
  await expect(page.locator('[data-form="add"] input[name="name"]')).toHaveValue('');
}

export function itemByName(page: Page, name: string) {
  return page.locator('[data-item]').filter({ hasText: name }).first();
}

export async function openSettings(page: Page): Promise<void> {
  await page.locator('[data-action="settings"]').click();
  await expect(page.locator('[data-settings-overlay]')).toBeVisible();
}

export async function closeSettings(page: Page): Promise<void> {
  await page.locator('[data-action="settings-close"]').click();
  await expect(page.locator('[data-settings-overlay]')).toHaveCount(0);
}
