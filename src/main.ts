import './style.css';
import { Lamport } from './clock';
import { getOrCreateDeviceId } from './device';
import { maxLamport } from './markdown';
import { ListStore } from './storage';
import { ThemeController } from './theme';
import { renderApp, type AppState } from './ui';
import { SHOPS } from './types';

const root = document.getElementById('app');
if (!root) throw new Error('#app not found');

const store = new ListStore(window.localStorage);
const lists = store.load();
const device = getOrCreateDeviceId(window.localStorage);
const clock = new Lamport(maxLamport(lists));

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
  device,
  clock,
};

renderApp(root, state, store);
