const express = require('express');
const router = express.Router();
const { Game, Guess, Map, Location, User, sequelize } = require('../models');
const auth = require('../middleware/auth');
const { Op } = require('sequelize');
const { wgs84DistanceMeters, calculateGeoScore } = require('../utils/scoring');

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
                where: { map_id: mapId, is_deleted: false },
                attributes: ['id']
            });
            
            if (allLocs.length < 5) {
                return res.status(400).json({ error: 'Map must have at least 5 locations' });
            }
            
            // Shuffle and pick 5
            const shuffled = allLocs.sort(() => 0.5 - Math.random());
            locations = shuffled.slice(0, 5);
        } else {
            // Classic World (Random from all locations? Or specific logic?)
            // For now, let's pick 5 random locations from ALL locations in DB
            // Ideally, this should use a curated "World" map, but we'll use all for now.
             const allLocs = await Location.findAll({ where: { is_deleted: false }, attributes: ['id'] });
             if (allLocs.length < 5) {
                return res.status(400).json({ error: 'Not enough locations in database' });
            }
            const shuffled = allLocs.sort(() => 0.5 - Math.random());
            locations = shuffled.slice(0, 5);
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
        const roundNumber = parseInt(round, 10);
        const latNum = Number(lat);
        const lngNum = Number(lng);

        if (!Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > 5) {
            return res.status(400).json({ error: 'Invalid round' });
        }

        if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        const response = await sequelize.transaction(async (transaction) => {
            const game = await Game.findOne({
                where: { id: gameId, user_id: req.user.id },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!game) {
                const err = new Error('Game not found');
                err.status = 404;
                throw err;
            }

            if (game.status === 'finished') {
                const err = new Error('Game already finished');
                err.status = 400;
                throw err;
            }

            // Find current round guess record and lock it to prevent duplicate scoring.
            const currentGuess = await Guess.findOne({
                where: { game_id: gameId, round_number: roundNumber },
                include: [Location],
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!currentGuess) {
                const err = new Error('Round not found');
                err.status = 404;
                throw err;
            }

            if (currentGuess.guess_lat !== null || currentGuess.guess_lng !== null) {
                const err = new Error('Round already played');
                err.status = 400;
                throw err;
            }

            // Calculate score with WGS84 ellipsoid distance.
            const actualLat = currentGuess.Location.lat;
            const actualLng = currentGuess.Location.lng;
            const distance = wgs84DistanceMeters(actualLat, actualLng, latNum, lngNum);
            const distanceKm = distance / 1000;
            const score = calculateGeoScore(distance);

            // Update Guess
            currentGuess.guess_lat = latNum;
            currentGuess.guess_lng = lngNum;
            currentGuess.distance_meters = Math.round(distance);
            currentGuess.score = score;
            await currentGuess.save({ transaction });

            // Update Game Total Score
            game.total_score = (game.total_score || 0) + score;
            
            // Check if game finished
            if (roundNumber >= 5) {
                game.status = 'finished';
            }
            await game.save({ transaction });

            // Prepare response
            const result = {
                score,
                distance: distanceKm,
                actual: { lat: actualLat, lng: actualLng },
                totalScore: game.total_score
            };

            // If next round exists, fetch it
            if (roundNumber < 5) {
                const nextRound = await Guess.findOne({
                    where: { game_id: gameId, round_number: roundNumber + 1 },
                    include: [{ model: Location, attributes: ['pano_id'] }],
                    transaction
                });
                if (nextRound) {
                    result.nextRound = {
                        round: roundNumber + 1,
                        panoId: nextRound.Location.pano_id
                    };
                }
            }

            return result;
        });

        res.json(response);

    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
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