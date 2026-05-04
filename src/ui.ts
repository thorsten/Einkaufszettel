import type { Lamport } from './clock';
import { attachPullToRefresh, attachSwipeLeft } from './gestures';
import type { I18n } from './i18n';
import { maxLamport, newItem } from './markdown';
import { shareMarkdown } from './share';
import type { ListStore } from './storage';
import { THEME_ICON, type ThemeController } from './theme';
import { SHOPS, SHOP_META, type Item, type Shop, type ShopLists } from './types';
import type { UndoStack } from './undo';

export interface AppState {
  active: Shop;
  lists: ShopLists;
  theme: ThemeController;
  i18n: I18n;
  device: string;
  clock: Lamport;
  undo: UndoStack;
  syncedAt?: number;
  editingId?: string;
  toast?: { label: string; expiresAt: number };
}

const SVG_LANG = `<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14M9 8a8 8 0 0 0 6 13M9 21a8 8 0 0 1 6-13M3 12h18"/></svg>`;
const SVG_TRASH = `<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>`;
const SVG_PENCIL = `<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function visibleItems(items: Item[]): Item[] {
  return items.filter((i) => !i.tomb);
}

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

export function renderApp(root: HTMLElement, state: AppState, store: ListStore): void {
  clearStaleToast(state);
  const t = state.i18n.t.bind(state.i18n);
  const items = visibleItems(state.lists[state.active]);
  const hasChecked = items.some((i) => i.done);

  root.innerHTML = `
    <div class="flex min-h-dvh flex-col" data-app>
      <div data-pull class="pointer-events-none fixed inset-x-0 top-0 z-20 flex h-0 items-center justify-center overflow-hidden text-xs font-medium text-teal-700 transition-[height] dark:text-teal-200" aria-hidden="true">
        <span data-pull-label></span>
      </div>

      <header class="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
        <div class="mx-auto max-w-2xl px-4 pt-3 pb-2">
          <div class="flex items-center justify-between gap-2">
            <h1 class="text-lg font-bold tracking-tight">${escapeHtml(t('title'))}</h1>
            <div class="flex flex-wrap items-center gap-1">
              <button
                data-action="theme"
                class="flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1.5 text-sm font-medium text-slate-700 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                aria-label="${escapeHtml(t('theme_aria'))}"
                title="${escapeHtml(t('theme_label'))}: ${escapeHtml(t('theme_' + state.theme.theme))}"
              >${THEME_ICON[state.theme.theme]}<span class="hidden sm:inline">${escapeHtml(t('theme_' + state.theme.theme))}</span></button>
              <button
                data-action="lang"
                class="flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1.5 text-sm font-medium text-slate-700 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                aria-label="${escapeHtml(t('lang_aria'))}"
                title="${escapeHtml(t('lang_label'))}: ${escapeHtml(state.i18n.lang.toUpperCase())}"
              >${SVG_LANG}<span class="hidden sm:inline">${escapeHtml(state.i18n.lang.toUpperCase())}</span></button>
              <button
                data-action="export"
                class="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                aria-label="${escapeHtml(t('export_aria'))}"
              >${escapeHtml(t('export'))}</button>
              <button
                data-action="sync"
                class="rounded-md bg-teal-100 px-3 py-1.5 text-sm font-medium text-teal-700 active:bg-teal-200 dark:bg-teal-900/40 dark:text-teal-200"
                aria-label="${escapeHtml(t('sync_aria'))}"
                title="${escapeHtml(t('sync_title'))}"
              >${escapeHtml(t('sync'))}</button>
            </div>
          </div>
          <nav class="mt-3 grid grid-cols-4 gap-1.5" role="tablist" aria-label="${escapeHtml(t('shop_select'))}">
            ${SHOPS.map((shop) => renderTab(shop, state)).join('')}
          </nav>
          <div class="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>${state.syncedAt ? `${escapeHtml(t('synced_at'))}: ${formatTime(state.syncedAt)}` : ''}</span>
            ${
              hasChecked
                ? `<button data-action="clear-checked" class="rounded px-1.5 py-0.5 font-medium text-slate-600 underline-offset-2 hover:underline active:text-teal-700 dark:text-slate-300 dark:active:text-teal-300">${escapeHtml(t('clear_checked'))}</button>`
                : ''
            }
          </div>
        </div>
      </header>

      <main data-scroll class="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-32">
        <section aria-label="${escapeHtml(t('shop_list'))} ${escapeHtml(state.active)}">
          ${renderItems(items, state)}
        </section>
      </main>

      ${renderToast(state)}

      <form
        data-form="add"
        class="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
        style="padding-bottom: env(safe-area-inset-bottom);"
      >
        <div class="mx-auto flex max-w-2xl gap-2 px-4 py-3">
          <input
            name="name"
            type="text"
            autocomplete="off"
            enterkeyhint="done"
            placeholder="${escapeHtml(t('add_placeholder'))}"
            class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:border-slate-600 dark:bg-slate-800"
            required
          />
          <input
            name="qty"
            type="text"
            autocomplete="off"
            inputmode="text"
            placeholder="${escapeHtml(t('qty_placeholder'))}"
            class="w-20 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:border-slate-600 dark:bg-slate-800"
          />
          <button
            type="submit"
            class="rounded-lg bg-teal-600 px-4 py-2.5 font-semibold text-white active:bg-teal-700"
            aria-label="${escapeHtml(t('add'))}"
          >+</button>
        </div>
      </form>

      <input data-input="file" type="file" accept=".md,text/markdown,text/plain" class="hidden" />
    </div>
  `;
  bind(root, state, store);
}

function formatTime(ms: number): string {
  const t = new Date(ms);
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

function renderTab(shop: Shop, state: AppState): string {
  const meta = SHOP_META[shop];
  const isActive = state.active === shop;
  const count = visibleItems(state.lists[shop]).filter((i) => !i.done).length;
  const activeCls = isActive
    ? `${meta.bg} ${meta.color} shadow-sm`
    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return `
    <button
      role="tab"
      aria-selected="${isActive}"
      data-shop="${shop}"
      class="relative flex flex-col items-center justify-center rounded-lg px-1 py-2 text-xs font-bold leading-tight ${activeCls}"
    >
      <span class="truncate">${escapeHtml(meta.label)}</span>
      ${count > 0 ? `<span class="mt-0.5 rounded-full bg-black/10 px-1.5 text-[10px] font-bold leading-4 dark:bg-white/20">${count}</span>` : ''}
    </button>
  `;
}

function renderItems(items: Item[], state: AppState): string {
  const t = state.i18n.t.bind(state.i18n);
  if (items.length === 0) {
    return `
      <div class="mt-12 text-center text-slate-500 dark:text-slate-400">
        <p class="text-base">${escapeHtml(t('empty_title'))}</p>
        <p class="mt-1 text-sm">${escapeHtml(t('empty_hint'))}</p>
      </div>
    `;
  }
  const sorted = [...items].sort((a, b) => Number(a.done) - Number(b.done));
  return `
    <ul class="space-y-2" role="list">
      ${sorted.map((it) => renderItem(it, state)).join('')}
    </ul>
  `;
}

function renderItem(it: Item, state: AppState): string {
  const t = state.i18n.t.bind(state.i18n);
  if (state.editingId === it.id) return renderItemEdit(it, t);
  const checked = it.done ? 'checked' : '';
  const lineCls = it.done ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100';
  return `
    <li
      data-item="${it.id}"
      class="relative overflow-hidden rounded-xl"
    >
      <div data-swipe-bg class="absolute inset-0 flex items-center justify-end bg-rose-500 px-5 text-white">
        ${SVG_TRASH}
      </div>
      <div data-swipe-fg class="relative flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800" style="touch-action: pan-y;">
        <label class="flex flex-1 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            data-action="toggle"
            ${checked}
            class="h-6 w-6 shrink-0 cursor-pointer accent-teal-600"
            aria-label="${escapeHtml(t('toggle_done'))}"
          />
          <span class="flex-1 break-words text-base ${lineCls}">${escapeHtml(it.name)}</span>
          ${it.qty ? `<span class="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">${escapeHtml(it.qty)}</span>` : ''}
        </label>
        <button
          type="button"
          data-action="edit"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 active:bg-slate-100 dark:active:bg-slate-700"
          aria-label="${escapeHtml(t('edit'))}"
        >${SVG_PENCIL}</button>
        <button
          type="button"
          data-action="delete"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 active:bg-slate-100 dark:active:bg-slate-700"
          aria-label="${escapeHtml(t('delete'))}"
        >${SVG_TRASH}</button>
      </div>
    </li>
  `;
}

function renderItemEdit(it: Item, t: (k: string) => string): string {
  return `
    <li
      data-item="${it.id}"
      class="rounded-xl border border-teal-400 bg-white p-3 shadow-sm dark:border-teal-500 dark:bg-slate-800"
    >
      <form data-form="edit" class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          name="name"
          type="text"
          value="${escapeHtml(it.name)}"
          class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:border-slate-600 dark:bg-slate-700"
          required
          autofocus
        />
        <input
          name="qty"
          type="text"
          value="${escapeHtml(it.qty ?? '')}"
          placeholder="${escapeHtml(t('qty_placeholder'))}"
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 sm:w-24 dark:border-slate-600 dark:bg-slate-700"
        />
        <div class="flex gap-2">
          <button type="submit" class="flex-1 rounded-lg bg-teal-600 px-3 py-2.5 text-sm font-semibold text-white active:bg-teal-700 sm:flex-none">${escapeHtml(t('save'))}</button>
          <button type="button" data-action="cancel-edit" class="flex-1 rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-700 active:bg-slate-200 sm:flex-none dark:bg-slate-700 dark:text-slate-200">${escapeHtml(t('cancel'))}</button>
        </div>
      </form>
    </li>
  `;
}

function renderToast(state: AppState): string {
  if (!state.toast) return '';
  const t = state.i18n.t.bind(state.i18n);
  return `
    <div data-toast class="fixed inset-x-0 bottom-20 z-20 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900" role="status">
      <span>${escapeHtml(state.toast.label)}</span>
      <button data-action="undo" class="rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide active:bg-white/25 dark:bg-black/15 dark:active:bg-black/25">${escapeHtml(t('undo'))}</button>
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
      renderApp(root, state, store);
    });
  });

  const addForm = root.querySelector<HTMLFormElement>('[data-form="add"]');
  addForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(addForm);
    const name = String(data.get('name') ?? '').trim();
    const qty = String(data.get('qty') ?? '').trim() || undefined;
    if (!name) return;
    snapshotForUndo(state, t('undo_added'));
    showToast(state, t('undo_added'));
    const it = newItem({ name, qty, dev: state.device, lamport: state.clock.tick() });
    state.lists[state.active].unshift(it);
    addForm.reset();
    rerender();
    root.querySelector<HTMLInputElement>('[data-form="add"] input[name="name"]')?.focus();
  });

  root.querySelectorAll<HTMLLIElement>('[data-item]').forEach((li) => {
    const id = li.dataset.item!;
    const items = state.lists[state.active];

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

    const editForm = li.querySelector<HTMLFormElement>('[data-form="edit"]');
    editForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const it = items.find((x) => x.id === id);
      if (!it) return;
      const data = new FormData(editForm);
      const name = String(data.get('name') ?? '').trim();
      const qty = String(data.get('qty') ?? '').trim() || undefined;
      if (!name) return;
      snapshotForUndo(state, t('undo_edited'));
      showToast(state, t('undo_edited'));
      it.name = name;
      it.qty = qty;
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
    .querySelector<HTMLButtonElement>('[data-action="clear-checked"]')
    ?.addEventListener('click', () => {
      const items = state.lists[state.active];
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
    const md = store.exportMarkdown(state.lists);
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
  const items = state.lists[state.active];
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
