const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_B = (1 - WGS84_F) * WGS84_A;

function toRadians(value) {
  return value * Math.PI / 180;
}

function sphericalFallbackMeters(lat1, lng1, lat2, lng2) {
  const meanEarthRadiusMeters = 6371008.8;
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lng2 - lng1);
  const sinHalfPhi = Math.sin(deltaPhi / 2);
  const sinHalfLambda = Math.sin(deltaLambda / 2);
  const a = sinHalfPhi * sinHalfPhi + Math.cos(phi1) * Math.cos(phi2) * sinHalfLambda * sinHalfLambda;
  return meanEarthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function wgs84DistanceMeters(lat1, lng1, lat2, lng2) {
  const φ1 = toRadians(Number(lat1));
  const φ2 = toRadians(Number(lat2));
  const L = toRadians(Number(lng2) - Number(lng1));

  if (![φ1, φ2, L].every(Number.isFinite)) return NaN;
  if (Number(lat1) === Number(lat2) && Number(lng1) === Number(lng2)) return 0;

  const U1 = Math.atan((1 - WGS84_F) * Math.tan(φ1));
  const U2 = Math.atan((1 - WGS84_F) * Math.tan(φ2));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);

  let λ = L;
  let λPrevious;
  let sinσ = 0;
  let cosσ = 0;
  let σ = 0;
  let sinα = 0;
  let cosSqα = 0;
  let cos2σm = 0;
  let converged = false;

  for (let i = 0; i < 100; i += 1) {
    const sinλ = Math.sin(λ);
    const cosλ = Math.cos(λ);
    sinσ = Math.sqrt(
      (cosU2 * sinλ) * (cosU2 * sinλ)
      + (cosU1 * sinU2 - sinU1 * cosU2 * cosλ) * (cosU1 * sinU2 - sinU1 * cosU2 * cosλ)
    );

    if (sinσ === 0) return 0;

    cosσ = sinU1 * sinU2 + cosU1 * cosU2 * cosλ;
    σ = Math.atan2(sinσ, cosσ);
    sinα = (cosU1 * cosU2 * sinλ) / sinσ;
    cosSqα = 1 - sinα * sinα;
    cos2σm = cosSqα === 0 ? 0 : cosσ - (2 * sinU1 * sinU2) / cosSqα;
    const C = (WGS84_F / 16) * cosSqα * (4 + WGS84_F * (4 - 3 * cosSqα));
    λPrevious = λ;
    λ = L + (1 - C) * WGS84_F * sinα * (
      σ + C * sinσ * (cos2σm + C * cosσ * (-1 + 2 * cos2σm * cos2σm))
    );

    if (Math.abs(λ - λPrevious) <= 1e-12) {
      converged = true;
      break;
    }
  }

  if (!converged) return sphericalFallbackMeters(lat1, lng1, lat2, lng2);

  const uSq = cosSqα * (WGS84_A * WGS84_A - WGS84_B * WGS84_B) / (WGS84_B * WGS84_B);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const Δσ = B * sinσ * (
    cos2σm + (B / 4) * (
      cosσ * (-1 + 2 * cos2σm * cos2σm)
      - (B / 6) * cos2σm * (-3 + 4 * sinσ * sinσ) * (-3 + 4 * cos2σm * cos2σm)
    )
  );

  return WGS84_B * A * (σ - Δσ);
}

function calculateGeoScore(distanceMeters) {
  const distanceKm = distanceMeters / 1000;
  return Math.max(0, Math.round(5000 * Math.exp(-10 * (distanceKm / 14900))));
}

function validateCoordinates(lat, lng) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  return {
    valid: Number.isFinite(latNum)
      && Number.isFinite(lngNum)
      && latNum >= -90
      && latNum <= 90
      && lngNum >= -180
      && lngNum <= 180,
    lat: latNum,
    lng: lngNum
  };
}

module.exports = {
  wgs84DistanceMeters,
  calculateGeoScore,
  validateCoordinates
};
