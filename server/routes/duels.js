const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { DuelQueue } = require('../models');
const { validateCoordinates } = require('../utils/scoring');
const {
  normalizeMapId,
  getPlayableMap,
  tryCreateMatch,
  findQueueStatus,
  buildDuelPayload,
  buildDuelReviewPayload,
  submitGuess,
  advanceRound,
  forfeitDuel,
  getLeaderboard
} = require('../services/duelService');

const isValidMode = (mode) => ['moving', 'nm', 'nmpz'].includes(mode);

router.get('/queue/status', auth, async (req, res) => {
  try {
    res.json(await findQueueStatus(req.user.id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/queue', auth, async (req, res) => {
  try {
    const mode = req.body.mode || 'moving';
    if (!isValidMode(mode)) return res.status(400).json({ error: 'Invalid mode' });

    const mapId = normalizeMapId(req.body.mapId);
    if (Number.isNaN(mapId)) return res.status(400).json({ error: 'Invalid map id' });

    await getPlayableMap(mapId);

    const currentStatus = await findQueueStatus(req.user.id);
    if (currentStatus.status === 'active') return res.json(currentStatus);

    await DuelQueue.upsert({
      user_id: req.user.id,
      mode,
      map_id: mapId,
      created_at: new Date()
    });

    const duel = await tryCreateMatch(req.app.get('io'), { mode, mapId });
    if (duel && (duel.player1_id === req.user.id || duel.player2_id === req.user.id)) {
      return res.json({ status: 'matched', duelId: duel.id });
    }

    res.json(await findQueueStatus(req.user.id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/queue', auth, async (req, res) => {
  try {
    await DuelQueue.destroy({ where: { user_id: req.user.id } });
    res.json({ status: 'idle' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/leaderboard', auth, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;
    res.json({ players: await getLeaderboard({ limit, offset }), page, limit });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});


router.get('/:id/review', auth, async (req, res) => {
  try {
    res.json(await buildDuelReviewPayload(req.params.id, req.user.id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    res.json(await buildDuelPayload(req.params.id, req.user.id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/guess', auth, async (req, res) => {
  try {
    const coords = validateCoordinates(req.body.lat, req.body.lng);
    if (!coords.valid) return res.status(400).json({ error: 'Invalid coordinates' });

    res.json(await submitGuess({
      duelId: req.params.id,
      userId: req.user.id,
      lat: coords.lat,
      lng: coords.lng,
      io: req.app.get('io')
    }));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/next', auth, async (req, res) => {
  try {
    res.json(await advanceRound({
      duelId: req.params.id,
      userId: req.user.id,
      io: req.app.get('io')
    }));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/forfeit', auth, async (req, res) => {
  try {
    res.json(await forfeitDuel({
      duelId: req.params.id,
      userId: req.user.id,
      io: req.app.get('io')
    }));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
