<template>
  <DashboardLayout page="duels">
    <header class="content-header">
      <div class="header-title">
        <h2>{{ t('duels.title') }}</h2>
        <p>{{ t('duels.subtitle') }}</p>
      </div>
      <button class="secondary-btn" @click="router.push('/duels/leaderboard')">
        <i class="fa-solid fa-ranking-star"></i> {{ t('duels.leaderboard') }}
      </button>
    </header>

    <div class="scroll-content">
      <div class="duel-grid">
        <section class="queue-card hero-card">
          <div class="hero-copy">
            <span class="eyebrow"><i class="fa-solid fa-bolt"></i> {{ t('duels.rated') }}</span>
            <h3>{{ t('duels.findMatch') }}</h3>
            <p>{{ t('duels.findMatchDesc') }}</p>
          </div>
          <div class="my-rating" v-if="user">
            <RatingName :user="user" />
            <strong>{{ user.elo_rating || 1500 }}</strong>
            <span>{{ t('duels.currentRating') }}</span>
          </div>
        </section>

        <section class="queue-card setup-card">
          <div class="section-title">
            <h3>{{ t('duels.queueSetup') }}</h3>
            <span v-if="status.status === 'waiting'" class="status-pill waiting"><i class="fa-solid fa-circle-notch fa-spin"></i> {{ t('duels.waiting') }}</span>
            <span v-else-if="status.status === 'active'" class="status-pill active"><i class="fa-solid fa-gamepad"></i> {{ t('duels.inDuel') }}</span>
          </div>

          <div class="field-block">
            <label>{{ t('singleplayer.select_mode') }}</label>
            <div class="mode-options">
              <button v-for="option in modes" :key="option.value" :class="['mode-chip', { selected: selectedMode === option.value }]" @click="selectedMode = option.value" :disabled="isWaiting">
                <i :class="option.icon"></i>
                <span>{{ option.label }}</span>
              </button>
            </div>
          </div>

          <div class="field-block">
            <label>{{ t('duels.selectMap') }}</label>
            <div class="map-list">
              <button
                v-for="map in playableMaps"
                :key="map.id || 'world'"
                :class="['map-choice', { selected: selectedMapId === map.id, disabled: !map.playable }]"
                :disabled="isWaiting || !map.playable"
                @click="selectedMapId = map.id"
              >
                <span class="map-name">{{ map.name }}</span>
                <small>{{ map.locationCount }} {{ t('duels.locations') }}</small>
              </button>
            </div>
          </div>

          <div class="queue-state" v-if="status.status === 'waiting'">
            <div class="pulse-dot"></div>
            <div>
              <strong>{{ t('duels.searching') }}</strong>
              <p>{{ t('duels.queueSize', { count: status.queueSize || 1 }) }}</p>
            </div>
          </div>

          <div class="actions">
            <button v-if="status.status === 'active'" class="primary-btn play-btn" @click="router.push(`/duels/${status.duelId}`)">
              <i class="fa-solid fa-arrow-right"></i> {{ t('duels.resumeDuel') }}
            </button>
            <button v-else-if="status.status === 'waiting'" class="danger-btn" @click="leaveQueue" :disabled="loading">
              <i class="fa-solid fa-xmark"></i> {{ t('duels.leaveQueue') }}
            </button>
            <button v-else class="primary-btn play-btn" @click="joinQueue" :disabled="loading || !selectedMapId">
              <i class="fa-solid fa-fire"></i> {{ loading ? t('common.processing') : t('duels.joinQueue') }}
            </button>
          </div>
        </section>

        <section class="queue-card leaderboard-card">
          <div class="section-title">
            <h3>{{ t('duels.topPlayers') }}</h3>
            <button class="link-btn" @click="router.push('/duels/leaderboard')">{{ t('common.search') }}</button>
          </div>
          <div v-if="leaderboard.length === 0" class="empty-state">{{ t('duels.noRatedPlayers') }}</div>
          <div v-else class="mini-board">
            <div v-for="player in leaderboard" :key="player.id" class="mini-row">
              <span class="rank">#{{ player.rank }}</span>
              <RatingName :user="player" />
              <strong>{{ player.elo_rating }}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  </DashboardLayout>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import DashboardLayout from '../components/DashboardLayout.vue';
import RatingName from '../components/RatingName.vue';
import { api, authState } from '../auth';
import { connectSocket } from '../socket';

const router = useRouter();
const { t } = useI18n();
const user = computed(() => authState.user);
const loading = ref(false);
const selectedMode = ref('moving');
const selectedMapId = ref(null);
const maps = ref([]);
const status = ref({ status: 'idle' });
const leaderboard = ref([]);
let poller = null;
let socket = null;

const modes = computed(() => [
  { value: 'moving', label: 'Moving', icon: 'fa-solid fa-person-walking' },
  { value: 'nm', label: 'No Move', icon: 'fa-solid fa-ban' },
  { value: 'nmpz', label: 'NMPZ', icon: 'fa-solid fa-lock' }
]);

const playableMaps = computed(() => maps.value.filter(map => map.playable));
const isWaiting = computed(() => status.value.status === 'waiting');

const fetchMaps = async () => {
  const res = await api.get('/maps/playable');
  maps.value = res.data.filter(map => map.playable);
  if (!selectedMapId.value && maps.value.length > 0) selectedMapId.value = maps.value[0].id;
};

const fetchStatus = async () => {
  const res = await api.get('/duels/queue/status');
  status.value = res.data;
};

const fetchLeaderboard = async () => {
  const res = await api.get('/duels/leaderboard?limit=8');
  leaderboard.value = res.data.players || [];
};

const joinQueue = async () => {
  if (!selectedMapId.value) return;
  loading.value = true;
  try {
    const res = await api.post('/duels/queue', { mode: selectedMode.value, mapId: selectedMapId.value });
    status.value = res.data;
    if (res.data.status === 'matched' || res.data.status === 'active') {
      router.push(`/duels/${res.data.duelId}`);
    }
  } finally {
    loading.value = false;
  }
};

const leaveQueue = async () => {
  loading.value = true;
  try {
    await api.delete('/duels/queue');
    status.value = { status: 'idle' };
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  socket = connectSocket();
  socket.on('duel:matched', ({ duelId }) => router.push(`/duels/${duelId}`));
  await Promise.all([fetchMaps(), fetchStatus(), fetchLeaderboard()]);
  poller = window.setInterval(fetchStatus, 3500);
});

onUnmounted(() => {
  if (poller) window.clearInterval(poller);
  if (socket) socket.off('duel:matched');
});
</script>

<style scoped>
.content-header { padding: var(--page-y) var(--page-x); border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; gap: 1rem; align-items: center; background: var(--color-bg); }
.header-title h2 { font-size: 1.34rem; line-height: 1.1; margin: 0 0 3px; font-weight: 700; letter-spacing: -.02em; }
.header-title p { color: var(--color-text-muted); margin: 0; }
.scroll-content { padding: var(--page-y) var(--page-x); overflow-y: auto; flex: 1; background: var(--color-page, var(--color-bg)); }
.duel-grid { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(280px, .72fr); gap: 1rem; width: 100%; max-width: 1560px; margin: 0; }
.queue-card { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 12px; box-shadow: var(--shadow-card); padding: var(--card-pad); }
.hero-card { grid-column: 1 / -1; display: flex; justify-content: space-between; gap: 1rem; align-items: center; background: linear-gradient(135deg, rgba(15, 23, 42,0.026), rgba(245,158,11,0.055)); border-color: rgba(245,158,11,.22); }
.eyebrow { display: inline-flex; align-items: center; gap: 6px; color: #b45309; font-weight: 700; font-size: 0.72rem; text-transform: uppercase; letter-spacing: .08em; }
.hero-copy h3 { font-size: 1.46rem; margin: 0.2rem 0 0.12rem; line-height: 1.12; font-weight: 700; letter-spacing: -.02em; }
.hero-copy p { margin: 0; max-width: 760px; }
.my-rating { min-width: 178px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 12px; padding: .8rem .9rem; display: grid; gap: 1px; text-align: right; box-shadow: var(--shadow-sm); }
.my-rating strong { font-size: 1.55rem; line-height: 1; font-weight: 750; }
.my-rating span:last-child { color: var(--color-text-muted); font-size: .78rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
.section-title { display: flex; justify-content: space-between; align-items: center; gap: .8rem; margin-bottom: .9rem; }
.section-title h3 { margin: 0; font-size: 1.04rem; font-weight: 700; }
.field-block { margin-bottom: 1rem; }
.field-block label { display: block; font-weight: 700; margin-bottom: .45rem; font-size: .86rem; text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-muted); }
.mode-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; }
.mode-chip, .map-choice { border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-main); border-radius: 10px; cursor: pointer; transition: all .15s; }
.mode-chip { padding: .68rem .58rem; display: flex; align-items: center; justify-content: center; gap: .45rem; font-weight: 700; }
.mode-chip.selected, .map-choice.selected { border-color: var(--color-accent); background: rgba(51,187,173,.10); color: var(--color-accent); box-shadow: inset 0 0 0 1px rgba(51,187,173,.14); }
.mode-chip:disabled, .map-choice:disabled { opacity: .55; cursor: not-allowed; }
.map-list { display: grid; gap: .45rem; max-height: 236px; overflow: auto; padding-right: 2px; }
.map-choice { display: flex; justify-content: space-between; align-items: center; padding: .62rem .72rem; text-align: left; }
.map-name { font-weight: 700; }
.map-choice small { color: var(--color-text-muted); font-weight: 700; }
.status-pill { font-size: .74rem; border-radius: 999px; padding: .28rem .58rem; font-weight: 700; white-space: nowrap; }
.status-pill.waiting { color: #92400e; background: #fef3c7; }
.status-pill.active { color: #047857; background: #d1fae5; }
.queue-state { display: flex; gap: .7rem; align-items: center; background: var(--color-surface); border-radius: 10px; padding: .75rem .85rem; margin-bottom: .85rem; border: 1px solid var(--color-border); }
.queue-state p { margin: 0; }
.pulse-dot { width: 11px; height: 11px; border-radius: 50%; background: var(--color-accent); box-shadow: 0 0 0 0 rgba(51,187,173,.55); animation: pulse 1.4s infinite; }
.actions { display: flex; gap: .75rem; }
.secondary-btn, .danger-btn, .link-btn { border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-main); border-radius: var(--radius); padding: .55rem .85rem; font-weight: 700; cursor: pointer; display: inline-flex; gap: .5rem; align-items: center; justify-content: center; }
.secondary-btn:hover, .link-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.danger-btn { color: var(--color-danger); width: 100%; }
.link-btn { padding: .3rem .55rem; font-size: .78rem; }
.mini-board { display: grid; gap: .18rem; }
.mini-row { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; gap: .6rem; align-items: center; padding: .48rem 0; border-bottom: 1px solid var(--color-border); font-variant-numeric: tabular-nums; }
.mini-row:last-child { border-bottom: 0; }
.rank { color: var(--color-text-muted); font-weight: 700; }
.mini-row strong { font-weight: 700; }
.empty-state { color: var(--color-text-muted); padding: 1rem 0; text-align: center; }
@keyframes pulse { 70% { box-shadow: 0 0 0 10px rgba(51,187,173,0); } 100% { box-shadow: 0 0 0 0 rgba(51,187,173,0); } }
@media (max-width: 900px) { .duel-grid { grid-template-columns: 1fr; } .hero-card, .content-header { flex-direction: column; align-items: stretch; } .my-rating { text-align: left; } .mode-options { grid-template-columns: 1fr; } }
</style>
