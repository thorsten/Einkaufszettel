import type { Lamport } from './clock';
import { maxLamport, newItem } from './markdown';
import type { ListStore } from './storage';
import { THEME_ICON, THEME_LABEL, type ThemeController } from './theme';
import { SHOPS, SHOP_META, type Item, type Shop, type ShopLists } from './types';

export interface AppState {
  active: Shop;
  lists: ShopLists;
  theme: ThemeController;
  device: string;
  clock: Lamport;
  syncedAt?: number;
}

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
  return {
    ts: Date.now(),
    lamport: state.clock.tick(),
    dev: state.device,
  };
}

export function renderApp(root: HTMLElement, state: AppState, store: ListStore): void {
  root.innerHTML = `
    <div class="flex min-h-dvh flex-col">
      <header class="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
        <div class="mx-auto max-w-2xl px-4 pt-3 pb-2">
          <div class="flex items-center justify-between gap-2">
            <h1 class="text-lg font-bold tracking-tight">Einkaufszettel</h1>
            <div class="flex gap-1">
              <button
                data-action="theme"
                class="flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1.5 text-sm font-medium text-slate-700 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                aria-label="Farbschema umschalten (aktuell ${escapeHtml(THEME_LABEL[state.theme.theme])})"
                title="Farbschema: ${escapeHtml(THEME_LABEL[state.theme.theme])}"
              >${THEME_ICON[state.theme.theme]}<span class="hidden sm:inline">${escapeHtml(THEME_LABEL[state.theme.theme])}</span></button>
              <button
                data-action="export"
                class="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                aria-label="Als Markdown exportieren"
              >Export</button>
              <button
                data-action="sync"
                class="rounded-md bg-teal-100 px-3 py-1.5 text-sm font-medium text-teal-700 active:bg-teal-200 dark:bg-teal-900/40 dark:text-teal-200"
                aria-label="Mit Markdown-Datei zusammenführen"
                title="Datei wählen → mit lokaler Liste zusammenführen"
              >Sync</button>
            </div>
          </div>
          <nav class="mt-3 grid grid-cols-4 gap-1.5" role="tablist" aria-label="Geschäft auswählen">
            ${SHOPS.map((shop) => renderTab(shop, state)).join('')}
          </nav>
          ${renderSyncStatus(state)}
        </div>
      </header>

      <main class="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-32">
        <section aria-label="Einkaufsliste ${escapeHtml(state.active)}">
          ${renderItems(visibleItems(state.lists[state.active]))}
        </section>
      </main>

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
            placeholder="Artikel hinzufügen…"
            class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:border-slate-600 dark:bg-slate-800"
            required
          />
          <input
            name="qty"
            type="text"
            autocomplete="off"
            inputmode="text"
            placeholder="Menge"
            class="w-20 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:border-slate-600 dark:bg-slate-800"
          />
          <button
            type="submit"
            class="rounded-lg bg-teal-600 px-4 py-2.5 font-semibold text-white active:bg-teal-700"
            aria-label="Hinzufügen"
          >+</button>
        </div>
      </form>

      <input data-input="file" type="file" accept=".md,text/markdown,text/plain" class="hidden" />
    </div>
  `;
  bind(root, state, store);
}

function renderSyncStatus(state: AppState): string {
  if (!state.syncedAt) return '';
  const t = new Date(state.syncedAt);
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  return `<p data-sync-status class="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">Zuletzt zusammengeführt: ${hh}:${mm}</p>`;
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

function renderItems(items: Item[]): string {
  if (items.length === 0) {
    return `
      <div class="mt-12 text-center text-slate-500 dark:text-slate-400">
        <p class="text-base">Noch keine Artikel.</p>
        <p class="mt-1 text-sm">Unten eintippen und + drücken.</p>
      </div>
    `;
  }
  const sorted = [...items].sort((a, b) => Number(a.done) - Number(b.done));
  return `
    <ul class="space-y-2" role="list">
      ${sorted.map((it) => renderItem(it)).join('')}
    </ul>
  `;
}

function renderItem(it: Item): string {
  const checked = it.done ? 'checked' : '';
  const lineCls = it.done ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100';
  return `
    <li
      data-item="${it.id}"
      class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800"
    >
      <label class="flex flex-1 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          data-action="toggle"
          ${checked}
          class="h-6 w-6 shrink-0 cursor-pointer accent-teal-600"
          aria-label="Erledigt"
        />
        <span class="flex-1 break-words text-base ${lineCls}">${escapeHtml(it.name)}</span>
        ${it.qty ? `<span class="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">${escapeHtml(it.qty)}</span>` : ''}
      </label>
      <button
        type="button"
        data-action="delete"
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 active:bg-slate-100 dark:active:bg-slate-700"
        aria-label="Löschen"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      </button>
    </li>
  `;
}

function bind(root: HTMLElement, state: AppState, store: ListStore): void {
  const rerender = () => {
    store.save(state.lists);
    renderApp(root, state, store);
  };

  root.querySelectorAll<HTMLButtonElement>('[data-shop]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.active = btn.dataset.shop as Shop;
      renderApp(root, state, store);
    });
  });

  const form = root.querySelector<HTMLFormElement>('[data-form="add"]');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const qty = String(data.get('qty') ?? '').trim() || undefined;
    if (!name) return;
    const it = newItem({ name, qty, dev: state.device, lamport: state.clock.tick() });
    state.lists[state.active].unshift(it);
    form.reset();
    rerender();
    root.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
  });

  root.querySelectorAll<HTMLLIElement>('[data-item]').forEach((li) => {
    const id = li.dataset.item!;
    const items = state.lists[state.active];
    li.querySelector<HTMLInputElement>('[data-action="toggle"]')?.addEventListener('change', () => {
      const it = items.find((x) => x.id === id);
      if (!it) return;
      it.done = !it.done;
      Object.assign(it, stamp(state, it));
      rerender();
    });
    li.querySelector<HTMLButtonElement>('[data-action="delete"]')?.addEventListener('click', () => {
      const it = items.find((x) => x.id === id);
      if (!it) return;
      it.tomb = true;
      Object.assign(it, stamp(state, it));
      rerender();
    });
  });

  root.querySelector<HTMLButtonElement>('[data-action="theme"]')?.addEventListener('click', () => {
    state.theme.cycle();
    renderApp(root, state, store);
  });

  root.querySelector<HTMLButtonElement>('[data-action="export"]')?.addEventListener('click', () => {
    const md = store.exportMarkdown(state.lists);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `einkaufszettel-${state.device}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const fileInput = root.querySelector<HTMLInputElement>('[data-input="file"]');
  root.querySelector<HTMLButtonElement>('[data-action="sync"]')?.addEventListener('click', () => {
    fileInput?.click();
  });
  fileInput?.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    const text = await f.text();
    state.lists = store.mergeMarkdown(state.lists, text);
    state.clock.observe(maxLamport(state.lists));
    state.syncedAt = Date.now();
    fileInput.value = '';
    renderApp(root, state, store);
  });
}
