import './style.css';
import { Lamport } from './clock';
import { getOrCreateDeviceId } from './device';
import { detectLang, I18n } from './i18n';
import { maxLamport } from './markdown';
import { ShopRegistry } from './shops';
import { ListStore } from './storage';
import { TemplateStore } from './templates';
import { ThemeController } from './theme';
import { renderApp, type AppState } from './ui';
import { UndoStack } from './undo';

const root = document.getElementById('app');
if (!root) throw new Error('#app not found');

const store = new ListStore(window.localStorage);
const lists = store.load();
const device = getOrCreateDeviceId(window.localStorage);
const clock = new Lamport(maxLamport(lists));
const undo = new UndoStack();
const shops = new ShopRegistry(window.localStorage);
const templates = new TemplateStore(window.localStorage);

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

// Make sure every registered shop has a bucket
for (const s of shops.shops) {
  if (!lists[s]) lists[s] = [];
}

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
};

renderApp(root, state, store);
