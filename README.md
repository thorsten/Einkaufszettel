# Einkaufszettel

Offline shopping list PWA for **V-MARKT, ALDI, EDEKA, REWE**. Built for two iPhones, no backend.

- 📱 Installs to iPhone home screen, works offline (PWA + service worker)
- 🌓 Dark / light / auto theme toggle
- 📝 Lists stored as Markdown in `localStorage` — human-readable, exportable
- 🔄 Two-device sync via Markdown file exchange (AirDrop / iCloud Drive / Files)
- 🧩 CRDT merge — conflict-free, deterministic, commutative
- 🪦 Tombstones for deletes, 30-day GC
- ⚡ No frontend framework. TypeScript + Tailwind v4 + bare DOM
- ✅ 60 vitest tests

## Requirements

- Node.js **≥ 24**
- pnpm **10** (or compatible)

## Quick start

```bash
pnpm install
pnpm dev             # local dev server
pnpm test            # vitest run
pnpm lint            # prettier --check + tsc --noEmit
pnpm build           # production build (PWA)
pnpm preview --host  # serve dist on LAN — open URL on iPhone Safari
```

## Install on iPhone

1. `pnpm preview --host` on Mac
2. Open `http://<mac-ip>:4173` in Safari on iPhone
3. Share → **Add to Home Screen**
4. Launches full screen, runs offline

For real deployment see [Deployment](#deployment).

## Two-iPhone sync workflow

No server. Markdown files are the wire format.

1. **Phone A**: tap **Export** → "Save to Files" → iCloud Drive folder.
2. **Phone B**: tap **Sync** → file picker → choose Phone A's `.md`.
3. Local list + incoming list merge deterministically. Phone A's edits show up.
4. Phone B re-exports, Phone A imports. Symmetric.

Each export is named `einkaufszettel-<deviceId>-<date>.md` so files don't collide.

## Architecture

```
src/
  main.ts         entry, wires storage + theme + clock + device
  types.ts        SHOPS const, Item with CRDT fields
  clock.ts        Lamport logical clock
  device.ts       per-device random ID, persisted
  markdown.ts     serialize / parse — schema with HTML-comment metadata
  merge.ts        LWW-Element-Set CRDT, tombstone GC
  storage.ts      ListStore over localStorage, mergeMarkdown
  theme.ts        ThemeController (system / light / dark)
  ui.ts           render + bind, mutations bump clock
  style.css       Tailwind v4 + class-based dark variant + safe-area
```

### Wire format

Each item is a Markdown task line plus an HTML-comment metadata trailer:

```markdown
# ALDI

- [ ] Milch (2 L) <!-- id:lqx-9k2 ts:1714831200000 lamport:3 dev:lqw-aab tomb:0 -->
- [x] Brot <!-- id:lqx-9k3 ts:1714831260000 lamport:5 dev:lqw-bbc tomb:0 -->
```

| Field     | Purpose                                                     |
| --------- | ----------------------------------------------------------- |
| `id`      | Stable item UUID, shared across devices                     |
| `ts`      | Wall-clock ms of last edit                                  |
| `lamport` | Logical counter, advances on every edit, monotonic per item |
| `dev`     | Originating device ID                                       |
| `tomb`    | `1` = tombstoned (soft delete)                              |

The HTML comment is inert in any Markdown renderer, so the file stays readable.

### Merge rules (LWW per `id`)

For two items with the same `id`, keep the one with the **larger tuple** `(lamport, ts, dev)`. Properties:

- **Idempotent**: `merge(a, a) = a`
- **Commutative**: `merge(a, b) = merge(b, a)`
- **Associative**: order across N files does not matter
- **Tombstone semantics**: deletion is just another edit — newer edits resurrect, newer tombstones win
- **GC**: tombstones older than 30 days are dropped on next merge

### Why per-item metadata, not a separate sync log

iCloud Drive — like any plain file sync — does not merge file contents. Concurrent writes to a shared file produce `-conflict-N.md` siblings and lost edits. Per-item CRDT pushes the merge into the application and lets each device write its **own** Markdown file (one writer per file = no conflict possible). Reading is a union.

## Storage

| Key                     | Contents                                 |
| ----------------------- | ---------------------------------------- |
| `einkaufszettel.v1.md`  | Full list as Markdown                    |
| `einkaufszettel.device` | Random per-device ID (minted on 1st run) |
| `einkaufszettel.theme`  | `system` \| `light` \| `dark`            |

Wipe: clear site data in Safari → fresh device ID, empty list.

## Tests

```bash
pnpm test            # 60 tests, ~10 s
pnpm test:watch      # watch mode
```

| File                     | Coverage                                 |
| ------------------------ | ---------------------------------------- |
| `tests/clock.test.ts`    | Lamport observe / tick / non-finite      |
| `tests/device.test.ts`   | ID minting + persistence                 |
| `tests/markdown.test.ts` | Round-trip, legacy fallback, tombstones  |
| `tests/merge.test.ts`    | LWW, tombstone behavior, idempotence     |
| `tests/storage.test.ts`  | localStorage + mergeMarkdown integration |
| `tests/theme.test.ts`    | Cycle, persistence, media-query reaction |
| `tests/ui.test.ts`       | Render, add / toggle / delete, XSS       |

## Deployment

### GitHub Pages (automatic)

A GitHub Actions workflow at [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and pull request:

| Job        | When                   | Steps                                      |
| ---------- | ---------------------- | ------------------------------------------ |
| **test**   | every push + PR        | `pnpm install` → `pnpm lint` → `pnpm test` |
| **build**  | after `test` passes    | `pnpm build` with Pages-aware `BASE_PATH`  |
| **deploy** | only on push to `main` | publishes `dist/` artifact to GitHub Pages |

One-time repo setup:

1. **Settings → Pages → Source**: select **GitHub Actions**.
2. Push to `main`. Workflow runs, deploys to `https://<user>.github.io/<repo>/`.
3. Subsequent pushes auto-redeploy.

`BASE_PATH` is detected automatically by `actions/configure-pages` and passed to `vite build`. PWA `start_url` and `scope` follow the base path.

### Custom domain or root path

Set the GitHub Pages custom domain in repo settings, or override locally:

```bash
BASE_PATH=/ pnpm build           # root deploy
BASE_PATH=/some-path/ pnpm build # custom subpath
```

### Other static hosts

Run `pnpm build`, upload `dist/`. Works on Netlify, Cloudflare Pages, Vercel, S3, any static host. Set `BASE_PATH=/` (default) unless serving from subpath.

## Tech

- **Node.js 24+** runtime
- **Vite 7** — dev server + build
- **TypeScript 6** strict
- **Tailwind v4** with class-based `dark` variant
- **vite-plugin-pwa 1.x** — service worker, manifest, autoUpdate
- **Vitest 4** + **happy-dom 20** — unit + DOM tests
- **Prettier 3** — formatting + lint
- **pnpm 10** — package manager

No React, Vue, Svelte, Solid, lit, etc. Just TypeScript and DOM.

## Roadmap (optional)

- Push sync via CloudKit shared zone (replace file picker, keep merge logic untouched)
- Reorder items (drag-and-drop) — needs `pos` field in CRDT
- Per-shop categories / sections
- Quantity stepper for common units

## License

MIT — see [LICENSE](LICENSE).
