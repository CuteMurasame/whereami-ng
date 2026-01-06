// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const { User } = require('../models'); // Import your User model

module.exports = async function (req, res, next) {
  // 1. Get Token
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access Denied' });

  try {
    // 2. Decode Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3. FETCH FRESH USER FROM DB (The Fix)
    const user = await User.findByPk(decoded.id);

    // 4. Check if User Exists
    if (!user) {
        return res.status(401).json({ error: 'User does not exist' });
    }

    // 5. INSTANT BAN CHECK
    if (user.is_banned) {
        return res.status(403).json({ error: 'YOUR_ACCOUNT_IS_BANNED' }); 
        // We use a specific code string to catch it easily in frontend
    }

    // 6. Attach FRESH user to request (Roles are now up-to-date for this request)
    req.user = user; 
    next();

  } catch (err) {
    res.status(400).json({ error: 'Invalid Token' });
  }
};
