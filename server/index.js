require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { sequelize } = require('./models');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Passport Config
const session = require('express-session');
const passport = require('./config/passport');

app.use(session({ secret: 'secret', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// Import Routes
const authRoutes = require('./routes/auth');
const mapRoutes = require('./routes/maps');
const adminRoutes = require('./routes/admin');
const settingsRoutes = require('./routes/settings');
const userRoutes = require('./routes/user');
const gameRoutes = require('./routes/games');

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/maps', mapRoutes); 
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/games', gameRoutes);

// Serve static files from the uploads directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

const PORT = process.env.PORT || 3000;
sequelize.sync().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
