const express = require('express');
const router = express.Router();
const { Settings } = require('../models');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const getSettings = async () => {
    const [settings] = await Settings.findOrCreate({
        where: { id: 1 },
        defaults: { email_enabled: false, maintenance_mode: false }
    });
    return settings;
};

// Middleware: Require Root
const requireRoot = (req, res, next) => {
    if (!req.user.is_root) return res.status(403).json({ error: "Root Access Required" });
    next();
};

// Public status endpoint used by the frontend before auth is known.
router.get('/public', async (req, res) => {
    const settings = await getSettings();
    res.json({ maintenance_mode: Boolean(settings.maintenance_mode) });
});

// GET SETTINGS
router.get('/', [auth, admin, requireRoot], async (req, res) => {
    const settings = await getSettings();
    res.json(settings);
});

// UPDATE SETTINGS
router.post('/toggle-email', [auth, admin, requireRoot], async (req, res) => {
    const { enabled } = req.body;
    const settings = await getSettings();
    settings.email_enabled = Boolean(enabled);
    await settings.save();
    res.json({ message: `Email System ${settings.email_enabled ? 'ENABLED' : 'DISABLED'}`, settings });
});

router.post('/toggle-maintenance', [auth, admin, requireRoot], async (req, res) => {
    const { enabled } = req.body;
    const settings = await getSettings();
    settings.maintenance_mode = Boolean(enabled);
    await settings.save();
    res.json({
        message: `Maintenance Mode ${settings.maintenance_mode ? 'ENABLED' : 'DISABLED'}`,
        settings
    });
});

module.exports = router;
