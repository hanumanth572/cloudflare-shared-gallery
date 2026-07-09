# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com); versions follow semver.

## [1.3.0] - 2026-07-09

### Added

- Soft delete: deleting moves a photo to "Recently deleted" for 30 days; anyone can restore it, collection memberships included. Permanent removal happens only by time (lazy purge), so nothing is irrecoverable while the group is paying attention.
- "New since your last visit": a banner and per-photo dots on each device, tracked with a localStorage watermark; your own uploads are excluded.

## [1.2.0] - 2026-07-09

### Added

- EXIF capture metadata: taken date and camera are indexed on upload (originals in R2 always keep full metadata).
- Details overlay in the lightbox (info button or `i` key): capture date, camera, resolution, file info, uploader, collections.
- Clickable "Uploaded by" opens a per-person gallery at `/by/<name>`.
- Footer stats: photo count, contributors, and storage used against the free R2 allowance.
- `scripts/backfill-exif.mjs` to index metadata for photos uploaded before 1.2.

## [1.1.0] - 2026-07-09

### Added

- Drag and drop anywhere on the page, including whole folders; uploads run through a concurrency-limited queue with aggregate progress.
- Automatic retry with backoff for transient upload failures (429/5xx/network).
- Batch prompt on multi-file uploads: file everything into an existing or new collection, or leave untagged.
- Shift-click range selection and a Download action for selected photos.

### Changed

- UI icons are now GitHub Octicons (inline SVG); app logo used throughout.

## [1.0.0] - 2026-07-09

Initial release.

- Single Cloudflare Worker (Free plan) serving a React SPA and JSON API; R2 for originals, D1 for metadata.
- Shared-password login with 30-day JWT session cookie, sliding renewal, and D1-backed login throttling.
- Uploads streamed to R2 with content validation; thumbnails and lightbox variants via the Images binding, cached with the Cache API.
- Three views (Home explorer, Photos, Collections), many-to-many collections with covers and attribution, swipe/keyboard lightbox with captions.
- Installable PWA with offline app shell; gated responses are never cached.
