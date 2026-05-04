import type { StorageLike } from './storage';

export type Theme = 'system' | 'light' | 'dark';

export const THEME_KEY = 'einkaufszettel.theme';
const ORDER: Theme[] = ['system', 'light', 'dark'];

export interface MediaQueryLike {
  matches: boolean;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
}

export function isTheme(v: unknown): v is Theme {
  return v === 'system' || v === 'light' || v === 'dark';
}

export function nextTheme(current: Theme): Theme {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
}

export function resolveTheme(theme: Theme, mq: Pick<MediaQueryLike, 'matches'>): 'light' | 'dark' {
  if (theme === 'system') return mq.matches ? 'dark' : 'light';
  return theme;
}

export function applyTheme(root: HTMLElement, resolved: 'light' | 'dark'): void {
  root.classList.toggle('dark', resolved === 'dark');
}

export class ThemeController {
  private current: Theme;
  private listener: (() => void) | null = null;

  constructor(
    private readonly storage: StorageLike,
    private readonly mq: MediaQueryLike,
    private readonly root: HTMLElement,
    private readonly onChange?: () => void,
  ) {
    const raw = storage.getItem(THEME_KEY);
    this.current = isTheme(raw) ? raw : 'system';
    this.bindMediaListener();
    this.apply();
  }

  get theme(): Theme {
    return this.current;
  }

  get resolved(): 'light' | 'dark' {
    return resolveTheme(this.current, this.mq);
  }

  set(theme: Theme): void {
    this.current = theme;
    this.storage.setItem(THEME_KEY, theme);
    this.apply();
    this.onChange?.();
  }

  cycle(): Theme {
    this.set(nextTheme(this.current));
    return this.current;
  }

  private apply(): void {
    applyTheme(this.root, this.resolved);
  }

  private bindMediaListener(): void {
    this.listener = () => {
      if (this.current === 'system') {
        this.apply();
        this.onChange?.();
      }
    };
    this.mq.addEventListener('change', this.listener);
  }
}

export const THEME_ICON: Record<Theme, string> = {
  system: `<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>`,
  light: `<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`,
  dark: `<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
};
