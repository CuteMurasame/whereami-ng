// server/routes/admin.js
const express = require('express');
const router = express.Router();
const { User } = require('../models');
const auth = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// Helper to check permissions
const canManage = (actor, target) => {
    if (actor.id === target.id) return false; // Can't ban yourself
    if (actor.is_root) return true; // Root controls all
    if (actor.is_admin && !target.is_admin && !target.is_root) return true; // Admin controls Users
    return false; // Admin cannot touch Admin/Root
};

// 1. GET USERS (Add is_root/is_banned to response)
router.get('/users', [auth, adminMiddleware], async (req, res) => {
    const users = await User.findAll({
        attributes: ['id', 'username', 'email', 'is_admin', 'is_root', 'is_banned', 'created_at']
    });
    res.json(users);
});

// 2. UPDATE ROLE (Promote/Demote) - ROOT ONLY
router.post('/role', [auth, adminMiddleware], async (req, res) => {
    if (!req.user.is_root) return res.status(403).json({ error: "Only Root can change ranks." });

    const { userId, role } = req.body; // role: 'admin', 'user'
    const target = await User.findByPk(userId);

    if (role === 'admin') {
        target.is_admin = true;
        target.is_root = false;
    } else if (role === 'user') {
        target.is_admin = false;
        target.is_root = false;
    }
    
    await target.save();
    res.json({ message: `User ${target.username} role updated to ${role}` });
});

// 3. BAN/UNBAN (Root & Admin)
router.post('/ban-status', [auth, adminMiddleware], async (req, res) => {
    const { userId, ban } = req.body; // ban: true/false
    const target = await User.findByPk(userId);
    const actor = req.user; // The person clicking the button

    // Hierarchy Check
    if (!canManage(actor, target)) {
        return res.status(403).json({ error: "You do not have permission to modify this user." });
    }

    target.is_banned = ban;
    await target.save();
    res.json({ message: `User ${target.username} ${ban ? 'BANNED' : 'UNBANNED'}` });
});

module.exports = router;
