const jwt = require('jsonwebtoken');
const { Settings, User } = require('../models');

const isPublicMaintenanceEndpoint = (req) => {
  if (req.method === 'OPTIONS') return true;
  if (req.path === '/api/settings/public') return true;
  if (req.path === '/api/auth/me' && req.method === 'GET') return true;
  if (req.path === '/api/auth/login' && req.method === 'POST') return true;
  if (req.path === '/api/auth/logout' && req.method === 'POST') return true;
  if (req.path.startsWith('/api/auth/google') && req.method === 'GET') return true;
  return false;
};

const getBearerToken = (req) => {
  const header = req.header('Authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

const canBypassMaintenance = async (req) => {
  const token = getBearerToken(req);
  if (!token) return false;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'is_admin', 'is_banned']
    });
    return Boolean(user && user.is_admin && !user.is_banned);
  } catch (err) {
    return false;
  }
};

module.exports = async function maintenanceMode(req, res, next) {
  try {
    const [settings] = await Settings.findOrCreate({
      where: { id: 1 },
      defaults: { email_enabled: false, maintenance_mode: false }
    });

    if (!settings.maintenance_mode) return next();
    if (isPublicMaintenanceEndpoint(req)) return next();
    if (await canBypassMaintenance(req)) return next();

    return res.status(503).json({
      error: 'MAINTENANCE_MODE',
      message: 'The site is currently in maintenance mode. Please try again later.'
    });
  } catch (err) {
    console.error('Maintenance mode check failed:', err);
    return next();
  }
};
