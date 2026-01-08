const express = require('express');
const router = express.Router();
const { Map, Location, User, sequelize } = require('../models');
const { resolveLocation, refreshLocationMetadata, checkPanoAvailability } = require('../utils/geoUtils');
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
            where: { 
                map_id: req.params.id,
                is_deleted: false 
            },
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

// Get Deleted Locations
router.get('/:id/deleted-locations', auth, async (req, res) => {
    try {
        const map = await Map.findByPk(req.params.id);
        if (!map) return res.status(404).json({ error: 'Map not found' });

        // Permission check
        if (!req.user.is_admin && !req.user.is_root && map.creator_id !== req.user.id) {
            return res.status(403).json({ error: 'Access Denied' });
        }

        const locations = await Location.findAll({
            where: { 
                map_id: map.id,
                is_deleted: true 
            },
            order: [['id', 'DESC']]
        });
        
        res.json(locations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Restore Location
router.post('/:id/restore-location/:locationId', auth, async (req, res) => {
    try {
        const map = await Map.findByPk(req.params.id);
        if (!map) return res.status(404).json({ error: 'Map not found' });

        if (!req.user.is_admin && !req.user.is_root && map.creator_id !== req.user.id) {
            return res.status(403).json({ error: 'Access Denied' });
        }

        const loc = await Location.findOne({
            where: { id: req.params.locationId, map_id: map.id }
        });

        if (!loc) return res.status(404).json({ error: 'Location not found' });

        loc.is_deleted = false;
        await loc.save();

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Empty Trash (Permanently Delete)
router.delete('/:id/empty-trash', auth, async (req, res) => {
    try {
        const map = await Map.findByPk(req.params.id);
        if (!map) return res.status(404).json({ error: 'Map not found' });

        if (!req.user.is_admin && !req.user.is_root && map.creator_id !== req.user.id) {
            return res.status(403).json({ error: 'Access Denied' });
        }

        const deleted = await Location.destroy({
            where: { 
                map_id: map.id,
                is_deleted: true
            }
        });

        res.json({ success: true, count: deleted });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check Availability (Stream)
router.get('/:id/check-availability', auth, async (req, res) => {
    try {
        const map = await Map.findByPk(req.params.id);
        if (!map) return res.status(404).json({ error: 'Map not found' });

        if (!req.user.is_admin && !req.user.is_root && map.creator_id !== req.user.id) {
            return res.status(403).json({ error: 'Access Denied' });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Allow resuming - offset refers to the index in the full list of locations (including deleted ones)
        // to ensure stability.
        const startOffset = parseInt(req.query.offset) || 0;

        // We count ALL locations to have a stable total for progress bars
        const total = await Location.count({ where: { map_id: map.id } });
        res.write(`data: ${JSON.stringify({ type: 'start', total })}\n\n`);

        // High concurrency: QPM 30,000 allows ~500 requests/sec.
        // Batch size 350 with parallel execution fits well.
        const BATCH_SIZE = 350; 
        const CONCURRENCY = 50; // Process 50 at a time within the batch to avoid choking
        
        let processedCount = startOffset;
        let removedCount = 0;
        let checkedCount = 0;

        // Helper for concurrency
        const processWithConcurrency = async (items, concurrency, fn) => {
            let index = 0;
            const results = [];
            const executing = [];

            const runNext = async () => {
                if (index >= items.length) return;
                const i = index++;
                const item = items[i];
                
                try {
                    results[i] = await fn(item);
                } catch (e) {
                    results[i] = { error: e };
                }
                
                // Immediately start next
                return runNext();
            };

            // Start initial pool
            for (let i = 0; i < concurrency && i < items.length; i++) {
                executing.push(runNext());
            }

            await Promise.all(executing);
            return results;
        };

        // Iterate over ALL locations to keep pagination stable
        for (let offset = startOffset; offset < total; offset += BATCH_SIZE) {
            const locations = await Location.findAll({ 
                where: { map_id: map.id },
                limit: BATCH_SIZE,
                offset: offset,
                order: [['id', 'ASC']]
            });
            
            const toRemoveIds = [];
            
            // Define the check function
            const checkLocation = async (loc) => {
                // If already deleted, just skip
                if (loc.is_deleted) {
                    processedCount++;
                    // We can send periodic updates here too if needed, but skipped items are fast
                    return { skipped: true };
                }

                // Check availability
                const isAvailable = await checkPanoAvailability(loc.pano_id);
                
                processedCount++;
                checkedCount++;
                
                // Send REAL-TIME progress update
                if (processedCount % 10 === 0 || processedCount === total) {
                     res.write(`data: ${JSON.stringify({ 
                        type: 'progress', 
                        processed: processedCount, 
                        removed: removedCount, // Note: This is "so far confirmed removed"
                        checked: checkedCount
                    })}\n\n`);
                    if (res.flush) res.flush();
                }

                if (!isAvailable) {
                    // We don't increment removedCount here for the progress bar 
                    // until we actually confirm/add to list, but for UX 'removedCount'
                    // usually means "found to be invalid".
                    removedCount++; 
                    return { remove: true, id: loc.id };
                }
                return { ok: true };
            };

            // Execute with concurrency limit
            const results = await processWithConcurrency(locations, CONCURRENCY, checkLocation);

            // Collect IDs to remove
            results.forEach(r => {
                if (r && r.remove) {
                    toRemoveIds.push(r.id);
                }
            });

            // Bulk update for efficiency
            if (toRemoveIds.length > 0) {
                await Location.update(
                    { is_deleted: true }, 
                    { where: { id: toRemoveIds } }
                );
            }
        }
        
        res.write(`data: ${JSON.stringify({ 
            type: 'done', 
            processed: processedCount, 
            removed: removedCount,
            checked: checkedCount
        })}\n\n`);
        
        res.end();

    } catch (err) {
        console.error('Availability check error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        } else {
            res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
            res.end();
        }
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

// Refresh All Locations (Root Only) - Streaming
router.get('/:id/refresh-locations-stream', auth, async (req, res) => {
    try {
        if (!req.user.is_root) {
            return res.status(403).json({ error: 'Access Denied: Root Only' });
        }

        const map = await Map.findByPk(req.params.id);
        if (!map) return res.status(404).json({ error: 'Map not found' });

        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const total = await Location.count({ where: { map_id: map.id } });
        res.write(`data: ${JSON.stringify({ type: 'start', total })}\n\n`);

        const BATCH_SIZE = 50;
        let updatedCount = 0;
        let failedCount = 0;
        let processedCount = 0;

        // Process in batches
        for (let offset = 0; offset < total; offset += BATCH_SIZE) {
            const locations = await Location.findAll({ 
                where: { map_id: map.id },
                limit: BATCH_SIZE,
                offset: offset,
                order: [['id', 'ASC']] // Ensure stable ordering
            });

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
                processedCount++;
                
                // Small delay to avoid rate limits
                await new Promise(r => setTimeout(r, 20)); 
            }

            // Send progress update after each batch
            res.write(`data: ${JSON.stringify({ 
                type: 'progress', 
                processed: processedCount, 
                updated: updatedCount, 
                failed: failedCount 
            })}\n\n`);
        }

        res.write(`data: ${JSON.stringify({ 
            type: 'done', 
            processed: processedCount, 
            updated: updatedCount, 
            failed: failedCount 
        })}\n\n`);
        
        res.end();

    } catch (err) {
        console.error('Refresh error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        } else {
            res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
            res.end();
        }
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

// Export Vali JSON
router.get('/:id/export-vali', auth, async (req, res) => {
    try {
        const map = await Map.findByPk(req.params.id);
        if (!map) return res.status(404).json({ error: 'Map not found' });

        // Permission check
        const isCreator = req.user.is_admin && map.creator_id === req.user.id;
        const isRoot = req.user.is_root;

        if (!isCreator && !isRoot) {
            return res.status(403).json({ error: 'Access Denied' });
        }

        const locations = await Location.findAll({
            where: { 
                map_id: map.id,
                is_deleted: false 
            },
            attributes: ['pano_id', 'lat', 'lng']
        });

        const exportData = locations.map(l => ({
            panoId: l.pano_id,
            lat: l.lat,
            lng: l.lng
        }));

        res.setHeader('Content-Disposition', `attachment; filename="${map.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_vali.json"`);
        res.json(exportData);

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
