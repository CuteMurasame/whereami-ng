const { Sequelize, DataTypes } = require('sequelize');
// Load environment variables from .env file
require('dotenv').config(); 

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
    country_code: { type: DataTypes.STRING(5) } // Useful for Country Streak mode
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
    timestamps: true
});

// --- RATING HISTORY ---
const RatingHistory = sequelize.define('RatingHistory', {
    old_rating: { type: DataTypes.INTEGER, allowNull: false },
    new_rating: { type: DataTypes.INTEGER, allowNull: false },
    rank_position: { type: DataTypes.INTEGER },
}, {
    tableName: 'rating_history',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false // We don't need updated_at for history logs
});

// 3. Define Relationships

// User <-> Map (Creator)
User.hasMany(Map, { foreignKey: 'creator_id' });
Map.belongsTo(User, { foreignKey: 'creator_id' });

// Map <-> Location
Map.hasMany(Location, { foreignKey: 'map_id' });
Location.belongsTo(Map, { foreignKey: 'map_id' });

// User <-> Game (Player)
User.hasMany(Game, { foreignKey: 'user_id' });
Game.belongsTo(User, { foreignKey: 'user_id' });

// Game <-> Map (Which map is being played)
Map.hasMany(Game, { foreignKey: 'map_id' });
Game.belongsTo(Map, { foreignKey: 'map_id' });

// Game <-> Guess
Game.hasMany(Guess, { foreignKey: 'game_id' });
Guess.belongsTo(Game, { foreignKey: 'game_id' });

// Location <-> Guess (Which location was this guess for?)
Location.hasMany(Guess, { foreignKey: 'location_id' });
Guess.belongsTo(Location, { foreignKey: 'location_id' });

// User <-> RatingHistory
User.hasMany(RatingHistory, { foreignKey: 'user_id' });
RatingHistory.belongsTo(User, { foreignKey: 'user_id' });

// Game <-> RatingHistory
Game.hasMany(RatingHistory, { foreignKey: 'game_id' });
RatingHistory.belongsTo(Game, { foreignKey: 'game_id' });

sequelize.authenticate()
    .then(() => {
        console.log('✅ Connection successful. Using existing database tables.');
    })
    .catch(err => {
        console.error('❌ Database connection error:', err);
    });

module.exports = { 
    sequelize, 
    User, 
    Map, 
    Location, 
    Game, 
    Guess,
	Settings,
    RatingHistory
};
