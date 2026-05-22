const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const passport = require('passport');
const auth = require('../middleware/auth');

const { Op } = require('sequelize');

const getClientUrl = (req) => (process.env.CLIENT_URL || `${req.protocol}://${req.hostname}:5173`).replace(/\/+$/, '');
const getApiBaseUrl = (req) => (process.env.PUBLIC_API_BASE_URL || `${req.protocol}://${req.get('host')}/api`).replace(/\/+$/, '');

const redirectWithHash = (clientUrl, path, params) => {
    const target = new URL(path, clientUrl);
    target.hash = new URLSearchParams(params).toString();
    return target.toString();
};

const signUserToken = (user) => jwt.sign(
    {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin,
        is_root: user.is_root
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
);

const publicUser = (user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    google_email: user.google_email,
    is_admin: user.is_admin,
    is_root: user.is_root,
    is_banned: user.is_banned,
    avatar_url: user.avatar_url,
    bio: user.bio,
    elo_rating: user.elo_rating,
    peak_elo: user.peak_elo,
    elo_games: user.elo_games,
    total_duels: user.total_duels,
    total_wins: user.total_wins,
    total_losses: user.total_losses,
    total_draws: user.total_draws
});

const signGoogleBindTicket = (userId) => jwt.sign(
    { purpose: 'google_bind_ticket', user_id: userId },
    process.env.JWT_SECRET,
    { expiresIn: '2m' }
);

const verifyGoogleBindTicket = (ticket) => {
    const decoded = jwt.verify(ticket, process.env.JWT_SECRET);
    if (decoded.purpose !== 'google_bind_ticket' || !decoded.user_id) {
        throw new Error('Invalid bind ticket');
    }
    return decoded;
};

const signGoogleBindState = (userId) => jwt.sign(
    { purpose: 'google_bind_state', bind_user_id: userId },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
);

const verifyGoogleBindState = (state) => {
    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    if (decoded.purpose !== 'google_bind_state' || !decoded.bind_user_id) {
        throw new Error('Invalid bind state');
    }
    return decoded;
};

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
    
    const token = signUserToken(user);

    res.json({
      message: "User registered successfully",
      token,
      user: publicUser(user)
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

    const token = signUserToken(user);

    res.json({
      message: "Logged in",
      token,
      user: publicUser(user)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', (req, res) => {
    const finish = () => {
        if (req.session) {
            req.session.destroy(() => {
                res.clearCookie('connect.sid');
                res.json({ message: 'Logged out' });
            });
            return;
        }
        res.json({ message: 'Logged out' });
    };

    if (typeof req.logout === 'function') {
        return req.logout(() => finish());
    }

    return finish();
});

router.get('/me', auth, (req, res) => {
    res.json({
        ...publicUser(req.user),
        google_id: req.user.google_id
    });
});

router.post('/google/unlink', auth, async (req, res) => {
    try {
        if (!req.user.google_id && !req.user.google_email) {
            return res.status(400).json({ error: 'Google account is not linked' });
        }

        await req.user.update({
            google_id: null,
            google_email: null
        });

        res.json({
            message: 'Google account unlinked successfully',
            user: {
                ...publicUser(req.user),
                google_id: null
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- GOOGLE AUTH ---

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Create a very short-lived launch URL for Google account binding.
// This avoids putting the user's normal login JWT in a browser URL.
router.post('/google/bind-ticket', auth, (req, res) => {
    const ticket = signGoogleBindTicket(req.user.id);
    res.json({
        url: `${getApiBaseUrl(req)}/auth/google/bind?ticket=${encodeURIComponent(ticket)}`
    });
});

router.get('/google/bind', (req, res, next) => {
    const ticket = req.query.ticket;
    if (!ticket) return res.status(401).send("No bind ticket provided");
    
    try {
        const decoded = verifyGoogleBindTicket(ticket);
        const state = signGoogleBindState(decoded.user_id);
        passport.authenticate('google', { scope: ['profile', 'email'], state })(req, res, next);
    } catch (err) {
        return res.status(401).send("Invalid or expired bind ticket");
    }
});

router.get('/google/callback', (req, res, next) => {
    const CLIENT_URL = getClientUrl(req);
    passport.authenticate('google', (err, user, info) => {
        if (err) return res.redirect(CLIENT_URL + '/login?error=auth_error');
        if (!user) return res.redirect(CLIENT_URL + '/login?error=auth_failed');
        
        req.logIn(user, (err) => {
            if (err) return res.redirect(CLIENT_URL + '/login?error=login_error');
            next();
        });
    })(req, res, next);
}, async (req, res) => {
    const CLIENT_URL = getClientUrl(req);
    try {
        let bindUserId = null;
        if (req.query.state) {
            try {
                const decodedState = verifyGoogleBindState(req.query.state);
                bindUserId = decodedState.bind_user_id;
            } catch (e) {
                console.error("Invalid Google bind state", e);
                return res.redirect(CLIENT_URL + '/settings?status=invalid_state');
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

            const userToUpdate = await User.findByPk(bindUserId);
            if (!userToUpdate) {
                return res.redirect(CLIENT_URL + '/settings?status=user_not_found');
            }

            // Update google_id and google_email. 
            // Only update primary email if it's currently empty.
            const updateData = {
                google_id: req.user.google_id,
                google_email: req.user.email
            };
            
            if (!userToUpdate.email) {
                updateData.email = req.user.email;
            }

            await userToUpdate.update(updateData);
            return res.redirect(CLIENT_URL + '/settings?status=success');
        }

        if (req.user.is_new_google_user) {
            // Check if user with this email already exists
            const existingUser = await User.findOne({ where: { email: req.user.email } });
            
            if (existingUser) {
                if (existingUser.is_banned) return res.redirect(CLIENT_URL + '/login?error=banned');

                // Link account
                await existingUser.update({
                    google_id: req.user.google_id,
                    google_email: req.user.email || existingUser.google_email
                });

                const token = signUserToken(existingUser);
                return res.redirect(redirectWithHash(CLIENT_URL, '/auth/callback', { token }));
            }

            const tempToken = jwt.sign(
                { google_id: req.user.google_id, email: req.user.email || null, is_temp: true },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );
            const params = { token: tempToken };
            if (req.user.email) params.email = req.user.email;
            return res.redirect(redirectWithHash(CLIENT_URL, '/register/google', params));
        } else {
            if (req.user.is_banned) {
                 return res.redirect(CLIENT_URL + '/login?error=banned');
            }

            const token = signUserToken(req.user);
            return res.redirect(redirectWithHash(CLIENT_URL, '/auth/callback', { token }));
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

        if (decoded.email) {
            const existingEmail = await User.findOne({ 
                where: { 
                    [Op.or]: [
                        { email: decoded.email },
                        { google_email: decoded.email }
                    ]
                } 
            });
            if (existingEmail) return res.status(400).json({ error: "Email already registered. Please login to your existing account and link Google in settings." });
        }

         const salt = await bcrypt.genSalt(10);
         const password_hash = await bcrypt.hash(password, salt);
         
         const newUser = await User.create({
             username,
             email: decoded.email || null,
             google_email: decoded.email || null,
             password_hash,
             google_id: decoded.google_id
         });

         const newToken = signUserToken(newUser);

        res.json({
            message: "Registered successfully",
            token: newToken,
            user: publicUser(newUser)
        });

    } catch (err) {
        if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
