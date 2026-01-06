const express = require('express');
const router = express.Router();
const { Map, Location, User, sequelize } = require('../models');
const { resolveLocation, refreshLocationMetadata } = require('../utils/geoUtils');
const auth = require('../middleware/auth');

// Helper to process locations string
const processLocations = async (locationsStr) => {
    if (!locationsStr) return [];
    const lines = locationsStr.split('\n');
    const promises = [];
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
            promises.push(resolveLocation(trimmed));
        }
    }
    
    const results = await Promise.all(promises);
    // Filter out nulls (failed resolutions)
    return results.filter(r => r !== null);
};

// Get All Maps
router.get('/', async (req, res) => {
    try {
        const where = {};
        if (req.query.is_singleplayer === 'true') {
            where.is_singleplayer = true;
        }

        const maps = await Map.findAll({ 
            where,
            include: [
                { model: User, attributes: ['username'] }
            ] 
        });
        res.json(maps);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Single Map
router.get('/:id', async (req, res) => {
    try {
        const map = await Map.findByPk(req.params.id, {
            include: [{ model: User, attributes: ['username'] }]
        });
        if (!map) return res.status(404).json({ error: 'Map not found' });
        
        // Get location count
        const locationCount = await Location.count({ where: { map_id: map.id } });
        
        res.json({ ...map.toJSON(), locationCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Random Location (Play Mode)
router.get('/:id/random', async (req, res) => {
    try {
        const map = await Map.findByPk(req.params.id);
        if (!map) return res.status(404).json({ error: 'Map not found' });

        // Get a random location
        // Note: For large datasets, this might be slow on some DBs, but fine for now.
        // Sequelize doesn't have a universal random(), so we'll fetch IDs and pick one.
        const locations = await Location.findAll({ 
            where: { map_id: map.id },
            attributes: ['id', 'pano_id', 'lat', 'lng']
        });

        if (locations.length === 0) {
            return res.status(404).json({ error: 'No locations in this map' });
        }

        const randomLoc = locations[Math.floor(Math.random() * locations.length)];
        res.json(randomLoc);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Map Locations (Paginated)
router.get('/:id/locations', async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        
        const locations = await Location.findAndCountAll({
            where: { map_id: req.params.id },
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['id', 'DESC']]
        });
        
        res.json({
            locations: locations.rows,
            total: locations.count,
            page: parseInt(page),
            totalPages: Math.ceil(locations.count / limit)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Location
router.delete('/:id/locations/:locationId', auth, async (req, res) => {
    try {
        const map = await Map.findByPk(req.params.id);
        if (!map) return res.status(404).json({ error: 'Map not found' });

        // Permission check
        const isCreator = req.user.is_admin && map.creator_id === req.user.id;
        const isRoot = req.user.is_root;

        if (!isCreator && !isRoot) {
            return res.status(403).json({ error: 'Access Denied' });
        }

        const deleted = await Location.destroy({
            where: { 
                id: req.params.locationId,
                map_id: map.id
            }
        });

        if (deleted) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Location not found' });
        }

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Refresh All Locations (Root Only)
router.post('/:id/refresh-locations', auth, async (req, res) => {
    try {
        if (!req.user.is_root) {
            return res.status(403).json({ error: 'Access Denied: Root Only' });
        }

        const map = await Map.findByPk(req.params.id);
        if (!map) return res.status(404).json({ error: 'Map not found' });

        const locations = await Location.findAll({ where: { map_id: map.id } });
        let updatedCount = 0;
        let failedCount = 0;

        for (const loc of locations) {
            const freshData = await refreshLocationMetadata(loc);
            if (freshData) {
                loc.pano_id = freshData.panoId;
                loc.lat = freshData.lat;
                loc.lng = freshData.lng;
                await loc.save();
                updatedCount++;
            } else {
                failedCount++;
            }
            // Small delay to avoid rate limits if many locations
            await new Promise(r => setTimeout(r, 50)); 
        }

        res.json({ 
            success: true, 
            total: locations.length, 
            updated: updatedCount, 
            failed: failedCount 
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new Map
router.post('/', auth, async (req, res) => {
    try {
        // Permission check: Admin or Root
        if (!req.user.is_admin && !req.user.is_root) {
            return res.status(403).json({ error: 'Access Denied' });
        }

        const { name, description, locations, is_official } = req.body;
        
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const newMap = await Map.create({ 
            name, 
            description, 
            creator_id: req.user.id,
            is_official: !!is_official
        });

        // Process locations if provided
        const locs = await processLocations(locations);
        if (locs.length > 0) {
            const locsData = locs.map(l => ({
                map_id: newMap.id,
                pano_id: l.panoId,
                lat: l.lat,
                lng: l.lng
            }));
            await Location.bulkCreate(locsData);
        }

        // Reload map with locations
        const mapWithLocs = await Map.findByPk(newMap.id, { include: Location });
        res.json(mapWithLocs);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Edit Map (Metadata)
router.put('/:id', auth, async (req, res) => {
    try {
        const map = await Map.findByPk(req.params.id);
        if (!map) return res.status(404).json({ error: 'Map not found' });

        // Permission check
        const isCreator = req.user.is_admin && map.creator_id === req.user.id;
        const isRoot = req.user.is_root;

        if (!isCreator && !isRoot) {
            return res.status(403).json({ error: 'Access Denied' });
        }

        const { name, description, is_official, is_singleplayer } = req.body;
        if (name) map.name = name;
        if (description !== undefined) map.description = description;
        if (is_official !== undefined) map.is_official = is_official;
        if (is_singleplayer !== undefined && req.user.is_root) map.is_singleplayer = is_singleplayer;
        
        await map.save();
        res.json(map);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Map
router.delete('/:id', auth, async (req, res) => {
    try {
        const map = await Map.findByPk(req.params.id);
        if (!map) return res.status(404).json({ error: 'Map not found' });

        // Permission check
        const isCreator = req.user.is_admin && map.creator_id === req.user.id;
        const isRoot = req.user.is_root;

        if (!isCreator && !isRoot) {
            return res.status(403).json({ error: 'Access Denied' });
        }

        // Delete associated locations first (optional if cascade is set, but safer to be explicit)
        await Location.destroy({ where: { map_id: map.id } });
        
        await map.destroy();
        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Locations to Map
router.post('/:id/locations', auth, async (req, res) => {
    try {
        const map = await Map.findByPk(req.params.id);
        if (!map) return res.status(404).json({ error: 'Map not found' });

        // Permission check
        const isCreator = req.user.is_admin && map.creator_id === req.user.id;
        const isRoot = req.user.is_root;

        if (!isCreator && !isRoot) {
            return res.status(403).json({ error: 'Access Denied' });
        }

        const { locations } = req.body; // Expecting string with newlines
        const locs = await processLocations(locations);
        
        if (locs.length > 0) {
            const locsData = locs.map(l => ({
                map_id: map.id,
                pano_id: l.panoId,
                lat: l.lat,
                lng: l.lng
            }));
            await Location.bulkCreate(locsData);
        }

        res.json({ success: true, added: locs.length });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Import Vali-generated JSON
router.post('/:id/import-vali', auth, async (req, res) => {
    try {
        const map = await Map.findByPk(req.params.id);
        if (!map) return res.status(404).json({ error: 'Map not found' });

        // Permission check
        const isCreator = req.user.is_admin && map.creator_id === req.user.id;
        const isRoot = req.user.is_root;

        if (!isCreator && !isRoot) {
            return res.status(403).json({ error: 'Access Denied' });
        }

        let locations = req.body;
        // Handle if wrapped in an object
        if (!Array.isArray(locations) && locations.locations && Array.isArray(locations.locations)) {
            locations = locations.locations;
        }

        if (!Array.isArray(locations)) {
            return res.status(400).json({ error: 'Invalid format: Expected JSON array of locations' });
        }

        const validLocs = locations.filter(l => l.panoId && l.lat !== undefined && l.lng !== undefined);
        
        if (validLocs.length === 0) {
            return res.status(400).json({ error: 'No valid locations found in import data' });
        }

        const locsData = validLocs.map(l => ({
            map_id: map.id,
            pano_id: l.panoId,
            lat: l.lat,
            lng: l.lng
        }));

        await Location.bulkCreate(locsData);

        res.json({ success: true, added: locsData.length });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get map leaderboard
router.get('/:id/leaderboard', async (req, res) => {
    try {
        const { id } = req.params;
        const { mode = 'moving', page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        const query = `
            SELECT 
                t.user_id as userId,
                u.username, 
                u.avatar_url, 
                u.email,
                t.max_score, 
                MAX(g.created_at) as achieved_at,
                MAX(g.id) as game_id
            FROM (
                SELECT user_id, MAX(total_score) as max_score
                FROM games
                WHERE map_id = :mapId AND mode = :mode AND status = 'finished'
                GROUP BY user_id
            ) t
            JOIN games g ON g.user_id = t.user_id AND g.total_score = t.max_score AND g.map_id = :mapId AND g.mode = :mode
            JOIN users u ON t.user_id = u.id
            GROUP BY t.user_id
            ORDER BY t.max_score DESC
            LIMIT :limit OFFSET :offset
        `;

        const leaderboard = await sequelize.query(query, {
            replacements: { 
                mapId: id, 
                mode, 
                limit: parseInt(limit), 
                offset: parseInt(offset) 
            },
            type: sequelize.QueryTypes.SELECT
        });

        res.json(leaderboard);
    } catch (err) {
        console.error('Error fetching leaderboard:', err);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

module.exports = router;