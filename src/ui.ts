import type { Lamport } from './clock';
import { attachPullToRefresh, attachSwipeLeft } from './gestures';
import { buildSuggestions, categoriesForShop } from './history';
import type { I18n } from './i18n';
import { maxLamport, maxPos, minPos, newItem } from './markdown';
import { shareMarkdown } from './share';
import type { ShopRegistry } from './shops';
import type { ListStore } from './storage';
import { buildShareUrl, shareConfigLink } from './config-link';
import type { SupabaseConfig, SupabaseSync, SyncStatus } from './supabase';
import { generateHouseholdId } from './sync-helpers';
import type { TemplateStore } from './templates';
import { THEME_ICON, type ThemeController } from './theme';
import { type Item, type Shop, type ShopLists, shopMeta } from './types';
import {
  escapeHtml,
  formatTime,
  groupByCategory,
  matchesSearch,
  sortForRender,
  visibleItems,
} from './ui-pure';
import type { UndoStack } from './undo';
import { VERSION } from './version';
import { isVoiceSupported, startVoice } from './voice';

export interface AppState {
  active: Shop;
  lists: ShopLists;
  theme: ThemeController;
  i18n: I18n;
  device: string;
  clock: Lamport;
  undo: UndoStack;
  shops: ShopRegistry;
  templates: TemplateStore;
  syncedAt?: number;
  editingId?: string;
  toast?: { label: string; expiresAt: number };
  search?: string;
  settingsOpen?: boolean;
  voiceActive?: boolean;
  supabaseConfig: SupabaseConfig;
  supabaseSync?: SupabaseSync | null;
  supabaseStatus: SyncStatus;
  onSupabaseSave?: (config: SupabaseConfig) => void;
}

const SVG_LANG = `<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14M9 8a8 8 0 0 0 6 13M9 21a8 8 0 0 1 6-13M3 12h18"/></svg>`;
const SVG_TRASH = `<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>`;
const SVG_PENCIL = `<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`;
const SVG_UP = `<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>`;
const SVG_DOWN = `<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;
const SVG_SETTINGS = `<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
const SVG_MIC = `<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`;
const SVG_SEARCH = `<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>`;

function stamp(state: AppState, existing?: Item): Pick<Item, 'ts' | 'lamport' | 'dev'> {
  if (existing) state.clock.observe(existing.lamport);
  return { ts: Date.now(), lamport: state.clock.tick(), dev: state.device };
}

function snapshotForUndo(state: AppState, label: string): void {
  state.undo.push(label, state.lists);
}

function showToast(state: AppState, label: string, ttlMs = 5000): void {
  state.toast = { label, expiresAt: Date.now() + ttlMs };
}

function clearStaleToast(state: AppState): void {
  if (state.toast && state.toast.expiresAt < Date.now()) state.toast = undefined;
}

function ensureShopBucket(state: AppState, shop: Shop): void {
  if (!state.lists[shop]) state.lists[shop] = [];
}

export function renderApp(root: HTMLElement, state: AppState, store: ListStore): void {
  clearStaleToast(state);
  ensureShopBucket(state, state.active);
  const t = state.i18n.t.bind(state.i18n);
  const items = visibleItems(state.lists[state.active] ?? []);
  const search = state.search ?? '';
  const filtered = items.filter((i) => matchesSearch(i, search));
  const hasChecked = items.some((i) => i.done);
  const shops = state.shops.shops;
  const suggestions = buildSuggestions(state.lists[state.active] ?? []);
  const cats = categoriesForShop(state.lists, state.active);
  const voiceOn = state.voiceActive ?? false;

  root.innerHTML = `
    <div class="flex min-h-dvh flex-col" data-app>
      <div data-pull class="pointer-events-none fixed inset-x-0 top-0 z-20 flex h-0 items-center justify-center overflow-hidden text-xs font-medium text-teal-700 transition-[height] dark:text-teal-200" aria-hidden="true">
        <span data-pull-label></span>
      </div>

      <header class="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
        <div class="mx-auto max-w-2xl px-4 pt-3 pb-2">
          <div class="flex items-center justify-between gap-2">
            <h1 class="flex items-baseline gap-1.5 text-lg font-bold tracking-tight">
              <span>${escapeHtml(t('title'))}</span>
              <span data-version class="text-[10px] font-medium text-slate-400 dark:text-slate-500" aria-label="Version ${escapeHtml(VERSION)}">v${escapeHtml(VERSION)}</span>
            </h1>
            <div class="flex flex-wrap items-center gap-1">
              <button data-action="theme" class="flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1.5 text-sm font-medium text-slate-700 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-200" aria-label="${escapeHtml(t('theme_aria'))}" title="${escapeHtml(t('theme_label'))}: ${escapeHtml(t('theme_' + state.theme.theme))}">${THEME_ICON[state.theme.theme]}<span class="hidden sm:inline">${escapeHtml(t('theme_' + state.theme.theme))}</span></button>
              <button data-action="lang" class="flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1.5 text-sm font-medium text-slate-700 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-200" aria-label="${escapeHtml(t('lang_aria'))}" title="${escapeHtml(t('lang_label'))}: ${escapeHtml(state.i18n.lang.toUpperCase())}">${SVG_LANG}<span class="hidden sm:inline">${escapeHtml(state.i18n.lang.toUpperCase())}</span></button>
              <button data-action="settings" class="flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1.5 text-sm font-medium text-slate-700 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-200" aria-label="${escapeHtml(t('settings_aria'))}" title="${escapeHtml(t('settings'))}">${SVG_SETTINGS}<span class="hidden sm:inline">${escapeHtml(t('settings'))}</span></button>
              <button data-action="export" class="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-200" aria-label="${escapeHtml(t('export_aria'))}">${escapeHtml(t('export'))}</button>
              <button data-action="sync" class="rounded-md bg-teal-100 px-3 py-1.5 text-sm font-medium text-teal-700 active:bg-teal-200 dark:bg-teal-900/40 dark:text-teal-200" aria-label="${escapeHtml(t('sync_aria'))}" title="${escapeHtml(t('sync_title'))}">${escapeHtml(t('sync'))}</button>
            </div>
          </div>
          <nav class="mt-3 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="${escapeHtml(t('shop_select'))}">
            ${shops.map((shop) => renderTab(shop, state)).join('')}
          </nav>
          <div class="mt-2 flex items-center gap-2">
            <label class="relative flex flex-1 items-center">
              <span class="pointer-events-none absolute left-2.5 text-slate-400 dark:text-slate-500">${SVG_SEARCH}</span>
              <input
                data-input="search"
                type="search"
                placeholder="${escapeHtml(t('search_placeholder'))}"
                value="${escapeHtml(search)}"
                class="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            ${
              hasChecked
                ? `<button data-action="clear-checked" class="rounded px-2 py-1 text-[11px] font-medium text-slate-600 active:text-teal-700 dark:text-slate-300 dark:active:text-teal-300">${escapeHtml(t('clear_checked'))}</button>`
                : ''
            }
          </div>
          ${state.syncedAt ? `<p class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">${escapeHtml(t('synced_at'))}: ${formatTime(state.syncedAt)}</p>` : ''}
        </div>
      </header>

      <main data-scroll class="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-32">
        <section aria-label="${escapeHtml(t('shop_list'))} ${escapeHtml(state.active)}">
          ${renderItemsSection(filtered, items, state)}
        </section>
      </main>

      ${renderToast(state)}
      ${state.settingsOpen ? renderSettings(state) : ''}

      <form data-form="add" class="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95" style="padding-bottom: env(safe-area-inset-bottom);">
        <datalist id="suggestions-list">
          ${suggestions
            .slice(0, 30)
            .map((s) => `<option value="${escapeHtml(s.name)}"></option>`)
            .join('')}
        </datalist>
        <datalist id="categories-list">
          ${cats.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('')}
        </datalist>
        <div class="mx-auto flex max-w-2xl flex-wrap items-center gap-2 px-4 py-3">
          <input
            name="name"
            type="text"
            list="suggestions-list"
            autocomplete="off"
            enterkeyhint="done"
            placeholder="${escapeHtml(t('add_placeholder'))}"
            class="min-w-0 flex-[2] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:border-slate-600 dark:bg-slate-800"
            required
          />
          <input name="qty" type="text" list="" autocomplete="off" inputmode="text" placeholder="${escapeHtml(t('qty_placeholder'))}" class="w-16 rounded-lg border border-slate-300 bg-white px-2 py-2.5 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:border-slate-600 dark:bg-slate-800" />
          <input name="cat" type="text" list="categories-list" autocomplete="off" placeholder="${escapeHtml(t('category_placeholder'))}" class="w-24 rounded-lg border border-slate-300 bg-white px-2 py-2.5 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:border-slate-600 dark:bg-slate-800" />
          <button type="button" data-action="voice" class="flex h-10 w-10 items-center justify-center rounded-lg ${voiceOn ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'} active:opacity-80" aria-label="${escapeHtml(t('voice_aria'))}" aria-pressed="${voiceOn}">${SVG_MIC}</button>
          <button type="submit" class="rounded-lg bg-teal-600 px-4 py-2.5 font-semibold text-white active:bg-teal-700" aria-label="${escapeHtml(t('add'))}">+</button>
        </div>
      </form>

      <input data-input="file" type="file" accept=".md,text/markdown,text/plain" class="hidden" />
    </div>
  `;
  bind(root, state, store);
}

function renderItemsSection(filtered: Item[], all: Item[], state: AppState): string {
  const t = state.i18n.t.bind(state.i18n);
  if (all.length === 0) {
    return `
      <div class="mt-12 text-center text-slate-500 dark:text-slate-400">
        <p class="text-base">${escapeHtml(t('empty_title'))}</p>
        <p class="mt-1 text-sm">${escapeHtml(t('empty_hint'))}</p>
      </div>
    `;
  }
  if (filtered.length === 0) {
    return `<div class="mt-12 text-center text-slate-500 dark:text-slate-400"><p>${escapeHtml(t('no_search_results'))}</p></div>`;
  }
  const groups = groupByCategory(sortForRender(filtered), t('category_uncategorized'));
  return groups
    .map(
      (g) => `
    <div class="mb-4">
      ${groups.length > 1 ? `<h2 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">${escapeHtml(g.label)}</h2>` : ''}
      <ul class="space-y-2" role="list">
        ${g.items.map((it, idx) => renderItem(it, state, idx, g.items.length)).join('')}
      </ul>
    </div>
  `,
    )
    .join('');
}

function renderTab(shop: Shop, state: AppState): string {
  const meta = shopMeta(shop, state.shops.shops);
  const isActive = state.active === shop;
  const items = visibleItems(state.lists[shop] ?? []);
  const count = items.filter((i) => !i.done).length;
  const activeCls = isActive
    ? `${meta.bg} ${meta.color} shadow-sm`
    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return `
    <button role="tab" aria-selected="${isActive}" data-shop="${escapeHtml(shop)}" class="relative flex shrink-0 flex-col items-center justify-center rounded-lg px-3 py-2 text-xs font-bold leading-tight ${activeCls}">
      <span class="truncate">${escapeHtml(meta.label || shop)}</span>
      ${count > 0 ? `<span class="mt-0.5 rounded-full bg-black/10 px-1.5 text-[10px] font-bold leading-4 dark:bg-white/20">${count}</span>` : ''}
    </button>
  `;
}

function renderItem(it: Item, state: AppState, idx: number, total: number): string {
  const t = state.i18n.t.bind(state.i18n);
  if (state.editingId === it.id) return renderItemEdit(it, state);
  const checked = it.done ? 'checked' : '';
  const lineCls = it.done ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100';
  return `
    <li data-item="${it.id}" class="relative overflow-hidden rounded-xl">
      <div data-swipe-bg class="absolute inset-0 flex items-center justify-end bg-rose-500 px-5 text-white">${SVG_TRASH}</div>
      <div data-swipe-fg class="relative flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800" style="touch-action: pan-y;">
        <label class="flex flex-1 cursor-pointer items-center gap-3">
          <input type="checkbox" data-action="toggle" ${checked} class="h-6 w-6 shrink-0 cursor-pointer accent-teal-600" aria-label="${escapeHtml(t('toggle_done'))}" />
          <span class="flex-1 break-words text-base ${lineCls}">${escapeHtml(it.name)}</span>
          ${it.qty ? `<span class="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">${escapeHtml(it.qty)}</span>` : ''}
        </label>
        <div class="flex flex-col items-center gap-0.5">
          <button type="button" data-action="move-up" ${idx === 0 ? 'disabled' : ''} class="flex h-5 w-6 items-center justify-center rounded text-slate-400 active:bg-slate-100 disabled:opacity-30 dark:active:bg-slate-700" aria-label="${escapeHtml(t('move_up'))}">${SVG_UP}</button>
          <button type="button" data-action="move-down" ${idx === total - 1 ? 'disabled' : ''} class="flex h-5 w-6 items-center justify-center rounded text-slate-400 active:bg-slate-100 disabled:opacity-30 dark:active:bg-slate-700" aria-label="${escapeHtml(t('move_down'))}">${SVG_DOWN}</button>
        </div>
        <button type="button" data-action="edit" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 active:bg-slate-100 dark:active:bg-slate-700" aria-label="${escapeHtml(t('edit'))}">${SVG_PENCIL}</button>
        <button type="button" data-action="delete" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 active:bg-slate-100 dark:active:bg-slate-700" aria-label="${escapeHtml(t('delete'))}">${SVG_TRASH}</button>
      </div>
    </li>
  `;
}

function renderItemEdit(it: Item, state: AppState): string {
  const t = state.i18n.t.bind(state.i18n);
  return `
    <li data-item="${it.id}" class="rounded-xl border border-teal-400 bg-white p-3 shadow-sm dark:border-teal-500 dark:bg-slate-800">
      <form data-form="edit" class="flex flex-col gap-2">
        <input name="name" type="text" value="${escapeHtml(it.name)}" class="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:border-slate-600 dark:bg-slate-700" required autofocus />
        <div class="flex gap-2">
          <input name="qty" type="text" value="${escapeHtml(it.qty ?? '')}" placeholder="${escapeHtml(t('qty_placeholder'))}" class="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:border-slate-600 dark:bg-slate-700" />
          <input name="cat" type="text" value="${escapeHtml(it.cat ?? '')}" placeholder="${escapeHtml(t('category_placeholder'))}" class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:border-slate-600 dark:bg-slate-700" />
        </div>
        <div class="flex gap-2">
          <button type="submit" class="flex-1 rounded-lg bg-teal-600 px-3 py-2.5 text-sm font-semibold text-white active:bg-teal-700">${escapeHtml(t('save'))}</button>
          <button type="button" data-action="cancel-edit" class="flex-1 rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-700 active:bg-slate-200 dark:bg-slate-700 dark:text-slate-200">${escapeHtml(t('cancel'))}</button>
        </div>
      </form>
    </li>
  `;
}

function renderToast(state: AppState): string {
  if (!state.toast) return '';
  const t = state.i18n.t.bind(state.i18n);
  return `
    <div data-toast class="fixed inset-x-0 bottom-24 z-20 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900" role="status">
      <span>${escapeHtml(state.toast.label)}</span>
      <button data-action="undo" class="rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide active:bg-white/25 dark:bg-black/15 dark:active:bg-black/25">${escapeHtml(t('undo'))}</button>
    </div>
  `;
}

function cloudShareDisabled(state: AppState): boolean {
  const c = state.supabaseConfig;
  return !c.url || !c.anonKey || !c.household;
}

function supabaseStatusClass(status: SyncStatus): string {
  switch (status) {
    case 'connected':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'connecting':
      return 'text-amber-600 dark:text-amber-400';
    case 'error':
      return 'text-rose-600 dark:text-rose-400';
    default:
      return 'text-slate-500 dark:text-slate-400';
  }
}

function renderSettings(state: AppState): string {
  const t = state.i18n.t.bind(state.i18n);
  const shops = state.shops.shops;
  const tpls = state.templates.list();
  return `
    <div data-settings-overlay class="fixed inset-0 z-30 bg-black/40" aria-modal="true" role="dialog">
      <div class="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl dark:bg-slate-900" style="padding-bottom: calc(env(safe-area-inset-bottom) + 1rem);">
        <div class="mx-auto max-w-2xl">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-lg font-bold">${escapeHtml(t('settings'))}</h2>
            <button data-action="settings-close" class="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">${escapeHtml(t('close'))}</button>
          </div>

          <section class="mb-6">
            <h3 class="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">${escapeHtml(t('shops_section'))}</h3>
            <ul class="space-y-2">
              ${shops
                .map(
                  (s, idx) => `
                <li class="flex items-center gap-2">
                  <input data-shop-input="${escapeHtml(s)}" type="text" value="${escapeHtml(s)}" class="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800" />
                  <button data-action="shop-rename" data-shop-name="${escapeHtml(s)}" class="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium dark:bg-slate-800">${escapeHtml(t('shop_rename'))}</button>
                  <button data-action="shop-up" data-shop-name="${escapeHtml(s)}" ${idx === 0 ? 'disabled' : ''} class="rounded-md bg-slate-100 px-1.5 py-1 disabled:opacity-30 dark:bg-slate-800" aria-label="${escapeHtml(t('move_up'))}">${SVG_UP}</button>
                  <button data-action="shop-down" data-shop-name="${escapeHtml(s)}" ${idx === shops.length - 1 ? 'disabled' : ''} class="rounded-md bg-slate-100 px-1.5 py-1 disabled:opacity-30 dark:bg-slate-800" aria-label="${escapeHtml(t('move_down'))}">${SVG_DOWN}</button>
                  <button data-action="shop-remove" data-shop-name="${escapeHtml(s)}" ${shops.length === 1 ? 'disabled' : ''} class="rounded-md bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 disabled:opacity-30 dark:bg-rose-900/40 dark:text-rose-200">${escapeHtml(t('shop_remove'))}</button>
                </li>
              `,
                )
                .join('')}
            </ul>
            <form data-form="shop-add" class="mt-3 flex gap-2">
              <input name="name" type="text" placeholder="${escapeHtml(t('shop_add_placeholder'))}" class="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800" required />
              <button type="submit" class="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white">+</button>
            </form>
          </section>

          <section class="mb-6">
            <h3 class="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">${escapeHtml(t('cloud_section'))}</h3>
            <p class="mb-2 text-[11px] text-slate-500 dark:text-slate-400">${escapeHtml(t('cloud_warning'))}</p>
            <form data-form="supabase" class="space-y-2">
              <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" name="enabled" ${state.supabaseConfig.enabled ? 'checked' : ''} class="h-4 w-4 accent-teal-600" />
                <span>${escapeHtml(t('cloud_enable'))}</span>
                <span class="ml-auto text-[11px] ${supabaseStatusClass(state.supabaseStatus)}">${escapeHtml(t('cloud_status_' + state.supabaseStatus))}</span>
              </label>
              <input name="url" type="url" placeholder="${escapeHtml(t('cloud_url'))}" value="${escapeHtml(state.supabaseConfig.url)}" class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800" />
              <input name="anonKey" type="text" placeholder="${escapeHtml(t('cloud_anon_key'))}" value="${escapeHtml(state.supabaseConfig.anonKey)}" class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-slate-600 dark:bg-slate-800" />
              <div class="flex gap-2">
                <input name="household" type="text" placeholder="${escapeHtml(t('cloud_household'))}" value="${escapeHtml(state.supabaseConfig.household)}" class="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-slate-600 dark:bg-slate-800" />
                <button type="button" data-action="cloud-generate" class="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium dark:bg-slate-800">${escapeHtml(t('cloud_household_generate'))}</button>
              </div>
              <div class="flex gap-2">
                <button type="submit" class="flex-1 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white">${escapeHtml(t('cloud_save'))}</button>
                <button type="button" data-action="cloud-share" ${cloudShareDisabled(state) ? 'disabled' : ''} class="flex-1 rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-200" aria-label="${escapeHtml(t('cloud_share_aria'))}">${escapeHtml(t('cloud_share'))}</button>
              </div>
            </form>
          </section>

          <section>
            <h3 class="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">${escapeHtml(t('templates_section'))}</h3>
            ${
              tpls.length === 0
                ? `<p class="text-sm text-slate-500 dark:text-slate-400">${escapeHtml(t('template_none'))}</p>`
                : `<ul class="space-y-2">
                ${tpls
                  .map(
                    (tpl) => `
                  <li class="flex items-center gap-2">
                    <span class="flex-1 truncate text-sm">${escapeHtml(tpl.name)}</span>
                    <button data-action="template-apply" data-template-name="${escapeHtml(tpl.name)}" class="rounded-md bg-teal-100 px-2 py-1 text-xs font-medium text-teal-700 dark:bg-teal-900/40 dark:text-teal-200">${escapeHtml(t('template_apply'))}</button>
                    <button data-action="template-remove" data-template-name="${escapeHtml(tpl.name)}" class="rounded-md bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">${escapeHtml(t('template_remove'))}</button>
                  </li>
                `,
                  )
                  .join('')}
              </ul>`
            }
            <form data-form="template-save" class="mt-3 flex gap-2">
              <input name="name" type="text" placeholder="${escapeHtml(t('template_save_placeholder'))}" class="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800" required />
              <button type="submit" class="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white">${escapeHtml(t('template_save'))}</button>
            </form>
          </section>
        </div>
      </div>
    </div>
  `;
}

function bind(root: HTMLElement, state: AppState, store: ListStore): void {
  const rerender = () => {
    store.save(state.lists);
    renderApp(root, state, store);
  };
  const t = state.i18n.t.bind(state.i18n);

  root.querySelectorAll<HTMLButtonElement>('[data-shop]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.active = btn.dataset.shop as Shop;
      state.editingId = undefined;
      ensureShopBucket(state, state.active);
      renderApp(root, state, store);
    });
  });

  const addForm = root.querySelector<HTMLFormElement>('[data-form="add"]');
  addForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(addForm);
    const name = String(data.get('name') ?? '').trim();
    const qty = String(data.get('qty') ?? '').trim() || undefined;
    const cat = String(data.get('cat') ?? '').trim() || undefined;
    if (!name) return;
    snapshotForUndo(state, t('undo_added'));
    showToast(state, t('undo_added'));
    const items = state.lists[state.active] ?? [];
    const pos = items.length === 0 ? 0 : minPos(items) - 1;
    const it = newItem({ name, qty, cat, dev: state.device, lamport: state.clock.tick(), pos });
    ensureShopBucket(state, state.active);
    state.lists[state.active].push(it);
    addForm.reset();
    rerender();
    root.querySelector<HTMLInputElement>('[data-form="add"] input[name="name"]')?.focus();
  });

  const searchInput = root.querySelector<HTMLInputElement>('[data-input="search"]');
  searchInput?.addEventListener('input', () => {
    state.search = searchInput.value;
    // partial re-render to avoid losing focus: just update list section
    renderApp(root, state, store);
    const re = root.querySelector<HTMLInputElement>('[data-input="search"]');
    re?.focus();
    if (re) re.setSelectionRange(re.value.length, re.value.length);
  });

  root.querySelectorAll<HTMLLIElement>('[data-item]').forEach((li) => {
    const id = li.dataset.item!;
    const items = state.lists[state.active] ?? [];

    li.querySelector<HTMLInputElement>('[data-action="toggle"]')?.addEventListener('change', () => {
      const it = items.find((x) => x.id === id);
      if (!it) return;
      snapshotForUndo(state, t('undo_toggled'));
      showToast(state, t('undo_toggled'));
      it.done = !it.done;
      Object.assign(it, stamp(state, it));
      rerender();
    });

    li.querySelector<HTMLButtonElement>('[data-action="delete"]')?.addEventListener('click', () => {
      doDelete(id, state, store, root);
    });

    li.querySelector<HTMLButtonElement>('[data-action="edit"]')?.addEventListener('click', () => {
      state.editingId = id;
      renderApp(root, state, store);
    });

    li.querySelector<HTMLButtonElement>('[data-action="cancel-edit"]')?.addEventListener(
      'click',
      () => {
        state.editingId = undefined;
        renderApp(root, state, store);
      },
    );

    li.querySelector<HTMLButtonElement>('[data-action="move-up"]')?.addEventListener(
      'click',
      () => {
        doReorder(id, -1, state, store, root);
      },
    );

    li.querySelector<HTMLButtonElement>('[data-action="move-down"]')?.addEventListener(
      'click',
      () => {
        doReorder(id, 1, state, store, root);
      },
    );

    const editForm = li.querySelector<HTMLFormElement>('[data-form="edit"]');
    editForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const it = items.find((x) => x.id === id);
      if (!it) return;
      const data = new FormData(editForm);
      const name = String(data.get('name') ?? '').trim();
      const qty = String(data.get('qty') ?? '').trim() || undefined;
      const cat = String(data.get('cat') ?? '').trim() || undefined;
      if (!name) return;
      snapshotForUndo(state, t('undo_edited'));
      showToast(state, t('undo_edited'));
      it.name = name;
      it.qty = qty;
      it.cat = cat;
      Object.assign(it, stamp(state, it));
      state.editingId = undefined;
      rerender();
    });

    const fg = li.querySelector<HTMLElement>('[data-swipe-fg]');
    if (fg) {
      let resetTimer: ReturnType<typeof setTimeout> | null = null;
      attachSwipeLeft(fg, {
        threshold: 80,
        onMove: (dx) => {
          fg.style.transform = `translateX(${dx}px)`;
          fg.style.transition = '';
        },
        onCancel: () => {
          fg.style.transition = 'transform 150ms ease-out';
          fg.style.transform = 'translateX(0)';
          if (resetTimer) clearTimeout(resetTimer);
          resetTimer = setTimeout(() => {
            fg.style.transition = '';
          }, 200);
        },
        onCommit: () => {
          fg.style.transition = 'transform 150ms ease-out';
          fg.style.transform = 'translateX(-100%)';
          if (resetTimer) clearTimeout(resetTimer);
          resetTimer = setTimeout(() => doDelete(id, state, store, root), 150);
        },
      });
    }
  });

  root.querySelector<HTMLButtonElement>('[data-action="theme"]')?.addEventListener('click', () => {
    state.theme.cycle();
    renderApp(root, state, store);
  });

  root.querySelector<HTMLButtonElement>('[data-action="lang"]')?.addEventListener('click', () => {
    state.i18n.cycle();
    renderApp(root, state, store);
  });

  root
    .querySelector<HTMLButtonElement>('[data-action="settings"]')
    ?.addEventListener('click', () => {
      state.settingsOpen = true;
      renderApp(root, state, store);
    });

  root
    .querySelector<HTMLButtonElement>('[data-action="settings-close"]')
    ?.addEventListener('click', () => {
      state.settingsOpen = false;
      renderApp(root, state, store);
    });

  root.querySelector<HTMLDivElement>('[data-settings-overlay]')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      state.settingsOpen = false;
      renderApp(root, state, store);
    }
  });

  root
    .querySelector<HTMLButtonElement>('[data-action="clear-checked"]')
    ?.addEventListener('click', () => {
      const items = state.lists[state.active] ?? [];
      const targets = items.filter((i) => i.done && !i.tomb);
      if (targets.length === 0) return;
      snapshotForUndo(state, t('undo_cleared'));
      showToast(state, t('undo_cleared'));
      for (const it of targets) {
        it.tomb = true;
        Object.assign(it, stamp(state, it));
      }
      rerender();
    });

  root.querySelector<HTMLButtonElement>('[data-action="export"]')?.addEventListener('click', () => {
    const md = store.exportMarkdown(state.lists, state.shops.shops);
    void shareMarkdown(
      `einkaufszettel-${state.device}-${new Date().toISOString().slice(0, 10)}.md`,
      md,
    );
  });

  const fileInput = root.querySelector<HTMLInputElement>('[data-input="file"]');
  root.querySelector<HTMLButtonElement>('[data-action="sync"]')?.addEventListener('click', () => {
    fileInput?.click();
  });
  fileInput?.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    const text = await f.text();
    snapshotForUndo(state, t('undo_synced'));
    state.lists = store.mergeMarkdown(state.lists, text);
    state.clock.observe(maxLamport(state.lists));
    state.syncedAt = Date.now();
    showToast(state, t('undo_synced'));
    fileInput.value = '';
    renderApp(root, state, store);
  });

  root.querySelector<HTMLButtonElement>('[data-action="undo"]')?.addEventListener('click', () => {
    const restored = state.undo.pop();
    if (!restored) return;
    state.lists = restored.lists;
    state.toast = undefined;
    state.editingId = undefined;
    rerender();
  });

  // Voice
  root.querySelector<HTMLButtonElement>('[data-action="voice"]')?.addEventListener('click', () => {
    if (!isVoiceSupported()) {
      showToast(state, t('voice_unsupported'));
      renderApp(root, state, store);
      return;
    }
    state.voiceActive = true;
    showToast(state, t('voice_listening'), 30000);
    renderApp(root, state, store);
    startVoice({
      lang: state.i18n.lang === 'en' ? 'en-US' : 'de-DE',
      onResult: ({ transcript }) => {
        state.voiceActive = false;
        state.toast = undefined;
        renderApp(root, state, store);
        const re = root.querySelector<HTMLInputElement>('[data-form="add"] input[name="name"]');
        if (re) {
          re.value = transcript;
          re.focus();
        }
      },
      onError: () => {
        state.voiceActive = false;
        renderApp(root, state, store);
      },
      onEnd: () => {
        if (state.voiceActive) {
          state.voiceActive = false;
          state.toast = undefined;
          renderApp(root, state, store);
        }
      },
    });
  });

  // Settings — shops
  root.querySelector<HTMLFormElement>('[data-form="shop-add"]')?.addEventListener('submit', (e) => {
    const form = e.currentTarget as HTMLFormElement;
    e.preventDefault();
    const name = String(new FormData(form).get('name') ?? '').trim();
    if (!name) return;
    if (state.shops.add(name)) {
      ensureShopBucket(state, name);
      renderApp(root, state, store);
    }
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="shop-rename"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const from = btn.dataset.shopName!;
      const input = root.querySelector<HTMLInputElement>(`[data-shop-input="${CSS.escape(from)}"]`);
      if (!input) return;
      const to = input.value.trim();
      if (!to || to === from) return;
      if (state.shops.rename(from, to)) {
        // migrate items in lists
        if (state.lists[from]) {
          state.lists[to] = state.lists[from];
          delete state.lists[from];
        }
        if (state.active === from) state.active = to;
        rerender();
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="shop-up"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.shops.move(btn.dataset.shopName!, -1)) renderApp(root, state, store);
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-action="shop-down"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.shops.move(btn.dataset.shopName!, 1)) renderApp(root, state, store);
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-action="shop-remove"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.shopName!;
      if (state.shops.remove(name)) {
        delete state.lists[name];
        if (state.active === name) state.active = state.shops.shops[0];
        rerender();
      }
    });
  });

  // Settings — templates
  root
    .querySelector<HTMLFormElement>('[data-form="template-save"]')
    ?.addEventListener('submit', (e) => {
      const form = e.currentTarget as HTMLFormElement;
      e.preventDefault();
      const name = String(new FormData(form).get('name') ?? '').trim();
      if (!name) return;
      state.templates.save(name, state.lists, state.shops.shops);
      renderApp(root, state, store);
    });

  root.querySelectorAll<HTMLButtonElement>('[data-action="template-apply"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.templateName!;
      const applied = state.templates.apply(name, state.device, () => state.clock.tick());
      if (!applied) return;
      snapshotForUndo(state, t('template_applied'));
      // merge applied into existing
      for (const shop of Object.keys(applied)) {
        ensureShopBucket(state, shop);
        const basePos = state.lists[shop].length === 0 ? 0 : maxPos(state.lists[shop]) + 1;
        applied[shop].forEach((it, i) => {
          it.pos = basePos + i;
          state.lists[shop].push(it);
        });
      }
      showToast(state, t('template_applied'));
      state.settingsOpen = false;
      rerender();
    });
  });

  // Settings — Supabase
  const cloudForm = root.querySelector<HTMLFormElement>('[data-form="supabase"]');
  cloudForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(cloudForm);
    const cfg = {
      enabled: data.get('enabled') === 'on',
      url: String(data.get('url') ?? '').trim(),
      anonKey: String(data.get('anonKey') ?? '').trim(),
      household: String(data.get('household') ?? '').trim(),
    };
    state.supabaseConfig = cfg;
    state.onSupabaseSave?.(cfg);
    renderApp(root, state, store);
  });
  root
    .querySelector<HTMLButtonElement>('[data-action="cloud-generate"]')
    ?.addEventListener('click', () => {
      const input = cloudForm?.querySelector<HTMLInputElement>('input[name="household"]');
      if (input) input.value = generateHouseholdId();
    });

  root
    .querySelector<HTMLButtonElement>('[data-action="cloud-share"]')
    ?.addEventListener('click', () => {
      if (cloudShareDisabled(state)) return;
      const url = buildShareUrl(window.location.origin + window.location.pathname, {
        url: state.supabaseConfig.url,
        anonKey: state.supabaseConfig.anonKey,
        household: state.supabaseConfig.household,
      });
      void shareConfigLink(url).then((result) => {
        if (result === 'shared') showToast(state, t('cloud_shared'));
        else if (result === 'copied') showToast(state, t('cloud_copied'));
        renderApp(root, state, store);
      });
    });

  root.querySelectorAll<HTMLButtonElement>('[data-action="template-remove"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.templates.remove(btn.dataset.templateName!);
      renderApp(root, state, store);
    });
  });

  const pull = root.querySelector<HTMLElement>('[data-pull]');
  const pullLabel = root.querySelector<HTMLElement>('[data-pull-label]');
  const scroll = root.querySelector<HTMLElement>('[data-scroll]');
  if (pull && pullLabel && scroll) {
    let armed = false;
    attachPullToRefresh(scroll, {
      isAtTop: () => (scroll.scrollTop ?? 0) <= 1 && window.scrollY <= 1,
      threshold: 70,
      onMove: (dy, ratio) => {
        const h = Math.min(70, dy / 1.5);
        pull.style.height = `${h}px`;
        pull.style.transition = '';
        armed = ratio >= 1;
        pullLabel.textContent = armed ? t('pull_release') : t('pull_pull');
      },
      onCancel: () => {
        pull.style.transition = 'height 150ms ease-out';
        pull.style.height = '0px';
      },
      onCommit: () => {
        pull.style.transition = 'height 150ms ease-out';
        pull.style.height = '0px';
        fileInput?.click();
      },
    });
  }
}

function doDelete(id: string, state: AppState, store: ListStore, root: HTMLElement): void {
  const items = state.lists[state.active] ?? [];
  const it = items.find((x) => x.id === id);
  if (!it) return;
  const t = state.i18n.t.bind(state.i18n);
  snapshotForUndo(state, t('undo_deleted'));
  showToast(state, t('undo_deleted'));
  it.tomb = true;
  Object.assign(it, stamp(state, it));
  store.save(state.lists);
  renderApp(root, state, store);
}

function doReorder(
  id: string,
  dir: -1 | 1,
  state: AppState,
  store: ListStore,
  root: HTMLElement,
): void {
  const items = state.lists[state.active] ?? [];
  const visible = sortForRender(
    visibleItems(items).filter((it) => matchesSearch(it, state.search ?? '')),
  );
  const idx = visible.findIndex((x) => x.id === id);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= visible.length) return;
  const a = visible[idx];
  const b = visible[target];
  const tmp = a.pos;
  a.pos = b.pos;
  b.pos = tmp;
  Object.assign(a, stamp(state, a));
  Object.assign(b, stamp(state, b));
  store.save(state.lists);
  renderApp(root, state, store);
}
