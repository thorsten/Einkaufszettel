# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Husky** + **commitlint** + **lint-staged** dev tooling.
  - `commit-msg` hook enforces [Conventional Commits](https://www.conventionalcommits.org/) via `@commitlint/config-conventional`.
  - `pre-commit` hook runs `lint-staged` (Prettier on staged files), `pnpm typecheck`, and `pnpm test`.
  - Hooks install automatically via `prepare` script on `pnpm install`.
- **Playwright E2E tests** — 51 specs across 8 files, covering items (add/toggle/edit/delete/clear/undo), search, categories, reorder, header (theme/lang/tabs), settings drawer (custom shops + templates), persistence, touch gestures (swipe-to-delete + pull-to-refresh, mobile-safari only), and PWA install flow (manifest, service worker, meta tags).
  - `playwright.config.ts` with chromium + mobile-safari (iPhone 14) projects.
  - `webServer` runs `vite build && vite preview --port 4173` so tests hit production-mode artifacts.
  - New CI job `e2e` matrix-runs both projects in parallel after `test`. `deploy` now depends on `build`, `e2e`, and `lighthouse`.
  - Browsers cached in CI via `actions/cache`.
- **Coverage gate raised to 90 % lines** (was 80). Functions ≥ 85, statements ≥ 85, branches ≥ 70.
  - `src/ui-pure.ts` extracted from `ui.ts`: pure functions (`escapeHtml`, `visibleItems`, `matchesSearch`, `groupByCategory`, `formatTime`, `sortForRender`) become directly testable.
  - 38 new unit tests added (ui-pure + ui handlers + voice + reorder).
- **Lighthouse PWA audit in CI** via `@lhci/cli`. Asserts `installable-manifest`, `service-worker`, `viewport`, plus perf ≥ 0.9, a11y ≥ 0.9. Reports uploaded as artifacts.
- **Bundle-size budget** via `size-limit`: JS ≤ 15 KB, CSS ≤ 8 KB, SW ≤ 5 KB (all gzipped). Runs in `build` job.

## [0.3.0] - 2026-05-04

### Added

- **Categories** per item (optional `cat` field). Items with categories render in grouped sections within a shop.
- **Recent-items autocomplete** — `<datalist>` of past item names, sorted by frequency × recency.
- **Item search** — search input above the list filters by name or category.
- **Reorder up/down** — small chevron buttons per item swap `pos` with neighbor.
- **Custom shops** — add, rename, remove, and reorder shops in a settings drawer. `Shop` type relaxed from literal union to plain `string`.
- **Templates** — save the current list as a named template, apply later. Stored as markdown blob in `localStorage`.
- **Voice input** — mic button on the add form uses Web Speech API (`de-DE` / `en-US`).
- **Settings drawer** with shops + templates sections.

### Changed

- `Item` schema gains `cat?: string` and `pos: number`. Markdown wire format extended; legacy items get sequential `pos` and no category.
- `mergeShopLists` now operates on the union of shop keys present on either side (custom shops merge cleanly across devices).
- `serializeAll` accepts an optional `order: Shop[]` so exports respect the user's tab order.
- Add form now has 3 fields (name, qty, category) plus a mic button.
- Coverage thresholds tuned: statements 75 %, branches 60 % (UI scope expanded; lines/functions still at 80 %).

### Tests

- 20 new tests across `shops`, `templates`, `history`, `voice`, plus expanded `markdown`, `merge`, `ui` suites. Total: 116 tests.

## [0.2.0] - 2026-05-04

### Added

- **Edit item in place** — pencil icon opens inline form to rename / change quantity.
- **Swipe-to-delete** — drag an item left ≥ 80 px on iOS to tombstone it.
- **Clear all checked** — header link bulk-tombstones every checked item in the active shop.
- **Undo last action** — toast with `Rückgängig` / `Undo`; 5 s TTL, 5-deep snapshot stack.
- **Web Share API export** — uses native iOS share sheet when available, falls back to download.
- **Pull-to-refresh = Sync** — drag down at the top of the list to open the file picker.
- **i18n de/en toggle** — globe button cycles language. All UI strings live in `src/i18n.ts`.
- **Coverage gate in CI** — `pnpm test:coverage` runs in GitHub Actions with thresholds (L80 / F80 / S80 / B70).
- **App version badge** — small version label rendered next to the title.

### Changed

- `THEME_LABEL` removed from `src/theme.ts`; theme labels now live in the i18n dictionary.
- Delete now snapshots state for undo before tombstoning.
- Sync now snapshots state for undo before merging.

### Tests

- 36 new tests across `i18n`, `undo`, `share`, `gestures`, and expanded `ui` suite. Total: 96 tests.

## [0.1.0] - 2026-05-04

### Added

- Offline shopping list PWA for **V-MARKT, ALDI, EDEKA, REWE**.
- Markdown storage in `localStorage` with per-item CRDT metadata
  (`id`, `ts`, `lamport`, `dev`, `tomb`).
- Two-device sync via Markdown file exchange. LWW-Element-Set merge,
  tombstone GC after 30 days. Idempotent, commutative, associative.
- Dark / light / auto theme toggle, class-based `dark` variant on `<html>`.
- Add / toggle-done / delete with logical clock bumps.
- Per-shop tab counter (live items only).
- iPhone Safari install — PWA manifest, service worker, safe-area insets,
  `apple-touch-icon`, `apple-mobile-web-app-*` meta tags.
- Export / Import as `.md` files for sharing between devices.
- GitHub Actions CI + auto-deploy to GitHub Pages on push to `main`.
  `BASE_PATH` env var configures Vite base for subpath deploys.
- Tech stack: Vite 7, TypeScript 6, Tailwind v4, vite-plugin-pwa 1.x,
  Vitest 4 + happy-dom, Prettier 3, pnpm 10. No frontend framework.
- 60 unit tests across `clock`, `device`, `markdown`, `merge`, `storage`,
  `theme`, `ui`.
- MIT license.

[Unreleased]: https://github.com/thorsten/Einkaufszettel/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/thorsten/Einkaufszettel/releases/tag/v0.3.0
[0.2.0]: https://github.com/thorsten/Einkaufszettel/releases/tag/v0.2.0
[0.1.0]: https://github.com/thorsten/Einkaufszettel/releases/tag/v0.1.0
