-- Adds soft-delete support for locations used by map editor trash and game selection.
-- For existing local development databases, run this once if you do not use `npm run db:fix`.

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'locations'
    AND COLUMN_NAME = 'is_deleted'
);

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE locations ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE',
  'SELECT ''locations.is_deleted already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'locations'
    AND INDEX_NAME = 'idx_locations_map_deleted'
);

SET @sql := IF(
  @index_exists = 0,
  'ALTER TABLE locations ADD INDEX idx_locations_map_deleted (map_id, is_deleted)',
  'SELECT ''idx_locations_map_deleted already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
