-- Migration 0003: soft delete for images.
-- Deleting marks the row and keeps the R2 original; nothing is destroyed
-- until the lazy purge removes items deleted more than 30 days ago.
-- Junction rows are kept so restoring also restores collection memberships.
ALTER TABLE images ADD COLUMN deleted_at INTEGER;
ALTER TABLE images ADD COLUMN deleted_by TEXT;
CREATE INDEX idx_images_deleted ON images(deleted_at) WHERE deleted_at IS NOT NULL;
