<template>
  <DashboardLayout>
    <div class="analysis-container">
      <div v-if="loading" class="loading-state">
        <i class="fa-solid fa-circle-notch fa-spin"></i> {{ t('analysis.loading') }}
      </div>
      <div v-else-if="!game || error" class="error-state">
        {{ error || t('analysis.not_found') }}
      </div>
      <div v-else class="analysis-content">
        <div class="header-card">
          <button @click="router.back()" class="back-btn">
            <i class="fa-solid fa-arrow-left"></i> {{ t('analysis.back') }}
          </button>
          <div class="game-summary">
            <div class="summary-header">
              <h1>{{ game.Map ? game.Map.name : t('singleplayer.classic_world') }}</h1>
              <div v-if="gameRank" class="rank-badge" :style="{ backgroundColor: gameRank.color }">
                {{ gameRank.title }}
              </div>
            </div>
            <div class="summary-stats">
              <div class="stat">
                <span class="label">{{ t('analysis.total_score') }}</span>
                <span class="value score-value">{{ game.total_score }}</span>
              </div>
              <div class="stat">
                <span class="label">{{ t('analysis.date') }}</span>
                <span class="value">{{ formatDate(game.created_at) }}</span>
              </div>
              <div class="stat">
                <span class="label">{{ t('analysis.mode') }}</span>
                <span class="value mode-badge">{{ game.mode }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="rounds-list">
          <div v-for="guess in game.Guesses" :key="guess.id" class="round-card">
            <div class="round-header">
              <h3>{{ t('analysis.round') }} {{ guess.round_number }}</h3>
              <div class="round-stats">
                <span class="round-score">{{ guess.score }} {{ t('analysis.pts') }}</span>
                <span class="round-distance">{{ formatDistance(guess.distance_meters) }}</span>
              </div>
            </div>
            
            <div class="map-container" :id="'map-' + guess.round_number"></div>
            
            <div class="round-actions">
              <a :href="getStreetViewUrl(guess.Location.pano_id)" target="_blank" class="sv-btn">
                <i class="fa-solid fa-street-view"></i> {{ t('analysis.open_maps') }}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>

<script setup>
import DashboardLayout from '../components/DashboardLayout.vue';
import { ref, onMounted, nextTick, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api } from '../auth';
import { Loader } from "@googlemaps/js-api-loader";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const loading = ref(true);
const game = ref(null);
const error = ref(null);

const loader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  version: "weekly",
  libraries: ["places", "geometry"]
});

const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const formatDistance = (meters) => {
  if (meters < 1000) return meters + " m";
  return (meters / 1000).toFixed(1) + " km";
};

const getStreetViewUrl = (panoId) => {
  return `https://www.google.com/maps/@?api=1&map_action=pano&pano=${panoId}`;
};

const gameRank = computed(() => {
  if (!game.value) return null;
  const score = game.value.total_score;
  if (score >= 24000) return { title: t('analysis.ranks.legend'), color: '#FF0000' };
  if (score >= 20000) return { title: t('analysis.ranks.master'), color: '#FF8000' };
  if (score >= 15000) return { title: t('analysis.ranks.explorer'), color: '#C0C000' };
  if (score >= 10000) return { title: t('analysis.ranks.voyager'), color: '#0000FF' };
  if (score >= 5000) return { title: t('analysis.ranks.traveler'), color: '#00C0C0' };
  return { title: t('analysis.ranks.beginner'), color: '#008000' };
});

const initMaps = async () => {
  const google = await loader.load();
  
  game.value.Guesses.forEach(guess => {
    const mapDiv = document.getElementById(`map-${guess.round_number}`);
    if (!mapDiv) return;

    const actual = { lat: guess.Location.lat, lng: guess.Location.lng };
    const userGuess = { lat: guess.guess_lat, lng: guess.guess_lng };

    // Calculate center
    const center = google.maps.geometry.spherical.interpolate(
      new google.maps.LatLng(actual), 
      new google.maps.LatLng(userGuess), 
      0.5
    );

    const map = new google.maps.Map(mapDiv, {
      center: center,
      zoom: 2,
      disableDefaultUI: true,
      gestureHandling: 'cooperative'
    });

    // Markers
    new google.maps.Marker({
      position: actual,
      map: map,
      icon: {
        path: "M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z",
        fillColor: "#4CAF50",
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: "#FFFFFF",
        scale: 1.2,
        anchor: new google.maps.Point(5, 20)
      }
    });

    new google.maps.Marker({
      position: userGuess,
      map: map,
      icon: {
        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
        fillColor: "#FF5252",
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: "#FFFFFF",
        scale: 1.5,
        anchor: new google.maps.Point(12, 22)
      }
    });

    // Line
    new google.maps.Polyline({
      path: [actual, userGuess],
      geodesic: false,
      strokeColor: '#FF0000',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      map: map
    });

    // Fit bounds
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(actual);
    bounds.extend(userGuess);
    map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
  });
};

const fetchGame = async () => {
  loading.value = true;
  error.value = null;
  try {
    const res = await api.get(`/games/${route.params.id}`);
    game.value = res.data;
    
    // Wait for DOM update then init maps
    nextTick(() => {
      initMaps();
    });
  } catch (err) {
    console.error(err);
    error.value = err.response?.data?.error || t('analysis.not_found');
  } finally {
    loading.value = false;
  }
};

onMounted(fetchGame);
</script>

<style scoped>
.analysis-container {
  padding: 1.5rem;
  max-width: 100%;
  margin: 0 auto;
  width: 100%;
}

.loading-state, .error-state {
  text-align: center;
  padding: 4rem;
  font-size: 1.2rem;
  color: var(--color-text-muted);
}

.header-card {
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: var(--shadow-sm);
}

.back-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 1rem;
  padding: 0;
}
.back-btn:hover { color: var(--color-primary); }

.game-summary h1 { margin: 0; font-size: 2rem; color: var(--color-text-main); }
.summary-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }

.rank-badge {
  font-size: 0.8rem;
  font-weight: 800;
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  letter-spacing: 1px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  text-transform: uppercase;
}

.summary-stats { display: flex; gap: 3rem; flex-wrap: wrap; padding-top: 1rem; border-top: 1px solid var(--color-border); }
.stat { display: flex; flex-direction: column; gap: 4px; }
.stat .label { font-size: 0.75rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 700; letter-spacing: 0.5px; }
.stat .value { font-size: 1.2rem; font-weight: 600; color: var(--color-text-main); }
.score-value { color: var(--color-primary); font-weight: 800; font-size: 1.5rem; }
.mode-badge { text-transform: uppercase; color: var(--color-accent) !important; font-weight: 800; }

.rounds-list { display: flex; flex-direction: column; gap: 2rem; }

.round-card {
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s, box-shadow 0.2s;
}
.round-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }

.round-header {
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.round-header h3 { margin: 0; font-size: 1rem; font-weight: 700; color: var(--color-text-main); text-transform: uppercase; letter-spacing: 0.5px; }

.round-stats { display: flex; gap: 1.5rem; align-items: center; }
.round-score { font-weight: 800; color: var(--color-primary); font-size: 1.1rem; }
.round-distance { color: var(--color-text-muted); font-weight: 600; font-size: 0.9rem; }

.map-container {
  width: 100%;
  height: 300px;
  background: #eee;
}

.round-actions {
  padding: 1rem;
  display: flex;
  justify-content: flex-end;
  background: #fff;
  border-top: 1px solid var(--color-border);
}

.sv-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--color-surface);
  color: var(--color-text-main);
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s;
}
.sv-btn:hover { background: #e0e7ff; color: var(--color-primary); }
</style>