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

CREATE TABLE IF NOT EXISTS rating_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  game_id INT,
  old_rating INT NOT NULL,
  new_rating INT NOT NULL,
  rank_position INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

INSERT IGNORE INTO system_settings (id, email_enabled, maintenance_mode) VALUES (1, 0, 0);
