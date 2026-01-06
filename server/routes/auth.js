const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const passport = require('passport');

const { Op } = require('sequelize');

// Register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) return res.status(400).json({ error: "Username already taken" });

    if (email && email.trim() !== "") {
      const existingEmail = await User.findOne({ 
          where: { 
              [Op.or]: [
                  { email: email },
                  { google_email: email }
              ]
          } 
      });
      if (existingEmail) return res.status(400).json({ error: "Email already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = await User.create({ 
      username, 
      email: email || null, 
      password_hash 
    });
    
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        is_admin: user.is_admin,
        is_root: user.is_root 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: "User registered successfully",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_admin: user.is_admin,
        is_root: user.is_root,
        is_banned: user.is_banned,
        avatar_url: user.avatar_url,
        bio: user.bio
      }
    });
  } catch (err) {
    if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ where: { username } });
    if (!user) return res.status(400).json({ error: "User not found" });
    
    if (user.is_banned) return res.status(403).json({ error: "User is banned" });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        is_admin: user.is_admin,
        is_root: user.is_root 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: "Logged in",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_admin: user.is_admin,
        is_root: user.is_root,
        is_banned: user.is_banned,
        avatar_url: user.avatar_url,
        bio: user.bio
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', require('../middleware/auth'), (req, res) => {
    res.json({
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        is_admin: req.user.is_admin,
        is_root: req.user.is_root,
        is_banned: req.user.is_banned,
        avatar_url: req.user.avatar_url,
        bio: req.user.bio,
        google_id: req.user.google_id
    });
});

// --- GOOGLE AUTH ---

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/bind', (req, res, next) => {
    const token = req.query.token;
    if (!token) return res.status(401).send("No token provided");
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const state = Buffer.from(JSON.stringify({ bind_user_id: decoded.id })).toString('base64');
        passport.authenticate('google', { scope: ['profile', 'email'], state })(req, res, next);
    } catch (err) {
        return res.status(401).send("Invalid token");
    }
});

router.get('/google/callback', (req, res, next) => {
    const CLIENT_URL = process.env.CLIENT_URL || `http://${req.hostname}:5173`;
    passport.authenticate('google', (err, user, info) => {
        if (err) return res.redirect(CLIENT_URL + '/login?error=auth_error');
        if (!user) return res.redirect(CLIENT_URL + '/login?error=auth_failed');
        
        req.logIn(user, (err) => {
            if (err) return res.redirect(CLIENT_URL + '/login?error=login_error');
            next();
        });
    })(req, res, next);
}, async (req, res) => {
    const CLIENT_URL = process.env.CLIENT_URL || `http://${req.hostname}:5173`;
    try {
        let bindUserId = null;
        if (req.query.state) {
            try {
                const decodedState = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
                bindUserId = decodedState.bind_user_id;
            } catch (e) {
                console.error("Failed to decode state", e);
            }
        }

        if (bindUserId) {
            if (!req.user.is_new_google_user) {
                if (req.user.id === bindUserId) {
                    return res.redirect(CLIENT_URL + '/settings?status=already_linked');
                } else {
                    return res.redirect(CLIENT_URL + '/settings?status=google_taken');
                }
            }

            // Check if the Google email is already used by another user
            if (!req.user.email) {
                 return res.redirect(CLIENT_URL + '/settings?status=google_no_email');
            }

            const existingEmailUser = await User.findOne({ 
                where: { 
                    [Op.or]: [
                        { email: req.user.email },
                        { google_email: req.user.email }
                    ]
                } 
            });
            
            if (existingEmailUser && existingEmailUser.id !== bindUserId) {
                return res.redirect(CLIENT_URL + '/settings?status=email_taken');
            }

            // Update google_id and google_email. 
            // Only update primary email if it's currently empty.
            const userToUpdate = await User.findByPk(bindUserId);
            const updateData = {
                google_id: req.user.google_id,
                google_email: req.user.email
            };
            
            if (!userToUpdate.email) {
                updateData.email = req.user.email;
            }

            await User.update(updateData, { where: { id: bindUserId } });
            return res.redirect(CLIENT_URL + '/settings?status=success');
        }

        if (req.user.is_new_google_user) {
            // Check if user with this email already exists
            const existingUser = await User.findOne({ where: { email: req.user.email } });
            
            if (existingUser) {
                if (existingUser.is_banned) return res.redirect(CLIENT_URL + '/login?error=banned');

                // Link account
                await existingUser.update({ google_id: req.user.google_id });

                const token = jwt.sign(
                    { 
                        id: existingUser.id, 
                        username: existingUser.username, 
                        is_admin: existingUser.is_admin,
                        is_root: existingUser.is_root 
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: '24h' }
                );
                return res.redirect(`${CLIENT_URL}/auth/callback?token=${token}`);
            }

            const tempToken = jwt.sign(
                { google_id: req.user.google_id, email: req.user.email || null, is_temp: true },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );
            return res.redirect(`${CLIENT_URL}/register/google?token=${tempToken}&email=${req.user.email}`);
        } else {
            if (req.user.is_banned) {
                 return res.redirect(CLIENT_URL + '/login?error=banned');
            }

            const token = jwt.sign(
                { 
                    id: req.user.id, 
                    username: req.user.username, 
                    is_admin: req.user.is_admin,
                    is_root: req.user.is_root 
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
            return res.redirect(`${CLIENT_URL}/auth/callback?token=${token}`);
        }
    } catch (err) {
        console.error(err);
        res.redirect(CLIENT_URL + '/login?error=server_error');
    }
  }
);

router.post('/google/finalize', async (req, res) => {
    const { token, username, password } = req.body;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.is_temp) return res.status(400).json({ error: "Invalid token" });

        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) return res.status(400).json({ error: "Username already taken" });

        const existingEmail = await User.findOne({ 
            where: { 
                [Op.or]: [
                    { email: decoded.email },
                    { google_email: decoded.email }
                ]
            } 
        });
        if (existingEmail) return res.status(400).json({ error: "Email already registered. Please login to your existing account and link Google in settings." });

         const salt = await bcrypt.genSalt(10);
         const password_hash = await bcrypt.hash(password, salt);
         
         const newUser = await User.create({
             username,
             email: decoded.email || null,
             google_email: decoded.email || null,
             password_hash,
             google_id: decoded.google_id
         });

         const newToken = jwt.sign(
            { 
                id: newUser.id, 
                username: newUser.username, 
                is_admin: newUser.is_admin,
                is_root: newUser.is_root 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: "Registered successfully",
            token: newToken,
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                is_admin: newUser.is_admin,
                is_root: newUser.is_root,
                is_banned: newUser.is_banned,
                avatar_url: newUser.avatar_url,
                bio: newUser.bio
            }
        });

    } catch (err) {
        if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
