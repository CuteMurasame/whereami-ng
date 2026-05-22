const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { User, RatingHistory, Game, Map, Duel } = require('../models');
const auth = require('../middleware/auth');

// --- MULTER SETUP ---
const uploadDir = path.join(__dirname, '..', 'uploads');
const allowedImageTypes = new Map([
    ['image/jpeg', '.jpg'],
    ['image/png', '.png'],
    ['image/webp', '.webp']
]);

const ensureUploadDir = () => {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        ensureUploadDir();
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = allowedImageTypes.get(file.mimetype) || '.bin';
        cb(null, `user-${req.user.id}-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (!allowedImageTypes.has(file.mimetype)) {
        return cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
    }
    cb(null, true);
};

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter
});

const uploadAvatar = (req, res, next) => {
    upload.single('avatar')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
};

const hasValidImageMagicBytes = (filePath, mimetype) => {
    const buffer = fs.readFileSync(filePath);

    if (mimetype === 'image/jpeg') {
        return buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    }

    if (mimetype === 'image/png') {
        const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        return pngSignature.every((byte, index) => buffer[index] === byte);
    }

    if (mimetype === 'image/webp') {
        return buffer.length >= 12
            && buffer.toString('ascii', 0, 4) === 'RIFF'
            && buffer.toString('ascii', 8, 12) === 'WEBP';
    }

    return false;
};

// --- ROUTES ---

// 1. Upload Avatar (Existing)
router.post('/avatar', auth, uploadAvatar, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file" });

    if (!hasValidImageMagicBytes(req.file.path, req.file.mimetype)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: "Invalid image file." });
    }

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
            attributes: ['id', 'username', 'avatar_url', 'bio', 'created_at', 'is_admin', 'is_root', 'is_banned', 'elo_rating', 'peak_elo', 'elo_games', 'total_duels', 'total_wins', 'total_losses', 'total_draws'] // Safe fields only
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
            where: {
                user_id: req.params.id,
                duel_id: { [Op.ne]: null }
            },
            include: [{
                model: Duel,
                attributes: ['id', 'mode', 'created_at'],
                required: false
            }],
            order: [['created_at', 'ASC']]
        });

        const formattedHistory = history.map(entry => ({
            EndTime: Math.floor(new Date(entry.created_at).getTime() / 1000),
            NewRating: entry.new_rating,
            OldRating: entry.old_rating,
            Place: entry.rank_position,
            ContestName: entry.Duel ? `Duel #${entry.Duel.id} (${entry.Duel.mode})` : `Duel #${entry.duel_id}`,
            StandingsUrl: entry.duel_id ? `/duels/${entry.duel_id}/review` : "#",
            RatingChange: entry.rating_change
        }));

        res.json(formattedHistory);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Get User Games History
router.get('/:id/games', async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const { type } = req.query;
        const items = [];

        if (!type || type === 'singleplayer') {
            const games = await Game.findAll({
                where: { user_id: userId, ...(type ? { type } : {}) },
                order: [['created_at', 'DESC']],
                limit: 50,
                include: [{ model: Map, attributes: ['name'] }]
            });

            items.push(...games.map(game => ({
                id: game.id,
                type: game.type,
                mode: game.mode,
                status: game.status,
                total_score: game.total_score,
                map_name: game.Map?.name || 'Classic World',
                created_at: game.created_at
            })));
        }

        if (!type || type === 'duels') {
            const duels = await Duel.findAll({
                where: {
                    [Op.or]: [{ player1_id: userId }, { player2_id: userId }]
                },
                include: [
                    { model: User, as: 'Player1', attributes: ['id', 'username'] },
                    { model: User, as: 'Player2', attributes: ['id', 'username'] },
                    { model: Map, attributes: ['name'] }
                ],
                order: [['created_at', 'DESC']],
                limit: 50
            });

            items.push(...duels.map(duel => {
                const mineIsP1 = duel.player1_id === userId;
                const opponent = mineIsP1 ? duel.Player2 : duel.Player1;
                return {
                    id: duel.id,
                    type: 'duels',
                    mode: duel.mode,
                    status: duel.status,
                    total_score: mineIsP1 ? duel.player1_score : duel.player2_score,
                    opponent_name: opponent?.username || 'Unknown',
                    map_name: duel.Map?.name || 'Classic World',
                    result: duel.result,
                    rating_change: mineIsP1 ? duel.player1_rating_change : duel.player2_rating_change,
                    created_at: duel.created_at
                };
            }));
        }

        items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        res.json(items.slice(0, 50));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Get User Statistics
router.get('/:id/stats', async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Singleplayer Stats
        const spGames = await Game.findAll({
            where: { 
                user_id: userId, 
                type: 'singleplayer', 
                status: 'finished' 
            },
            attributes: ['total_score', 'mode', 'created_at']
        });

        const totalGames = spGames.length;
        const totalScore = spGames.reduce((sum, g) => sum + g.total_score, 0);
        const avgScore = totalGames > 0 ? Math.round(totalScore / totalGames) : 0;
        const maxScore = totalGames > 0 ? Math.max(...spGames.map(g => g.total_score)) : 0;
        
        // Mode breakdown
        const modes = {};
        spGames.forEach(g => {
            if (!modes[g.mode]) modes[g.mode] = { count: 0, totalScore: 0 };
            modes[g.mode].count++;
            modes[g.mode].totalScore += g.total_score;
        });

        const modeStats = Object.keys(modes).map(mode => ({
            mode,
            count: modes[mode].count,
            avgScore: Math.round(modes[mode].totalScore / modes[mode].count)
        }));

        const user = await User.findByPk(userId, {
            attributes: ['elo_rating', 'peak_elo', 'elo_games', 'total_duels', 'total_wins', 'total_losses', 'total_draws']
        });

        res.json({
            singleplayer: {
                totalGames,
                totalScore,
                avgScore,
                maxScore,
                modeStats
            },
            duels: {
                rating: user?.elo_rating || 1500,
                peakRating: user?.peak_elo || user?.elo_rating || 1500,
                games: user?.elo_games || 0,
                totalDuels: user?.total_duels || 0,
                wins: user?.total_wins || 0,
                losses: user?.total_losses || 0,
                draws: user?.total_draws || 0,
                winRate: user?.total_duels ? Math.round((user.total_wins / user.total_duels) * 1000) / 10 : 0
            }
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
