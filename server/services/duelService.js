const { Op } = require('sequelize');
const {
  sequelize,
  User,
  Map,
  Location,
  RatingHistory,
  DuelQueue,
  Duel,
  DuelRound
} = require('../models');
const { wgs84DistanceMeters, calculateGeoScore } = require('../utils/scoring');
const { calculateElo, formatRatingUser, DEFAULT_RATING } = require('../utils/rating');

const DUEL_ROUNDS = 5;
const FORCE_PICK_MS = 15 * 1000;
const ROUND_RESULT_MS = 8 * 1000;
const DUEL_AUTOMATION_INTERVAL_MS = 1000;
const ACTIVE_DUEL_STATUSES = ['playing', 'round_results'];
const QUEUE_TTL_MS = 15 * 60 * 1000;

function normalizeMapId(mapId) {
  if (mapId === null || mapId === undefined || mapId === '' || mapId === 'null') return null;
  const parsed = Number(mapId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
}

function getIoRoom(userId) {
  return `user:${userId}`;
}

async function getPlayableMap(mapId, transaction = null) {
  const normalizedMapId = normalizeMapId(mapId);
  if (Number.isNaN(normalizedMapId)) {
    const err = new Error('Invalid map id');
    err.status = 400;
    throw err;
  }

  if (!normalizedMapId) {
    const total = await Location.count({ where: { is_deleted: false }, transaction });
    if (total < DUEL_ROUNDS) {
      const err = new Error('Not enough locations in database');
      err.status = 400;
      throw err;
    }
    return { map: null, mapId: null, locationCount: total };
  }

  const map = await Map.findByPk(normalizedMapId, { transaction });
  if (!map) {
    const err = new Error('Map not found');
    err.status = 404;
    throw err;
  }

  const locationCount = await Location.count({
    where: { map_id: normalizedMapId, is_deleted: false },
    transaction
  });

  if (locationCount < DUEL_ROUNDS) {
    const err = new Error('Selected map must have at least 5 playable locations');
    err.status = 400;
    throw err;
  }

  return { map, mapId: normalizedMapId, locationCount };
}

async function pickLocations(mapId, transaction) {
  const where = { is_deleted: false };
  if (mapId) where.map_id = mapId;

  const locations = await Location.findAll({
    where,
    attributes: ['id'],
    order: sequelize.random(),
    limit: DUEL_ROUNDS,
    transaction
  });

  if (locations.length < DUEL_ROUNDS) {
    const err = new Error('Not enough playable locations');
    err.status = 400;
    throw err;
  }

  return locations.map(location => location.id);
}

async function getActiveDuelForUser(userId, transaction = null) {
  return Duel.findOne({
    where: {
      status: { [Op.in]: ACTIVE_DUEL_STATUSES },
      [Op.or]: [{ player1_id: userId }, { player2_id: userId }]
    },
    order: [['updated_at', 'DESC']],
    transaction
  });
}

async function cleanupOldQueueEntries(transaction = null) {
  const staleBefore = new Date(Date.now() - QUEUE_TTL_MS);
  await DuelQueue.destroy({
    where: { created_at: { [Op.lt]: staleBefore } },
    transaction
  });
}

async function createDuelForPair(player1, player2, { mode, mapId }, transaction) {
  const locationIds = await pickLocations(mapId, transaction);
  const p1Rating = player1.elo_rating ?? DEFAULT_RATING;
  const p2Rating = player2.elo_rating ?? DEFAULT_RATING;

  const duel = await Duel.create({
    player1_id: player1.id,
    player2_id: player2.id,
    map_id: mapId,
    mode,
    status: 'playing',
    current_round: 1,
    total_rounds: DUEL_ROUNDS,
    player1_score: 0,
    player2_score: 0,
    player1_rating_before: p1Rating,
    player2_rating_before: p2Rating
  }, { transaction });

  await DuelRound.bulkCreate(locationIds.map((locationId, index) => ({
    duel_id: duel.id,
    location_id: locationId,
    round_number: index + 1
  })), { transaction });

  return duel;
}

async function tryCreateMatch(io, { mode, mapId }) {
  const matchedDuel = await sequelize.transaction(async (transaction) => {
    await cleanupOldQueueEntries(transaction);

    const queueWhere = { mode };
    queueWhere.map_id = mapId === null ? { [Op.is]: null } : mapId;

    const queue = await DuelQueue.findAll({
      where: queueWhere,
      include: [{
        model: User,
        required: true,
        attributes: [
          'id', 'username', 'avatar_url', 'elo_rating', 'peak_elo', 'elo_games',
          'total_duels', 'total_wins', 'total_losses', 'total_draws', 'is_banned'
        ],
        where: { is_banned: false }
      }],
      order: [['created_at', 'ASC']],
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    const eligible = [];
    for (const entry of queue) {
      const active = await getActiveDuelForUser(entry.user_id, transaction);
      if (!active) eligible.push(entry);
    }

    if (eligible.length < 2) return null;

    let bestPair = [eligible[0], eligible[1]];
    let bestDiff = Math.abs((eligible[0].User.elo_rating ?? DEFAULT_RATING) - (eligible[1].User.elo_rating ?? DEFAULT_RATING));

    for (let i = 0; i < eligible.length - 1; i += 1) {
      for (let j = i + 1; j < eligible.length; j += 1) {
        const diff = Math.abs((eligible[i].User.elo_rating ?? DEFAULT_RATING) - (eligible[j].User.elo_rating ?? DEFAULT_RATING));
        if (diff < bestDiff) {
          bestDiff = diff;
          bestPair = [eligible[i], eligible[j]];
        }
      }
    }

    await DuelQueue.destroy({
      where: { user_id: { [Op.in]: [bestPair[0].user_id, bestPair[1].user_id] } },
      transaction
    });

    return createDuelForPair(bestPair[0].User, bestPair[1].User, { mode, mapId }, transaction);
  });

  if (matchedDuel && io) {
    io.to(getIoRoom(matchedDuel.player1_id)).emit('duel:matched', { duelId: matchedDuel.id });
    io.to(getIoRoom(matchedDuel.player2_id)).emit('duel:matched', { duelId: matchedDuel.id });
    await broadcastDuelState(io, matchedDuel.id);
  }

  return matchedDuel;
}

async function findQueueStatus(userId) {
  const activeDuel = await getActiveDuelForUser(userId);
  if (activeDuel) {
    return { status: 'active', duelId: activeDuel.id };
  }

  const queue = await DuelQueue.findOne({
    where: { user_id: userId },
    include: [{ model: Map, attributes: ['id', 'name'] }]
  });

  if (!queue) return { status: 'idle' };

  const queueWhere = { mode: queue.mode };
  queueWhere.map_id = queue.map_id === null ? { [Op.is]: null } : queue.map_id;
  const queueSize = await DuelQueue.count({ where: queueWhere });

  return {
    status: 'waiting',
    mode: queue.mode,
    mapId: queue.map_id,
    mapName: queue.Map?.name || 'Classic World',
    queueSize,
    joinedAt: queue.created_at
  };
}

function isPlayer1(duel, userId) {
  return Number(duel.player1_id) === Number(userId);
}

function assertParticipant(duel, userId) {
  if (!duel || (Number(duel.player1_id) !== Number(userId) && Number(duel.player2_id) !== Number(userId))) {
    const err = new Error('Duel not found');
    err.status = 404;
    throw err;
  }
}

function hasGuess(round, slot) {
  return round[`${slot}_guess_lat`] !== null && round[`${slot}_guess_lng`] !== null;
}

function addMs(date, ms) {
  if (!date) return null;
  return new Date(new Date(date).getTime() + ms);
}

function toIso(date) {
  return date ? new Date(date).toISOString() : null;
}

function getRoundFirstGuessInfo(round) {
  if (!round) return { at: null, slot: null };

  const entries = ['player1', 'player2']
    .filter(slot => hasGuess(round, slot) && round[`${slot}_guessed_at`])
    .map(slot => ({ slot, at: new Date(round[`${slot}_guessed_at`]) }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  return entries[0] || { at: null, slot: null };
}

function getForceGuessDeadline(round) {
  const firstGuess = getRoundFirstGuessInfo(round);
  return firstGuess.at ? addMs(firstGuess.at, FORCE_PICK_MS) : null;
}

function isForceGuessExpired(round, now = new Date()) {
  const deadline = getForceGuessDeadline(round);
  return Boolean(deadline && deadline.getTime() <= now.getTime());
}

function formatGuess(round, slot, show) {
  const guessed = hasGuess(round, slot);
  if (!guessed) {
    return show
      ? {
        guessed: false,
        score: round[`${slot}_score`] || 0,
        distanceMeters: null,
        guessedAt: round[`${slot}_guessed_at`] || null
      }
      : { guessed: false };
  }
  const base = { guessed: true };
  if (!show) return base;
  return {
    guessed: true,
    lat: round[`${slot}_guess_lat`],
    lng: round[`${slot}_guess_lng`],
    score: round[`${slot}_score`] || 0,
    distanceMeters: round[`${slot}_distance_meters`],
    guessedAt: round[`${slot}_guessed_at`]
  };
}

function formatCompletedRound(round, show) {
  const location = round.Location;
  return {
    roundNumber: round.round_number,
    actual: show && location ? { lat: location.lat, lng: location.lng } : null,
    player1: formatGuess(round, 'player1', show),
    player2: formatGuess(round, 'player2', show)
  };
}

async function loadDuelWithPlayers(duelId, transaction = null, lock = null) {
  return Duel.findByPk(duelId, {
    include: [
      {
        model: User,
        as: 'Player1',
        attributes: [
          'id', 'username', 'avatar_url', 'elo_rating', 'peak_elo', 'elo_games',
          'total_duels', 'total_wins', 'total_losses', 'total_draws'
        ]
      },
      {
        model: User,
        as: 'Player2',
        attributes: [
          'id', 'username', 'avatar_url', 'elo_rating', 'peak_elo', 'elo_games',
          'total_duels', 'total_wins', 'total_losses', 'total_draws'
        ]
      },
      { model: Map, attributes: ['id', 'name', 'description'] }
    ],
    transaction,
    lock
  });
}

async function loadRounds(duelId, transaction = null) {
  return DuelRound.findAll({
    where: { duel_id: duelId },
    include: [{ model: Location, attributes: ['id', 'pano_id', 'lat', 'lng'] }],
    order: [['round_number', 'ASC']],
    transaction
  });
}


function buildDuelSnapshot(duel, userId, rounds, { includePano = false, includeAllRounds = true } = {}) {
  const mineIsPlayer1 = isPlayer1(duel, userId);
  const player1 = formatRatingUser(duel.Player1);
  const player2 = formatRatingUser(duel.Player2);
  const formattedRounds = rounds
    .filter(round => includeAllRounds || round.round_number < duel.current_round || duel.status !== 'playing')
    .map(round => {
      const completed = formatCompletedRound(round, true);
      return {
        ...completed,
        panoId: includePano ? (round.Location?.pano_id || null) : undefined,
        locationId: round.location_id || round.Location?.id || null
      };
    });

  return {
    id: duel.id,
    status: duel.status,
    mode: duel.mode,
    currentRound: duel.current_round,
    totalRounds: duel.total_rounds,
    map: duel.Map ? { id: duel.Map.id, name: duel.Map.name, description: duel.Map.description } : { id: null, name: 'Classic World' },
    isPlayer1: mineIsPlayer1,
    players: {
      player1,
      player2,
      me: mineIsPlayer1 ? player1 : player2,
      opponent: mineIsPlayer1 ? player2 : player1
    },
    scores: {
      player1: duel.player1_score,
      player2: duel.player2_score,
      me: mineIsPlayer1 ? duel.player1_score : duel.player2_score,
      opponent: mineIsPlayer1 ? duel.player2_score : duel.player1_score
    },
    rating: {
      player1Before: duel.player1_rating_before,
      player2Before: duel.player2_rating_before,
      player1After: duel.player1_rating_after,
      player2After: duel.player2_rating_after,
      player1Change: duel.player1_rating_change,
      player2Change: duel.player2_rating_change,
      myBefore: mineIsPlayer1 ? duel.player1_rating_before : duel.player2_rating_before,
      opponentBefore: mineIsPlayer1 ? duel.player2_rating_before : duel.player1_rating_before,
      myAfter: mineIsPlayer1 ? duel.player1_rating_after : duel.player2_rating_after,
      opponentAfter: mineIsPlayer1 ? duel.player2_rating_after : duel.player1_rating_after,
      myChange: mineIsPlayer1 ? duel.player1_rating_change : duel.player2_rating_change,
      opponentChange: mineIsPlayer1 ? duel.player2_rating_change : duel.player1_rating_change
    },
    result: duel.status === 'finished' ? {
      winnerId: duel.winner_id,
      result: duel.result,
      meWon: duel.winner_id ? Number(duel.winner_id) === Number(userId) : false,
      draw: duel.result === 'draw',
      finishedAt: duel.finished_at
    } : null,
    rounds: formattedRounds,
    createdAt: duel.created_at,
    updatedAt: duel.updated_at,
    finishedAt: duel.finished_at
  };
}

async function buildDuelReviewPayload(duelId, userId) {
  const duel = await loadDuelWithPlayers(duelId);
  assertParticipant(duel, userId);

  if (duel.status !== 'finished') {
    const err = new Error('Duel review is available only after the duel is finished');
    err.status = 403;
    throw err;
  }

  const rounds = await loadRounds(duel.id);
  return buildDuelSnapshot(duel, userId, rounds, { includePano: true, includeAllRounds: true });
}

async function buildDuelPayload(duelId, userId) {
  const duel = await loadDuelWithPlayers(duelId);
  assertParticipant(duel, userId);

  const rounds = await loadRounds(duel.id);
  const mineIsPlayer1 = isPlayer1(duel, userId);
  const mySlot = mineIsPlayer1 ? 'player1' : 'player2';
  const opponentSlot = mineIsPlayer1 ? 'player2' : 'player1';
  const currentRound = rounds.find(round => round.round_number === duel.current_round) || null;
  const now = new Date();
  const firstGuess = getRoundFirstGuessInfo(currentRound);
  const forceGuessDeadlineAt = duel.status === 'playing' ? getForceGuessDeadline(currentRound) : null;
  const resultDeadlineAt = duel.status === 'round_results' ? addMs(duel.updated_at, ROUND_RESULT_MS) : null;
  const roundAcceptingGuesses = duel.status === 'playing' && (!forceGuessDeadlineAt || forceGuessDeadlineAt.getTime() > now.getTime());
  const showCurrentResult = Boolean(currentRound && (duel.status === 'round_results' || duel.status === 'finished'));

  const current = currentRound ? {
    roundNumber: currentRound.round_number,
    panoId: currentRound.Location?.pano_id || null,
    canGuess: roundAcceptingGuesses && !hasGuess(currentRound, mySlot),
    meGuessed: hasGuess(currentRound, mySlot),
    opponentGuessed: hasGuess(currentRound, opponentSlot),
    player1Guessed: hasGuess(currentRound, 'player1'),
    player2Guessed: hasGuess(currentRound, 'player2'),
    myGuess: formatGuess(currentRound, mySlot, true),
    opponentGuess: formatGuess(currentRound, opponentSlot, false),
    firstGuessAt: toIso(firstGuess.at),
    firstGuessSlot: firstGuess.slot,
    forceGuessDeadlineAt: toIso(forceGuessDeadlineAt),
    resultDeadlineAt: toIso(resultDeadlineAt),
    phase: duel.status === 'playing'
      ? (firstGuess.at ? 'force_countdown' : 'guessing')
      : (duel.status === 'round_results' ? 'round_result' : duel.status),
    result: showCurrentResult ? formatCompletedRound(currentRound, true) : null
  } : null;

  const completedRounds = rounds
    .filter(round => round.round_number < duel.current_round || (round.round_number === duel.current_round && showCurrentResult))
    .map(round => formatCompletedRound(round, true));

  const player1 = formatRatingUser(duel.Player1);
  const player2 = formatRatingUser(duel.Player2);

  return {
    id: duel.id,
    status: duel.status,
    mode: duel.mode,
    currentRound: duel.current_round,
    totalRounds: duel.total_rounds,
    map: duel.Map ? { id: duel.Map.id, name: duel.Map.name, description: duel.Map.description } : { id: null, name: 'Classic World' },
    isPlayer1: mineIsPlayer1,
    players: {
      player1,
      player2,
      me: mineIsPlayer1 ? player1 : player2,
      opponent: mineIsPlayer1 ? player2 : player1
    },
    scores: {
      player1: duel.player1_score,
      player2: duel.player2_score,
      me: mineIsPlayer1 ? duel.player1_score : duel.player2_score,
      opponent: mineIsPlayer1 ? duel.player2_score : duel.player1_score
    },
    rating: {
      player1Before: duel.player1_rating_before,
      player2Before: duel.player2_rating_before,
      player1After: duel.player1_rating_after,
      player2After: duel.player2_rating_after,
      player1Change: duel.player1_rating_change,
      player2Change: duel.player2_rating_change,
      myBefore: mineIsPlayer1 ? duel.player1_rating_before : duel.player2_rating_before,
      opponentBefore: mineIsPlayer1 ? duel.player2_rating_before : duel.player1_rating_before,
      myAfter: mineIsPlayer1 ? duel.player1_rating_after : duel.player2_rating_after,
      opponentAfter: mineIsPlayer1 ? duel.player2_rating_after : duel.player1_rating_after,
      myChange: mineIsPlayer1 ? duel.player1_rating_change : duel.player2_rating_change,
      opponentChange: mineIsPlayer1 ? duel.player2_rating_change : duel.player1_rating_change
    },
    result: duel.status === 'finished' ? {
      winnerId: duel.winner_id,
      result: duel.result,
      meWon: duel.winner_id ? Number(duel.winner_id) === Number(userId) : false,
      draw: duel.result === 'draw',
      finishedAt: duel.finished_at
    } : null,
    current,
    rounds: completedRounds,
    timers: {
      serverNow: now.toISOString(),
      forcePickMs: FORCE_PICK_MS,
      roundResultMs: ROUND_RESULT_MS
    },
    createdAt: duel.created_at,
    updatedAt: duel.updated_at
  };
}

async function updateUserAfterDuel(user, oldRating, newRating, result, transaction) {
  user.elo_rating = newRating;
  user.peak_elo = Math.max(user.peak_elo || DEFAULT_RATING, newRating);
  user.elo_games = (user.elo_games || 0) + 1;
  user.total_duels = (user.total_duels || 0) + 1;
  if (result === 'win') user.total_wins = (user.total_wins || 0) + 1;
  if (result === 'loss') user.total_losses = (user.total_losses || 0) + 1;
  if (result === 'draw') user.total_draws = (user.total_draws || 0) + 1;
  await user.save({ transaction });

  return {
    oldRating,
    newRating,
    change: newRating - oldRating
  };
}

async function applyRatingUpdate(duel, transaction) {
  const player1 = await User.findByPk(duel.player1_id, { transaction, lock: transaction.LOCK.UPDATE });
  const player2 = await User.findByPk(duel.player2_id, { transaction, lock: transaction.LOCK.UPDATE });

  const old1 = player1.elo_rating ?? DEFAULT_RATING;
  const old2 = player2.elo_rating ?? DEFAULT_RATING;
  let player1Result = 'draw';
  let player2Result = 'draw';

  if (duel.result === 'player1') {
    player1Result = 'win';
    player2Result = 'loss';
  } else if (duel.result === 'player2') {
    player1Result = 'loss';
    player2Result = 'win';
  }

  const elo = calculateElo(old1, old2, player1Result);
  const p1 = await updateUserAfterDuel(player1, old1, elo.player1NewRating, player1Result, transaction);
  const p2 = await updateUserAfterDuel(player2, old2, elo.player2NewRating, player2Result, transaction);

  duel.player1_rating_before = old1;
  duel.player2_rating_before = old2;
  duel.player1_rating_after = p1.newRating;
  duel.player2_rating_after = p2.newRating;
  duel.player1_rating_change = p1.change;
  duel.player2_rating_change = p2.change;

  await RatingHistory.bulkCreate([
    {
      user_id: duel.player1_id,
      duel_id: duel.id,
      old_rating: p1.oldRating,
      new_rating: p1.newRating,
      rating_change: p1.change,
      rank_position: null
    },
    {
      user_id: duel.player2_id,
      duel_id: duel.id,
      old_rating: p2.oldRating,
      new_rating: p2.newRating,
      rating_change: p2.change,
      rank_position: null
    }
  ], { transaction });
}

async function finishDuel(duel, transaction, forcedWinnerSlot = null) {
  if (forcedWinnerSlot === 'player1') {
    duel.winner_id = duel.player1_id;
    duel.result = 'player1';
  } else if (forcedWinnerSlot === 'player2') {
    duel.winner_id = duel.player2_id;
    duel.result = 'player2';
  } else if (duel.player1_score > duel.player2_score) {
    duel.winner_id = duel.player1_id;
    duel.result = 'player1';
  } else if (duel.player2_score > duel.player1_score) {
    duel.winner_id = duel.player2_id;
    duel.result = 'player2';
  } else {
    duel.winner_id = null;
    duel.result = 'draw';
  }

  duel.status = 'finished';
  duel.finished_at = new Date();
  await applyRatingUpdate(duel, transaction);
  await duel.save({ transaction });
}

async function finalizeRoundResults(duel, round, transaction) {
  if (!duel || !round) {
    const err = new Error('Invalid duel state');
    err.status = 400;
    throw err;
  }

  ['player1', 'player2'].forEach((slot) => {
    if (!hasGuess(round, slot)) {
      round[`${slot}_score`] = 0;
      round[`${slot}_distance_meters`] = null;
    }
  });

  await round.save({ transaction });

  duel.player1_score = (duel.player1_score || 0) + (round.player1_score || 0);
  duel.player2_score = (duel.player2_score || 0) + (round.player2_score || 0);
  duel.status = 'round_results';
  await duel.save({ transaction });
}

async function advanceDuelAfterResults(duel, transaction) {
  if (duel.current_round >= duel.total_rounds) {
    await finishDuel(duel, transaction);
  } else {
    duel.current_round += 1;
    duel.status = 'playing';
    await duel.save({ transaction });
  }
}

async function submitGuess({ duelId, userId, lat, lng, io }) {
  const result = await sequelize.transaction(async (transaction) => {
    const duel = await Duel.findByPk(duelId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    assertParticipant(duel, userId);

    if (duel.status !== 'playing') {
      const err = new Error('This round is not accepting guesses');
      err.status = 400;
      throw err;
    }

    const slot = isPlayer1(duel, userId) ? 'player1' : 'player2';
    if (duel.current_round < 1 || duel.current_round > duel.total_rounds) {
      const err = new Error('Invalid duel state');
      err.status = 400;
      throw err;
    }

    const round = await DuelRound.findOne({
      where: { duel_id: duel.id, round_number: duel.current_round },
      include: [{ model: Location, attributes: ['id', 'lat', 'lng'] }],
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!round || !round.Location) {
      const err = new Error('Round not found');
      err.status = 404;
      throw err;
    }

    if (hasGuess(round, slot)) {
      const err = new Error('You already guessed this round');
      err.status = 400;
      throw err;
    }

    // If the forced 15s window has already elapsed, resolve the round instead of
    // accepting a late guess. This keeps both clients aligned with server time.
    if (isForceGuessExpired(round)) {
      await finalizeRoundResults(duel, round, transaction);
      return {
        duelId: duel.id,
        score: 0,
        distanceMeters: null,
        bothGuessed: hasGuess(round, 'player1') && hasGuess(round, 'player2'),
        expired: true,
        status: duel.status
      };
    }

    const distanceMeters = wgs84DistanceMeters(round.Location.lat, round.Location.lng, lat, lng);
    const score = calculateGeoScore(distanceMeters);
    round[`${slot}_guess_lat`] = lat;
    round[`${slot}_guess_lng`] = lng;
    round[`${slot}_score`] = score;
    round[`${slot}_distance_meters`] = Math.round(distanceMeters);
    round[`${slot}_guessed_at`] = new Date();
    await round.save({ transaction });

    const bothGuessed = hasGuess(round, 'player1') && hasGuess(round, 'player2');
    if (bothGuessed) {
      await finalizeRoundResults(duel, round, transaction);
    }

    return {
      duelId: duel.id,
      score,
      distanceMeters: Math.round(distanceMeters),
      bothGuessed,
      status: duel.status
    };
  });

  if (io) await broadcastDuelState(io, duelId);
  return result;
}

async function advanceRound({ duelId, userId, io }) {
  const result = await sequelize.transaction(async (transaction) => {
    const duel = await Duel.findByPk(duelId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    assertParticipant(duel, userId);

    if (duel.status !== 'round_results') {
      const err = new Error('Round results are not ready');
      err.status = 400;
      throw err;
    }

    await advanceDuelAfterResults(duel, transaction);

    return { duelId: duel.id, status: duel.status, currentRound: duel.current_round };
  });

  if (io) await broadcastDuelState(io, duelId);
  return result;
}

async function forfeitDuel({ duelId, userId, io }) {
  const result = await sequelize.transaction(async (transaction) => {
    const duel = await Duel.findByPk(duelId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    assertParticipant(duel, userId);

    if (!ACTIVE_DUEL_STATUSES.includes(duel.status)) {
      const err = new Error('This duel is already over');
      err.status = 400;
      throw err;
    }

    const winnerSlot = isPlayer1(duel, userId) ? 'player2' : 'player1';
    await finishDuel(duel, transaction, winnerSlot);
    await DuelQueue.destroy({ where: { user_id: userId }, transaction });

    return { duelId: duel.id, status: duel.status };
  });

  if (io) await broadcastDuelState(io, duelId);
  return result;
}

async function broadcastDuelState(io, duelId) {
  if (!io) return;
  const duel = await Duel.findByPk(duelId, { attributes: ['id', 'player1_id', 'player2_id', 'status', 'current_round'] });
  if (!duel) return;

  for (const userId of [duel.player1_id, duel.player2_id]) {
    try {
      const payload = await buildDuelPayload(duel.id, userId);
      io.to(getIoRoom(userId)).emit('duel:state', payload);
    } catch (err) {
      console.error('Failed to broadcast duel state:', err);
    }
  }

  io.to(`duel:${duel.id}`).emit('duel:updated', {
    duelId: duel.id,
    status: duel.status,
    currentRound: duel.current_round,
    timestamp: new Date().toISOString()
  });
}

async function processDuelAutomationTick(io) {
  const candidates = await Duel.findAll({
    where: { status: { [Op.in]: ACTIVE_DUEL_STATUSES } },
    attributes: ['id']
  });

  const changedDuelIds = [];
  const now = new Date();

  for (const candidate of candidates) {
    let changed = false;
    try {
      await sequelize.transaction(async (transaction) => {
        const duel = await Duel.findByPk(candidate.id, {
          transaction,
          lock: transaction.LOCK.UPDATE
        });

        if (!duel || !ACTIVE_DUEL_STATUSES.includes(duel.status)) return;

        const round = await DuelRound.findOne({
          where: { duel_id: duel.id, round_number: duel.current_round },
          include: [{ model: Location, attributes: ['id', 'lat', 'lng'] }],
          transaction,
          lock: transaction.LOCK.UPDATE
        });

        if (!round) return;

        if (duel.status === 'playing') {
          const bothGuessed = hasGuess(round, 'player1') && hasGuess(round, 'player2');
          if (bothGuessed || isForceGuessExpired(round, now)) {
            await finalizeRoundResults(duel, round, transaction);
            changed = true;
          }
          return;
        }

        if (duel.status === 'round_results') {
          const resultDeadline = addMs(duel.updated_at, ROUND_RESULT_MS);
          if (resultDeadline && resultDeadline.getTime() <= now.getTime()) {
            await advanceDuelAfterResults(duel, transaction);
            changed = true;
          }
        }
      });
    } catch (err) {
      console.error(`Failed to process duel automation for duel ${candidate.id}:`, err);
    }

    if (changed) changedDuelIds.push(candidate.id);
  }

  for (const duelId of changedDuelIds) {
    await broadcastDuelState(io, duelId);
  }

  return changedDuelIds;
}

let duelAutomationTimer = null;
let duelAutomationInFlight = false;

function startDuelAutomation(io) {
  if (duelAutomationTimer) return duelAutomationTimer;

  duelAutomationTimer = setInterval(async () => {
    if (duelAutomationInFlight) return;
    duelAutomationInFlight = true;
    try {
      await processDuelAutomationTick(io);
    } catch (err) {
      console.error('Duel automation tick failed:', err);
    } finally {
      duelAutomationInFlight = false;
    }
  }, DUEL_AUTOMATION_INTERVAL_MS);

  return duelAutomationTimer;
}

async function getLeaderboard({ limit = 50, offset = 0 } = {}) {
  const users = await User.findAll({
    where: { is_banned: false, elo_games: { [Op.gt]: 0 } },
    attributes: [
      'id', 'username', 'avatar_url', 'elo_rating', 'peak_elo', 'elo_games',
      'total_duels', 'total_wins', 'total_losses', 'total_draws'
    ],
    order: [['elo_rating', 'DESC'], ['peak_elo', 'DESC'], ['total_duels', 'DESC']],
    limit,
    offset
  });

  return users.map((user, index) => ({
    rank: offset + index + 1,
    ...formatRatingUser(user),
    win_rate: user.total_duels ? Math.round((user.total_wins / user.total_duels) * 1000) / 10 : 0
  }));
}

module.exports = {
  DUEL_ROUNDS,
  FORCE_PICK_MS,
  ROUND_RESULT_MS,
  ACTIVE_DUEL_STATUSES,
  normalizeMapId,
  getPlayableMap,
  tryCreateMatch,
  findQueueStatus,
  getActiveDuelForUser,
  buildDuelPayload,
  buildDuelReviewPayload,
  submitGuess,
  advanceRound,
  forfeitDuel,
  broadcastDuelState,
  processDuelAutomationTick,
  startDuelAutomation,
  getLeaderboard
};
