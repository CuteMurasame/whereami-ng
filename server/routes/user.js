const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { User, RatingHistory, Game } = require('../models');
const auth = require('../middleware/auth');

// --- MULTER SETUP (Keep existing code) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/';
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `user-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// --- ROUTES ---

// 1. Upload Avatar (Existing)
router.post('/avatar', auth, upload.single('avatar'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file" });
    req.user.avatar_url = `/uploads/${req.file.filename}`;
    await req.user.save();
    res.json({ message: "Avatar updated", avatar_url: req.user.avatar_url });
});

// 2. Update Profile (Bio, etc) - NEW
router.put('/update', auth, async (req, res) => {
    try {
        const { bio } = req.body;
        
        // Basic validation
        if (bio && bio.length > 500) {
            return res.status(400).json({ error: "Bio must be under 500 characters." });
        }

        req.user.bio = bio;
        await req.user.save();

        res.json({ message: "Profile updated", user: req.user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Get Public Profile by ID - NEW
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, {
            attributes: ['id', 'username', 'avatar_url', 'bio', 'created_at', 'is_admin', 'is_root', 'is_banned'] // Safe fields only
        });

        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Get User Rating History (Duels Only)
router.get('/:id/rating-history', async (req, res) => {
    try {
        const history = await RatingHistory.findAll({
            where: { user_id: req.params.id },
            include: [{ 
                model: Game, 
                attributes: ['id', 'type', 'mode'],
                where: { type: 'duels' } // Filter for Duels only
            }],
            order: [['created_at', 'ASC']]
        });

        const formattedHistory = history.map(entry => ({
            EndTime: Math.floor(new Date(entry.created_at).getTime() / 1000),
            NewRating: entry.new_rating,
            OldRating: entry.old_rating,
            Place: entry.rank_position,
            ContestName: entry.Game ? `${entry.Game.type} #${entry.Game.id}` : "Unknown Match",
            StandingsUrl: entry.Game ? `/game/${entry.Game.id}` : "#"
        }));

        res.json(formattedHistory);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Get User Games History
router.get('/:id/games', async (req, res) => {
    try {
        const { type } = req.query;
        const whereClause = { user_id: req.params.id };
        if (type) whereClause.type = type;

        const games = await Game.findAll({
            where: whereClause,
            order: [['created_at', 'DESC']],
            limit: 50 // Limit to last 50 games for now
        });

        res.json(games);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
