const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
// Load environment variables from server/.env regardless of current working directory.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); 

// 1. Setup Database Connection
const sequelize = new Sequelize(
    process.env.DB_NAME || 'whereami_db',
    process.env.DB_USER || 'root',     // This will now read 'whereami_user' from your .env
    process.env.DB_PASS || '',         // This will now read 'password123' from your .env
    {
        host: process.env.DB_HOST || 'localhost',
        dialect: 'mysql',
        logging: false, // Set to console.log to see raw SQL queries
    }
);

// 2. Define Models

// --- USER ---
const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    email: { type: DataTypes.STRING, unique: true },
	avatar_url: { type: DataTypes.STRING, allowNull: true },
	bio: { type: DataTypes.TEXT, allowNull: true },
    password_hash: { type: DataTypes.STRING, allowNull: false },
    is_admin: { type: DataTypes.BOOLEAN, defaultValue: false },
	is_root: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_banned: { type: DataTypes.BOOLEAN, defaultValue: false },
    google_id: { type: DataTypes.STRING, unique: true, allowNull: true },
    google_email: { type: DataTypes.STRING, unique: true, allowNull: true },
    elo_rating: { type: DataTypes.INTEGER, defaultValue: 1500 },
    peak_elo: { type: DataTypes.INTEGER, defaultValue: 1500 },
    elo_games: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_duels: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_wins: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_losses: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_draws: { type: DataTypes.INTEGER, defaultValue: 0 },
    is_bot: { type: DataTypes.BOOLEAN, defaultValue: false }, // For AI opponents later
    bot_accuracy: { type: DataTypes.FLOAT, allowNull: true }  // 0.0 to 1.0
}, {
	tableName: 'users',
	timestamps: true,
	createdAt: 'created_at',
	updatedAt: 'updated_at'
});

// --- MAP ---
const Map = sequelize.define('Map', {
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    is_official: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_singleplayer: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
	tableName: 'maps',
	timestamps: true,
	createdAt: 'created_at',
	updatedAt: 'updated_at'
});

// --- LOCATION (Street View Points) ---
const Location = sequelize.define('Location', {
    pano_id: { type: DataTypes.STRING, allowNull: false },
    lat: { type: DataTypes.DOUBLE, allowNull: false },
    lng: { type: DataTypes.DOUBLE, allowNull: false },
    country_code: { type: DataTypes.STRING(5) }, // Useful for Country Streak mode
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
	tableName: 'locations',
	timestamps: false
});

// --- GAME (A session) ---
const Game = sequelize.define('Game', {
    type: { 
        type: DataTypes.ENUM('singleplayer', 'duels', 'battleroyales'), 
        defaultValue: 'singleplayer' 
    },
    mode: { 
        type: DataTypes.ENUM('moving', 'nm', 'nmpz'), 
        defaultValue: 'moving' 
    },
    status: { 
        type: DataTypes.ENUM('waiting', 'active', 'finished'), 
        defaultValue: 'active' 
    },
    total_score: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
	tableName: 'games',
	timestamps: true,
	createdAt: 'created_at',
	updatedAt: 'updated_at'
});

// --- GUESS (A player's action) ---
const Guess = sequelize.define('Guess', {
    round_number: { type: DataTypes.INTEGER, allowNull: false },
    guess_lat: { type: DataTypes.DOUBLE },
    guess_lng: { type: DataTypes.DOUBLE },
    score: { type: DataTypes.INTEGER, defaultValue: 0 },
    distance_meters: { type: DataTypes.INTEGER },
    time_taken: { type: DataTypes.INTEGER } // in milliseconds
}, {
	tableName: 'guesses',
	timestamps: false
});

const Settings = sequelize.define('Settings', {
    // We hardcode ID=1 to ensure singleton behavior
    id: { type: DataTypes.INTEGER, primaryKey: true, defaultValue: 1 },
    email_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    maintenance_mode: { type: DataTypes.BOOLEAN, defaultValue: false } // Bonus feature
}, {
    tableName: 'system_settings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// --- RATING HISTORY ---
const RatingHistory = sequelize.define('RatingHistory', {
    old_rating: { type: DataTypes.INTEGER, allowNull: false },
    new_rating: { type: DataTypes.INTEGER, allowNull: false },
    rank_position: { type: DataTypes.INTEGER },
    rating_change: { type: DataTypes.INTEGER, defaultValue: 0 },
    duel_id: { type: DataTypes.INTEGER, allowNull: true },
}, {
    tableName: 'rating_history',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false // We don't need updated_at for history logs
});

// --- DUEL MATCHMAKING QUEUE ---
const DuelQueue = sequelize.define('DuelQueue', {
    user_id: { type: DataTypes.INTEGER, primaryKey: true },
    mode: { type: DataTypes.ENUM('moving', 'nm', 'nmpz'), defaultValue: 'moving' },
    map_id: { type: DataTypes.INTEGER, allowNull: true }
}, {
    tableName: 'duel_queue',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

// --- DUEL ---
const Duel = sequelize.define('Duel', {
    player1_id: { type: DataTypes.INTEGER, allowNull: false },
    player2_id: { type: DataTypes.INTEGER, allowNull: false },
    map_id: { type: DataTypes.INTEGER, allowNull: true },
    mode: { type: DataTypes.ENUM('moving', 'nm', 'nmpz'), defaultValue: 'moving' },
    status: { type: DataTypes.ENUM('playing', 'round_results', 'finished', 'cancelled'), defaultValue: 'playing' },
    current_round: { type: DataTypes.INTEGER, defaultValue: 1 },
    total_rounds: { type: DataTypes.INTEGER, defaultValue: 5 },
    player1_score: { type: DataTypes.INTEGER, defaultValue: 0 },
    player2_score: { type: DataTypes.INTEGER, defaultValue: 0 },
    winner_id: { type: DataTypes.INTEGER, allowNull: true },
    result: { type: DataTypes.ENUM('player1', 'player2', 'draw', 'cancelled'), allowNull: true },
    player1_rating_before: { type: DataTypes.INTEGER, allowNull: true },
    player2_rating_before: { type: DataTypes.INTEGER, allowNull: true },
    player1_rating_after: { type: DataTypes.INTEGER, allowNull: true },
    player2_rating_after: { type: DataTypes.INTEGER, allowNull: true },
    player1_rating_change: { type: DataTypes.INTEGER, defaultValue: 0 },
    player2_rating_change: { type: DataTypes.INTEGER, defaultValue: 0 },
    finished_at: { type: DataTypes.DATE, allowNull: true }
}, {
    tableName: 'duels',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// --- DUEL ROUND ---
const DuelRound = sequelize.define('DuelRound', {
    duel_id: { type: DataTypes.INTEGER, allowNull: false },
    location_id: { type: DataTypes.INTEGER, allowNull: true },
    round_number: { type: DataTypes.INTEGER, allowNull: false },
    player1_guess_lat: { type: DataTypes.DOUBLE, allowNull: true },
    player1_guess_lng: { type: DataTypes.DOUBLE, allowNull: true },
    player1_score: { type: DataTypes.INTEGER, defaultValue: 0 },
    player1_distance_meters: { type: DataTypes.INTEGER, allowNull: true },
    player1_guessed_at: { type: DataTypes.DATE, allowNull: true },
    player2_guess_lat: { type: DataTypes.DOUBLE, allowNull: true },
    player2_guess_lng: { type: DataTypes.DOUBLE, allowNull: true },
    player2_score: { type: DataTypes.INTEGER, defaultValue: 0 },
    player2_distance_meters: { type: DataTypes.INTEGER, allowNull: true },
    player2_guessed_at: { type: DataTypes.DATE, allowNull: true }
}, {
    tableName: 'duel_rounds',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ unique: true, fields: ['duel_id', 'round_number'] }]
});

// 3. Define Relationships

// Foreign key definitions are explicit so Sequelize does not guess ON DELETE SET NULL
// during schema repair. This keeps the model layer aligned with create_db.sql and
// prevents MySQL errno 150 on older local development databases whose FK columns
// were created as NOT NULL or already had CASCADE constraints.
const nullableFk = (name) => ({ name, allowNull: true });
const requiredFk = (name) => ({ name, allowNull: false });

// User <-> Map (Creator)
User.hasMany(Map, { foreignKey: nullableFk('creator_id'), onDelete: 'SET NULL', onUpdate: 'CASCADE' });
Map.belongsTo(User, { foreignKey: nullableFk('creator_id'), onDelete: 'SET NULL', onUpdate: 'CASCADE' });

// Map <-> Location
Map.hasMany(Location, { foreignKey: nullableFk('map_id'), onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Location.belongsTo(Map, { foreignKey: nullableFk('map_id'), onDelete: 'CASCADE', onUpdate: 'CASCADE' });

// User <-> Game (Player)
User.hasMany(Game, { foreignKey: nullableFk('user_id'), onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Game.belongsTo(User, { foreignKey: nullableFk('user_id'), onDelete: 'CASCADE', onUpdate: 'CASCADE' });

// Game <-> Map (Which map is being played)
Map.hasMany(Game, { foreignKey: nullableFk('map_id'), onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Game.belongsTo(Map, { foreignKey: nullableFk('map_id'), onDelete: 'CASCADE', onUpdate: 'CASCADE' });

// Game <-> Guess
Game.hasMany(Guess, { foreignKey: nullableFk('game_id'), onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Guess.belongsTo(Game, { foreignKey: nullableFk('game_id'), onDelete: 'CASCADE', onUpdate: 'CASCADE' });

// Location <-> Guess (Which location was this guess for?)
Location.hasMany(Guess, { foreignKey: nullableFk('location_id'), onDelete: 'SET NULL', onUpdate: 'CASCADE' });
Guess.belongsTo(Location, { foreignKey: nullableFk('location_id'), onDelete: 'SET NULL', onUpdate: 'CASCADE' });

// User <-> RatingHistory
User.hasMany(RatingHistory, { foreignKey: nullableFk('user_id'), onDelete: 'CASCADE', onUpdate: 'CASCADE' });
RatingHistory.belongsTo(User, { foreignKey: nullableFk('user_id'), onDelete: 'CASCADE', onUpdate: 'CASCADE' });

// Game <-> RatingHistory
Game.hasMany(RatingHistory, { foreignKey: nullableFk('game_id'), onDelete: 'CASCADE', onUpdate: 'CASCADE' });
RatingHistory.belongsTo(Game, { foreignKey: nullableFk('game_id'), onDelete: 'CASCADE', onUpdate: 'CASCADE' });

// Duel Queue
User.hasOne(DuelQueue, { foreignKey: requiredFk('user_id'), onDelete: 'CASCADE', onUpdate: 'CASCADE' });
DuelQueue.belongsTo(User, { foreignKey: requiredFk('user_id'), onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Map.hasMany(DuelQueue, { foreignKey: nullableFk('map_id'), onDelete: 'SET NULL', onUpdate: 'CASCADE' });
DuelQueue.belongsTo(Map, { foreignKey: nullableFk('map_id'), onDelete: 'SET NULL', onUpdate: 'CASCADE' });

// Duel relationships
User.hasMany(Duel, { foreignKey: requiredFk('player1_id'), as: 'DuelsAsPlayer1', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
User.hasMany(Duel, { foreignKey: requiredFk('player2_id'), as: 'DuelsAsPlayer2', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Duel.belongsTo(User, { foreignKey: requiredFk('player1_id'), as: 'Player1', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Duel.belongsTo(User, { foreignKey: requiredFk('player2_id'), as: 'Player2', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Duel.belongsTo(User, { foreignKey: nullableFk('winner_id'), as: 'Winner', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
Map.hasMany(Duel, { foreignKey: nullableFk('map_id'), onDelete: 'SET NULL', onUpdate: 'CASCADE' });
Duel.belongsTo(Map, { foreignKey: nullableFk('map_id'), onDelete: 'SET NULL', onUpdate: 'CASCADE' });

Duel.hasMany(DuelRound, { foreignKey: requiredFk('duel_id'), onDelete: 'CASCADE', onUpdate: 'CASCADE' });
DuelRound.belongsTo(Duel, { foreignKey: requiredFk('duel_id'), onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Location.hasMany(DuelRound, { foreignKey: nullableFk('location_id'), onDelete: 'SET NULL', onUpdate: 'CASCADE' });
DuelRound.belongsTo(Location, { foreignKey: nullableFk('location_id'), onDelete: 'SET NULL', onUpdate: 'CASCADE' });

Duel.hasMany(RatingHistory, { foreignKey: nullableFk('duel_id'), onDelete: 'CASCADE', onUpdate: 'CASCADE' });
RatingHistory.belongsTo(Duel, { foreignKey: nullableFk('duel_id'), onDelete: 'CASCADE', onUpdate: 'CASCADE' });

module.exports = { 
    sequelize, 
    User, 
    Map, 
    Location, 
    Game, 
    Guess,
	Settings,
    RatingHistory,
    DuelQueue,
    Duel,
    DuelRound
};
