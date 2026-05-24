-- Drop the join table first to satisfy the foreign key from TimeEntryTag.tagId.
-- Both tables have ON DELETE CASCADE in the schema, but the migration runs
-- DDL directly so we still need to drop the dependent table first.
DROP TABLE IF EXISTS "TimeEntryTag";
DROP TABLE IF EXISTS "Tag";
