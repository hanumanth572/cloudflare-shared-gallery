# Shared Gallery

A 100% serverless, private, shared image gallery running entirely on Cloudflare. Anyone
who knows the shared password can upload photos, browse them, organise them into
collections (virtual folders — a photo can live in many at once), and see who added
what. Mobile is a first-class citizen: the app is an installable PWA with camera
capture, swipe navigation, and a bottom nav.

The whole app — React SPA and JSON API — ships as a **single Cloudflare Worker with
Static Assets**. Originals live in **R2**, metadata in **D1**, and resized variants are
produced on demand by **Cloudflare Images transformations** through the Workers
`IMAGES` binding, cached with the Cache API.

## Constraints (read before adding features)

This app is built to run entirely on the **Cloudflare Workers Free plan**, with no paid
bindings or add-ons. These are the ceilings that shaped the design:

| Service | Free limit that matters |
| --- | --- |
| Workers (with Static Assets) | 100,000 requests/day; **10 ms CPU per invocation**; 128 MB memory; 50 subrequests/invocation; 3 MB compressed Worker; 100 MB max request body |
| R2 | 10 GB storage; 1M Class A ops/month; 10M Class B ops/month; no egress fees |
| D1 | 5 GB per database; 5M rows read/day; 100k rows written/day |
| Cloudflare Images transformations | **5,000 unique transformations per 30 days** |

- **Image transformations are capped at 5,000 unique transformations per 30 days.**
  With two variant presets per image (`thumb` 480w, `full` 1600w), that is a practical
  ceiling of roughly **2,500 images**. This is expected to be sufficient for current
  use; if the library grows past it, the levers are: stay at two presets, add a custom
  domain, or enable the Images Paid plan ($0.50 per 1,000 transformations). None of
  these need code changes.
- **The 10 ms CPU limit is why image resizing is offloaded to the Images binding and
  must never be done in the Worker.** A WASM codec decoding a photo would blow the CPU
  budget instantly. The Worker only orchestrates streams (R2 → Images pipeline), so
  never buffer a whole original into memory either.
- **Repeat variant requests must never re-transform.** Every transformed variant is
  stored in the Cache API with an immutable 1-year TTL, checked *after* the session
  gate. This caching is what keeps usage inside the 5,000/30-days allowance. Note that
  the Cache API is a no-op on `*.workers.dev` — put the app behind a **custom domain**
  for the cache layer (and therefore the transformation budget) to work in production.
- Worker requests are capped at 100,000/day. Every thumbnail request invokes the
  Worker, so a 40-tile screen is ~40–45 requests — around 2,000 screen loads/day.
  Browser-side `Cache-Control` on variants makes repeat views nearly free.
- Deliberately **not** used (some are not on the Free plan in the shape this app would
  need, none are necessary): Durable Objects, Queues, Cron Triggers, Workers KV,
  Cloudflare Access, and the platform-level Worker response cache (`cache.enabled` —
  it would serve gated `/media/*` bytes without running the session gate).

## Setup

Prerequisites: Node 20+, npm, a Cloudflare account (Free plan is fine).

```sh
npm install

# 1. Create the remote resources (once)
npx wrangler login
npx wrangler r2 bucket create shared-gallery-media
npx wrangler d1 create shared-gallery-db
#    ...then paste the returned database_id into wrangler.jsonc

# 2. Apply the schema
npx wrangler d1 migrations apply shared-gallery-db --remote

# 3. Enable transformations (once, in the dashboard)
#    Dashboard -> Images -> Transformations -> enable for the zone that will
#    serve the app. Variants 404/fail until this is on.

# 4. Secrets (never in wrangler.jsonc, never committed)
node scripts/hash-password.mjs "your shared password"
npx wrangler secret put GALLERY_PASSWORD_HASH   # paste the pbkdf2$... string
openssl rand -base64 32 | npx wrangler secret put JWT_SECRET

# 5. Deploy
npm run deploy
```

### Local development

```sh
cp .dev.vars.example .dev.vars        # fill in a JWT_SECRET and a hash from step 4
npx wrangler d1 migrations apply shared-gallery-db --local
npm run dev                           # Vite dev server with local R2/D1/Images
```

`npm run check` typechecks both the client and the Worker. `npm run preview` builds
and serves the production bundle in the Workers runtime locally.

## Auth model

One shared password for the whole gallery. A correct login mints a 30-day HS256 JWT
(`jose`), delivered in an `sg_session` httpOnly cookie (`Secure; SameSite=Lax`), with
sliding renewal inside the last 7 days. The password is stored only as a PBKDF2-SHA256
hash (100k iterations) in a Wrangler secret. Login is throttled per IP via a D1 table
(>10 failures in 5 minutes → 429). Display names are self-declared labels for
attribution only — they are never authorization.

- **Log everyone out at once** (the only revocation mechanism, since JWTs are
  stateless): rotate the secret — `openssl rand -base64 32 | npx wrangler secret put
  JWT_SECRET`. Every device must re-enter the shared password.
- **Change the password**: run `scripts/hash-password.mjs` with the new password and
  `wrangler secret put GALLERY_PASSWORD_HASH` again. Existing sessions stay valid
  until they expire; rotate `JWT_SECRET` too if that matters.

## How media serving stays cheap

`GET /media/:key` streams the original from R2. `GET /media/:key?v=thumb|full`
negotiates AVIF/WebP/JPEG from the `Accept` header, transforms via `env.IMAGES`
(`fit=scale-down`, widths 480/1600), and caches the result in the Cache API keyed by
`key + variant + format`. Both routes require a valid session; originals are never
publicly reachable. The transform runs on Cloudflare's image pipeline, not Worker CPU.

## Project layout

```
src/worker/     Worker: router, session middleware, routes (auth/images/collections/media)
src/client/     React SPA: views, components, fetch client, PWA registration
src/shared/     API types shared by both
migrations/     D1 migrations (canonical schema)
scripts/        hash-password.mjs, mk-icons.mjs
public/         manifest, service worker, icons
```
