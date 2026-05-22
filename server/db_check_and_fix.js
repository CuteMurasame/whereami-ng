const { sequelize } = require('./models');

const TABLES_TO_NORMALIZE = [
  'users',
  'maps',
  'locations',
  'games',
  'guesses',
  'system_settings',
  'rating_history',
  'duel_queue',
  'duels',
  'duel_rounds'
];

const IDENTIFIER_RE = /^[A-Za-z0-9_]+$/;

function quoteIdent(identifier) {
  if (!IDENTIFIER_RE.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `\`${identifier}\``;
}

async function run(sql, replacements) {
  console.log(sql);
  return sequelize.query(sql, { replacements });
}

async function tableExists(table) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?`,
    { replacements: [table] }
  );
  return Number(rows[0].count) > 0;
}

async function columnExists(table, column) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    { replacements: [table, column] }
  );
  return Number(rows[0].count) > 0;
}

async function indexExists(table, indexName) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?`,
    { replacements: [table, indexName] }
  );
  return Number(rows[0].count) > 0;
}

async function addColumnIfMissing(table, column, definition) {
  if (!(await tableExists(table)) || await columnExists(table, column)) return;
  await run(`ALTER TABLE ${quoteIdent(table)} ADD COLUMN ${quoteIdent(column)} ${definition}`);
}

async function modifyColumnIfExists(table, column, definition) {
  if (!(await tableExists(table)) || !(await columnExists(table, column))) return;
  await run(`ALTER TABLE ${quoteIdent(table)} MODIFY COLUMN ${quoteIdent(column)} ${definition}`);
}

async function addIndexIfMissing(table, indexName, definition) {
  if (!(await tableExists(table)) || await indexExists(table, indexName)) return;
  await run(`ALTER TABLE ${quoteIdent(table)} ADD INDEX ${quoteIdent(indexName)} ${definition}`);
}

async function foreignKeyExists(table, constraintName) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND CONSTRAINT_NAME = ?
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    { replacements: [table, constraintName] }
  );
  return Number(rows[0].count) > 0;
}

async function getForeignKeysForColumn(table, column) {
  const [rows] = await sequelize.query(
    `SELECT DISTINCT CONSTRAINT_NAME AS constraintName
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
    { replacements: [table, column] }
  );
  return rows.map((row) => row.constraintName);
}

async function dropForeignKeysForColumn(table, column) {
  if (!(await tableExists(table)) || !(await columnExists(table, column))) return;
  const constraints = await getForeignKeysForColumn(table, column);
  for (const constraintName of constraints) {
    await run(`ALTER TABLE ${quoteIdent(table)} DROP FOREIGN KEY ${quoteIdent(constraintName)}`);
  }
}

async function normalizeStorageEngine() {
  for (const table of TABLES_TO_NORMALIZE) {
    if (await tableExists(table)) {
      await run(`ALTER TABLE ${quoteIdent(table)} ENGINE=InnoDB`);
    }
  }
}

async function setInvalidNullableReferencesToNull(childTable, childColumn, parentTable, parentColumn = 'id') {
  if (!(await tableExists(childTable)) || !(await tableExists(parentTable))) return;
  if (!(await columnExists(childTable, childColumn)) || !(await columnExists(parentTable, parentColumn))) return;

  await run(
    `UPDATE ${quoteIdent(childTable)} child_table
       LEFT JOIN ${quoteIdent(parentTable)} parent_table
         ON child_table.${quoteIdent(childColumn)} = parent_table.${quoteIdent(parentColumn)}
        SET child_table.${quoteIdent(childColumn)} = NULL
      WHERE child_table.${quoteIdent(childColumn)} IS NOT NULL
        AND parent_table.${quoteIdent(parentColumn)} IS NULL`
  );
}

async function deleteInvalidRequiredReferences(childTable, childColumn, parentTable, parentColumn = 'id') {
  if (!(await tableExists(childTable)) || !(await tableExists(parentTable))) return;
  if (!(await columnExists(childTable, childColumn)) || !(await columnExists(parentTable, parentColumn))) return;

  await run(
    `DELETE child_table
       FROM ${quoteIdent(childTable)} child_table
       LEFT JOIN ${quoteIdent(parentTable)} parent_table
         ON child_table.${quoteIdent(childColumn)} = parent_table.${quoteIdent(parentColumn)}
      WHERE child_table.${quoteIdent(childColumn)} IS NOT NULL
        AND parent_table.${quoteIdent(parentColumn)} IS NULL`
  );
}

async function addForeignKeyIfMissing({ table, column, constraintName, referencesTable, referencesColumn = 'id', onDelete = 'SET NULL' }) {
  if (!(await tableExists(table)) || !(await tableExists(referencesTable))) return;
  if (!(await columnExists(table, column)) || !(await columnExists(referencesTable, referencesColumn))) return;
  if (await foreignKeyExists(table, constraintName)) return;

  await run(
    `ALTER TABLE ${quoteIdent(table)}
       ADD CONSTRAINT ${quoteIdent(constraintName)}
       FOREIGN KEY (${quoteIdent(column)})
       REFERENCES ${quoteIdent(referencesTable)} (${quoteIdent(referencesColumn)})
       ON DELETE ${onDelete}
       ON UPDATE CASCADE`
  );
}

async function ensureCoreColumns() {
  await addColumnIfMissing('users', 'avatar_url', 'VARCHAR(255) NULL');
  await addColumnIfMissing('users', 'bio', 'TEXT NULL');
  await addColumnIfMissing('users', 'is_admin', 'TINYINT(1) DEFAULT 0');
  await addColumnIfMissing('users', 'is_root', 'TINYINT(1) DEFAULT 0');
  await addColumnIfMissing('users', 'is_banned', 'TINYINT(1) DEFAULT 0');
  await addColumnIfMissing('users', 'google_id', 'VARCHAR(255) NULL UNIQUE');
  await addColumnIfMissing('users', 'google_email', 'VARCHAR(255) NULL UNIQUE');
  await addColumnIfMissing('users', 'elo_rating', 'INT DEFAULT 1500');
  await addColumnIfMissing('users', 'peak_elo', 'INT DEFAULT 1500');
  await addColumnIfMissing('users', 'elo_games', 'INT DEFAULT 0');
  await addColumnIfMissing('users', 'total_duels', 'INT DEFAULT 0');
  await addColumnIfMissing('users', 'total_wins', 'INT DEFAULT 0');
  await addColumnIfMissing('users', 'total_losses', 'INT DEFAULT 0');
  await addColumnIfMissing('users', 'total_draws', 'INT DEFAULT 0');
  await addColumnIfMissing('users', 'is_bot', 'TINYINT(1) DEFAULT 0');
  await addColumnIfMissing('users', 'bot_accuracy', 'FLOAT NULL');

  await addColumnIfMissing('maps', 'is_singleplayer', 'TINYINT(1) DEFAULT 0');

  await addColumnIfMissing('locations', 'is_deleted', 'TINYINT(1) DEFAULT 0');
  await addIndexIfMissing('locations', 'idx_locations_map_deleted', '(`map_id`, `is_deleted`)');

  await addColumnIfMissing('system_settings', 'maintenance_mode', 'TINYINT(1) DEFAULT 0');
  await addColumnIfMissing('system_settings', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing('system_settings', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

  await addColumnIfMissing('rating_history', 'duel_id', 'INT NULL');
  await addColumnIfMissing('rating_history', 'rating_change', 'INT DEFAULT 0');
  await addIndexIfMissing('rating_history', 'idx_rating_history_user_duel', '(`user_id`, `duel_id`)');

  // Keep enums compatible with the current models without using Sequelize alter.
  await modifyColumnIfExists('games', 'type', "ENUM('singleplayer', 'duels', 'battleroyales') DEFAULT 'singleplayer'");
  await modifyColumnIfExists('games', 'mode', "ENUM('moving', 'nm', 'nmpz') DEFAULT 'moving'");
  await modifyColumnIfExists('games', 'status', "ENUM('waiting', 'active', 'finished') DEFAULT 'active'");

  await modifyColumnIfExists('duel_queue', 'mode', "ENUM('moving', 'nm', 'nmpz') DEFAULT 'moving'");
  await modifyColumnIfExists('duels', 'mode', "ENUM('moving', 'nm', 'nmpz') DEFAULT 'moving'");
  await modifyColumnIfExists('duels', 'status', "ENUM('playing', 'round_results', 'finished', 'cancelled') DEFAULT 'playing'");
  await modifyColumnIfExists('duels', 'result', "ENUM('player1', 'player2', 'draw', 'cancelled') NULL");

  if (await tableExists('users') && await columnExists('users', 'peak_elo') && await columnExists('users', 'elo_rating')) {
    await run('UPDATE `users` SET `peak_elo` = GREATEST(COALESCE(`peak_elo`, 1500), COALESCE(`elo_rating`, 1500))');
  }

  if (await tableExists('system_settings')) {
    await run('INSERT IGNORE INTO `system_settings` (`id`, `email_enabled`, `maintenance_mode`, `created_at`, `updated_at`) VALUES (1, 0, 0, NOW(), NOW())');
  }
}

async function repairForeignKeys() {
  const fkColumns = [
    ['maps', 'creator_id'],
    ['locations', 'map_id'],
    ['games', 'user_id'],
    ['games', 'map_id'],
    ['guesses', 'game_id'],
    ['guesses', 'location_id'],
    ['rating_history', 'user_id'],
    ['rating_history', 'game_id'],
    ['rating_history', 'duel_id'],
    ['duel_queue', 'user_id'],
    ['duel_queue', 'map_id'],
    ['duels', 'player1_id'],
    ['duels', 'player2_id'],
    ['duels', 'winner_id'],
    ['duels', 'map_id'],
    ['duel_rounds', 'duel_id'],
    ['duel_rounds', 'location_id']
  ];

  for (const [table, column] of fkColumns) {
    await dropForeignKeysForColumn(table, column);
  }

  // Make columns compatible with the current FK actions. This is the part that fixes
  // the observed MySQL errno 150 caused by Sequelize trying to add SET NULL against
  // an older or mismatched locations.map_id definition.
  await modifyColumnIfExists('maps', 'creator_id', 'INT NULL');
  await modifyColumnIfExists('locations', 'map_id', 'INT NULL');
  await modifyColumnIfExists('games', 'user_id', 'INT NULL');
  await modifyColumnIfExists('games', 'map_id', 'INT NULL');
  await modifyColumnIfExists('guesses', 'game_id', 'INT NULL');
  await modifyColumnIfExists('guesses', 'location_id', 'INT NULL');
  await modifyColumnIfExists('rating_history', 'user_id', 'INT NULL');
  await modifyColumnIfExists('rating_history', 'game_id', 'INT NULL');
  await modifyColumnIfExists('rating_history', 'duel_id', 'INT NULL');
  await modifyColumnIfExists('duel_queue', 'user_id', 'INT NOT NULL');
  await modifyColumnIfExists('duel_queue', 'map_id', 'INT NULL');
  await modifyColumnIfExists('duels', 'player1_id', 'INT NOT NULL');
  await modifyColumnIfExists('duels', 'player2_id', 'INT NOT NULL');
  await modifyColumnIfExists('duels', 'winner_id', 'INT NULL');
  await modifyColumnIfExists('duels', 'map_id', 'INT NULL');
  await modifyColumnIfExists('duel_rounds', 'duel_id', 'INT NOT NULL');
  await modifyColumnIfExists('duel_rounds', 'location_id', 'INT NULL');

  await setInvalidNullableReferencesToNull('maps', 'creator_id', 'users');
  await setInvalidNullableReferencesToNull('locations', 'map_id', 'maps');
  await setInvalidNullableReferencesToNull('games', 'user_id', 'users');
  await setInvalidNullableReferencesToNull('games', 'map_id', 'maps');
  await setInvalidNullableReferencesToNull('guesses', 'game_id', 'games');
  await setInvalidNullableReferencesToNull('guesses', 'location_id', 'locations');
  await setInvalidNullableReferencesToNull('rating_history', 'user_id', 'users');
  await setInvalidNullableReferencesToNull('rating_history', 'game_id', 'games');
  await setInvalidNullableReferencesToNull('rating_history', 'duel_id', 'duels');
  await setInvalidNullableReferencesToNull('duel_queue', 'map_id', 'maps');
  await setInvalidNullableReferencesToNull('duels', 'winner_id', 'users');
  await setInvalidNullableReferencesToNull('duels', 'map_id', 'maps');
  await setInvalidNullableReferencesToNull('duel_rounds', 'location_id', 'locations');

  await deleteInvalidRequiredReferences('duel_queue', 'user_id', 'users');
  await deleteInvalidRequiredReferences('duels', 'player1_id', 'users');
  await deleteInvalidRequiredReferences('duels', 'player2_id', 'users');
  await deleteInvalidRequiredReferences('duel_rounds', 'duel_id', 'duels');

  await addForeignKeyIfMissing({ table: 'maps', column: 'creator_id', constraintName: 'fk_maps_creator', referencesTable: 'users', onDelete: 'SET NULL' });
  await addForeignKeyIfMissing({ table: 'locations', column: 'map_id', constraintName: 'fk_locations_map', referencesTable: 'maps', onDelete: 'CASCADE' });
  await addForeignKeyIfMissing({ table: 'games', column: 'user_id', constraintName: 'fk_games_user', referencesTable: 'users', onDelete: 'CASCADE' });
  await addForeignKeyIfMissing({ table: 'games', column: 'map_id', constraintName: 'fk_games_map', referencesTable: 'maps', onDelete: 'CASCADE' });
  await addForeignKeyIfMissing({ table: 'guesses', column: 'game_id', constraintName: 'fk_guesses_game', referencesTable: 'games', onDelete: 'CASCADE' });
  await addForeignKeyIfMissing({ table: 'guesses', column: 'location_id', constraintName: 'fk_guesses_location', referencesTable: 'locations', onDelete: 'SET NULL' });
  await addForeignKeyIfMissing({ table: 'rating_history', column: 'user_id', constraintName: 'fk_rating_history_user', referencesTable: 'users', onDelete: 'CASCADE' });
  await addForeignKeyIfMissing({ table: 'rating_history', column: 'game_id', constraintName: 'fk_rating_history_game', referencesTable: 'games', onDelete: 'CASCADE' });
  await addForeignKeyIfMissing({ table: 'rating_history', column: 'duel_id', constraintName: 'fk_rating_history_duel', referencesTable: 'duels', onDelete: 'CASCADE' });
  await addForeignKeyIfMissing({ table: 'duel_queue', column: 'user_id', constraintName: 'fk_duel_queue_user', referencesTable: 'users', onDelete: 'CASCADE' });
  await addForeignKeyIfMissing({ table: 'duel_queue', column: 'map_id', constraintName: 'fk_duel_queue_map', referencesTable: 'maps', onDelete: 'SET NULL' });
  await addForeignKeyIfMissing({ table: 'duels', column: 'player1_id', constraintName: 'fk_duels_player1', referencesTable: 'users', onDelete: 'CASCADE' });
  await addForeignKeyIfMissing({ table: 'duels', column: 'player2_id', constraintName: 'fk_duels_player2', referencesTable: 'users', onDelete: 'CASCADE' });
  await addForeignKeyIfMissing({ table: 'duels', column: 'winner_id', constraintName: 'fk_duels_winner', referencesTable: 'users', onDelete: 'SET NULL' });
  await addForeignKeyIfMissing({ table: 'duels', column: 'map_id', constraintName: 'fk_duels_map', referencesTable: 'maps', onDelete: 'SET NULL' });
  await addForeignKeyIfMissing({ table: 'duel_rounds', column: 'duel_id', constraintName: 'fk_duel_rounds_duel', referencesTable: 'duels', onDelete: 'CASCADE' });
  await addForeignKeyIfMissing({ table: 'duel_rounds', column: 'location_id', constraintName: 'fk_duel_rounds_location', referencesTable: 'locations', onDelete: 'SET NULL' });
}

async function checkAndFixDatabase() {
  console.log('Starting database schema check and fix...');
  try {
    await sequelize.authenticate();

    // Use sync without alter. `alter: true` lets Sequelize infer/drop/re-add foreign
    // keys and can produce MySQL errno 150 on existing dev databases. Missing columns
    // and FK repair are handled explicitly below instead.
    await normalizeStorageEngine();
    await sequelize.sync({ alter: false, logging: console.log });
    await ensureCoreColumns();
    await repairForeignKeys();

    console.log('Database schema checked and fixed successfully.');
  } catch (error) {
    console.error('Error checking/fixing database:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

checkAndFixDatabase();
