const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const fs = require('fs');
const { sequelize } = require('./models');
const { startDuelAutomation } = require('./services/duelService');

const app = express();
const server = http.createServer(app);
app.set('trust proxy', 1);

const allowedOrigins = (process.env.CORS_ORIGIN || process.env.CLIENT_URL || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Keep local tools and same-origin requests working.
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error('Not allowed by CORS'));
        },
        credentials: true
    }
});
app.set('io', io);
require('./sockets/duels')(io);

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

app.use(express.json({ limit: '10mb' }));

// Passport Config
const session = require('express-session');
const passport = require('./config/passport');

app.use(session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// Import Routes
const authRoutes = require('./routes/auth');
const mapRoutes = require('./routes/maps');
const adminRoutes = require('./routes/admin');
const settingsRoutes = require('./routes/settings');
const userRoutes = require('./routes/user');
const gameRoutes = require('./routes/games');
const duelRoutes = require('./routes/duels');
const maintenanceMode = require('./middleware/maintenance');

// Maintenance mode is checked before business routes.
// Login/status endpoints remain reachable so administrators can get back in and turn it off.
app.use(maintenanceMode);

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/maps', mapRoutes); 
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/duels', duelRoutes);

// Serve static files from the uploads directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir, {
    index: false,
    setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=86400');
    }
}));

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connection successful. Using existing database tables.');
        await sequelize.sync();
        startDuelAutomation(io);
        server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    } catch (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }
}

startServer();
