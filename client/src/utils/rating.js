export function getRatingClass(ratingValue = 1500) {
  const rating = Number(ratingValue || 1500);
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

export function signed(value) {
  const n = Number(value || 0);
  return n > 0 ? `+${n}` : `${n}`;
}
