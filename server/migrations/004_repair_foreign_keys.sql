-- Repairs foreign keys after the duel update for existing local development databases.
-- Prefer `npm run db:fix`; this file is provided for users who apply migrations manually.

SET @schema_name = DATABASE();

-- Normalize the one relationship that caused MySQL errno 150 in older schemas.
SET @fk_name := (
  SELECT CONSTRAINT_NAME
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'locations'
    AND COLUMN_NAME = 'map_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @sql := IF(@fk_name IS NOT NULL, CONCAT('ALTER TABLE locations DROP FOREIGN KEY `', @fk_name, '`'), 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE locations MODIFY COLUMN map_id INT NULL;
UPDATE locations l LEFT JOIN maps m ON l.map_id = m.id SET l.map_id = NULL WHERE l.map_id IS NOT NULL AND m.id IS NULL;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'locations'
    AND CONSTRAINT_NAME = 'fk_locations_map'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(
  @fk_exists = 0,
  'ALTER TABLE locations ADD CONSTRAINT fk_locations_map FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
