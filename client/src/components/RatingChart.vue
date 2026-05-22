<template>
  <div class="rating-chart-container" :class="{ expanded: isExpanded, large }">
    <button
      type="button"
      class="chart-expand-btn"
      @click="isExpanded = !isExpanded"
      :aria-label="isExpanded ? 'Close expanded chart' : 'Expand chart'"
    >
      <i :class="isExpanded ? 'fa-solid fa-compress' : 'fa-solid fa-expand'"></i>
    </button>

    <div v-if="loading" class="chart-state">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <span>Loading rating history...</span>
    </div>

    <div v-else-if="!points.length" class="chart-state empty">
      <i class="fa-regular fa-chart-bar"></i>
      <span>No duel rating history yet.</span>
    </div>

    <template v-else>
      <div class="chart-frame">
        <svg
          class="status-svg"
          :viewBox="`0 0 ${WIDTH} ${STATUS_CANVAS_HEIGHT}`"
          role="group"
          aria-label="Selected rating entry"
        >
          <defs>
            <clipPath :id="contestClipId">
              <rect x="295" y="34" width="325" height="28" rx="2" />
            </clipPath>
          </defs>

          <rect
            class="status-panel"
            :x="OFFSET_X"
            :y="STATUS_OFFSET_Y"
            :width="STATUS_PANEL_WIDTH"
            :height="STATUS_PANEL_HEIGHT"
            rx="4"
            :stroke="activeColor"
          />

          <text
            class="status-rating-number"
            :x="OFFSET_X + 75"
            :y="STATUS_OFFSET_Y + STATUS_PANEL_HEIGHT / 2"
            text-anchor="middle"
            dominant-baseline="central"
            :fill="activeColor"
          >{{ activeEntry.NewRating }}</text>

          <g class="particle-layer" aria-hidden="true">
            <text
              v-for="particle in particles"
              :key="particle.id"
              class="rating-particle"
              :x="OFFSET_X + 75"
              :y="STATUS_OFFSET_Y + STATUS_PANEL_HEIGHT / 2"
              text-anchor="middle"
              dominant-baseline="central"
              :style="particle.style"
            >{{ particle.text }}</text>
          </g>

          <text
            v-if="activePlace"
            class="status-place"
            :x="OFFSET_X + 160"
            :y="STATUS_OFFSET_Y + STATUS_PANEL_HEIGHT / 2.7"
            text-anchor="middle"
            dominant-baseline="central"
          >{{ activePlace }}</text>

          <text
            class="status-delta"
            :x="OFFSET_X + 162"
            :y="STATUS_OFFSET_Y + STATUS_PANEL_HEIGHT / 2"
            text-anchor="start"
            dominant-baseline="central"
          >{{ activeDelta }}</text>

          <text
            class="status-date"
            :x="OFFSET_X + 245"
            :y="STATUS_OFFSET_Y + STATUS_PANEL_HEIGHT / 4"
            text-anchor="start"
            dominant-baseline="central"
          >{{ activeDate }}</text>

          <a
            v-if="activeEntry.StandingsUrl && activeEntry.StandingsUrl !== '#'"
            :href="activeEntry.StandingsUrl"
          >
            <text
              class="status-contest status-contest-link"
              :clip-path="`url(#${contestClipId})`"
              :x="OFFSET_X + 245"
              :y="STATUS_OFFSET_Y + STATUS_PANEL_HEIGHT / 1.6"
              text-anchor="start"
              dominant-baseline="central"
            >{{ activeEntry.ContestName }}</text>
            <title>{{ activeEntry.ContestName }}</title>
          </a>
          <text
            v-else
            class="status-contest"
            :clip-path="`url(#${contestClipId})`"
            :x="OFFSET_X + 245"
            :y="STATUS_OFFSET_Y + STATUS_PANEL_HEIGHT / 1.6"
            text-anchor="start"
            dominant-baseline="central"
          >{{ activeEntry.ContestName }}</text>
        </svg>

        <div class="chart-graph">
          <svg
            class="rating-svg"
            :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
            role="img"
            aria-label="Rating history chart"
          >
            <g class="plot" :transform="`translate(${OFFSET_X}, ${OFFSET_Y})`">
              <rect
                v-for="band in bands"
                :key="band.key"
                :x="0"
                :y="band.y"
                :width="PANEL_WIDTH"
                :height="band.height"
                :fill="band.color"
                opacity="0.3"
              />
              <g class="rating-boundaries">
                <template v-for="boundary in boundaryLines" :key="boundary.value">
                  <line
                    :x1="0"
                    :x2="PANEL_WIDTH"
                    :y1="boundary.y"
                    :y2="boundary.y"
                    :stroke="boundary.value === 2000 ? '#000' : '#fff'"
                    stroke-width="0.5"
                  />
                  <text :x="-10" :y="boundary.y" text-anchor="end" dominant-baseline="middle" class="axis-label">
                    {{ boundary.value }}
                  </text>
                </template>
              </g>

              <g class="x-grid">
                <template v-for="label in xLabels" :key="label.key">
                  <line :x1="label.x" :x2="label.x" :y1="0" :y2="PANEL_HEIGHT" stroke="#fff" stroke-width="0.5" />
                  <text :x="label.x" :y="PANEL_HEIGHT + 16" text-anchor="middle" class="axis-label">{{ label.text }}</text>
                </template>
              </g>

              <rect :x="0" :y="0" :width="PANEL_WIDTH" :height="PANEL_HEIGHT" rx="3" fill="none" stroke="#888" stroke-width="1.5" />
            </g>

            <g v-if="activePoint" class="active-guides">
              <line
                :x1="activePoint.x"
                :x2="activePoint.x"
                :y1="OFFSET_Y"
                :y2="OFFSET_Y + PANEL_HEIGHT"
              />
              <line
                :x1="OFFSET_X"
                :x2="OFFSET_X + PANEL_WIDTH"
                :y1="activePoint.y"
                :y2="activePoint.y"
              />
            </g>

            <g class="rating-chart-layer">
              <path :d="linePath" fill="none" stroke="#AAA" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
              <path :d="linePath" fill="none" stroke="#FFF" stroke-width="0.5" stroke-linejoin="round" stroke-linecap="round" />

              <g v-if="highestPoint" class="highest-callout">
                <line :x1="highestPoint.x" :y1="highestPoint.y" :x2="highestPoint.labelX" :y2="highestPoint.labelY" stroke="#fff" stroke-width="1" />
                <rect :x="highestPoint.labelX - 40" :y="highestPoint.labelY - 10" width="80" height="20" rx="3" fill="#fff" stroke="#888" />
                <text :x="highestPoint.labelX" :y="highestPoint.labelY" text-anchor="middle" dominant-baseline="middle" class="highest-label">
                  Highest: {{ highestPoint.rating }}
                </text>
              </g>

              <g class="rating-points">
                <g
                  v-for="point in points"
                  :key="point.key"
                  class="point-group"
                  @mouseenter="setHover(point.index)"
                  @focus="setHover(point.index)"
                >
                  <circle
                    v-if="point.index === activeIndex"
                    :cx="point.x"
                    :cy="point.y"
                    r="6.8"
                    fill="none"
                    :stroke="point.color"
                    stroke-width="1.1"
                    opacity="0.95"
                  />
                  <circle
                    :cx="point.x"
                    :cy="point.y"
                    :r="point.index === activeIndex ? 4.4 : 3.5"
                    :fill="point.color"
                    :stroke="point.index === highestIndex ? '#000' : '#fff'"
                    stroke-width="0.5"
                  />
                  <circle :cx="point.x" :cy="point.y" r="9" fill="transparent" class="point-hit" tabindex="0" />
                </g>
              </g>
            </g>
          </svg>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { api } from '../auth';
import { formatLocaleDateTime } from '../utils/dateFormat';

const props = defineProps({
  userId: {
    type: Number,
    required: true
  },
  large: {
    type: Boolean,
    default: false
  }
});

const WIDTH = 640;
const HEIGHT = 360;
const STATUS_CANVAS_HEIGHT = 80;
const OFFSET_X = 50;
const OFFSET_Y = 5;
const STATUS_OFFSET_Y = 5;
const STATUS_PANEL_WIDTH = WIDTH - OFFSET_X - 10;
const STATUS_PANEL_HEIGHT = STATUS_CANVAS_HEIGHT - STATUS_OFFSET_Y - 5;
const PANEL_WIDTH = WIDTH - OFFSET_X - 10;
const PANEL_HEIGHT = HEIGHT - OFFSET_Y - 30;
const MARGIN_VAL_X = 0.5;
const MARGIN_VAL_Y_LOW = 100;
const MARGIN_VAL_Y_HIGH = 300;
const PARTICLE_MIN = 3;
const PARTICLE_MAX = 20;
const STAR_MIN = 3200;
const EPS = 1e-9;

const COLORS = [
  // Keep the duel rating thresholds, but use the vivid tuxun_NEW/CreateJS palette.
  { from: 0, color: '#808080', alpha: 0.15, name: 'grey' },
  { from: 1250, color: '#008000', alpha: 0.15, name: 'green' },
  { from: 1350, color: '#00C0C0', alpha: 0.2, name: 'cyan' },
  { from: 1450, color: '#0000FF', alpha: 0.1, name: 'blue' },
  { from: 1550, color: '#C0C000', alpha: 0.25, name: 'yellow' },
  { from: 1650, color: '#FF8000', alpha: 0.2, name: 'orange' },
  { from: 1750, color: '#FF0000', alpha: 0.1, name: 'red' },
  { from: 1850, color: '#000000', alpha: 0.08, name: 'nutella' },
  { from: 1950, color: '#FF0000', alpha: 0.1, name: 'tourist' },
  { from: 2050, color: '#FF0000', alpha: 0.1, name: 'rainbow' }
];
const BOUNDARIES = COLORS.map(c => c.from).filter(v => v > 0);

const isExpanded = ref(false);
const loading = ref(false);
const history = ref([]);
const hoverIndex = ref(null);
const particles = ref([]);
const chartUid = `rating-${Math.random().toString(36).slice(2)}`;
const contestClipId = `${chartUid}-contest-clip`;

const normalizedHistory = computed(() => history.value.map((entry, index) => ({
  ...entry,
  GraphIndex: index,
  NewRating: Number(entry.NewRating ?? 1500),
  OldRating: Number(entry.OldRating ?? entry.NewRating ?? 1500),
  EndTime: Number(entry.EndTime || Date.now() / 1000),
  ContestName: entry.ContestName || `Duel #${index + 1}`,
  StandingsUrl: entry.StandingsUrl || '#'
})));

const n = computed(() => normalizedHistory.value.length);
const xMin = computed(() => -MARGIN_VAL_X);
const xMax = computed(() => Math.max(n.value - 1, 0) + MARGIN_VAL_X);
const yBounds = computed(() => {
  if (!normalizedHistory.value.length) return { min: 1200, max: 1800 };
  const ratings = normalizedHistory.value.map(p => p.NewRating);
  const rawMin = Math.min(...ratings);
  const rawMax = Math.max(...ratings);
  return {
    min: Math.min(1500, Math.max(0, rawMin - MARGIN_VAL_Y_LOW)),
    max: rawMax + MARGIN_VAL_Y_HIGH
  };
});

const highestIndex = computed(() => {
  if (!normalizedHistory.value.length) return -1;
  return normalizedHistory.value.reduce((best, entry, index) => entry.NewRating > normalizedHistory.value[best].NewRating ? index : best, 0);
});
const activeIndex = computed(() => hoverIndex.value ?? Math.max(n.value - 1, 0));
const activeEntry = computed(() => normalizedHistory.value[activeIndex.value] || {});
const activeColor = computed(() => getColor(activeEntry.value.NewRating).color);
const activeDelta = computed(() => formatDiff(activeEntry.value.NewRating - activeEntry.value.OldRating));
const activePlace = computed(() => {
  const place = Number(activeEntry.value.Place);
  return Number.isFinite(place) && place > 0 ? getOrdinal(place) : '';
});
const activeDate = computed(() => formatFullDate(activeEntry.value.EndTime));
const activePoint = computed(() => points.value[activeIndex.value] || null);

const bands = computed(() => {
  const { min, max } = yBounds.value;
  const result = [];
  for (let i = COLORS.length - 1; i >= 0; i--) {
    const low = Math.max(min, COLORS[i].from);
    const high = Math.min(max, COLORS[i + 1]?.from ?? max);
    if (high <= min || low >= max || high <= low) continue;
    const yTop = yInPanelForRating(high);
    const yBottom = yInPanelForRating(low);
    result.push({
      key: `${COLORS[i].name}-${COLORS[i].from}`,
      y: yTop,
      height: Math.max(0, yBottom - yTop),
      color: COLORS[i].color,
      alpha: COLORS[i].alpha
    });
  }
  return result;
});

const boundaryLines = computed(() => BOUNDARIES
  .filter(value => value >= yBounds.value.min && value <= yBounds.value.max)
  .map(value => ({ value, y: yInPanelForRating(value) }))
);

const xLabels = computed(() => {
  const total = n.value;
  if (!total) return [];
  const labelStep = Math.max(1, Math.ceil(total / 6));
  const labels = [];
  let labeledLast = false;
  for (let i = 0; i < total; i += labelStep) {
    labels.push({ key: `x-${i}`, x: xInPanelForIndex(i), text: formatAxisDate(normalizedHistory.value[i].EndTime) });
    if (i === total - 1) labeledLast = true;
  }
  if (!labeledLast && total > 1) {
    labels.push({ key: `x-${total - 1}`, x: xInPanelForIndex(total - 1), text: formatAxisDate(normalizedHistory.value[total - 1].EndTime) });
  }
  return labels;
});

const points = computed(() => normalizedHistory.value.map((entry, index) => ({
  key: `${entry.EndTime}-${index}`,
  index,
  x: xForIndex(index),
  y: yForRating(entry.NewRating),
  color: getColor(entry.NewRating).color,
  entry
})));

const linePath = computed(() => {
  if (!points.value.length) return '';
  return points.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`).join(' ');
});

const highestPoint = computed(() => {
  const point = points.value[highestIndex.value];
  if (!point) return null;
  const dx = point.index > (xMin.value + xMax.value) / 2 ? -80 : 80;
  const labelX = clamp(point.x + dx, OFFSET_X + 40, OFFSET_X + PANEL_WIDTH - 40);
  const labelY = clamp(point.y - 16, OFFSET_Y + 10, OFFSET_Y + PANEL_HEIGHT - 10);
  return { ...point, labelX, labelY, rating: point.entry.NewRating };
});

watch(() => props.userId, fetchHistory, { immediate: true });

onMounted(() => {
  window.addEventListener('keydown', handleEscape);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape);
  document.body.classList.remove('rating-chart-expanded-open');
});

watch(isExpanded, (expanded) => {
  document.body.classList.toggle('rating-chart-expanded-open', expanded);
});

function handleEscape(event) {
  if (event.key === 'Escape' && isExpanded.value) isExpanded.value = false;
}

async function fetchHistory() {
  if (!props.userId) {
    history.value = [];
    return;
  }
  loading.value = true;
  try {
    const res = await api.get(`/user/${props.userId}/rating-history`);
    history.value = Array.isArray(res.data) ? res.data : [];
    hoverIndex.value = null;
    particles.value = [];
  } catch (e) {
    console.error('Failed to fetch rating history', e);
    history.value = [];
  } finally {
    loading.value = false;
  }
}

function getPer(value, left, right) {
  if (Math.abs(right - left) < EPS) return 0.5;
  return (value - left) / (right - left);
}

function xInPanelForIndex(index) {
  return PANEL_WIDTH * getPer(index, xMin.value, xMax.value);
}

function yInPanelForRating(rating) {
  return PANEL_HEIGHT - PANEL_HEIGHT * getPer(rating, yBounds.value.min, yBounds.value.max);
}

function xForIndex(index) {
  return OFFSET_X + xInPanelForIndex(index);
}

function yForRating(rating) {
  return OFFSET_Y + yInPanelForRating(rating);
}

function getColor(ratingValue) {
  const rating = Number(ratingValue || 0);
  for (let i = COLORS.length - 1; i >= 0; i--) {
    if (rating >= COLORS[i].from) return COLORS[i];
  }
  return COLORS[0];
}

function getRatingPer(ratingValue) {
  const rating = Number(ratingValue || 0);
  const stepSize = 400;
  let previous = COLORS[COLORS.length - 1].from + stepSize;
  for (let i = COLORS.length - 1; i >= 0; i--) {
    if (rating >= COLORS[i].from) return (rating - COLORS[i].from) / (previous - COLORS[i].from);
    previous = COLORS[i].from;
  }
  return 0;
}

function setHover(index) {
  hoverIndex.value = index;
  makeParticles(normalizedHistory.value[index]);
}

function makeParticles(entry) {
  if (!entry) {
    particles.value = [];
    return;
  }

  const rating = Number(entry.NewRating || 0);
  const colorInfo = getColor(rating);
  const amount = clamp(
    Math.trunc(Math.pow(getRatingPer(rating), 2) * (PARTICLE_MAX - PARTICLE_MIN) + PARTICLE_MIN),
    PARTICLE_MIN,
    PARTICLE_MAX
  );
  const text = rating >= STAR_MIN ? '★' : '@';

  particles.value = Array.from({ length: amount }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 4;
    const dx = Math.cos(angle) * speed * 9.5;
    const dy = Math.sin(angle) * speed * 9.5;
    return {
      id: `${Date.now()}-${i}-${Math.random()}`,
      text,
      style: {
        '--dx': `${dx}px`,
        '--dy': `${dy}px`,
        '--rot': `${Math.random() * 360 + 120}deg`,
        '--particle-color': colorInfo.color,
        '--particle-alpha': colorInfo.alpha,
        animationDelay: `${Math.random() * 0.04}s`
      }
    };
  });
}

function formatDiff(diff) {
  const value = Number(diff || 0);
  if (value === 0) return '±0';
  return value > 0 ? `+${value}` : `${value}`;
}

function getOrdinal(x) {
  const value = Number(x);
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const mod = value % 100;
  return `${value}${suffixes[(mod - 20) % 10] || suffixes[mod] || suffixes[0]}`;
}

function formatAxisDate(seconds) {
  const date = new Date(Number(seconds || 0) * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatFullDate(seconds) {
  const date = new Date(Number(seconds || 0) * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return formatLocaleDateTime(date, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
</script>

<style scoped>
.rating-chart-container {
  width: 100%;
  max-width: 820px;
  margin: 0 auto 2rem auto;
  background: #fff;
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  position: relative;
}
.rating-chart-container.large {
  max-width: 1120px;
}
.chart-frame {
  width: min(100%, 640px);
  margin: 0 auto;
}
.rating-chart-container.large .chart-frame,
.rating-chart-container.expanded .chart-frame {
  width: min(100%, 1080px);
}
.chart-expand-btn {
  position: absolute;
  top: 96px;
  right: 22px;
  z-index: 3;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  border: 1px solid #e5e7eb;
  background: rgba(255,255,255,.94);
  color: #111827;
  cursor: pointer;
  display: grid;
  place-items: center;
  box-shadow: 0 2px 8px rgba(0,0,0,.12);
  transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
}
.chart-expand-btn:hover {
  background: #fff;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(15, 23, 42, .16);
}
.rating-chart-container.expanded {
  position: fixed;
  inset: 24px;
  z-index: 10000;
  max-width: none;
  margin: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: #fff;
}
.status-svg,
.rating-svg {
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
}
.status-panel {
  fill: #fff;
  stroke-width: 1;
}
.status-rating-number {
  font-family: 'Squada One', Impact, sans-serif;
  font-size: 48px;
  letter-spacing: .01em;
}
.status-place {
  font: 16px Lato, Arial, sans-serif;
  fill: #000;
}
.status-delta {
  font-family: 'Squada One', Impact, sans-serif;
  font-size: 28px;
  fill: #000;
}
.status-date {
  font: 14px Lato, Arial, sans-serif;
  fill: #000;
}
.status-contest {
  font: 20px Lato, Arial, sans-serif;
  fill: #000;
}
.status-contest-link {
  cursor: pointer;
}
.status-contest-link:hover {
  text-decoration: underline;
}
.chart-graph {
  width: 100%;
  display: flex;
  justify-content: center;
}
.rating-chart-layer {
  filter: drop-shadow(1px 2px 3px rgba(0,0,0,.3));
}
.active-guides line {
  stroke: rgba(17, 24, 39, 0.28);
  stroke-width: 0.8;
  stroke-dasharray: 4 5;
  pointer-events: none;
}
.axis-label,
.highest-label {
  font: 12px Lato, Arial, sans-serif;
  fill: #000;
  pointer-events: none;
}
.point-hit {
  cursor: pointer;
  outline: none;
}
.chart-state {
  min-height: 430px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  color: #6b7280;
  font-weight: 700;
}
.chart-state i {
  font-size: 1.6rem;
}
.chart-state.empty {
  border: 1px dashed #d1d5db;
  border-radius: 8px;
}
.particle-layer {
  pointer-events: none;
  overflow: visible;
}
.rating-particle {
  font: 64px Lato, Arial, sans-serif;
  line-height: 1;
  fill: var(--particle-color);
  opacity: var(--particle-alpha);
  animation: rating-particle-burst .5s ease-out forwards;
  transform-origin: center;
  transform-box: fill-box;
}
@keyframes rating-particle-burst {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: var(--particle-alpha); }
  100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(0); opacity: 0; }
}
@media (max-width: 700px) {
  .rating-chart-container {
    padding: 8px;
  }
  .chart-expand-btn {
    top: 88px;
    right: 18px;
  }
}
</style>
