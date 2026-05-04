import './style.css';
import { Lamport } from './clock';
import { readConfigFromHash } from './config-link';
import { getOrCreateDeviceId } from './device';
import { detectLang, I18n } from './i18n';
import { maxLamport } from './markdown';
import { ShopRegistry } from './shops';
import { ListStore } from './storage';
import { applyIncoming } from './sync-helpers';
import { loadConfig, saveConfig, SupabaseSync, type SupabaseConfig } from './supabase';
import { TemplateStore } from './templates';
import { ThemeController } from './theme';
import { renderApp, type AppState } from './ui';
import { UndoStack } from './undo';

const rootEl = document.getElementById('app');
if (!rootEl) throw new Error('#app not found');
const root: HTMLElement = rootEl;

const store = new ListStore(window.localStorage);
const lists = store.load();
const device = getOrCreateDeviceId(window.localStorage);
const clock = new Lamport(maxLamport(lists));
const undo = new UndoStack();
const shops = new ShopRegistry(window.localStorage);
const templates = new TemplateStore(window.localStorage);
const supabaseConfig = loadConfig(window.localStorage);

const i18n = new I18n(
  window.localStorage,
  () => detectLang(navigator.language),
  () => renderApp(root, state, store),
);

const theme = new ThemeController(
  window.localStorage,
  window.matchMedia('(prefers-color-scheme: dark)'),
  document.documentElement,
  () => renderApp(root, state, store),
);

for (const s of shops.shops) {
  if (!lists[s]) lists[s] = [];
}

let supabaseSync: SupabaseSync | null = null;

const state: AppState = {
  active: shops.shops[0],
  lists,
  theme,
  i18n,
  device,
  clock,
  undo,
  shops,
  templates,
  supabaseConfig,
  supabaseStatus: 'idle',
  onSupabaseSave: (cfg) => applySupabaseConfig(cfg),
};

store.onSave((current) => {
  supabaseSync?.push(current);
});

function startSupabase(cfg: SupabaseConfig): void {
  supabaseSync = new SupabaseSync({
    config: cfg,
    onIncoming: (shop, item) => {
      const changed = applyIncoming(state.lists, shop, item);
      if (!changed) return;
      state.clock.observe(item.lamport);
      store.saveQuiet(state.lists);
      renderApp(root, state, store);
    },
    onStatus: (status) => {
      state.supabaseStatus = status;
      renderApp(root, state, store);
    },
  });
  void supabaseSync.connect();
}

async function applySupabaseConfig(cfg: SupabaseConfig): Promise<void> {
  saveConfig(window.localStorage, cfg);
  state.supabaseConfig = cfg;
  if (supabaseSync) {
    await supabaseSync.disconnect();
    supabaseSync = null;
  }
  if (cfg.enabled) startSupabase(cfg);
  else state.supabaseStatus = 'idle';
  renderApp(root, state, store);
}

const incoming = readConfigFromHash(window.location.hash);
if (incoming) {
  history.replaceState(null, '', window.location.pathname + window.location.search);
  if (window.confirm(i18n.t('cloud_apply_prompt'))) {
    void applySupabaseConfig({ ...incoming, enabled: true });
  }
} else if (supabaseConfig.enabled) {
  startSupabase(supabaseConfig);
}

renderApp(root, state, store);
