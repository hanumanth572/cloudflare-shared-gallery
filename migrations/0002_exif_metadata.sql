-- Migration 0002: indexed EXIF capture metadata.
-- Originals in R2 always keep their full metadata untouched; these columns
-- surface the capture time and camera in the API and details pane.
ALTER TABLE images ADD COLUMN taken_at INTEGER;
ALTER TABLE images ADD COLUMN camera TEXT;
