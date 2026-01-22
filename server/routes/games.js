const express = require('express');
const router = express.Router();
const { Game, Guess, Map, Location, User } = require('../models');
const auth = require('../middleware/auth');
const { Op } = require('sequelize');

// Get Active Game
router.get('/active', auth, async (req, res) => {
    try {
        const game = await Game.findOne({
            where: { 
                user_id: req.user.id, 
                status: 'active',
                type: 'singleplayer'
            },
            include: [
                { model: Map, attributes: ['name'] }
            ]
        });

        if (!game) {
            return res.json(null);
        }

        // Find current round (first round without a guess)
        const currentRoundGuess = await Guess.findOne({
            where: { 
                game_id: game.id,
                guess_lat: null
            },
            order: [['round_number', 'ASC']],
            include: [{ model: Location, attributes: ['pano_id'] }]
        });

        if (!currentRoundGuess) {
            // All rounds guessed but status active? Mark finished.
            game.status = 'finished';
            await game.save();
            return res.json(null);
        }

        res.json({
            gameId: game.id,
            round: currentRoundGuess.round_number,
            totalScore: game.total_score,
            panoId: currentRoundGuess.Location.pano_id,
            mode: game.mode,
            mapName: game.Map ? game.Map.name : 'Classic World'
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start a new Singleplayer Game
router.post('/start', auth, async (req, res) => {
    try {
        // Check if user already has an active game
        const activeGame = await Game.findOne({
            where: { 
                user_id: req.user.id,
                status: 'active',
                type: 'singleplayer'
            }
        });

        if (activeGame) {
            // Optional: Auto-finish it or return error? 
            // For now, let's just mark it as finished so we can start a new one
            activeGame.status = 'finished';
            await activeGame.save();
        }

        const { mapId, mode } = req.body;
        
        // Validate mode
        if (!['moving', 'nm', 'nmpz'].includes(mode)) {
            return res.status(400).json({ error: 'Invalid mode' });
        }

        let locations = [];
        
        if (mapId) {
            // Custom Map
            const map = await Map.findByPk(mapId);
            if (!map) return res.status(404).json({ error: 'Map not found' });
            
            // Get 5 random locations
            // Note: Sequelize random is DB specific. Using simple shuffle for now.
            const allLocs = await Location.findAll({ 
                where: { map_id: mapId },
                attributes: ['id']
            });
            
            if (allLocs.length < 5) {
                return res.status(400).json({ error: 'Map must have at least 5 locations' });
            }
            
            // Shuffle and pick 5
            const shuffled = allLocs.sort(() => 0.5 - Math.random());
            locations = shuffled.slice(0, 5);
        } else {
            return res.status(400).json({ error: 'Invalid map' });
        }

        // Create Game
        const game = await Game.create({
            user_id: req.user.id,
            map_id: mapId || null,
            type: 'singleplayer',
            mode: mode,
            status: 'active'
        });

        // Create 5 Guesses (Rounds)
        const guessesData = locations.map((loc, index) => ({
            game_id: game.id,
            location_id: loc.id,
            round_number: index + 1
        }));
        
        await Guess.bulkCreate(guessesData);

        // Fetch the first round's location details (only pano_id)
        const firstRound = await Guess.findOne({
            where: { game_id: game.id, round_number: 1 },
            include: [{ model: Location, attributes: ['pano_id'] }]
        });

        res.json({
            gameId: game.id,
            round: 1,
            totalRounds: 5,
            panoId: firstRound.Location.pano_id,
            mode: mode
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Submit Guess
router.post('/:id/guess', auth, async (req, res) => {
    try {
        const { round, lat, lng } = req.body;
        const gameId = req.params.id;

        const game = await Game.findByPk(gameId);
        if (!game || game.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Game not found' });
        }

        if (game.status === 'finished') {
            return res.status(400).json({ error: 'Game already finished' });
        }

        // Find current round guess record
        const currentGuess = await Guess.findOne({
            where: { game_id: gameId, round_number: round },
            include: [Location]
        });

        if (!currentGuess) {
            return res.status(404).json({ error: 'Round not found' });
        }

        if (currentGuess.guess_lat) {
            return res.status(400).json({ error: 'Round already played' });
        }

        // Calculate Score
        const actualLat = currentGuess.Location.lat;
        const actualLng = currentGuess.Location.lng;
        
        // Haversine Distance
        const R = 6371e3; // metres
        const φ1 = actualLat * Math.PI/180;
        const φ2 = lat * Math.PI/180;
        const Δφ = (lat-actualLat) * Math.PI/180;
        const Δλ = (lng-actualLng) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c; // in meters

        // Score Formula: 5000 * exp(-10 * distance / 20000) (distance in km)
        // Max distance 20000km roughly half earth circumference
        const distanceKm = distance / 1000;
        const score = Math.floor(5000 * Math.exp(-10 * (distanceKm / 14900))); // Adjusted constant for better curve

        // Update Guess
        currentGuess.guess_lat = lat;
        currentGuess.guess_lng = lng;
        currentGuess.distance_meters = Math.round(distance);
        currentGuess.score = score;
        await currentGuess.save();

        // Update Game Total Score
        game.total_score += score;
        
        // Check if game finished
        if (round >= 5) {
            game.status = 'finished';
        }
        await game.save();

        // Prepare response
        const response = {
            score,
            distance: distanceKm,
            actual: { lat: actualLat, lng: actualLng },
            totalScore: game.total_score
        };

        // If next round exists, fetch it
        if (round < 5) {
            const nextRound = await Guess.findOne({
                where: { game_id: gameId, round_number: round + 1 },
                include: [{ model: Location, attributes: ['pano_id'] }]
            });
            if (nextRound) {
                response.nextRound = {
                    round: round + 1,
                    panoId: nextRound.Location.pano_id
                };
            }
        }

        res.json(response);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Game Details (for analysis)
router.get('/:id', auth, async (req, res) => {
    try {
        const game = await Game.findOne({
            where: { id: req.params.id },
            include: [
                { model: Map, attributes: ['name'] },
                { 
                    model: Guess, 
                    attributes: ['round_number', 'guess_lat', 'guess_lng', 'score', 'distance_meters'],
                    include: [{ model: Location, attributes: ['lat', 'lng', 'pano_id'] }]
                }
            ],
            order: [[ 'Guesses', 'round_number', 'ASC' ]]
        });

        if (!game) return res.status(404).json({ error: "Game not found" });

        // Disable analysis for ongoing singleplayer games
        if (game.type === 'singleplayer' && game.status !== 'finished') {
            return res.status(403).json({ error: "Analysis available only after finishing the game" });
        }
        
        res.json(game);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
