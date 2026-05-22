const jwt = require('jsonwebtoken');
const { User, Duel } = require('../models');
const { broadcastDuelState } = require('../services/duelService');

function extractToken(socket) {
  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken;

  const header = socket.handshake.headers?.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function setupDuelSockets(io) {
  io.use(async (socket, next) => {
    try {
      const token = extractToken(socket);
      if (!token) return next(new Error('unauthorized'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id, {
        attributes: ['id', 'username', 'is_banned']
      });

      if (!user || user.is_banned) return next(new Error('unauthorized'));
      socket.user = user;
      return next();
    } catch (err) {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    socket.join(`user:${userId}`);

    socket.on('duel:join', async ({ duelId } = {}) => {
      try {
        if (!duelId) return;
        const duel = await Duel.findOne({
          where: { id: duelId },
          attributes: ['id', 'player1_id', 'player2_id']
        });

        if (!duel || (duel.player1_id !== userId && duel.player2_id !== userId)) return;
        socket.join(`duel:${duel.id}`);
        await broadcastDuelState(io, duel.id);
      } catch (err) {
        socket.emit('duel:error', { message: 'Failed to join duel room' });
      }
    });

    socket.on('duel:leave', ({ duelId } = {}) => {
      if (duelId) socket.leave(`duel:${duelId}`);
    });
  });
}

module.exports = setupDuelSockets;
