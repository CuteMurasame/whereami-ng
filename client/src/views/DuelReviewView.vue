<template>
  <DashboardLayout page="duels">
    <div class="review-container">
      <div v-if="loading" class="loading-state">
        <i class="fa-solid fa-circle-notch fa-spin"></i> {{ t('analysis.loading') }}
      </div>

      <div v-else-if="!duel || error" class="error-state">
        {{ error || t('duels.reviewNotFound') }}
      </div>

      <div v-else class="review-content">
        <div class="header-card">
          <button @click="router.back()" class="back-btn">
            <i class="fa-solid fa-arrow-left"></i> {{ t('analysis.back') }}
          </button>

          <div class="duel-summary">
            <p class="eyebrow">{{ duel.map.name }} · {{ duel.mode.toUpperCase() }}</p>
            <h1>
              <span>{{ duel.players.me.username }}</span>
              <em>{{ t('duels.vs') }}</em>
              <span>{{ duel.players.opponent.username }}</span>
            </h1>

            <div class="summary-stats">
              <div class="stat">
                <span class="label">{{ t('duels.final') }}</span>
                <span class="value score-value">{{ duel.scores.me }} - {{ duel.scores.opponent }}</span>
              </div>
              <div class="stat">
                <span class="label">{{ t('duels.ratingChange') }}</span>
                <span class="value" :class="ratingDeltaClass">{{ signed(duel.rating.myChange) }}</span>
              </div>
              <div class="stat">
                <span class="label">{{ t('analysis.date') }}</span>
                <span class="value">{{ formatDate(duel.finishedAt || duel.updatedAt || duel.createdAt) }}</span>
              </div>
              <div class="stat">
                <span class="label">{{ t('analysis.mode') }}</span>
                <span class="value mode-badge">{{ duel.mode }}</span>
              </div>
            </div>

            <div class="header-actions">
              <button class="primary-btn" @click="router.push('/duels')">{{ t('duels.playAgain') }}</button>
              <button class="secondary-btn" @click="router.push('/duels/leaderboard')">{{ t('duels.leaderboard') }}</button>
              <button class="secondary-btn" @click="router.push(`/user/${duel.players.opponent.id}`)">{{ t('duels.viewOpponentProfile') }}</button>
            </div>
          </div>
        </div>

        <div class="rounds-list">
          <div v-for="round in duel.rounds" :key="round.roundNumber" class="round-card">
            <div class="round-header">
              <h3>{{ t('analysis.round') }} {{ round.roundNumber }}</h3>
              <div class="round-stats">
                <span class="round-score">{{ t('duels.you') }} +{{ myGuess(round).score || 0 }}</span>
                <span class="round-score opponent">{{ t('duels.opponent') }} +{{ opponentGuess(round).score || 0 }}</span>
              </div>
            </div>

            <div class="round-body">
              <div :id="`duel-review-map-${round.roundNumber}`" class="map-container"></div>
              <div class="round-details">
                <div class="detail-row target-row">
                  <span><i class="fa-solid fa-flag-checkered"></i> {{ t('duels.target') }}</span>
                  <a :href="getStreetViewUrl(round.panoId)" target="_blank" rel="noopener">{{ t('duels.openStreetView') }}</a>
                  <a :href="getCoordsUrl(round.actual)" target="_blank" rel="noopener">{{ t('duels.openTarget') }}</a>
                </div>

                <div class="detail-row me-row">
                  <span><i class="fa-solid fa-circle"></i> {{ t('duels.yourGuess') }}</span>
                  <strong>{{ formatDistance(myGuess(round).distanceMeters, myGuess(round).guessed) }}</strong>
                  <a v-if="myGuess(round).guessed" :href="getCoordsUrl(myGuess(round))" target="_blank" rel="noopener">{{ t('duels.openYourGuess') }}</a>
                </div>

                <div class="detail-row opponent-row">
                  <span><i class="fa-solid fa-circle"></i> {{ t('duels.opponentGuess') }}</span>
                  <strong>{{ formatDistance(opponentGuess(round).distanceMeters, opponentGuess(round).guessed) }}</strong>
                  <a v-if="opponentGuess(round).guessed" :href="getCoordsUrl(opponentGuess(round))" target="_blank" rel="noopener">{{ t('duels.openOpponentGuess') }}</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Loader } from '@googlemaps/js-api-loader';
import DashboardLayout from '../components/DashboardLayout.vue';
import { api } from '../auth';
import { signed } from '../utils/rating';
import { createDistanceLabelElement, createFlagMarkerElement, createHtmlOverlay, createPlayerMarkerElement, drawStyledDistanceLine, MAP_MARKER_TONES, straightMidpoint } from '../utils/mapMarkers';
import { formatLocaleDateTime } from '../utils/dateFormat';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const duel = ref(null);
const loading = ref(true);
const error = ref(null);
let maps = [];

const loader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  version: 'weekly',
  libraries: ['geometry']
});

const ratingDeltaClass = computed(() => ({ positive: (duel.value?.rating?.myChange || 0) > 0, negative: (duel.value?.rating?.myChange || 0) < 0 }));

const formatDate = (value) => {
  if (!value) return '-';
  return formatLocaleDateTime(value, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatDistance = (meters, guessed = true) => {
  if (!guessed || meters === null || meters === undefined) return t('duels.noGuess');
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 2 : 1)} km`;
};

const myGuess = (round) => duel.value?.isPlayer1 ? round.player1 : round.player2;
const opponentGuess = (round) => duel.value?.isPlayer1 ? round.player2 : round.player1;

const getStreetViewUrl = (panoId) => {
  if (!panoId) return '#';
  return `https://www.google.com/maps/@?api=1&map_action=pano&pano=${encodeURIComponent(panoId)}`;
};

const getCoordsUrl = (point) => {
  if (!point || point.lat === undefined || point.lng === undefined) return '#';
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
};

const fetchReview = async () => {
  loading.value = true;
  error.value = null;
  try {
    const res = await api.get(`/duels/${route.params.id}/review`);
    duel.value = res.data;
    loading.value = false;
    await nextTick();
    await initMaps();
  } catch (err) {
    console.error(err);
    error.value = err.response?.data?.error || t('duels.reviewNotFound');
    loading.value = false;
  }
};

const initMaps = async () => {
  const google = await loader.load();
  maps = [];

  duel.value.rounds.forEach((round) => {
    const el = document.getElementById(`duel-review-map-${round.roundNumber}`);
    if (!el || !round.actual) return;

    const actual = new google.maps.LatLng(round.actual.lat, round.actual.lng);
    const map = new google.maps.Map(el, {
      center: actual,
      zoom: 2,
      disableDefaultUI: true,
      gestureHandling: 'cooperative',
      clickableIcons: false
    });
    maps.push(map);

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(actual);

    createHtmlOverlay(
      google,
      actual,
      createFlagMarkerElement(t('duels.target'), MAP_MARKER_TONES.target),
      map,
      { zIndex: 3000, transform: 'translate(-28%, -88%)' }
    );

    addGuessLayer({ google, map, bounds, actual, guess: myGuess(round), player: duel.value.players.me, tone: MAP_MARKER_TONES.me, label: t('duels.you') });
    addGuessLayer({ google, map, bounds, actual, guess: opponentGuess(round), player: duel.value.players.opponent, tone: MAP_MARKER_TONES.opponent, label: t('duels.opponent') });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
      const listener = map.addListener('idle', () => {
        if (map.getZoom() > 15) map.setZoom(15);
        google.maps.event.removeListener(listener);
      });
    }
  });
};

const addGuessLayer = ({ google, map, bounds, actual, guess, player, tone, label }) => {
  if (!guess?.guessed) return;
  const position = new google.maps.LatLng(guess.lat, guess.lng);
  const color = tone.color;
  bounds.extend(position);

  createHtmlOverlay(
    google,
    position,
    createPlayerMarkerElement(player, tone, label),
    map,
    { zIndex: 2500 }
  );

  drawStyledDistanceLine({ google, map, from: actual, to: position, color, zIndex: 10 });

  const midpoint = straightMidpoint(google, actual, position);
  createHtmlOverlay(
    google,
    midpoint,
    createDistanceLabelElement(`${label} · ${formatDistance(guess.distanceMeters)}`, color),
    map,
    { zIndex: 3500, pane: 'floatPane' }
  );
};

onMounted(fetchReview);
</script>

<style scoped>
.review-container { padding: 1.5rem; max-width: 100%; margin: 0 auto; width: 100%; }
.loading-state, .error-state { text-align: center; padding: 4rem; font-size: 1.2rem; color: var(--color-text-muted); }
.header-card { background: #fff; border: 1px solid var(--color-border); border-radius: 12px; padding: 2rem; margin-bottom: 2rem; box-shadow: var(--shadow-sm); }
.back-btn { background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 1rem; display: flex; align-items: center; gap: 8px; margin-bottom: 1rem; padding: 0; }
.back-btn:hover { color: var(--color-primary); }
.eyebrow { margin: 0 0 .5rem; color: var(--color-text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
.duel-summary h1 { margin: 0; font-size: clamp(1.45rem, 3.6vw, 2.25rem); color: var(--color-text-main); display: flex; align-items: baseline; gap: .85rem; flex-wrap: wrap; }
.duel-summary h1 span { max-width: min(420px, 42vw); overflow-wrap: anywhere; line-height: 1.08; }
.duel-summary h1 em { font-size: clamp(1.15rem, 2.4vw, 1.6rem); color: var(--color-text-muted); font-style: normal; text-transform: uppercase; letter-spacing: .12em; font-weight: 700; }
.summary-stats { display: flex; gap: 2rem; flex-wrap: wrap; padding-top: 1rem; margin-top: 1rem; border-top: 1px solid var(--color-border); }
.stat { display: flex; flex-direction: column; gap: 4px; }
.stat .label { font-size: 0.75rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 700; letter-spacing: 0.5px; }
.stat .value { font-size: 1.2rem; font-weight: 700; color: var(--color-text-main); }
.score-value { color: var(--color-primary) !important; font-weight: 750 !important; font-size: 1.6rem !important; }
.mode-badge { text-transform: uppercase; color: var(--color-accent) !important; font-weight: 700 !important; }
.positive { color: #16a34a !important; }
.negative { color: #ef4444 !important; }
.header-actions { display: flex; gap: .75rem; flex-wrap: wrap; margin-top: 1.25rem; }
.primary-btn, .secondary-btn { border-radius: var(--radius); padding: .7rem 1rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; border: 1px solid transparent; }
.secondary-btn { background: #fff; color: #111827; border-color: #e5e7eb; }
.rounds-list { display: flex; flex-direction: column; gap: 2rem; }
.round-card { background: #fff; border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; box-shadow: var(--shadow-sm); }
.round-header { padding: 1rem 1.5rem; background: #f8fafc; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
.round-header h3 { margin: 0; font-size: 1rem; font-weight: 700; color: var(--color-text-main); text-transform: uppercase; letter-spacing: 0.5px; }
.round-stats { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
.round-score { font-weight: 700; color: #2563eb; font-size: 1.02rem; }
.round-score.opponent { color: #ef4444; }
.round-body { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 0; }
.map-container { width: 100%; height: 330px; background: #e5e7eb; }
.round-details { border-left: 1px solid var(--color-border); padding: 1rem; display: flex; flex-direction: column; gap: .75rem; }
.detail-row { border: 1px solid #e5e7eb; background: #f8fafc; border-radius: 12px; padding: .85rem; display: grid; gap: .45rem; }
.detail-row span { font-weight: 700; color: #111827; display: inline-flex; align-items: center; gap: .45rem; }
.detail-row strong { color: #64748b; }
.detail-row a { color: var(--color-primary); font-weight: 700; font-size: .9rem; }
.target-row i { color: #16a34a; }
.me-row i { color: #2563eb; }
.opponent-row i { color: #ef4444; }
@media (max-width: 860px) {
  .review-container { padding: 1rem; }
  .header-card { padding: 1.25rem; }
  .round-body { grid-template-columns: 1fr; }
  .round-details { border-left: none; border-top: 1px solid var(--color-border); }
  .map-container { height: 300px; }
}
</style>
