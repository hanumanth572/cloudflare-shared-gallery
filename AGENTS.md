# Agent operating notes — Shared Gallery

Rules for any coding agent (or human) working in this repo. They exist because the app
must keep running on the **Cloudflare Workers Free plan**.

## Free-plan guardrails

- Do not introduce Durable Objects, Queues, Cron Triggers, KV, Cloudflare Access, or
  any paid feature. The allowed services are exactly: Workers (with Static Assets),
  R2, D1, and Images transformations via the `IMAGES` binding.
- **Never resize images inside the Worker.** Always offload to the Images binding
  reading the R2 stream (`env.IMAGES.input(obj.body)…`). In-Worker WASM resizing
  would exceed the 10 ms Free CPU limit.
- **Always cache transformed variants in the Cache API** (`caches.default`) so repeat
  requests do not re-transform and burn the 5,000-per-30-days allowance. Check the
  cache first, transform only on a miss, `cache.put` before returning.
- Do NOT enable the platform Worker response cache (`"cache": { "enabled": true }` in
  wrangler.jsonc) even though the Images docs suggest it: it serves cached responses
  **without running the Worker**, which would bypass the session gate on `/media/*`.
  Caching must stay inside the gated Worker.
- Stream originals end to end; never buffer a whole file into memory (128 MB cap).
  The Images binding input cap is 20 MB — the media route falls back to serving the
  original when a transform fails; keep that fallback.

## Security invariants

- The session token lives only in an httpOnly cookie (`sg_session`). Never write it
  to localStorage or expose it to client JavaScript.
- `JWT_SECRET` and `GALLERY_PASSWORD_HASH` are set with `wrangler secret put` and read
  from `env`. Never commit secrets; local values live in `.dev.vars` (gitignored).
- The display name (`sg_display_name` in localStorage, sent as the `X-Gallery-User`
  header) is **attribution only, never authorization**. Sanitize it server-side
  (`src/worker/lib/displayName.ts`), store it as `uploaded_by` / `added_by` /
  `created_by`, and never branch access decisions on it. Do not confuse it with the
  session cookie.
- Generate R2 keys server-side (`src/worker/lib/r2.ts`); never derive a key from a
  user-supplied filename.
- The session gate (`src/worker/middleware.ts`) runs before every `/api/*` route
  except `/api/health` and `/api/auth/*`, and before all `/media/*`. Keep API and
  media routes registered ahead of the static asset fallback (`run_worker_first`).

## Conventions

- Keep read endpoints and mutation endpoints cleanly separated so a public read mode
  is a later config change, not a refactor.
- `migrations/` is the canonical schema; `src/worker/db/schema.sql` is a generated
  convenience copy — update both when the schema changes, via a new migration file.
- Check platform behaviour against the Cloudflare docs (append `index.md` to a docs
  URL for markdown) rather than guessing binding APIs.
- Verify each phase of work with the local dev server (`npm run dev`) before
  deploying. `npm run check` must pass.
- Commit at the end of every phase of work with a message naming the phase.

## Deletion invariant

- Image deletion is SOFT: routes must only ever set deleted_at/deleted_by. The one
  hard-delete path is `purgeExpiredDeletions` (30-day lazy purge). Never add a
  user-facing permanent delete; the recovery window is the defence against a leaked
  shared password. All live queries must filter `deleted_at IS NULL`.

## Branding

- The footer credit ("Designed by bzwrd") follows the bzwrd brand pack
  (github.com/Zesty0wl/bzwrd-brand-pack, private): wordmark always lowercase, one
  blinking Volt (#CCFF00) caret as the only accent, link to bzwrd.co.uk kept. Styles
  live in styles.css under .bzwrd-credit; do not rebuild by hand.
- bzwrd house style: no em dashes in any user-visible copy. Use a comma, colon, full
  stop, or rephrase.
- UI icons are inline SVGs extracted from GitHub Octicons (MIT) in
  src/client/components/icons.tsx; no emoji glyphs in the UI. The app logo source is
  brand/logo-source.png; regenerate PWA icons with scripts/mk-icons.sh.
