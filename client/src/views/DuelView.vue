<template>
  <DashboardLayout page="duels">
    <div v-if="loading" class="center-state loading-duel-state">
      <i class="fa-solid fa-circle-notch fa-spin"></i> {{ t('common.loading') }}
      <div v-if="initialLoadWarningVisible" class="load-warning-inline">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>{{ t('common.slowLoadHint') }}</span>
        <button type="button" @click="retryLoad">{{ t('common.refresh') }}</button>
        <button type="button" class="warning-close-btn" :aria-label="t('common.dismiss')" @click="dismissInitialLoadWarning">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>

    <div v-else-if="!duel" class="center-state">
      <h2>{{ t('duels.notFound') }}</h2>
      <button class="primary-btn small-btn" @click="router.push('/duels')">{{ t('duels.backToQueue') }}</button>
    </div>

    <div v-else ref="shellRef" class="duel-shell" :class="{ fullscreen: isFullscreen }">
      <section v-if="isFinished" class="final-screen">
        <div class="final-card">
          <div class="final-icon" :class="finalTone"><i :class="finalIcon"></i></div>
          <p class="eyebrow">{{ duel.map.name }} · {{ duel.mode.toUpperCase() }}</p>
          <div class="final-versus"><strong>{{ duel.players.me.username }}</strong><span>vs</span><strong>{{ duel.players.opponent.username }}</strong></div>
          <h1>{{ finalTitle }}</h1>
          <p>{{ t('duels.finalScore', { me: duel.scores.me, opponent: duel.scores.opponent }) }}</p>

          <div class="final-score-grid">
            <div>
              <span>{{ t('duels.you') }}</span>
              <strong>{{ duel.scores.me }}</strong>
            </div>
            <div>
              <span>{{ t('duels.opponent') }}</span>
              <strong>{{ duel.scores.opponent }}</strong>
            </div>
            <div class="rating-delta-tile">
              <span>{{ t('duels.rating') }}</span>
              <strong class="rating-delta-value" :class="ratingDeltaClass">{{ signed(duel.rating.myChange) }}</strong>
            </div>
          </div>

          <div class="final-actions">
            <button class="primary-btn play-btn" @click="router.push('/duels')">{{ t('duels.playAgain') }}</button>
            <button class="secondary-btn" @click="router.push('/duels/leaderboard')">{{ t('duels.leaderboard') }}</button>
            <button class="secondary-btn" @click="router.push(`/duels/${duel.id}/review`)">{{ t('duels.review') }}</button>
            <button class="secondary-btn" @click="router.push(`/user/${duel.players.opponent.id}`)">{{ t('duels.viewOpponentProfile') }}</button>
          </div>
        </div>
      </section>

      <section v-else class="duel-game-screen">
        <div v-show="!showResult" class="street-stage">
          <div id="duel-street-view" class="street-view" :class="{ frozen: duel.mode === 'nmpz' }"></div>

          <div id="duel-compass-container" class="compass-container">
            <div id="duel-compass-strip" class="compass-strip"></div>
            <div class="compass-marker"></div>
          </div>

          <div class="round-pill">
            <strong>{{ t('duels.roundOf', { round: duel.currentRound, total: duel.totalRounds }) }}</strong>
            <span>{{ duel.map.name }} · {{ duel.mode.toUpperCase() }}</span>
          </div>

          <div class="player-hud player-hud-left" :style="hudStyle('me')">
            <div class="hud-avatar-wrap"><img v-if="avatarUrl(duel.players.me)" :src="avatarUrl(duel.players.me)" alt="" /><span v-else>{{ initials(duel.players.me) }}</span></div>
            <div>
              <small>{{ t('duels.you') }}</small>
              <strong>{{ duel.players.me.username }}</strong>
              <em>{{ duel.scores.me }} pts</em>
            </div>
            <i v-if="duel.current?.meGuessed" class="fa-solid fa-circle-check hud-check"></i>
          </div>

          <div class="player-hud player-hud-right" :style="hudStyle('opponent')">
            <div>
              <small>{{ t('duels.opponent') }}</small>
              <strong>{{ duel.players.opponent.username }}</strong>
              <em>{{ duel.scores.opponent }} pts</em>
            </div>
            <div class="hud-avatar-wrap"><img v-if="avatarUrl(duel.players.opponent)" :src="avatarUrl(duel.players.opponent)" alt="" /><span v-else>{{ initials(duel.players.opponent) }}</span></div>
            <i v-if="duel.current?.opponentGuessed" class="fa-solid fa-circle-check hud-check right-check"></i>
          </div>

          <div v-if="forceCountdownActive" class="timer-display" :class="{ urgent: forceCountdownSeconds <= 5 }">
            <i class="fa-solid fa-clock"></i>
            <span v-if="duel.current?.opponentGuessed && !duel.current?.meGuessed">
              {{ t('duels.opponentLocked', { seconds: forceCountdownSeconds }) }}
            </span>
            <span v-else>
              {{ t('duels.waitingCountdown', { seconds: forceCountdownSeconds }) }}
            </span>
          </div>
          <div v-else-if="duel.current?.meGuessed" class="waiting-status">
            <i class="fa-solid fa-check"></i> {{ t('duels.waitOpponent') }}
          </div>

          <div v-if="roundLoadWarningVisible" class="load-warning-toast">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>{{ t('common.slowLoadHint') }}</span>
            <button type="button" @click="retryLoad">{{ t('common.refresh') }}</button>
            <button type="button" class="warning-close-btn" :aria-label="t('common.dismiss')" @click="dismissRoundLoadWarning">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div
            class="map-overlay"
            :class="{ expanded: mapExpanded, locked: !duel.current?.canGuess }"
            @mouseenter="mapExpanded = true"
            @mouseleave="mapExpanded = false"
            @click="mapExpanded = true"
          >
            <div class="map-overlay-header">
              <strong>{{ t('duels.placeGuess') }}</strong>
              <button class="map-expand-btn" type="button" @click.stop="mapExpanded = !mapExpanded">
                <i :class="mapExpanded ? 'fa-solid fa-compress' : 'fa-solid fa-expand'"></i>
              </button>
            </div>
            <div id="duel-guess-map" class="guess-map"></div>
            <button class="primary-btn guess-btn" :disabled="!canSubmit" @click.stop="submitGuess()">
              <i class="fa-solid fa-crosshairs"></i>
              <span>{{ submitLabel }}</span>
              <kbd v-if="canSubmit && spaceSubmitGuessEnabled" class="hotkey-pill">Space</kbd>
            </button>
          </div>

          <div class="game-controls" v-if="duel.mode === 'moving'">
            <button class="control-btn" @click="undoMove" :disabled="currentHistoryIndex <= 0" title="Undo">
              <i class="fa-solid fa-rotate-left"></i>
            </button>
            <button class="control-btn" @click="returnToStart" :disabled="!startPanoId" title="Back to start">
              <i class="fa-solid fa-flag"></i>
            </button>
            <button class="control-btn" @click="redoMove" :disabled="currentHistoryIndex >= moveHistory.length - 1" title="Redo">
              <i class="fa-solid fa-rotate-right"></i>
            </button>
          </div>
        </div>

        <div v-show="showResult" class="result-stage">
          <div id="duel-result-map" class="result-map-full"></div>

          <div class="result-topbar">
            <div>
              <strong>{{ t('duels.roundResults') }}</strong>
              <span>{{ t('duels.roundOf', { round: duel.currentRound, total: duel.totalRounds }) }}</span>
            </div>
            <div class="result-countdown">
              <i class="fa-solid fa-forward-step"></i>
              {{ resultCountdownLabel }}
            </div>
          </div>

          <div class="map-legend">
            <div><span class="legend-dot target"></span>{{ t('duels.target') }}</div>
            <div><span class="legend-dot me"></span>{{ t('duels.yourGuess') }}</div>
            <div><span class="legend-dot opponent"></span>{{ t('duels.opponentGuess') }}</div>
          </div>

          <div class="round-summary-card">
            <div class="summary-head">
              <span>{{ t('duels.roundDelta') }}</span>
              <strong :class="roundDeltaClass">{{ signed(roundScoreDelta) }}</strong>
            </div>
            <div class="summary-grid">
              <div>
                <span>{{ t('duels.you') }}</span>
                <strong>+{{ myRound?.score || 0 }}</strong>
                <em>{{ formatDistance(myRound?.distanceMeters, myRound?.guessed) }}</em>
              </div>
              <div>
                <span>{{ t('duels.opponent') }}</span>
                <strong>+{{ opponentRound?.score || 0 }}</strong>
                <em>{{ formatDistance(opponentRound?.distanceMeters, opponentRound?.guessed) }}</em>
              </div>
              <div>
                <span>{{ t('duels.totalScore') }}</span>
                <strong>{{ duel.scores.me }} - {{ duel.scores.opponent }}</strong>
                <em>{{ t('duels.scoreSwing', { delta: signed(totalScoreDelta) }) }}</em>
              </div>
            </div>
          </div>
        </div>

        <div class="utility-actions">
          <button class="utility-btn" type="button" @click="toggleFullscreen">
            <i :class="isFullscreen ? 'fa-solid fa-compress' : 'fa-solid fa-expand'"></i>
            <span>{{ isFullscreen ? t('duels.exitFullscreen') : t('duels.fullscreen') }}</span>
          </button>
          <button class="utility-btn danger" type="button" @click="forfeit" :disabled="submitting">
            <i class="fa-solid fa-flag"></i>
            <span>{{ t('duels.forfeit') }}</span>
          </button>
        </div>

        <div v-if="duel.rounds.length && !showResult" class="round-history-strip">
          <div v-for="round in duel.rounds" :key="round.roundNumber" class="history-dot" :class="historyTone(round)">
            <span>{{ round.roundNumber }}</span>
            <strong>{{ getRoundScore(round, 'me') }}-{{ getRoundScore(round, 'opponent') }}</strong>
          </div>
        </div>
      </section>
    </div>
  </DashboardLayout>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Loader } from '@googlemaps/js-api-loader';
import Swal from 'sweetalert2';
import DashboardLayout from '../components/DashboardLayout.vue';
import { api } from '../auth';
import { toServerUrl } from '../config';
import { connectSocket } from '../socket';
import { signed } from '../utils/rating';
import { isSpaceSubmitGuessEnabled, PREFERENCES_CHANGED_EVENT, shouldIgnoreHotkeyTarget } from '../utils/preferences';
import { createDistanceLabelElement, createFlagMarkerElement, createHtmlOverlay, createPlayerMarkerElement, drawStyledDistanceLine, straightMidpoint } from '../utils/mapMarkers';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const PLAYER_TONES = {
  me: { color: '#2563eb', soft: 'rgba(37, 99, 235, .16)' },
  opponent: { color: '#ef4444', soft: 'rgba(239, 68, 68, .16)' },
  target: { color: '#16a34a', soft: 'rgba(22, 163, 74, .18)' }
};
const DEFAULT_GUESS_MAP_VIEW = { center: { lat: 20, lng: 0 }, zoom: 2 };
const DUEL_ROUND_STATE_PREFIX = 'whereami.duel.roundState:';
const NON_MOVING_BLOCKED_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '+', '=', '_', '-']);
const LOAD_WARNING_DELAY_MS = 4000;

const duel = ref(null);
const loading = ref(true);
const submitting = ref(false);
const currentGuess = ref(null);
const mapExpanded = ref(false);
const isFullscreen = ref(false);
const shellRef = ref(null);
const clockNow = ref(Date.now());
const serverOffsetMs = ref(0);
const moveHistory = ref([]);
const currentHistoryIndex = ref(-1);
const startPanoId = ref(null);
const roundLoadWarningVisible = ref(false);
const initialLoadWarningVisible = ref(false);
const spaceSubmitGuessEnabled = ref(isSpaceSubmitGuessEnabled());

let socket = null;
let streetView = null;
let streetRoundKey = null;
let panoListener = null;
let povListener = null;
let statusListener = null;
let guessMap = null;
let guessClickListener = null;
let guessMarkerOverlay = null;
let guessMapRoundKey = null;
let resultMap = null;
let resultOverlays = [];
let resultPolylines = [];
let clockTimer = null;
let autoSubmitKey = null;
let roundLoadWarningTimer = null;
let roundLoadWarningKey = null;
let initialLoadWarningTimer = null;
let persistRoundStateTimer = null;
let dismissedRoundLoadWarningKey = null;
let initialLoadWarningDismissed = false;
let isNavigatingHistory = false;

const loader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  version: 'weekly',
  libraries: ['geometry']
});

const isFinished = computed(() => duel.value?.status === 'finished');
const showResult = computed(() => Boolean(duel.value?.status === 'round_results' && duel.value?.current?.result));
const currentResult = computed(() => duel.value?.current?.result || null);
const myRound = computed(() => currentResult.value ? (duel.value.isPlayer1 ? currentResult.value.player1 : currentResult.value.player2) : null);
const opponentRound = computed(() => currentResult.value ? (duel.value.isPlayer1 ? currentResult.value.player2 : currentResult.value.player1) : null);
const roundScoreDelta = computed(() => (myRound.value?.score || 0) - (opponentRound.value?.score || 0));
const totalScoreDelta = computed(() => (duel.value?.scores?.me || 0) - (duel.value?.scores?.opponent || 0));
const roundDeltaClass = computed(() => ({ positive: roundScoreDelta.value > 0, negative: roundScoreDelta.value < 0 }));
const canSubmit = computed(() => Boolean(duel.value?.current?.canGuess && currentGuess.value && !submitting.value));
const syncedNowMs = computed(() => clockNow.value + serverOffsetMs.value);
const forceDeadlineMs = computed(() => parseDateMs(duel.value?.current?.forceGuessDeadlineAt));
const resultDeadlineMs = computed(() => parseDateMs(duel.value?.current?.resultDeadlineAt));
const forceRemainingMs = computed(() => forceDeadlineMs.value ? Math.max(0, forceDeadlineMs.value - syncedNowMs.value) : 0);
const resultRemainingMs = computed(() => resultDeadlineMs.value ? Math.max(0, resultDeadlineMs.value - syncedNowMs.value) : 0);
const forceCountdownActive = computed(() => duel.value?.status === 'playing' && Boolean(forceDeadlineMs.value));
const forceCountdownSeconds = computed(() => Math.max(0, Math.ceil(forceRemainingMs.value / 1000)));
const resultCountdownSeconds = computed(() => Math.max(0, Math.ceil(resultRemainingMs.value / 1000)));
const resultCountdownLabel = computed(() => {
  const seconds = resultCountdownSeconds.value;
  if (duel.value?.currentRound >= duel.value?.totalRounds) return t('duels.finalIn', { seconds });
  return t('duels.nextRoundIn', { seconds });
});
const submitLabel = computed(() => submitting.value ? t('common.processing') : t('singleplayer.guess'));
const finalTone = computed(() => duel.value?.result?.draw ? 'draw' : (duel.value?.result?.meWon ? 'win' : 'loss'));
const finalIcon = computed(() => finalTone.value === 'win' ? 'fa-solid fa-trophy' : (finalTone.value === 'draw' ? 'fa-solid fa-scale-balanced' : 'fa-solid fa-heart-crack'));
const finalTitle = computed(() => {
  if (!duel.value?.result) return '';
  if (duel.value.result.draw) return t('duels.draw');
  return duel.value.result.meWon ? t('duels.victory') : t('duels.defeat');
});
const ratingDeltaClass = computed(() => ({ positive: (duel.value?.rating?.myChange || 0) > 0, negative: (duel.value?.rating?.myChange || 0) < 0 }));

const parseDateMs = (value) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const updateServerClock = (payload) => {
  const serverNow = parseDateMs(payload?.timers?.serverNow);
  if (serverNow) serverOffsetMs.value = serverNow - Date.now();
};

const avatarUrl = (player) => player?.avatar_url ? toServerUrl(player.avatar_url) : '';
const initials = (player) => Array.from((player?.username || '?').trim())[0]?.toUpperCase() || '?';
const hudStyle = (tone) => ({ '--tone': PLAYER_TONES[tone].color, '--tone-soft': PLAYER_TONES[tone].soft });

const currentRoundKey = () => duel.value ? `${duel.value.id}:${duel.value.currentRound}` : null;
const roundStateStorageKey = (roundKey = currentRoundKey()) => roundKey ? `${DUEL_ROUND_STATE_PREFIX}${roundKey}` : null;
const isValidPoint = (point) => Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng));
const isValidPov = (pov) => pov && Number.isFinite(Number(pov.heading)) && Number.isFinite(Number(pov.pitch));

const readRoundState = (roundKey = currentRoundKey()) => {
  const key = roundStateStorageKey(roundKey);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const persistRoundState = () => {
  if (!duel.value || duel.value.status !== 'playing') return;
  const key = roundStateStorageKey();
  if (!key) return;
  try {
    const state = {
      roundKey: currentRoundKey(),
      pano: streetView?.getPano?.() || null,
      pov: streetView?.getPov?.() || null,
      guess: currentGuess.value && isValidPoint(currentGuess.value) ? { lat: Number(currentGuess.value.lat), lng: Number(currentGuess.value.lng) } : null,
      moveHistory: Array.isArray(moveHistory.value) ? moveHistory.value.slice(-80) : [],
      currentHistoryIndex: currentHistoryIndex.value,
      startPanoId: startPanoId.value || duel.value.current?.panoId || null,
      savedAt: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private windows; gameplay should continue.
  }
};

const schedulePersistRoundState = () => {
  if (persistRoundStateTimer) window.clearTimeout(persistRoundStateTimer);
  persistRoundStateTimer = window.setTimeout(() => {
    persistRoundStateTimer = null;
    persistRoundState();
  }, 140);
};

const armRoundLoadWarning = (roundKey) => {
  if (!roundKey) return;
  if (dismissedRoundLoadWarningKey !== roundKey) dismissedRoundLoadWarningKey = null;
  if (roundLoadWarningTimer) window.clearTimeout(roundLoadWarningTimer);
  roundLoadWarningKey = roundKey;
  roundLoadWarningVisible.value = false;
  roundLoadWarningTimer = window.setTimeout(() => {
    if (roundLoadWarningKey === roundKey && dismissedRoundLoadWarningKey !== roundKey && duel.value?.status === 'playing') {
      roundLoadWarningVisible.value = true;
    }
  }, LOAD_WARNING_DELAY_MS);
};

const clearRoundLoadWarning = (roundKey = null) => {
  if (roundKey && roundLoadWarningKey && roundLoadWarningKey !== roundKey) return;
  if (roundLoadWarningTimer) window.clearTimeout(roundLoadWarningTimer);
  roundLoadWarningTimer = null;
  roundLoadWarningKey = null;
  roundLoadWarningVisible.value = false;
};

const dismissRoundLoadWarning = () => {
  dismissedRoundLoadWarningKey = roundLoadWarningKey || currentRoundKey();
  roundLoadWarningVisible.value = false;
};

const armInitialLoadWarning = () => {
  if (initialLoadWarningTimer) window.clearTimeout(initialLoadWarningTimer);
  initialLoadWarningVisible.value = false;
  initialLoadWarningDismissed = false;
  initialLoadWarningTimer = window.setTimeout(() => {
    if (loading.value && !initialLoadWarningDismissed) initialLoadWarningVisible.value = true;
  }, LOAD_WARNING_DELAY_MS);
};

const clearInitialLoadWarning = () => {
  if (initialLoadWarningTimer) window.clearTimeout(initialLoadWarningTimer);
  initialLoadWarningTimer = null;
  initialLoadWarningVisible.value = false;
};

const dismissInitialLoadWarning = () => {
  initialLoadWarningDismissed = true;
  initialLoadWarningVisible.value = false;
};

const retryLoad = async () => {
  if (loading.value) {
    initialLoadWarningVisible.value = false;
    try {
      await fetchDuel();
    } finally {
      loading.value = false;
      clearInitialLoadWarning();
    }
    return;
  }

  dismissedRoundLoadWarningKey = null;
  roundLoadWarningVisible.value = false;
  await renderForState();
};

const syncPreferences = () => {
  spaceSubmitGuessEnabled.value = isSpaceSubmitGuessEnabled();
};

const handleKeydown = (e) => {
  if (shouldIgnoreHotkeyTarget(e.target)) return;

  const plainKey = !e.metaKey && !e.altKey && !e.ctrlKey;
  if (plainKey && duel.value?.status === 'playing' && !showResult.value && duel.value?.mode !== 'moving' && NON_MOVING_BLOCKED_KEYS.has(e.key)) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    return;
  }

  if ((e.code !== 'Space' && e.key !== ' ') || !plainKey) return;
  if (canSubmit.value && spaceSubmitGuessEnabled.value) {
    e.preventDefault();
    e.stopPropagation();
    submitGuess();
  }
};

const resetGuessMapView = () => {
  if (!guessMap) return;
  guessMap.setCenter(DEFAULT_GUESS_MAP_VIEW.center);
  guessMap.setZoom(DEFAULT_GUESS_MAP_VIEW.zoom);
};

const slotTone = (slot) => {
  const mineSlot = duel.value?.isPlayer1 ? 'player1' : 'player2';
  return slot === mineSlot ? PLAYER_TONES.me : PLAYER_TONES.opponent;
};

const slotLabel = (slot) => {
  const mineSlot = duel.value?.isPlayer1 ? 'player1' : 'player2';
  return slot === mineSlot ? t('duels.you') : t('duels.opponent');
};

const formatDistance = (meters, guessed = true) => {
  if (!guessed || meters === null || meters === undefined) return t('duels.noGuess');
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 2 : 1)} km`;
};

const fetchDuel = async () => {
  const res = await api.get(`/duels/${route.params.id}`);
  updateServerClock(res.data);
  duel.value = res.data;
  await renderForState();
};

const renderForState = async () => {
  await nextTick();
  if (!duel.value || isFinished.value) {
    clearRoundLoadWarning();
    return;
  }

  if (showResult.value) {
    clearRoundLoadWarning();
    await renderResultMap();
  } else {
    const roundKey = currentRoundKey();
    armRoundLoadWarning(roundKey);
    try {
      await renderStreetView();
      await renderGuessMap();
    } catch (err) {
      console.error('Failed to render duel round:', err);
    }
  }
  resizeMaps();
};

const renderStreetView = async () => {
  if (!duel.value?.current?.panoId) return;
  await loader.load();
  const el = document.getElementById('duel-street-view');
  if (!el) return;

  const roundKey = `${duel.value.id}:${duel.value.currentRound}`;
  const isNewRound = streetRoundKey !== roundKey;
  const savedState = isNewRound ? readRoundState(roundKey) : null;
  const savedPano = typeof savedState?.pano === 'string' && savedState.pano ? savedState.pano : null;
  const savedPov = isValidPov(savedState?.pov) ? { heading: Number(savedState.pov.heading), pitch: Number(savedState.pov.pitch) } : null;
  const targetPano = isNewRound ? (savedPano || duel.value.current.panoId) : undefined;

  const options = {
    visible: true,
    zoom: 1,
    addressControl: false,
    showRoadLabels: false,
    fullscreenControl: false,
    disableDefaultUI: true,
    clickToGo: duel.value.mode === 'moving',
    linksControl: duel.value.mode === 'moving',
    keyboardShortcuts: duel.value.mode === 'moving',
    scrollwheel: duel.value.mode !== 'nmpz',
    disableDoubleClickZoom: duel.value.mode === 'nmpz',
    motionTracking: false,
    motionTrackingControl: false
  };
  if (targetPano) options.pano = targetPano;
  if (isNewRound) options.pov = savedPov || { heading: 0, pitch: 0 };

  if (!streetView) streetView = new google.maps.StreetViewPanorama(el, { ...options, pano: targetPano || duel.value.current.panoId });
  else streetView.setOptions(options);

  if (isNewRound) {
    streetRoundKey = roundKey;
    startPanoId.value = savedState?.startPanoId || duel.value.current.panoId;
    if (Array.isArray(savedState?.moveHistory) && savedState.moveHistory.length) {
      moveHistory.value = savedState.moveHistory.filter(Boolean).slice(-80);
      const maxIndex = moveHistory.value.length - 1;
      const savedIndex = Number.isInteger(savedState.currentHistoryIndex) ? savedState.currentHistoryIndex : moveHistory.value.indexOf(savedPano);
      currentHistoryIndex.value = Math.min(Math.max(savedIndex >= 0 ? savedIndex : maxIndex, 0), maxIndex);
    } else {
      moveHistory.value = [targetPano || duel.value.current.panoId];
      currentHistoryIndex.value = 0;
    }
  }

  setupDynamicCompass();
  updateCompass(streetView.getPov()?.heading || 0);
  if (povListener) povListener.remove();
  povListener = streetView.addListener('pov_changed', () => {
    updateCompass(streetView.getPov()?.heading || 0);
    schedulePersistRoundState();
  });

  if (panoListener) panoListener.remove();
  panoListener = streetView.addListener('pano_changed', handlePanoChanged);

  if (statusListener) statusListener.remove();
  statusListener = streetView.addListener('status_changed', () => {
    const status = streetView.getStatus?.();
    if (status === google.maps.StreetViewStatus.OK || status === 'OK') {
      clearRoundLoadWarning(roundKey);
      schedulePersistRoundState();
    } else if (roundLoadWarningKey === roundKey && dismissedRoundLoadWarningKey !== roundKey) {
      roundLoadWarningVisible.value = true;
    }
  });

  const currentStatus = streetView.getStatus?.();
  if (currentStatus === google.maps.StreetViewStatus.OK || currentStatus === 'OK') clearRoundLoadWarning(roundKey);
  schedulePersistRoundState();
};

const renderGuessMap = async () => {
  await loader.load();
  const el = document.getElementById('duel-guess-map');
  if (!el) return;

  if (!guessMap) {
    guessMap = new google.maps.Map(el, {
      center: DEFAULT_GUESS_MAP_VIEW.center,
      zoom: DEFAULT_GUESS_MAP_VIEW.zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      restriction: {
        latLngBounds: { north: 85, south: -85, west: -180, east: 180 },
        strictBounds: true
      }
    });
    guessClickListener = guessMap.addListener('click', (e) => {
      if (!duel.value?.current?.canGuess || submitting.value) return;
      currentGuess.value = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      upsertGuessMarker();
      schedulePersistRoundState();
    });
  }

  google.maps.event.trigger(guessMap, 'resize');
  const roundKey = `${duel.value.id}:${duel.value.currentRound}`;
  if (guessMapRoundKey !== roundKey) {
    guessMapRoundKey = roundKey;
    autoSubmitKey = null;
    currentGuess.value = null;
    mapExpanded.value = false;
    resetGuessMapView();
    if (guessMarkerOverlay) guessMarkerOverlay.setMap(null);
    guessMarkerOverlay = null;

    const savedState = readRoundState(roundKey);
    if (isValidPoint(savedState?.guess)) {
      currentGuess.value = { lat: Number(savedState.guess.lat), lng: Number(savedState.guess.lng) };
    }
  }

  const serverGuess = duel.value?.current?.myGuess;
  if (!currentGuess.value && serverGuess?.guessed && serverGuess.lat !== undefined && serverGuess.lng !== undefined) {
    currentGuess.value = { lat: serverGuess.lat, lng: serverGuess.lng };
  }
  upsertGuessMarker();
};

const upsertGuessMarker = () => {
  if (!guessMap || !currentGuess.value) return;
  if (guessMarkerOverlay) guessMarkerOverlay.setMap(null);
  const element = createPlayerMarkerElement(duel.value.players.me, PLAYER_TONES.me, t('duels.you'), true);
  guessMarkerOverlay = createHtmlOverlay(google, currentGuess.value, element, guessMap, { zIndex: 1000 });
};

const clearResultMap = () => {
  resultOverlays.forEach(overlay => overlay.setMap(null));
  resultOverlays = [];
  resultPolylines.forEach(line => line.setMap(null));
  resultPolylines = [];
};

const renderResultMap = async () => {
  const result = currentResult.value;
  if (!result?.actual) return;

  await loader.load();
  const el = document.getElementById('duel-result-map');
  if (!el) return;

  if (!resultMap) {
    resultMap = new google.maps.Map(el, {
      center: result.actual,
      zoom: 2,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      restriction: {
        latLngBounds: { north: 85, south: -85, west: -180, east: 180 },
        strictBounds: true
      }
    });
  }

  google.maps.event.trigger(resultMap, 'resize');
  clearResultMap();

  const bounds = new google.maps.LatLngBounds();
  const actual = new google.maps.LatLng(result.actual.lat, result.actual.lng);
  bounds.extend(actual);
  resultOverlays.push(createHtmlOverlay(google, actual, createFlagMarkerElement(t('duels.target'), PLAYER_TONES.target), resultMap, { zIndex: 3000, transform: 'translate(-28%, -88%)' }));

  ['player1', 'player2'].forEach((slot) => {
    const guess = result[slot];
    if (!guess?.guessed) return;
    const position = new google.maps.LatLng(guess.lat, guess.lng);
    const tone = slotTone(slot);
    bounds.extend(position);
    resultOverlays.push(createHtmlOverlay(
      google,
      position,
      createPlayerMarkerElement(duel.value.players[slot], tone, slotLabel(slot)),
      resultMap,
      { zIndex: 2500 }
    ));
    drawDistanceLine(actual, position, guess.distanceMeters, tone.color, slotLabel(slot));
  });

  if (!bounds.isEmpty()) {
    resultMap.fitBounds(bounds, { top: 140, right: 120, bottom: 220, left: 120 });
    const listener = resultMap.addListener('idle', () => {
      if (resultMap.getZoom() > 15) resultMap.setZoom(15);
      google.maps.event.removeListener(listener);
    });
  }
};

const drawDistanceLine = (actual, guess, meters, color, label) => {
  const [halo, line] = drawStyledDistanceLine({ google, map: resultMap, from: actual, to: guess, color, zIndex: 10 });
  resultPolylines.push(halo, line);

  const midpoint = straightMidpoint(google, actual, guess);
  resultOverlays.push(createHtmlOverlay(
    google,
    midpoint,
    createDistanceLabelElement(`${label} · ${formatDistance(meters)}`, color),
    resultMap,
    { zIndex: 3500, pane: 'floatPane' }
  ));
};

const submitGuess = async () => {
  if (!canSubmit.value) return;
  submitting.value = true;
  try {
    await api.post(`/duels/${duel.value.id}/guess`, currentGuess.value);
    await fetchDuel();
  } catch (err) {
    Swal.fire('Error', err.response?.data?.error || 'Failed to submit guess', 'error');
    await fetchDuel();
  } finally {
    submitting.value = false;
  }
};

const maybeAutoSubmitOnDeadline = () => {
  if (!duel.value || duel.value.status !== 'playing' || duel.value.current?.meGuessed || submitting.value) return;
  if (!forceDeadlineMs.value || forceRemainingMs.value > 350 || !currentGuess.value) return;
  const key = `${duel.value.id}:${duel.value.currentRound}`;
  if (autoSubmitKey === key) return;
  autoSubmitKey = key;
  submitGuess();
};

const forfeit = async () => {
  const result = await Swal.fire({
    title: t('duels.forfeitConfirmTitle'),
    text: t('duels.forfeitConfirmText'),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: t('duels.forfeit'),
    cancelButtonText: t('common.cancel')
  });
  if (!result.isConfirmed) return;

  submitting.value = true;
  try {
    await api.post(`/duels/${duel.value.id}/forfeit`);
    await fetchDuel();
  } finally {
    submitting.value = false;
  }
};

const getRoundScore = (round, perspective) => {
  const mine = duel.value?.isPlayer1 ? round.player1 : round.player2;
  const opponent = duel.value?.isPlayer1 ? round.player2 : round.player1;
  return perspective === 'me' ? (mine.score || 0) : (opponent.score || 0);
};

const historyTone = (round) => {
  const mine = getRoundScore(round, 'me');
  const opponent = getRoundScore(round, 'opponent');
  if (mine > opponent) return 'win';
  if (mine < opponent) return 'loss';
  return 'draw';
};

const handlePanoChanged = () => {
  if (!streetView) return;
  const newPano = streetView.getPano();
  if (!newPano || moveHistory.value[currentHistoryIndex.value] === newPano) return;

  if (isNavigatingHistory) {
    isNavigatingHistory = false;
    schedulePersistRoundState();
    return;
  }

  if (currentHistoryIndex.value < moveHistory.value.length - 1) {
    moveHistory.value = moveHistory.value.slice(0, currentHistoryIndex.value + 1);
  }

  moveHistory.value.push(newPano);
  currentHistoryIndex.value += 1;
  schedulePersistRoundState();
};

const undoMove = () => {
  if (!streetView || currentHistoryIndex.value <= 0) return;
  isNavigatingHistory = true;
  currentHistoryIndex.value -= 1;
  streetView.setPano(moveHistory.value[currentHistoryIndex.value]);
  schedulePersistRoundState();
};

const redoMove = () => {
  if (!streetView || currentHistoryIndex.value >= moveHistory.value.length - 1) return;
  isNavigatingHistory = true;
  currentHistoryIndex.value += 1;
  streetView.setPano(moveHistory.value[currentHistoryIndex.value]);
  schedulePersistRoundState();
};

const returnToStart = () => {
  if (streetView && startPanoId.value) {
    streetView.setPano(startPanoId.value);
    schedulePersistRoundState();
  }
};

const setupDynamicCompass = () => {
  const strip = document.getElementById('duel-compass-strip');
  if (!strip || strip.dataset.ready === '1') return;

  strip.innerHTML = '';
  strip.dataset.ready = '1';
  const pixelsPerDegree = 4;
  const directions = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

  for (let i = -360; i < 720; i += 1) {
    const leftPos = (i * pixelsPerDegree) + (360 * pixelsPerDegree);
    const key = ((i % 360) + 360) % 360;

    if (Object.prototype.hasOwnProperty.call(directions, key)) {
      const label = document.createElement('span');
      label.className = `compass-label${key % 90 === 0 ? ' major' : ''}`;
      label.textContent = directions[key];
      label.style.left = `${leftPos}px`;
      strip.appendChild(label);
    } else if (i % 10 === 0) {
      const tick = document.createElement('div');
      tick.className = 'compass-tick';
      tick.style.left = `${leftPos}px`;
      strip.appendChild(tick);
    }
  }
};

const updateCompass = (heading) => {
  const strip = document.getElementById('duel-compass-strip');
  const container = document.getElementById('duel-compass-container');
  if (!strip || !container) return;

  const pixelsPerDegree = 4;
  const offset = (((heading || 0) + 360) * pixelsPerDegree) - (container.offsetWidth / 2);
  strip.style.transform = `translateX(${-offset}px)`;
};

const toggleFullscreen = async () => {
  isFullscreen.value = !isFullscreen.value;
  try {
    if (isFullscreen.value && shellRef.value?.requestFullscreen && !document.fullscreenElement) {
      await shellRef.value.requestFullscreen();
    } else if (!isFullscreen.value && document.fullscreenElement) {
      await document.exitFullscreen();
    }
  } catch (err) {
    // CSS fullscreen still works when the browser fullscreen request is blocked.
  }
  setTimeout(resizeMaps, 120);
};

const onFullscreenChange = () => {
  if (!document.fullscreenElement && isFullscreen.value) isFullscreen.value = false;
  setTimeout(resizeMaps, 120);
};

const resizeMaps = () => {
  if (guessMap) google.maps.event.trigger(guessMap, 'resize');
  if (resultMap) google.maps.event.trigger(resultMap, 'resize');
};

watch(() => [duel.value?.status, duel.value?.currentRound, duel.value?.current?.forceGuessDeadlineAt, duel.value?.current?.resultDeadlineAt], renderForState);
watch(mapExpanded, () => setTimeout(resizeMaps, 150));

onMounted(async () => {
  armInitialLoadWarning();
  window.addEventListener('keydown', handleKeydown, true);
  window.addEventListener(PREFERENCES_CHANGED_EVENT, syncPreferences);
  clockTimer = setInterval(() => {
    clockNow.value = Date.now();
    maybeAutoSubmitOnDeadline();
  }, 250);
  document.addEventListener('fullscreenchange', onFullscreenChange);

  try {
    socket = connectSocket();
    socket.emit('duel:join', { duelId: route.params.id });
    socket.on('duel:state', async (payload) => {
      if (String(payload.id) !== String(route.params.id)) return;
      updateServerClock(payload);
      duel.value = payload;
      await renderForState();
    });
    socket.on('duel:updated', fetchDuel);
    await fetchDuel();
  } finally {
    loading.value = false;
    clearInitialLoadWarning();
  }
});

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
  if (persistRoundStateTimer) window.clearTimeout(persistRoundStateTimer);
  clearRoundLoadWarning();
  clearInitialLoadWarning();
  window.removeEventListener('keydown', handleKeydown, true);
  window.removeEventListener(PREFERENCES_CHANGED_EVENT, syncPreferences);
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  if (socket) {
    socket.emit('duel:leave', { duelId: route.params.id });
    socket.off('duel:state');
    socket.off('duel:updated', fetchDuel);
  }
  if (guessClickListener) guessClickListener.remove();
  if (panoListener) panoListener.remove();
  if (povListener) povListener.remove();
  if (statusListener) statusListener.remove();
  if (guessMarkerOverlay) guessMarkerOverlay.setMap(null);
  clearResultMap();
});
</script>

<style scoped>
.center-state { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; color: var(--color-text-muted); }
.load-warning-inline { display: inline-flex; align-items: center; gap: .55rem; max-width: min(560px, calc(100vw - 32px)); padding: .6rem .8rem; border-radius: 999px; background: rgba(15,23,42,.84); color: #fff; border: 1px solid rgba(255,255,255,.16); box-shadow: 0 16px 42px rgba(0,0,0,.18); font-weight: 800; font-size: .86rem; }
.load-warning-inline button { border: 1px solid rgba(255,255,255,.28); background: rgba(255,255,255,.12); color: #fff; border-radius: 999px; padding: .32rem .6rem; font-weight: 900; cursor: pointer; }
.load-warning-inline .warning-close-btn, .load-warning-toast .warning-close-btn { width: 28px; height: 28px; padding: 0; display: grid; place-items: center; border-radius: 999px; }
.small-btn { width: auto; }
.duel-shell { height: 100%; min-height: 0; background: #0b1020; color: #fff; overflow: hidden; position: relative; }
.duel-shell.fullscreen { position: fixed; inset: 0; z-index: 9999; height: 100vh; width: 100vw; }
.duel-game-screen, .street-stage, .result-stage { position: relative; width: 100%; height: 100%; min-height: 0; overflow: hidden; }
.street-view, .result-map-full { position: absolute; inset: 0; width: 100%; height: 100%; }
.street-view.frozen { pointer-events: none; }

.round-pill, .timer-display, .waiting-status, .result-topbar, .round-summary-card, .map-legend, .utility-btn, .round-history-strip, .player-hud {
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.round-pill { position: absolute; top: 18px; left: 50%; transform: translateX(-50%); z-index: 20; min-width: min(420px, calc(100vw - 32px)); background: rgba(3, 7, 18, .72); border: 1px solid rgba(255,255,255,.16); border-radius: 999px; padding: .72rem 1.05rem; display: flex; justify-content: center; align-items: center; gap: .75rem; box-shadow: 0 16px 48px rgba(0,0,0,.24); }
.round-pill strong { font-weight: 900; }
.round-pill span { opacity: .78; font-size: .88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.player-hud { position: absolute; top: 82px; z-index: 20; min-width: 230px; display: flex; align-items: center; gap: .75rem; background: rgba(255,255,255,.94); color: #111827; border: 1px solid rgba(255,255,255,.7); border-left: 5px solid var(--tone); border-radius: 18px; padding: .65rem .8rem; box-shadow: 0 18px 50px rgba(0,0,0,.22); }
.player-hud-left { left: 18px; }
.player-hud-right { right: 18px; justify-content: flex-end; text-align: right; border-left: 1px solid rgba(255,255,255,.7); border-right: 5px solid var(--tone); }
.player-hud small, .player-hud em { display: block; color: #64748b; font-size: .75rem; font-style: normal; }
.player-hud strong { display: block; max-width: 140px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.hud-avatar-wrap { width: 42px; height: 42px; flex: 0 0 auto; border-radius: 999px; border: 3px solid var(--tone); background: var(--tone-soft); display: grid; place-items: center; overflow: hidden; font-weight: 900; color: var(--tone); }
.hud-avatar-wrap img { width: 100%; height: 100%; object-fit: cover; }
.hud-check { color: var(--tone); margin-left: auto; }
.right-check { margin-left: 0; margin-right: auto; }

.timer-display, .waiting-status { position: absolute; top: 113px; left: 50%; transform: translate(-50%, -50%); z-index: 22; display: inline-flex; align-items: center; gap: .55rem; background: rgba(251, 191, 36, .96); color: #422006; border-radius: 999px; padding: .7rem 1rem; font-weight: 900; box-shadow: 0 16px 42px rgba(0,0,0,.26); }
.timer-display.urgent { background: rgba(239, 68, 68, .96); color: #fff; animation: duel-pulse .9s ease-in-out infinite; }
.waiting-status { background: rgba(22, 163, 74, .92); color: #fff; }
@keyframes duel-pulse { 0%, 100% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -50%) scale(1.035); } }

.load-warning-toast { position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%); z-index: 32; max-width: min(520px, calc(100% - 32px)); display: inline-flex; align-items: center; gap: .55rem; background: rgba(15,23,42,.82); color: #fff; border: 1px solid rgba(255,255,255,.18); border-radius: 999px; padding: .55rem .75rem; box-shadow: 0 16px 42px rgba(0,0,0,.25); font-weight: 800; font-size: .86rem; pointer-events: auto; }
.load-warning-toast span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.load-warning-toast button { border: 1px solid rgba(255,255,255,.28); background: rgba(255,255,255,.12); color: #fff; border-radius: 999px; padding: .32rem .6rem; font-weight: 900; cursor: pointer; flex: 0 0 auto; }

.map-overlay { position: absolute; right: 20px; bottom: 22px; z-index: 24; width: min(calc(100% - 40px), clamp(300px, 32%, 380px)); height: min(calc(100% - 118px), clamp(224px, 30%, 300px)); background: rgba(255,255,255,.96); color: #111827; border: 1px solid rgba(255,255,255,.72); border-radius: 18px; padding: .72rem; display: flex; flex-direction: column; gap: .6rem; box-shadow: 0 24px 70px rgba(0,0,0,.32); opacity: .92; transition: width .26s ease, height .26s ease, opacity .2s ease, transform .2s ease; }
.map-overlay.expanded { width: min(calc(100% - 40px), clamp(460px, 72%, 920px)); height: min(calc(100% - 126px), clamp(330px, 66%, 620px)); opacity: 1; }
.map-overlay.locked { opacity: .84; }
.map-overlay-header { display: flex; align-items: center; justify-content: space-between; gap: .75rem; font-weight: 900; }
.map-expand-btn { width: 32px; height: 32px; border-radius: 10px; border: 1px solid #e5e7eb; background: #fff; color: #111827; cursor: pointer; }
.guess-map { flex: 1; min-height: 0; border-radius: 12px; overflow: hidden; background: #e5e7eb; border: 1px solid #e5e7eb; }
.guess-btn { min-height: 44px; flex-shrink: 0; font-weight: 900; display: inline-flex; align-items: center; justify-content: center; gap: .5rem; }
.hotkey-pill { border: 1px solid rgba(255,255,255,.45); background: rgba(255,255,255,.18); color: inherit; border-radius: 6px; padding: 1px 6px; font-size: .72rem; font-weight: 900; line-height: 1.2; }

.game-controls { position: absolute; left: 20px; bottom: 24px; z-index: 24; display: flex; gap: .6rem; }
.control-btn, .utility-btn { border: 1px solid rgba(255,255,255,.22); background: rgba(15,23,42,.72); color: #fff; cursor: pointer; box-shadow: 0 12px 36px rgba(0,0,0,.25); }
.control-btn { width: 44px; height: 44px; border-radius: 999px; display: grid; place-items: center; font-size: 1rem; }
.control-btn:disabled { opacity: .45; cursor: not-allowed; }
.utility-actions { position: absolute; top: 18px; right: 18px; z-index: 30; display: flex; gap: .55rem; }
.utility-btn { min-height: 38px; border-radius: 999px; padding: .45rem .75rem; display: inline-flex; align-items: center; gap: .45rem; font-weight: 800; }
.utility-btn.danger { color: #fecaca; }
.utility-btn:disabled { opacity: .45; cursor: not-allowed; }

.compass-container { position: absolute; top: 18px; left: 18px; width: 290px; height: 38px; z-index: 21; background: rgba(3,7,18,.72); border: 1px solid rgba(255,255,255,.16); border-radius: 12px; overflow: hidden; box-shadow: 0 12px 34px rgba(0,0,0,.24); }
.compass-marker { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 11px solid #f87171; z-index: 2; }
.compass-strip { position: absolute; inset: 0 auto 0 0; height: 100%; display: flex; align-items: center; will-change: transform; }
:global(.compass-label) { position: absolute; top: 50%; transform: translate(-50%, -50%); color: rgba(255,255,255,.82); font-weight: 800; font-size: .78rem; white-space: nowrap; text-shadow: 0 1px 3px rgba(0,0,0,.8); }
:global(.compass-label.major) { color: #fff; font-size: 1rem; }
:global(.compass-tick) { position: absolute; top: 50%; transform: translateY(-50%); width: 1px; height: 10px; background: rgba(255,255,255,.7); }

.result-stage { background: #e5e7eb; }
.result-map-full { z-index: 1; }
.result-topbar { position: absolute; top: 18px; left: 50%; transform: translateX(-50%); z-index: 20; min-width: min(560px, calc(100vw - 32px)); background: rgba(255,255,255,.96); color: #111827; border: 1px solid rgba(255,255,255,.8); border-radius: 999px; padding: .75rem 1rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; box-shadow: 0 18px 55px rgba(15,23,42,.18); }
.result-topbar strong, .result-topbar span { display: block; }
.result-topbar span { color: #64748b; font-size: .8rem; }
.result-countdown { display: inline-flex; align-items: center; gap: .45rem; font-weight: 900; color: #16a34a; white-space: nowrap; }
.map-legend { position: absolute; left: 20px; top: 92px; z-index: 20; background: rgba(255,255,255,.94); color: #111827; border-radius: 16px; padding: .75rem .9rem; display: grid; gap: .45rem; font-weight: 800; font-size: .85rem; box-shadow: 0 14px 38px rgba(15,23,42,.18); }
.legend-dot { display: inline-block; width: 12px; height: 12px; border-radius: 999px; margin-right: .5rem; vertical-align: -1px; }
.legend-dot.target { background: #16a34a; border-radius: 3px; }
.legend-dot.me { background: #2563eb; }
.legend-dot.opponent { background: #ef4444; }
.round-summary-card { position: absolute; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 20; width: min(760px, calc(100vw - 32px)); background: rgba(255,255,255,.97); color: #111827; border-radius: 24px; padding: 1rem; box-shadow: 0 22px 70px rgba(15,23,42,.24); border: 1px solid rgba(255,255,255,.82); }
.summary-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding-bottom: .75rem; margin-bottom: .75rem; }
.summary-head span { color: #64748b; font-weight: 800; text-transform: uppercase; font-size: .78rem; letter-spacing: .08em; }
.summary-head strong { font-size: 2rem; }
.positive { color: #16a34a; }
.negative { color: #ef4444; }
.summary-grid { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: .7rem; }
.summary-grid div, .final-score-grid div { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 16px; padding: .85rem; }
.summary-grid span, .final-score-grid span { display: block; color: #64748b; font-size: .78rem; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
.summary-grid strong, .final-score-grid strong { display: block; font-size: 1.35rem; margin-top: .15rem; }
.summary-grid em { display: block; font-style: normal; color: #64748b; font-weight: 700; margin-top: .15rem; }

.round-history-strip { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); z-index: 19; display: flex; gap: .4rem; pointer-events: none; }
.show-result .round-history-strip { bottom: 220px; }
.history-dot { min-width: 58px; border-radius: 999px; padding: .32rem .52rem; background: rgba(15,23,42,.68); border: 1px solid rgba(255,255,255,.16); color: #fff; display: flex; gap: .3rem; align-items: center; justify-content: center; font-size: .78rem; }
.history-dot.win { background: rgba(22,163,74,.82); }
.history-dot.loss { background: rgba(239,68,68,.82); }
.history-dot.draw { background: rgba(100,116,139,.82); }

.final-screen { height: 100%; display: grid; place-items: center; padding: 1.5rem; background: radial-gradient(circle at top, rgba(79,70,229,.28), transparent 35%), #0b1020; }
.final-card { width: min(620px, 100%); background: rgba(255,255,255,.97); color: #111827; border-radius: 28px; padding: 2rem; text-align: center; box-shadow: 0 24px 80px rgba(0,0,0,.28); border: 1px solid rgba(255,255,255,.55); }
.final-icon { width: 76px; height: 76px; border-radius: 999px; margin: 0 auto 1rem; display: grid; place-items: center; font-size: 2rem; }
.final-icon.win { background: #dcfce7; color: #16a34a; }
.final-icon.loss { background: #fee2e2; color: #ef4444; }
.final-icon.draw { background: #e0e7ff; color: #4f46e5; }
.eyebrow { margin: 0 0 .35rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
.final-versus { display: inline-flex; align-items: baseline; justify-content: center; gap: .75rem; flex-wrap: wrap; margin-bottom: .6rem; color: #111827; font-size: clamp(.95rem, 2.3vw, 1.35rem); }
.final-versus strong { max-width: min(260px, 42vw); overflow-wrap: anywhere; line-height: 1.08; }
.final-versus span { color: #64748b; font-size: 1.35em; font-weight: 950; text-transform: uppercase; letter-spacing: .08em; }
.final-card h1 { font-size: clamp(2rem, 6vw, 3.4rem); margin: 0 0 .5rem; }
.final-score-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .75rem; margin: 1.25rem 0; text-align: left; }
.rating-delta-tile { text-align: center; }
.final-score-grid .rating-delta-value { font-size: 2.25rem; line-height: 1; letter-spacing: -0.04em; }
.final-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
.secondary-btn { border: 1px solid #e5e7eb; background: #fff; color: #111827; border-radius: var(--radius); padding: .65rem 1rem; font-weight: 900; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; width: 100%; }

:global(.duel-avatar-marker) { width: 52px; height: 52px; border-radius: 999px; border: 4px solid var(--marker-color); background: #fff; box-shadow: 0 10px 28px rgba(0,0,0,.3), 0 0 0 3px rgba(255,255,255,.95); overflow: hidden; display: grid; place-items: center; color: var(--marker-color); font-weight: 950; font-size: 1.05rem; }
:global(.duel-avatar-marker.compact) { width: 46px; height: 46px; }
:global(.duel-avatar-marker img) { width: 100%; height: 100%; object-fit: cover; }
:global(.duel-avatar-marker span) { width: 100%; height: 100%; display: grid; place-items: center; background: #f8fafc; }
:global(.duel-flag-marker) { width: 48px; height: 48px; display: grid; place-items: center; color: #fff; background: var(--marker-color); border: 3px solid #fff; border-radius: 16px 16px 16px 4px; box-shadow: 0 12px 28px rgba(0,0,0,.32); font-size: 1.35rem; }
:global(.duel-distance-label) { background: #fff; color: #111827; border: 2px solid var(--marker-color); box-shadow: 0 12px 32px rgba(15,23,42,.22); border-radius: 999px; padding: .35rem .65rem; font-weight: 950; white-space: nowrap; font-size: .82rem; }

@media (max-width: 980px) {
  .player-hud { top: 76px; min-width: 0; max-width: 42vw; }
  .player-hud strong { max-width: 95px; }
  .compass-container { width: 220px; }
  .map-overlay.expanded { width: calc(100% - 40px); height: min(calc(100% - 126px), 58%); }
  .summary-grid, .final-score-grid { grid-template-columns: 1fr; }
}

@media (max-width: 680px), (max-height: 620px) {
  .round-pill { top: 10px; min-width: 0; width: calc(100vw - 112px); padding: .55rem .75rem; justify-content: flex-start; }
  .round-pill span { display: none; }
  .utility-actions { top: 10px; right: 10px; }
  .utility-btn span { display: none; }
  .compass-container { top: 58px; left: 10px; width: 180px; height: 34px; }
  .player-hud { top: 100px; padding: .5rem; border-radius: 14px; }
  .player-hud-left { left: 10px; }
  .player-hud-right { right: 10px; }
  .hud-avatar-wrap { width: 34px; height: 34px; border-width: 2px; }
  .player-hud small, .player-hud em, .player-hud .hud-check { display: none; }
  .player-hud strong { max-width: 88px; font-size: .86rem; }
  .timer-display, .waiting-status { top: 121px; max-width: calc(100vw - 24px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .load-warning-toast { bottom: 78px; max-width: calc(100vw - 20px); }
  .load-warning-toast span { max-width: 56vw; }
  .map-overlay { right: 10px; bottom: 10px; width: min(300px, calc(100vw - 20px)); height: min(220px, calc(100% - 154px)); }
  .map-overlay.expanded { width: calc(100vw - 20px); height: min(54vh, calc(100% - 154px)); }
  .game-controls { left: 10px; bottom: 10px; }
  .control-btn { width: 38px; height: 38px; }
  .result-topbar { top: 10px; border-radius: 18px; align-items: flex-start; }
  .map-legend { display: none; }
  .round-summary-card { bottom: 10px; width: calc(100vw - 20px); max-height: 46vh; overflow-y: auto; border-radius: 18px; }
  .round-history-strip { display: none; }
  .final-card { padding: 1.25rem; border-radius: 20px; }
  .final-actions { grid-template-columns: 1fr; }
}
</style>
