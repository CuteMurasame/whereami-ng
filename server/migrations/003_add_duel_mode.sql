-- Duel mode, rating stats, and rating history linkage.
-- This migration is intentionally defensive so it can be run on existing local dev databases.

SET @schema_name = DATABASE();

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'peak_elo') = 0,
  'ALTER TABLE users ADD COLUMN peak_elo INT DEFAULT 1500 AFTER elo_rating',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'elo_games') = 0,
  'ALTER TABLE users ADD COLUMN elo_games INT DEFAULT 0 AFTER peak_elo',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'total_duels') = 0,
  'ALTER TABLE users ADD COLUMN total_duels INT DEFAULT 0 AFTER elo_games',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'total_wins') = 0,
  'ALTER TABLE users ADD COLUMN total_wins INT DEFAULT 0 AFTER total_duels',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'total_losses') = 0,
  'ALTER TABLE users ADD COLUMN total_losses INT DEFAULT 0 AFTER total_wins',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'total_draws') = 0,
  'ALTER TABLE users ADD COLUMN total_draws INT DEFAULT 0 AFTER total_losses',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE users SET peak_elo = GREATEST(COALESCE(peak_elo, 1500), COALESCE(elo_rating, 1500));

CREATE TABLE IF NOT EXISTS duel_queue (
  user_id INT PRIMARY KEY,
  mode ENUM('moving', 'nm', 'nmpz') DEFAULT 'moving',
  map_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_duel_queue_match (map_id, mode, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS duels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  player1_id INT NOT NULL,
  player2_id INT NOT NULL,
  map_id INT,
  mode ENUM('moving', 'nm', 'nmpz') DEFAULT 'moving',
  status ENUM('playing', 'round_results', 'finished', 'cancelled') DEFAULT 'playing',
  current_round INT DEFAULT 1,
  total_rounds INT DEFAULT 5,
  player1_score INT DEFAULT 0,
  player2_score INT DEFAULT 0,
  winner_id INT,
  result ENUM('player1', 'player2', 'draw', 'cancelled'),
  player1_rating_before INT,
  player2_rating_before INT,
  player1_rating_after INT,
  player2_rating_after INT,
  player1_rating_change INT DEFAULT 0,
  player2_rating_change INT DEFAULT 0,
  finished_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_duels_player1_status (player1_id, status),
  INDEX idx_duels_player2_status (player2_id, status),
  FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS duel_rounds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  duel_id INT NOT NULL,
  location_id INT,
  round_number INT NOT NULL,
  player1_guess_lat DOUBLE,
  player1_guess_lng DOUBLE,
  player1_score INT DEFAULT 0,
  player1_distance_meters INT,
  player1_guessed_at DATETIME NULL,
  player2_guess_lat DOUBLE,
  player2_guess_lng DOUBLE,
  player2_score INT DEFAULT 0,
  player2_distance_meters INT,
  player2_guessed_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_duel_round (duel_id, round_number),
  FOREIGN KEY (duel_id) REFERENCES duels(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
);

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'rating_history' AND COLUMN_NAME = 'duel_id') = 0,
  'ALTER TABLE rating_history ADD COLUMN duel_id INT NULL AFTER game_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'rating_history' AND COLUMN_NAME = 'rating_change') = 0,
  'ALTER TABLE rating_history ADD COLUMN rating_change INT DEFAULT 0 AFTER new_rating',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'rating_history' AND COLUMN_NAME = 'duel_id' AND REFERENCED_TABLE_NAME = 'duels');
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE rating_history ADD CONSTRAINT fk_rating_history_duel FOREIGN KEY (duel_id) REFERENCES duels(id) ON DELETE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
