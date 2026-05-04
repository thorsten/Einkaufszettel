# Roadmap

Feature backlog grouped by impact-to-effort. Pick what matches priorities.

## Tier 1 — quick wins ✅ shipped 2026-05-04 (v0.2.0)

All eight Tier 1 features implemented. See [Done](#done) at bottom.

## Tier 2 — meaningful ✅ shipped 2026-05-04 (v0.3.0)

All seven Tier 2 features implemented. See [Done](#done) at bottom.

## Tier 3 — sync upgrades (3–7 days)

Only worth it if file-picker sync proves clunky.

| Feature                             | Trade-off                                                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **QR-code handshake → WebRTC sync** | Two phones scan QR, peer connection, push merged CRDT. No backend. Works only when both online and nearby.                    |
| **Native iOS shell (Capacitor)**    | Real iCloud Drive read/write via `NSFileCoordinator` + `NSMetadataQuery` — sync becomes invisible. Adds Xcode build pipeline. |
| **CloudKit private DB + CKShare**   | True push sync, no native shell needed for offline. Ties you to Apple ID.                                                     |
| **Supabase realtime** (alt)         | Cross-platform (also web), realtime channel, RLS. Adds backend + auth.                                                        |

## Tier 4 — smart features (1–2 weeks each, optional)

| Feature                 | Why interesting                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Barcode scan**        | Camera (`getUserMedia`) + ZXing-WASM + Open Food Facts API → name, qty, shop.                                            |
| **LLM auto-categorize** | "Apfelsaft" typed under V-Markt → suggest moving to REWE if user usually buys juice there. Local model or Anthropic API. |
| **Price tracking**      | Optional `price` field. Graph over time per item × shop.                                                                 |
| **Recipe → list**       | Paste recipe URL → extract ingredients → distribute to shops.                                                            |

## Cross-cutting

- ✅ **E2E tests** with Playwright + iOS Safari emulator (touch + install flow) — shipped 2026-05-04
- ✅ **Coverage threshold** ≥ 90 % lines — shipped 2026-05-04
- ✅ **Lighthouse PWA score** check in CI — shipped 2026-05-04
- ✅ **Bundle-size budget** via size-limit — shipped 2026-05-04
- **Storage migration framework** (`v1.md` → `v2.md` schema bump path)

## Suggested phasing

| Phase     | Scope                                                          | Outcome                                       |
| --------- | -------------------------------------------------------------- | --------------------------------------------- |
| **0.2.0** | Tier 1 + coverage gate                                         | App feels native. Edit + swipe + undo. de/en. |
| **0.3.0** | Categories + autocomplete + search + custom shops              | Scales to 100+ items per shop comfortably.    |
| **0.4.0** | Drag reorder + templates + voice input                         | Feature-complete-ish list app.                |
| **0.5.0** | One sync upgrade — pick **QR + WebRTC** (cheapest, no backend) | Push-sync without leaving PWA.                |
| **1.0.0** | Polish: Lighthouse 100, E2E suite, storage migration framework | Stable release.                               |

## Top three picks

If forced to pick three first: **edit-in-place**, **swipe-to-delete**, **recent-items autocomplete**. Three small, three big perceived-quality jumps, all stay within current architecture.

## How to use this doc

- Mark a feature in-flight with [WIP] in front of the row.
- On ship: move row to a "Done" section at the bottom with version + date.
- Replace any tier section if scope shifts. Keep file under ~300 lines.

## Done

### v0.3.0 — 2026-05-04

| Feature                   | Module                                                                 |
| ------------------------- | ---------------------------------------------------------------------- |
| Categories within a shop  | `cat?: string` in `src/types.ts`; grouped render in `src/ui.ts`        |
| Recent-items autocomplete | `src/history.ts` `buildSuggestions`; `<datalist>` in add form          |
| Item search / filter      | `src/ui.ts` search input + `matchesSearch`                             |
| Up/down reorder           | `pos: number` in `src/types.ts`; `move-up` / `move-down` actions in UI |
| Custom shops              | `src/shops.ts` `ShopRegistry`; `Shop = string`; settings drawer        |
| Shopping templates        | `src/templates.ts` `TemplateStore`; settings drawer                    |
| Voice input               | `src/voice.ts` `startVoice` (Web Speech API)                           |

### v0.2.0 — 2026-05-04

| Feature                | Module                                  |
| ---------------------- | --------------------------------------- |
| Edit item in place     | `src/ui.ts` (edit form + state)         |
| Swipe-to-delete (iOS)  | `src/gestures.ts` `attachSwipeLeft`     |
| Clear all checked      | `src/ui.ts` (bulk tombstone)            |
| Undo last action       | `src/undo.ts` `UndoStack` + toast       |
| Web Share API export   | `src/share.ts` `shareMarkdown`          |
| Pull-to-refresh = Sync | `src/gestures.ts` `attachPullToRefresh` |
| i18n de/en toggle      | `src/i18n.ts` `I18n`                    |
| Coverage gate in CI    | `vite.config.ts` thresholds + workflow  |
