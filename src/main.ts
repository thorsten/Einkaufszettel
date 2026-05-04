import './style.css';
import { Lamport } from './clock';
import { getOrCreateDeviceId } from './device';
import { detectLang, I18n } from './i18n';
import { maxLamport } from './markdown';
import { ListStore } from './storage';
import { ThemeController } from './theme';
import { renderApp, type AppState } from './ui';
import { SHOPS } from './types';
import { UndoStack } from './undo';

const root = document.getElementById('app');
if (!root) throw new Error('#app not found');

const store = new ListStore(window.localStorage);
const lists = store.load();
const device = getOrCreateDeviceId(window.localStorage);
const clock = new Lamport(maxLamport(lists));
const undo = new UndoStack();

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

const state: AppState = {
  active: SHOPS[0],
  lists,
  theme,
  i18n,
  device,
  clock,
  undo,
};

renderApp(root, state, store);
