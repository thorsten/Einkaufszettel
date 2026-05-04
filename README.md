# Einkaufszettel

Offline shopping list PWA for **V-MARKT, ALDI, EDEKA, REWE**. Built for two iPhones, no backend.

- 📱 Installs to iPhone home screen, works offline (PWA + service worker)
- 🌓 Dark / light / auto theme toggle
- 📝 Lists stored as Markdown in `localStorage` — human-readable, exportable
- 🔄 Two-device sync via Markdown file exchange (AirDrop / iCloud Drive / Files)
- 🧩 CRDT merge — conflict-free, deterministic, commutative
- 🪦 Tombstones for deletes, 30-day GC
- ⚡ No frontend framework. TypeScript + Tailwind v4 + bare DOM
- ✅ 151 unit tests, 51 Playwright E2E specs (chromium + iOS Safari), 90 % line coverage gate, Lighthouse PWA gate, bundle-size budget, conventional-commits enforced via husky

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

## Two-iPhone sync — two options

### Option A: Markdown file exchange (offline, no backend)

1. **Phone A**: tap **Export** → "Save to Files" → iCloud Drive folder.
2. **Phone B**: tap **Sync** → file picker → choose Phone A's `.md`.
3. Local list + incoming list merge deterministically. Phone A's edits show up.
4. Phone B re-exports, Phone A imports. Symmetric.

Each export is named `einkaufszettel-<deviceId>-<date>.md` so files don't collide.

### Option B: Supabase realtime (push sync, optional)

Both phones now push every mutation as a debounced upsert and subscribe to Postgres-changes for the household. Local CRDT merge runs on every inbound row, so order/timing don't matter.

#### 1. Create a Supabase project

Sign in at [supabase.com](https://supabase.com) and create a free project (any region close to you).

#### 2. Run the schema

Dashboard → **SQL Editor** → **+ New query** → paste the contents of [`docs/supabase-schema.sql`](docs/supabase-schema.sql) → **Run**. This creates table `einkaufszettel_items`, enables RLS, and registers it for realtime.

#### 3. Find Supabase URL + anon key

Dashboard → **Project Settings ⚙ → API**.

| App field    | Dashboard field                      | Looks like                                     |
| ------------ | ------------------------------------ | ---------------------------------------------- |
| Supabase URL | "Project URL"                        | `https://abcdefghij.supabase.co`               |
| Anon key     | "Project API keys → `anon` `public`" | `eyJhbGciOiJIUzI1NiIs…` (long JWT, ~200 chars) |

⚠️ Use the **`anon`** key (safe to ship in a client). **Do not** use `service_role` — that key bypasses RLS and is server-only.

#### 4. Generate a household UUID (in the app, not Supabase)

The household UUID is generated client-side and **partitions your data inside the shared table**.

- Phone A: open ⚙ **Settings → Cloud-Sync (Supabase)** → tap **Neu generieren / Generate** next to **Haushalts-ID / Household ID**. App produces something like `b3a7f2e1-9c4d-4f12-aaaa-1234567890ab`.
- Both devices must use the **identical** household UUID — see step 5 for the easy way to copy it across.

#### 5. Share the config to Phone B (one tap)

After Phone A has all three fields filled, tap **Konfiguration teilen / Share config**. The app builds a URL like:

```
https://<your-pages-url>/#cfg=<base64url-blob>
```

The hash fragment encodes all three values (URL + anon key + household UUID). Phone A's iOS share sheet opens — pick **AirDrop**, **Messages**, **Mail**, anything.

Phone B taps the link → app opens → confirmation prompt: _"Cloud-Sync-Konfiguration aus diesem Link übernehmen?"_ → tap OK → config saved + applied. The hash is scrubbed from the URL after apply so it doesn't sit in browser history.

Fallbacks: if the device doesn't expose Web Share, the app copies the link to clipboard. If clipboard is also unavailable, it falls back to a `prompt()` dialog.

#### 6. Enable + save

Per device (Phone A always; Phone B only if you skipped step 5):

```
Supabase URL:   https://<project-ref>.supabase.co
Anon key:       eyJhbGc…
Household ID:   <generated on Phone A, copied to Phone B>
Enable:         ☑
```

Tap **Speichern / Save**. Status pill should turn **Verbunden / Connected** within ~1 s.

#### Security model

The household UUID is the **shared secret**. Anyone with URL + anon key + UUID can read and write that household's items. Don't paste the UUID into public Slack/Discord/screenshots. For stronger isolation, switch to Supabase Auth + a memberships table; tighten the RLS policies in `docs/supabase-schema.sql` accordingly.

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

## Commit conventions

This repo enforces [Conventional Commits](https://www.conventionalcommits.org/) via [commitlint](https://commitlint.js.org/) and a Husky `commit-msg` hook.

Format: `type(scope?): subject`. Allowed types: `feat`, `fix`, `docs`, `chore`, `build`, `ci`, `refactor`, `perf`, `test`, `style`, `revert`.

```
feat: add voice input
fix(merge): drop stale tombstones older than retention
docs(readme): refresh version table
```

A `pre-commit` hook runs:

1. `lint-staged` — Prettier formats every staged file in place
2. `pnpm typecheck` — `tsc --noEmit`
3. `pnpm test` — full Vitest suite

Hooks install automatically via the `prepare` script on `pnpm install`. Skip in emergencies with `git commit --no-verify` (don't make a habit of it).

## Tests

### Unit tests (Vitest)

```bash
pnpm test            # full suite, ~10 s
pnpm test:watch      # watch mode
pnpm test:coverage   # with coverage gate
```

### End-to-end tests (Playwright)

```bash
pnpm e2e:install     # one-time browser install (~250 MB)
pnpm e2e             # build + serve dist + run on chromium + mobile-safari
pnpm e2e:report      # open last HTML report
pnpm e2e --project=chromium     # only one browser
pnpm e2e --ui                   # interactive Playwright UI
```

E2E specs cover: items (add/toggle/edit/delete/clear/undo), search + categories, reorder, header (theme/lang/tabs), settings drawer (custom shops + templates), persistence across reload, touch gestures (swipe-to-delete + pull-to-refresh on mobile-safari only), and PWA install flow (manifest, service worker, meta tags).

The Playwright `webServer` runs `vite build && vite preview` on port 4173, so tests hit the same artifact that ships to GitHub Pages.

| File                      | Coverage                                               |
| ------------------------- | ------------------------------------------------------ |
| `tests/clock.test.ts`     | Lamport observe / tick / non-finite                    |
| `tests/device.test.ts`    | ID minting + persistence                               |
| `tests/markdown.test.ts`  | Round-trip, legacy fallback, tombstones, cat + pos     |
| `tests/merge.test.ts`     | LWW, tombstone behavior, idempotence, custom shops     |
| `tests/storage.test.ts`   | localStorage + mergeMarkdown integration               |
| `tests/theme.test.ts`     | Cycle, persistence, media-query reaction               |
| `tests/i18n.test.ts`      | Detect / cycle / lookup / fallback                     |
| `tests/undo.test.ts`      | Push / peek / pop / TTL / max entries                  |
| `tests/share.test.ts`     | Web Share API + download fallback                      |
| `tests/gestures.test.ts`  | Swipe-left + pull-to-refresh pointer events            |
| `tests/shops.test.ts`     | Add / rename / remove / move / reset                   |
| `tests/templates.test.ts` | Save / list / apply / remove                           |
| `tests/history.test.ts`   | Suggestions + categories                               |
| `tests/voice.test.ts`     | SpeechRecognition wrapper + support detection          |
| `tests/ui.test.ts`        | Render, add / toggle / delete / edit / undo / settings |

## Quality gates

| Gate              | Tool                              | Threshold                |
| ----------------- | --------------------------------- | ------------------------ |
| Coverage (lines)  | Vitest + v8                       | ≥ 90 %                   |
| Bundle size (JS)  | size-limit                        | ≤ 15 KB gzipped          |
| Bundle size (CSS) | size-limit                        | ≤ 8 KB gzipped           |
| Bundle size (SW)  | size-limit                        | ≤ 5 KB gzipped           |
| PWA installable   | Lighthouse `installable-manifest` | error if not installable |
| Service worker    | Lighthouse `service-worker`       | error if not registered  |
| Performance       | Lighthouse perf category          | ≥ 0.9                    |
| Accessibility     | Lighthouse a11y category          | ≥ 0.9                    |
| Best practices    | Lighthouse                        | warn if < 0.9            |

Run locally:

```bash
pnpm test:coverage   # coverage gate
pnpm build && pnpm size           # bundle size budget
pnpm build && pnpm lighthouse     # full Lighthouse audit
```

## Deployment

### GitHub Pages (automatic)

A GitHub Actions workflow at [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and pull request:

| Job            | When                               | Steps                                                                |
| -------------- | ---------------------------------- | -------------------------------------------------------------------- |
| **test**       | every push + PR                    | `pnpm lint` → `pnpm test:coverage` (≥ 90 % lines)                    |
| **e2e**        | after `test` passes                | Playwright × {chromium, mobile-safari} matrix, ~51 specs             |
| **build**      | after `test` passes                | `pnpm build` (with Pages `BASE_PATH`) → `pnpm size` (gzipped budget) |
| **lighthouse** | after `build` passes               | `lhci autorun` against `dist/` — perf / a11y / PWA / SEO audits      |
| **deploy**     | only on push to `main` (after all) | publishes `dist/` artifact to GitHub Pages                           |

Production URL: **<https://einkauf.rinne.bayern>**

One-time repo setup:

1. **Settings → Pages → Source**: select **GitHub Actions**.
2. **Settings → Pages → Custom domain**: enter `einkauf.rinne.bayern` (matches `public/CNAME` in this repo).
3. DNS: point an `A`/`AAAA` record (apex) or `CNAME` (subdomain) at GitHub Pages per [their docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).
4. Push to `main`. Workflow runs, deploys to the custom domain.
5. Subsequent pushes auto-redeploy.

`BASE_PATH` is detected automatically by `actions/configure-pages` and passed to `vite build`. With the custom domain set, base resolves to `/` so `start_url`, `scope`, and asset URLs all live at the domain root.

### Custom domain or subpath override

```bash
BASE_PATH=/ pnpm build           # root deploy (default with custom domain)
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

## Roadmap

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the full backlog grouped by tier and a suggested phasing.

## Changelog

See [`CHANGELOG.md`](CHANGELOG.md).

## License

MIT — see [LICENSE](LICENSE).
