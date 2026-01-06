<template>
  <DashboardLayout page="singleplayer">
    <div class="game-container">
      
      <!-- SETUP PHASE -->
      <div v-if="gameState === 'setup'" class="setup-screen">
        <div class="setup-header">
          <h2>{{ t('singleplayer.setup_title') }}</h2>
          <p>{{ t('singleplayer.setup_desc') }}</p>
        </div>

        <!-- Mode Selection -->
        <div class="mode-selection">
          <h3>{{ t('singleplayer.select_mode') }}</h3>
          <div class="mode-options">
            <div 
              class="mode-card" 
              :class="{ selected: selectedMode === 'moving' }"
              @click="selectedMode = 'moving'"
            >
              <i class="fa-solid fa-person-walking"></i>
              <span>Moving</span>
            </div>
            <div 
              class="mode-card" 
              :class="{ selected: selectedMode === 'nm' }"
              @click="selectedMode = 'nm'"
            >
              <i class="fa-solid fa-ban"></i>
              <span>NM</span>
            </div>
            <div 
              class="mode-card" 
              :class="{ selected: selectedMode === 'nmpz' }"
              @click="selectedMode = 'nmpz'"
            >
              <i class="fa-solid fa-lock"></i>
              <span>NMPZ</span>
            </div>
          </div>
        </div>

        <div class="map-selection">
          <!-- Custom Maps -->
          <div 
            v-for="map in maps" 
            :key="map.id"
            class="map-option"
            :class="{ selected: selectedMapId === map.id }"
            @click="selectedMapId = map.id"
          >
            <div class="map-icon"><i class="fa-solid fa-map"></i></div>
            <div class="map-info">
              <h3>{{ map.name }}</h3>
              <p>{{ map.description || t('maps.no_desc') }}</p>
              <span v-if="map.is_official" class="badge official">Official</span>
            </div>
          </div>
        </div>

        <div class="setup-actions">
          <button @click="startGame" class="primary-btn start-btn" :disabled="!selectedMapId || loading">
            {{ t('singleplayer.start_game') }}
          </button>
        </div>
      </div>

      <!-- GAME PHASE -->
      <div v-else-if="gameState === 'playing'" class="game-screen">
        <div id="street-view" class="street-view" :class="{ 'no-interaction': selectedMode === 'nmpz' }"></div>
        
        <!-- Compass -->
        <div id="compass-container">
          <div id="compass-strip"></div>
          <div id="compass-marker"></div>
        </div>

        <!-- Map Overlay -->
        <div 
          class="map-overlay" 
          :class="{ 'expanded': mapExpanded }"
          @mouseenter="mapExpanded = true"
          @mouseleave="mapExpanded = false"
          @click="mapExpanded = true"
        >
          <div id="guess-map" class="guess-map"></div>
          <button 
            class="guess-btn primary-btn" 
            :disabled="!currentGuess"
            @click.stop="submitGuess"
          >
            {{ t('singleplayer.guess') }}
          </button>
        </div>

        <!-- Round Info -->
        <div class="round-info">
          <span>{{ t('singleplayer.round') }} {{ round }} / 5</span>
          <span>{{ t('singleplayer.score') }}: {{ totalScore }}</span>
        </div>

        <!-- Game Controls -->
        <div class="game-controls" v-if="selectedMode === 'moving'">
          <button class="control-btn" @click="undoMove" :disabled="currentHistoryIndex <= 0" title="Undo">
            <i class="fa-solid fa-rotate-left"></i>
          </button>
          <button class="control-btn" @click="returnToStart" title="Back to Start">
            <i class="fa-solid fa-flag"></i>
          </button>
          <button class="control-btn" @click="redoMove" :disabled="currentHistoryIndex >= moveHistory.length - 1" title="Redo">
            <i class="fa-solid fa-rotate-right"></i>
          </button>
        </div>
      </div>

      <!-- RESULT PHASE -->
      <div v-else-if="gameState === 'result'" class="result-screen">
        <div class="result-header">
          <div class="result-stat">
            <span class="label">{{ t('singleplayer.distance') }}</span>
            <span class="value">{{ lastDistance }}</span>
          </div>
          <div class="result-stat">
            <span class="label">{{ t('singleplayer.score') }}</span>
            <span class="value">{{ lastScore }}</span>
          </div>
        </div>
        
        <div id="result-map" class="result-map"></div>

        <div class="result-actions">
          <button @click="nextRound" class="primary-btn next-btn">
            {{ round < 5 ? t('singleplayer.next_round') : t('singleplayer.summary') }}
          </button>
          <div class="space-hint">{{ t('singleplayer.press_space') }}</div>
        </div>
      </div>

      <!-- SUMMARY PHASE -->
      <div v-else-if="gameState === 'summary'" class="summary-screen">
        <div class="summary-card">
          <h2>{{ t('singleplayer.game_over') }}</h2>
          
          <div class="final-score-container">
            <div class="rank-badge" :style="{ backgroundColor: gameRank.color }">
              {{ gameRank.title }}
            </div>
            <span class="label">{{ t('singleplayer.total_score') }}</span>
            <span class="value" :style="{ color: gameRank.color }">{{ totalScore }}</span>
            <div class="score-bar">
              <div class="score-fill" :style="{ width: (totalScore / 25000 * 100) + '%', backgroundColor: gameRank.color }"></div>
            </div>
          </div>

          <div class="summary-actions">
            <button @click="resetGame" class="primary-btn play-btn">
              {{ t('singleplayer.play_again') }}
            </button>
            <button @click="router.push('/lobby')" class="primary-btn" style="background-color: var(--color-surface); color: var(--color-text-main); border: 1px solid var(--color-border);">
              {{ t('singleplayer.back_to_lobby') }}
            </button>
          </div>
        </div>
      </div>

    </div>
  </DashboardLayout>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Loader } from '@googlemaps/js-api-loader';
import { api } from '../auth';
import DashboardLayout from '../components/DashboardLayout.vue';
import Swal from 'sweetalert2';

const { t } = useI18n();
const router = useRouter();

// State
const gameState = ref('setup'); // setup, playing, result, summary
const maps = ref([]);
const selectedMapId = ref(null);
const selectedMode = ref('moving'); // moving, nm, nmpz
const gameId = ref(null);
const round = ref(1);
const totalScore = ref(0);
const lastScore = ref(0);
const lastDistance = ref(0);
const mapExpanded = ref(false);
const currentGuess = ref(null);
const loading = ref(false);

// History State
const moveHistory = ref([]);
const currentHistoryIndex = ref(-1);
const startPanoId = ref(null);
let isNavigatingHistory = false;

// Google Maps Objects
let streetView = null;
let guessMap = null;
let resultMap = null;
let guessMarker = null;
let resultMarkers = [];
let resultLine = null;

// API Loader
const loader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  version: "weekly",
  libraries: ["geometry"]
});

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown, true);
  await checkActiveGame();
  await fetchMaps();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown, true);
});

const handleKeydown = (e) => {
  // Playing state: Space to submit guess
  if ((e.code === 'Space' || e.key === ' ') && gameState.value === 'playing' && currentGuess.value && !loading.value) {
    e.preventDefault();
    e.stopPropagation();
    submitGuess();
  }
  // Result state: Space to next round
  else if ((e.code === 'Space' || e.key === ' ') && gameState.value === 'result') {
    e.preventDefault();
    e.stopPropagation();
    nextRound();
  }
};

const checkActiveGame = async () => {
  try {
    const res = await api.get('/games/active');
    if (res.data) {
      const game = res.data;
      gameId.value = game.gameId;
      round.value = game.round;
      totalScore.value = game.totalScore;
      selectedMode.value = game.mode;
      
      gameState.value = 'playing';
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: t('singleplayer.resumed'),
        showConfirmButton: false,
        timer: 3000
      });
      
      await startRound(game.panoId);
    }
  } catch (err) {
    console.error("Failed to check active game", err);
  }
};

const fetchMaps = async () => {
  try {
    const res = await api.get('/maps?is_singleplayer=true');
    maps.value = res.data;
  } catch (err) {
    console.error(err);
  }
};

const startGame = async () => {
  loading.value = true;
  try {
    const res = await api.post('/games/start', {
      mapId: selectedMapId.value,
      mode: selectedMode.value
    });
    
    gameId.value = res.data.gameId;
    round.value = res.data.round;
    totalScore.value = 0;
    
    gameState.value = 'playing';
    
    // Start Round 1
    await startRound(res.data.panoId);
    
  } catch (err) {
    Swal.fire('Error', err.response?.data?.error || 'Failed to start game', 'error');
  } finally {
    loading.value = false;
  }
};

const startRound = async (panoId) => {
  currentGuess.value = null;
  guessMarker = null; // Reset marker reference for new map instance
  mapExpanded.value = false;
  
  // Reset history
  moveHistory.value = [];
  currentHistoryIndex.value = -1;
  startPanoId.value = panoId;

  // Wait for DOM to update
  setTimeout(async () => {
    await initMaps(panoId);
  }, 100);
};

const initMaps = async (panoId) => {
  const google = await loader.load();
  
  // Init Street View
  const svOptions = {
    pano: panoId,
    pov: { heading: 0, pitch: 0 },
    zoom: 1,
    addressControl: false,
    showRoadLabels: false,
    fullscreenControl: false,
    disableDefaultUI: true,
    clickToGo: selectedMode.value === 'moving',
    linksControl: selectedMode.value === 'moving',
    scrollwheel: selectedMode.value !== 'nmpz',
    disableDoubleClickZoom: selectedMode.value === 'nmpz'
  };

  streetView = new google.maps.StreetViewPanorama(
    document.getElementById("street-view"),
    svOptions
  );

  // Initialize history
  moveHistory.value = [panoId];
  currentHistoryIndex.value = 0;

  streetView.addListener('pano_changed', () => {
    const newPano = streetView.getPano();
    
    // Avoid adding duplicates if the event fires for the current pano
    if (moveHistory.value[currentHistoryIndex.value] === newPano) return;

    if (isNavigatingHistory) {
      isNavigatingHistory = false;
      return;
    }

    // Truncate future history if we are in the middle
    if (currentHistoryIndex.value < moveHistory.value.length - 1) {
      moveHistory.value = moveHistory.value.slice(0, currentHistoryIndex.value + 1);
    }

    moveHistory.value.push(newPano);
    currentHistoryIndex.value++;
  });

  // Compass Init
  setupDynamicCompass();
  updateCompass(0);
  streetView.addListener('pov_changed', () => {
    updateCompass(streetView.getPov().heading);
  });

  // For NMPZ, we might need extra listeners to prevent movement if API options aren't enough
  // But standard options usually suffice.

  // Init Guess Map
  guessMap = new google.maps.Map(document.getElementById("guess-map"), {
    center: { lat: 0, lng: 0 },
    zoom: 1,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    clickableIcons: false,
    restriction: {
      latLngBounds: { north: 85, south: -85, west: -180, east: 180 },
      strictBounds: true
    }
  });

  guessMap.addListener("click", (e) => {
    placeGuessMarker(e.latLng);
  });
};

const placeGuessMarker = (latLng) => {
  currentGuess.value = latLng;
  
  const icon = {
    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
    fillColor: "#FF5252",
    fillOpacity: 1,
    strokeWeight: 2,
    strokeColor: "#FFFFFF",
    scale: 2,
    anchor: new google.maps.Point(12, 22)
  };

  if (guessMarker) {
    guessMarker.setPosition(latLng);
    guessMarker.setIcon(icon);
  } else {
    guessMarker = new google.maps.Marker({
      position: latLng,
      map: guessMap,
      icon: icon
    });
  }
};

const submitGuess = async () => {
  if (!currentGuess.value) return;
  
  loading.value = true;
  try {
    const res = await api.post(`/games/${gameId.value}/guess`, {
      round: round.value,
      lat: currentGuess.value.lat(),
      lng: currentGuess.value.lng()
    });

    const result = res.data;
    if (result.distance < 1) {
      lastDistance.value = Math.round(result.distance * 1000) + " m";
    } else {
      lastDistance.value = result.distance.toFixed(1) + " km";
    }
    lastScore.value = result.score;
    totalScore.value = result.totalScore;

    gameState.value = 'result';
    
    // Show Result Map
    setTimeout(() => {
      initResultMap(result.actual, currentGuess.value);
    }, 300); // Increased timeout to ensure DOM is ready

    // Store next round info
    if (result.nextRound) {
      nextRoundPanoId = result.nextRound.panoId;
    } else {
      nextRoundPanoId = null;
    }

  } catch (err) {
    Swal.fire('Error', err.response?.data?.error || 'Failed to submit guess', 'error');
  } finally {
    loading.value = false;
  }
};

let nextRoundPanoId = null;

const nextRound = () => {
  if (round.value < 5 && nextRoundPanoId) {
    round.value++;
    gameState.value = 'playing';
    startRound(nextRoundPanoId);
  } else {
    gameState.value = 'summary';
  }
};

// Removed handleResultKeydown as it is merged into handleKeydown

const resetGame = () => {
  gameState.value = 'setup';
  round.value = 1;
  totalScore.value = 0;
  gameId.value = null;
  currentGuess.value = null;
  guessMarker = null;
  lastDistance.value = null;
  lastScore.value = null;
  nextRoundPanoId = null;
};

const gameRank = computed(() => {
  const score = totalScore.value;
  if (score >= 24000) return { title: 'LEGEND', color: '#FFD700' };
  if (score >= 20000) return { title: 'MASTER', color: '#9C27B0' };
  if (score >= 15000) return { title: 'EXPLORER', color: '#2196F3' };
  if (score >= 5000) return { title: 'TRAVELER', color: '#4CAF50' };
  return { title: 'BEGINNER', color: '#9E9E9E' };
});

const initResultMap = async (actual, guess) => {
  const google = await loader.load();
  
  // Calculate center using interpolation
  const center = google.maps.geometry.spherical.interpolate(
    new google.maps.LatLng(actual), 
    new google.maps.LatLng(guess), 
    0.5
  );

  resultMap = new google.maps.Map(document.getElementById("result-map"), {
    center: center,
    zoom: 2,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    restriction: {
      latLngBounds: { north: 85, south: -85, west: -180, east: 180 },
      strictBounds: true
    }
  });

  // Answer Marker (Flag)
  const answerIcon = {
    path: "M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z",
    fillColor: "#4CAF50",
    fillOpacity: 1,
    strokeWeight: 2,
    strokeColor: "#FFFFFF",
    scale: 1.5,
    anchor: new google.maps.Point(5, 20)
  };

  new google.maps.Marker({
    position: actual,
    map: resultMap,
    icon: answerIcon,
    zIndex: 2
  });

  // Guess Marker (Red Pin)
  const guessIcon = {
    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
    fillColor: "#FF5252",
    fillOpacity: 1,
    strokeWeight: 2,
    strokeColor: "#FFFFFF",
    scale: 2,
    anchor: new google.maps.Point(12, 22)
  };

  new google.maps.Marker({
    position: guess,
    map: resultMap,
    icon: guessIcon,
    zIndex: 1
  });

  // Line
  new google.maps.Polyline({
    path: [actual, guess],
    geodesic: false,
    strokeColor: '#FF0000',
    strokeOpacity: 0.8,
    strokeWeight: 2,
    map: resultMap
  });

  // Fit bounds
  const bounds = new google.maps.LatLngBounds();
  bounds.extend(actual);
  bounds.extend(guess);
  resultMap.fitBounds(bounds, { top: 100, bottom: 100, left: 50, right: 50 });

  // Ensure center is correct and zoom isn't too extreme for close guesses
  const listener = resultMap.addListener('idle', () => {
    resultMap.setCenter(center);
    if (resultMap.getZoom() > 15) {
      resultMap.setZoom(15);
    }
    google.maps.event.removeListener(listener);
  });
};

// Removed loadLocation and getRandomLocation as they are handled by backend now

const undoMove = () => {
  if (currentHistoryIndex.value > 0) {
    isNavigatingHistory = true;
    currentHistoryIndex.value--;
    streetView.setPano(moveHistory.value[currentHistoryIndex.value]);
  }
};

const redoMove = () => {
  if (currentHistoryIndex.value < moveHistory.value.length - 1) {
    isNavigatingHistory = true;
    currentHistoryIndex.value++;
    streetView.setPano(moveHistory.value[currentHistoryIndex.value]);
  }
};

const returnToStart = () => {
  if (startPanoId.value) {
    streetView.setPano(startPanoId.value);
  }
};

const setupDynamicCompass = () => {
  const strip = document.getElementById('compass-strip');
  if (!strip) return;

  strip.innerHTML = '';

  const pixelsPerDegree = 4;
  const directions = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

  for (let i = -360; i < 720; i++) {
    const leftPos = (i * pixelsPerDegree) + (360 * pixelsPerDegree);
    const key = ((i % 360) + 360) % 360;

    if (directions.hasOwnProperty(key)) {
      const label = document.createElement('span');
      label.className = 'compass-label';
      label.textContent = directions[key];
      label.style.left = `${leftPos}px`;
      label.style.whiteSpace = "nowrap";
      if (key % 90 !== 0) {
        label.style.fontSize = '0.8rem';
      }
      strip.appendChild(label);
    } else if (i % 10 === 0) {
      const tick = document.createElement('div');
      tick.className = 'compass-tick tick-minor';
      tick.style.left = `${leftPos}px`;
      strip.appendChild(tick);
    }
  }
};

const updateCompass = (heading) => {
  const strip = document.getElementById('compass-strip');
  const container = document.getElementById('compass-container');
  if (!strip || !container) return;

  const pixelsPerDegree = 4;
  const offset = ((heading + 360) * pixelsPerDegree) - (container.offsetWidth / 2);

  strip.style.transform = offset > 0 ? `translateX(-${offset}px)` : `translateX(${-offset}px)`;
};
</script>

<style scoped>
.game-container { height: 100%; display: flex; flex-direction: column; }

/* Setup Screen */
.setup-screen { padding: 2rem; max-width: 800px; margin: 0 auto; width: 100%; }
.setup-header { text-align: center; margin-bottom: 2rem; }

.mode-selection { margin-bottom: 2rem; }
.mode-selection h3 { margin-bottom: 1rem; font-size: 1.1rem; }
.mode-options { display: flex; gap: 1rem; }
.mode-card {
  flex: 1; border: 2px solid var(--color-border); border-radius: var(--radius);
  padding: 1rem; cursor: pointer; display: flex; flex-direction: column; 
  align-items: center; gap: 10px; transition: all 0.2s;
}
.mode-card:hover { border-color: var(--color-primary); background: var(--color-surface); }
.mode-card.selected { border-color: var(--color-primary); background: rgba(79, 70, 229, 0.05); color: var(--color-primary); }
.mode-card i { font-size: 1.5rem; }

.map-selection { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
.map-option { 
  border: 2px solid var(--color-border); border-radius: var(--radius); padding: 1rem; 
  cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 10px;
}
.map-option:hover { border-color: var(--color-primary); background: var(--color-surface); }
.map-option.selected { border-color: var(--color-primary); background: rgba(79, 70, 229, 0.05); box-shadow: 0 0 0 2px var(--color-primary); }
.map-icon { font-size: 2rem; color: var(--color-text-muted); }
.map-option.selected .map-icon { color: var(--color-primary); }
.map-info h3 { margin: 0; font-size: 1.1rem; }
.map-info p { margin: 0; font-size: 0.9rem; color: var(--color-text-muted); }
.setup-actions { text-align: center; }
.start-btn { max-width: 200px; font-size: 1.2rem; padding: 12px 24px; }

/* Game Screen */
.game-screen { position: relative; flex: 1; display: flex; flex-direction: column; height: calc(100vh - 64px); }
.street-view { flex: 1; width: 100%; height: 100%; }
.street-view.no-interaction { pointer-events: none; }

.nmpz-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  z-index: 5; background: transparent;
}

.map-overlay {
  position: absolute; bottom: 20px; right: 20px; 
  width: 320px; height: 240px;
  background: white; border-radius: var(--radius); box-shadow: var(--shadow-md);
  display: flex; flex-direction: column; padding: 10px; gap: 10px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); z-index: 10;
  opacity: 0.9;
}
.map-overlay:hover, .map-overlay.expanded {
  width: 75%; height: 66%;
  opacity: 1;
}

.guess-map { flex: 1; border-radius: 4px; background: #eee; }
.guess-btn { width: 100%; height: 40px; flex-shrink: 0; }

.round-info {
  position: absolute; top: 20px; left: 20px;
  background: rgba(0, 0, 0, 0.7); color: white; padding: 10px 20px;
  border-radius: 20px; display: flex; gap: 20px; font-weight: bold;
  z-index: 10;
}

/* Result Screen */
.result-screen { flex: 1; display: flex; flex-direction: column; position: relative; }
.result-header {
  position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.95); padding: 1rem 3rem; border-radius: 50px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15); display: flex; gap: 4rem; z-index: 10;
  backdrop-filter: blur(10px);
}
.result-stat { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.result-stat .label { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; color: #666; font-weight: 600; }
.result-stat .value { font-size: 2rem; font-weight: 800; line-height: 1; }
.result-stat:first-child .value { color: #00BCD4; } /* Distance color */
.result-stat:last-child .value { color: #FFA000; } /* Score color */

.result-map { flex: 1; width: 100%; }
.result-actions {
  position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
  z-index: 10; display: flex; flex-direction: column; align-items: center; gap: 10px;
}
.next-btn { 
  padding: 12px 40px; font-size: 1.1rem; font-weight: 600; 
  background-color: var(--color-primary);
  border: 1px solid transparent; color: white; border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  transition: background-color 0.2s, transform 0.1s;
}
.next-btn:hover { background-color: var(--color-primary-hover); transform: translateY(-1px); }
.next-btn:active { transform: translateY(1px); }

.space-hint {
  color: white; text-shadow: 0 1px 3px rgba(0,0,0,0.5); font-size: 0.9rem; font-weight: 500;
  background: rgba(0,0,0,0.3); padding: 4px 12px; border-radius: 20px;
}

/* Summary Screen */
.summary-screen { 
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; 
  background: var(--color-surface); padding: 20px;
}

.summary-card {
  background: var(--color-bg);
  padding: 3rem;
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--color-border);
  text-align: center;
  width: 100%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.summary-card h2 {
  font-size: 2rem;
  color: var(--color-text-main);
  margin: 0;
}

.final-score-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem 0;
  background: var(--color-surface);
  border-radius: var(--radius);
  position: relative;
  overflow: hidden;
}

.rank-badge {
  font-size: 0.9rem;
  font-weight: 800;
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  margin-bottom: 10px;
  letter-spacing: 1px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}

.final-score-container .label {
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-text-muted);
  font-weight: 600;
}

.final-score-container .value {
  font-size: 4rem;
  font-weight: 800;
  color: var(--color-primary);
  line-height: 1;
}

.score-bar {
  width: 80%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  margin-top: 10px;
  overflow: hidden;
}

.score-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 4px;
  transition: width 1s ease-out;
}

.summary-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.badge { font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600; text-transform: uppercase; }
.badge.official { background: rgba(51, 187, 173, 0.1); color: var(--color-accent); }

/* Compass Styles */
#compass-container {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 300px;
  height: 40px;
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
  overflow: hidden;
  z-index: 10;
}

#compass-marker {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-top: 10px solid #ff4d4d;
}

#compass-strip {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  display: flex;
  align-items: center;
  will-change: transform;
}

:deep(.compass-label) {
  color: white;
  font-weight: bold;
  font-size: 1rem;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  text-shadow: 0 0 3px black;
}

:deep(.compass-tick) {
  background-color: white;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}

:deep(.tick-major) {
  width: 2px;
  height: 15px;
}

:deep(.tick-minor) {
  width: 1px;
  height: 10px;
  opacity: 0.7;
}

.game-controls {
  position: absolute;
  bottom: 20px;
  left: 20px;
  display: flex;
  gap: 10px;
  z-index: 10;
}

.control-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: white;
  border: none;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  color: var(--color-text-main);
  transition: all 0.2s;
}

.control-btn:hover:not(:disabled) {
  background: var(--color-surface);
  transform: translateY(-2px);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
