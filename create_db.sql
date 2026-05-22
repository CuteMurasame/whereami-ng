CREATE DATABASE IF NOT EXISTS whereami_db;
USE whereami_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) UNIQUE,
  avatar_url VARCHAR(255),
  bio TEXT,
  password_hash VARCHAR(255) NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  is_root BOOLEAN DEFAULT FALSE,
  is_banned BOOLEAN DEFAULT FALSE,
  google_id VARCHAR(255) UNIQUE,
  google_email VARCHAR(255) UNIQUE,
  elo_rating INT DEFAULT 1500,
  peak_elo INT DEFAULT 1500,
  elo_games INT DEFAULT 0,
  total_duels INT DEFAULT 0,
  total_wins INT DEFAULT 0,
  total_losses INT DEFAULT 0,
  total_draws INT DEFAULT 0,
  is_bot BOOLEAN DEFAULT FALSE,
  bot_accuracy FLOAT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  creator_id INT,
  is_official BOOLEAN DEFAULT FALSE,
  is_singleplayer BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  map_id INT,
  pano_id VARCHAR(255) NOT NULL,
  lat DOUBLE NOT NULL,
  lng DOUBLE NOT NULL,
  country_code VARCHAR(5),
  is_deleted BOOLEAN DEFAULT FALSE,
  INDEX idx_locations_map_deleted (map_id, is_deleted),
  FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS games (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  map_id INT,
  type ENUM('singleplayer', 'duels', 'battleroyales') DEFAULT 'singleplayer',
  mode ENUM('moving', 'nm', 'nmpz') DEFAULT 'moving',
  status ENUM('waiting', 'active', 'finished') DEFAULT 'active',
  total_score INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS guesses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  game_id INT,
  location_id INT,
  round_number INT NOT NULL,
  guess_lat DOUBLE,
  guess_lng DOUBLE,
  score INT DEFAULT 0,
  distance_meters INT,
  time_taken INT,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS system_settings (
  id INT PRIMARY KEY DEFAULT 1,
  email_enabled BOOLEAN DEFAULT FALSE,
  maintenance_mode BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS rating_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  game_id INT,
  duel_id INT,
  old_rating INT NOT NULL,
  new_rating INT NOT NULL,
  rating_change INT DEFAULT 0,
  rank_position INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rating_history_user_duel (user_id, duel_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (duel_id) REFERENCES duels(id) ON DELETE CASCADE
);


INSERT IGNORE INTO system_settings (id, email_enabled, maintenance_mode) VALUES (1, 0, 0);
