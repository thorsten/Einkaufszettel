# AGENTS.md

Guidance for AI coding agents (Claude Code, Cursor, Copilot, etc.) working in this repository. `CLAUDE.md` is a symlink to this file.

## Project

Offline shopping list PWA for German supermarkets (V-MARKT, ALDI, EDEKA, REWE). Vanilla TypeScript + Tailwind v4 + bare DOM — **no frontend framework**. Designed for two iPhones syncing via Markdown file exchange (no backend).

## Commands

```bash
# Dev
pnpm dev                # Vite dev server
pnpm build              # tsc --noEmit + vite build (PWA)
pnpm preview --host     # serve dist/ on LAN

# Quality gates
pnpm lint               # prettier --check + tsc --noEmit
pnpm format             # prettier --write
pnpm test               # vitest run (excludes e2e/**)
pnpm test:watch
pnpm test:coverage      # enforces lines ≥ 90, funcs ≥ 85, stmts ≥ 85, branches ≥ 70
pnpm typecheck

# Single test file
pnpm test tests/merge.test.ts
pnpm test --reporter=verbose -t "tombstone wins"   # by name pattern

# E2E (Playwright)
pnpm e2e:install                  # one-time, installs chromium + webkit
pnpm e2e                          # all projects (chromium + mobile-safari)
pnpm e2e --project=chromium       # one project
pnpm e2e e2e/items.spec.ts        # one spec
pnpm e2e:report                   # open last HTML report

# Bundle + Lighthouse (require dist/)
pnpm build && pnpm size           # gzipped budgets: JS ≤15 KB, CSS ≤8 KB, SW ≤5 KB
pnpm build && pnpm lighthouse     # lhci autorun against dist/
```

`prepare` script auto-installs Husky hooks. `commit-msg` enforces Conventional Commits (`feat`, `fix`, `docs`, `chore`, `build`, `ci`, `refactor`, `perf`, `test`, `style`, `revert`). `pre-commit` runs lint-staged + typecheck + full Vitest suite (~20 s). Use `git commit --no-verify` only in emergencies.

## Architecture — big picture

### State + render model

**Single mutable `AppState` object lives in `src/ui.ts`. Full innerHTML re-render on every mutation. No virtual DOM, no diffing, no reactive primitives.** Pattern:

1. Event handler mutates state
2. `store.save(state.lists)` persists Markdown to localStorage
3. `renderApp(root, state, store)` clears innerHTML and re-binds all handlers

This works because the app is small and re-render is fast. Beware: ephemeral DOM-only state (input values, swipe transforms, scroll position) is lost on rerender unless explicitly preserved or restored after.

`AppState` aggregates: `lists`, `theme` (`ThemeController`), `i18n` (`I18n`), `device` (string), `clock` (`Lamport`), `undo` (`UndoStack`), `shops` (`ShopRegistry`), `templates` (`TemplateStore`), and ephemeral fields like `editingId`, `toast`, `search`, `settingsOpen`, `voiceActive`.

Pure render helpers live in `src/ui-pure.ts` (`escapeHtml`, `visibleItems`, `matchesSearch`, `groupByCategory`, `formatTime`, `sortForRender`) so they can be unit-tested without the DOM.

### Storage = Markdown

`localStorage[einkaufszettel.v1.md]` holds the entire list as Markdown text. Every mutation re-serializes the whole tree. This makes Export, Sync, and template-save trivial: just hand out (or read) the same Markdown.

Each item is one task line + an HTML-comment metadata trailer:

```markdown
# ALDI

- [ ] Milch (2 L) <!-- id:abc ts:1714831200000 lamport:3 dev:dx tomb:0 pos:5 cat:Milchprodukte -->
```

The HTML comment is inert in any Markdown renderer. **Do not change wire format without bumping the storage key version** (`STORAGE_KEY` in `src/storage.ts`).

### CRDT (LWW-Element-Set per item id)

`src/merge.ts`. Items merge by:

```
keep argmax over (lamport, ts, dev) for each id
```

Properties: idempotent, commutative, associative. **Tombstone is just another edit** — newer edit resurrects, newer tombstone wins. Tombstones older than 30 days are GC'd on merge.

`mergeShopLists` operates on the **union of shop keys** present on either side, so custom shops merge cleanly across devices without a separate registry sync.

### Logical clock

`src/clock.ts` — Lamport counter. **Every mutation must `state.clock.tick()` and write the new value into the item's `lamport`.** When merging incoming data, call `state.clock.observe(maxLamport(lists))` so the next local edit beats anything seen.

`src/ui.ts` `stamp(state, existing)` is the canonical mutation helper — it observes the existing lamport and bumps. Use it. Don't write `Date.now()` or `clock.tick()` inline.

### Why per-device files (not a shared file)

iCloud Drive, Dropbox, etc. don't merge file content; concurrent writes produce `-conflict-N.md` siblings. Each device exports its own `einkaufszettel-<deviceId>-<date>.md`; importing **merges** rather than replacing. Single-writer-per-file invariant + LWW merge on read = deterministic without locks.

### Custom shops

`Shop = string` (not a literal union). `DEFAULT_SHOPS` is an initial seed; `ShopRegistry` (`src/shops.ts`) holds the runtime list, persisted under `einkaufszettel.shops`. Anywhere you iterate shops, prefer `state.shops.shops` or `Object.keys(lists)`. `shopMeta(shop)` returns colors with a hash-based fallback for unknown shops.

### Module map (non-obvious)

| Module             | Role                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `src/types.ts`     | `Item` schema (id/ts/lamport/dev/tomb/pos/cat), `SHOP_META`, `shopMeta()`                                                  |
| `src/markdown.ts`  | Serialize/parse, `newItem`, `maxLamport`, `minPos`/`maxPos`                                                                |
| `src/merge.ts`     | `compareItem`, `mergeShopLists`, tombstone GC                                                                              |
| `src/storage.ts`   | `ListStore` (load/save/clear/export/mergeMarkdown). `StorageLike` interface accepts any KV — used by every settings store. |
| `src/ui-pure.ts`   | Pure render helpers, framework-free                                                                                        |
| `src/ui.ts`        | `renderApp` + `bind`. Big file; full re-render on each mutation.                                                           |
| `src/gestures.ts`  | `attachSwipeLeft`, `attachPullToRefresh` — pointer events                                                                  |
| `src/share.ts`     | Web Share API w/ download fallback. Fully DI'd for tests.                                                                  |
| `src/voice.ts`     | `SpeechRecognition` wrapper. Factory injectable for tests.                                                                 |
| `src/i18n.ts`      | de/en dictionary + `I18n` controller. **All UI strings go here.**                                                          |
| `src/undo.ts`      | TTL-bounded snapshot stack. Snapshot = serialized markdown.                                                                |
| `src/shops.ts`     | `ShopRegistry` (custom shops)                                                                                              |
| `src/templates.ts` | `TemplateStore` — saved markdown blobs                                                                                     |
| `src/history.ts`   | Builds `<datalist>` suggestions + category list per shop                                                                   |

### Mutation contract

Every state mutation must:

1. **Snapshot** — call `state.undo.push(label, state.lists)` if user-undoable.
2. **Stamp** — apply `stamp(state, existing)` to bump lamport and ts.
3. **Tombstone, don't delete** — `it.tomb = true`, never `splice` from arrays.
4. **Persist** — `store.save(state.lists)` (handled by `rerender()` helper inside `bind`).
5. **Re-render** — `renderApp(root, state, store)` rebuilds DOM and rebinds.

Skipping any of these breaks sync, undo, or both.

## Tests

Vitest scope: `tests/**` only. **`e2e/**`is excluded** at the vitest level (see`vite.config.ts > test.exclude`). Always put Playwright specs under `e2e/`, never `tests/`.

Coverage gate: `pnpm test:coverage`. Lines ≥ 90 % is the binding gate. If you add an uncovered branch in `src/ui.ts`, either cover it via integration test or extract the logic into `src/ui-pure.ts` and unit-test it there.

E2E specs assume a clean localStorage and German UI. Use `gotoFresh(page)` from `e2e/_helpers.ts` — it clears storage and pre-sets `lang=de` (chromium's `navigator.language` is `en-US`, which would otherwise auto-detect into English and break German-text assertions).

Touch/pointer-event specs (swipe, pull-to-refresh) are **gated to webkit only** via `test.skip(({ browserName }) => browserName !== 'webkit')`. They simulate via `page.mouse.*` because Playwright's `touchscreen` is limited.

## CI

Job graph:

```
test ──► e2e (matrix: chromium, mobile-safari)
  │
  └─► build ─► size-limit
            └─► lighthouse
deploy needs: [build, e2e, lighthouse]   (push to main only)
```

`FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` set at workflow env scope so all JS actions run on Node 24 (silences Node 20 deprecation warnings).

Build job uploads `dist/` as both a Pages artifact and a regular artifact (consumed by `lighthouse` job to avoid rebuilding).

`BASE_PATH` env is detected by `actions/configure-pages` and passed to `vite build`. Locally, default is `/`. PWA `start_url` and `scope` follow `BASE_PATH` so installs work under subpaths.

## Known landmines

- **Voice handler race**: `onResult` rerenders, then sets input value; `onEnd` must be a no-op when a result already fired (it sets `voiceActive=false` early). Fixed in `src/ui.ts` — don't reorder.
- **Search input loses focus on every keystroke** because of full re-render. Handler manually re-focuses + restores selection. If you change the rerender flow, preserve this.
- **`navigator.language === 'en-US'` in headless chromium** → `I18n` auto-detects English on first run. Tests must opt into a language explicitly.
- **`pnpm install --frozen-lockfile`** is used in CI. Always commit `pnpm-lock.yaml` after dep changes.
- **PWA service worker caches aggressively**. After a release, users may need to close + reopen the app or clear site data to pick up new code. `registerType: 'autoUpdate'` mitigates but doesn't eliminate.

## Roadmap reference

`docs/ROADMAP.md` tracks tier 3 (sync upgrades) + tier 4 (smart features). Tiers 1 and 2 plus all listed cross-cutting items are shipped. `CHANGELOG.md` is Keep-a-Changelog format and bumped per release.
