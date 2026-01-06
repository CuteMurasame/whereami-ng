const express = require('express');
const router = express.Router();
const { Settings } = require('../models');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Middleware: Require Root
const requireRoot = (req, res, next) => {
    if (!req.user.is_root) return res.status(403).json({ error: "Root Access Required" });
    next();
};

// GET SETTINGS
router.get('/', [auth, admin, requireRoot], async (req, res) => {
    const [settings] = await Settings.findOrCreate({ where: { id: 1 } });
    res.json(settings);
});

// UPDATE SETTINGS
router.post('/toggle-email', [auth, admin, requireRoot], async (req, res) => {
    const { enabled } = req.body;
    const [settings] = await Settings.findOrCreate({ where: { id: 1 } });
    
    settings.email_enabled = enabled;
    await settings.save();
    
    res.json({ message: `Email System ${enabled ? 'ENABLED' : 'DISABLED'}`, settings });
});

module.exports = router;
