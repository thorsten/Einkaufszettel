# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/thorsten/Einkaufszettel/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/thorsten/Einkaufszettel/releases/tag/v0.2.0
[0.1.0]: https://github.com/thorsten/Einkaufszettel/releases/tag/v0.1.0
