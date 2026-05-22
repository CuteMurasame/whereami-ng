const DEFAULT_RATING = 1500;
const DEFAULT_K_FACTOR = 64;

function getExpectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function calculateElo(player1Rating, player2Rating, player1Result, kFactor = DEFAULT_K_FACTOR) {
  const scoreMap = { win: 1, loss: 0, draw: 0.5 };
  const score1 = scoreMap[player1Result];
  if (score1 === undefined) {
    return {
      player1NewRating: player1Rating,
      player2NewRating: player2Rating,
      player1Change: 0,
      player2Change: 0
    };
  }

  const expected1 = getExpectedScore(player1Rating, player2Rating);
  const change = Math.round(kFactor * (score1 - expected1));
  return {
    player1NewRating: player1Rating + change,
    player2NewRating: player2Rating - change,
    player1Change: change,
    player2Change: -change
  };
}

function getRatingClass(ratingValue) {
  const rating = Number(ratingValue || DEFAULT_RATING);
  if (rating < 1250) return 'grey-rating';
  if (rating < 1350) return 'green-rating';
  if (rating < 1450) return 'cyan-rating';
  if (rating < 1550) return 'blue-rating';
  if (rating < 1650) return 'yellow-rating';
  if (rating < 1750) return 'orange-rating';
  if (rating < 1850) return 'red-rating';
  if (rating < 1950) return 'nutella';
  if (rating < 2050) return 'tourist';
  return 'rainbow';
}

function formatRatingUser(user) {
  if (!user) return null;
  const plain = typeof user.toJSON === 'function' ? user.toJSON() : user;
  const rating = plain.elo_rating ?? DEFAULT_RATING;
  return {
    id: plain.id,
    username: plain.username,
    avatar_url: plain.avatar_url,
    elo_rating: rating,
    peak_elo: plain.peak_elo ?? rating,
    elo_games: plain.elo_games ?? 0,
    total_duels: plain.total_duels ?? 0,
    total_wins: plain.total_wins ?? 0,
    total_losses: plain.total_losses ?? 0,
    total_draws: plain.total_draws ?? 0,
    rating_class: getRatingClass(rating)
  };
}

module.exports = {
  DEFAULT_RATING,
  calculateElo,
  getExpectedScore,
  getRatingClass,
  formatRatingUser
};
