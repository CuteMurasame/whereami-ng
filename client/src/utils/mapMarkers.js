import { toServerUrl } from '../config';

export const MAP_MARKER_TONES = {
  me: { color: '#2563eb', soft: 'rgba(37, 99, 235, .16)' },
  opponent: { color: '#ef4444', soft: 'rgba(239, 68, 68, .16)' },
  target: { color: '#16a34a', soft: 'rgba(22, 163, 74, .18)' }
};

export const getMarkerAvatarUrl = (player) => player?.avatar_url ? toServerUrl(player.avatar_url) : '';

export const getMarkerInitials = (player) => Array.from((player?.username || '?').trim())[0]?.toUpperCase() || '?';

export function createHtmlOverlay(google, position, element, map, options = {}) {
  const latLng = position instanceof google.maps.LatLng ? position : new google.maps.LatLng(position.lat, position.lng);
  const transform = options.transform || 'translate(-50%, -50%)';
  const pane = options.pane || 'overlayMouseTarget';
  const zIndex = options.zIndex || 1;

  class HtmlOverlay extends google.maps.OverlayView {
    constructor() {
      super();
      this.position = latLng;
      this.container = null;
    }

    onAdd() {
      this.container = document.createElement('div');
      this.container.style.position = 'absolute';
      this.container.style.zIndex = String(zIndex);
      this.container.style.transform = transform;
      this.container.appendChild(element);
      this.getPanes()[pane].appendChild(this.container);
    }

    draw() {
      if (!this.container) return;
      const point = this.getProjection().fromLatLngToDivPixel(this.position);
      if (!point) return;
      this.container.style.left = `${point.x}px`;
      this.container.style.top = `${point.y}px`;
    }

    onRemove() {
      if (this.container?.parentNode) this.container.parentNode.removeChild(this.container);
      this.container = null;
    }

    setPosition(nextPosition) {
      this.position = nextPosition instanceof google.maps.LatLng ? nextPosition : new google.maps.LatLng(nextPosition.lat, nextPosition.lng);
      this.draw();
    }
  }

  const overlay = new HtmlOverlay();
  overlay.setMap(map);
  return overlay;
}

export function createPlayerMarkerElement(player, tone = MAP_MARKER_TONES.me, label = '', compact = false) {
  const marker = document.createElement('div');
  marker.className = `duel-avatar-marker${compact ? ' compact' : ''}`;
  marker.style.setProperty('--marker-color', tone.color || tone);
  marker.title = `${label}${player?.username ? `: ${player.username}` : ''}`;

  const imgUrl = getMarkerAvatarUrl(player);
  const fallback = document.createElement('span');
  fallback.textContent = getMarkerInitials(player);
  fallback.style.display = imgUrl ? 'none' : 'grid';

  if (imgUrl) {
    const img = document.createElement('img');
    img.src = imgUrl;
    img.alt = player?.username || label;
    img.addEventListener('error', () => {
      img.remove();
      fallback.style.display = 'grid';
    });
    marker.appendChild(img);
  }

  marker.appendChild(fallback);
  return marker;
}

export function createFlagMarkerElement(title = 'Target', tone = MAP_MARKER_TONES.target) {
  const marker = document.createElement('div');
  marker.className = 'duel-flag-marker';
  marker.style.setProperty('--marker-color', tone.color || tone);
  marker.innerHTML = '<i class="fa-solid fa-flag-checkered"></i>';
  marker.title = title;
  return marker;
}

export function createDistanceLabelElement(text, color) {
  const label = document.createElement('div');
  label.className = 'duel-distance-label';
  label.style.setProperty('--marker-color', color);
  label.textContent = text;
  return label;
}

const pointToLiteral = (point) => ({
  lat: typeof point.lat === 'function' ? point.lat() : Number(point.lat),
  lng: typeof point.lng === 'function' ? point.lng() : Number(point.lng)
});

const normalizeLng = (lng) => {
  let value = ((lng + 180) % 360 + 360) % 360 - 180;
  if (value === -180 && lng > 0) value = 180;
  return value;
};

export function straightMidpoint(google, a, b) {
  const first = pointToLiteral(a);
  const second = pointToLiteral(b);
  let lng1 = first.lng;
  let lng2 = second.lng;
  const diff = lng2 - lng1;
  if (diff > 180) lng1 += 360;
  if (diff < -180) lng2 += 360;
  return new google.maps.LatLng((first.lat + second.lat) / 2, normalizeLng((lng1 + lng2) / 2));
}

export function drawStyledDistanceLine({ google, map, from, to, color, zIndex = 10 }) {
  const path = [from, to];
  const halo = new google.maps.Polyline({
    path,
    geodesic: false,
    strokeColor: '#ffffff',
    strokeOpacity: 0.92,
    strokeWeight: 8,
    zIndex,
    map
  });

  const line = new google.maps.Polyline({
    path,
    geodesic: false,
    strokeColor: color,
    strokeOpacity: 0.72,
    strokeWeight: 4,
    icons: [{
      icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeWeight: 2, strokeColor: color, scale: 3 },
      offset: '0',
      repeat: '18px'
    }],
    zIndex: zIndex + 1,
    map
  });

  return [halo, line];
}
