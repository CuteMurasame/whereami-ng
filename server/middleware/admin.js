// server/middleware/admin.js
module.exports = function (req, res, next) {
  // 403 Forbidden is the correct code for "Logged in but not allowed"
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Access Denied: Admins Only.' });
  }
  next();
};
