-- Adds the maintenance mode toggle to existing local development databases.
-- For existing databases, run this once if you do not use `npm run db:fix`.

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'system_settings'
    AND COLUMN_NAME = 'maintenance_mode'
);

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE system_settings ADD COLUMN maintenance_mode BOOLEAN DEFAULT FALSE',
  'SELECT ''system_settings.maintenance_mode already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO system_settings (id, email_enabled, maintenance_mode) VALUES (1, 0, 0);
