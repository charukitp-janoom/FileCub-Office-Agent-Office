-- Phase 6 performance pass: index the hot lookups that were missing.
--
-- permissions is queried on every single permission-checker.check() call
-- (i.e. on every file import/organize) but had no index at all — every
-- check was a full table scan.
CREATE INDEX IF NOT EXISTS idx_permissions_user_resource ON permissions(user_id, resource_type);

-- scan-import.service.ts's duplicate-import guard queries files by
-- (owner_id, path) on every manual-upload / scan-import / desktop-auto
-- -import call, but the only existing index is on (owner_id, category_id).
CREATE INDEX IF NOT EXISTS idx_files_owner_path ON files(owner_id, path);
