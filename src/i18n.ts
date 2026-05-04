import type { StorageLike } from './storage';

export type Lang = 'de' | 'en';
export const LANGS: Lang[] = ['de', 'en'];
export const LANG_KEY = 'einkaufszettel.lang';

type Dict = Record<string, string>;

const DE: Dict = {
  title: 'Einkaufszettel',
  add_placeholder: 'Artikel hinzufügen…',
  qty_placeholder: 'Menge',
  add: 'Hinzufügen',
  empty_title: 'Noch keine Artikel.',
  empty_hint: 'Unten eintippen und + drücken.',
  toggle_done: 'Erledigt',
  delete: 'Löschen',
  edit: 'Bearbeiten',
  save: 'Speichern',
  cancel: 'Abbrechen',
  export: 'Export',
  export_aria: 'Als Markdown exportieren',
  sync: 'Sync',
  sync_aria: 'Mit Markdown-Datei zusammenführen',
  sync_title: 'Datei wählen → mit lokaler Liste zusammenführen',
  synced_at: 'Zuletzt zusammengeführt',
  clear_checked: 'Erledigte löschen',
  undo: 'Rückgängig',
  undo_added: 'Artikel hinzugefügt',
  undo_deleted: 'Artikel gelöscht',
  undo_toggled: 'Status geändert',
  undo_edited: 'Artikel bearbeitet',
  undo_cleared: 'Erledigte gelöscht',
  undo_synced: 'Zusammengeführt',
  shop_select: 'Geschäft auswählen',
  shop_list: 'Einkaufsliste',
  theme_aria: 'Farbschema umschalten',
  theme_label: 'Farbschema',
  theme_system: 'Auto',
  theme_light: 'Hell',
  theme_dark: 'Dunkel',
  lang_aria: 'Sprache umschalten',
  lang_label: 'Sprache',
  pull_release: 'Loslassen zum Sync',
  pull_pull: 'Ziehen zum Sync',
};

const EN: Dict = {
  title: 'Shopping List',
  add_placeholder: 'Add item…',
  qty_placeholder: 'Qty',
  add: 'Add',
  empty_title: 'No items yet.',
  empty_hint: 'Type below and tap +.',
  toggle_done: 'Done',
  delete: 'Delete',
  edit: 'Edit',
  save: 'Save',
  cancel: 'Cancel',
  export: 'Export',
  export_aria: 'Export as Markdown',
  sync: 'Sync',
  sync_aria: 'Merge with Markdown file',
  sync_title: 'Pick a file → merge into local list',
  synced_at: 'Last sync',
  clear_checked: 'Clear checked',
  undo: 'Undo',
  undo_added: 'Item added',
  undo_deleted: 'Item deleted',
  undo_toggled: 'Status changed',
  undo_edited: 'Item edited',
  undo_cleared: 'Checked cleared',
  undo_synced: 'Merged',
  shop_select: 'Select shop',
  shop_list: 'Shopping list',
  theme_aria: 'Toggle theme',
  theme_label: 'Theme',
  theme_system: 'Auto',
  theme_light: 'Light',
  theme_dark: 'Dark',
  lang_aria: 'Toggle language',
  lang_label: 'Language',
  pull_release: 'Release to sync',
  pull_pull: 'Pull to sync',
};

const DICTS: Record<Lang, Dict> = { de: DE, en: EN };

export function isLang(v: unknown): v is Lang {
  return v === 'de' || v === 'en';
}

export function detectLang(navigatorLang?: string | null): Lang {
  if (navigatorLang && navigatorLang.toLowerCase().startsWith('en')) return 'en';
  return 'de';
}

export function nextLang(current: Lang): Lang {
  return current === 'de' ? 'en' : 'de';
}

export class I18n {
  private current: Lang;

  constructor(
    private readonly storage: StorageLike,
    detect: () => Lang,
    private readonly onChange?: () => void,
  ) {
    const raw = storage.getItem(LANG_KEY);
    this.current = isLang(raw) ? raw : detect();
  }

  get lang(): Lang {
    return this.current;
  }

  set(lang: Lang): void {
    this.current = lang;
    this.storage.setItem(LANG_KEY, lang);
    this.onChange?.();
  }

  cycle(): Lang {
    this.set(nextLang(this.current));
    return this.current;
  }

  t(key: string): string {
    return DICTS[this.current][key] ?? DICTS.de[key] ?? key;
  }
}
