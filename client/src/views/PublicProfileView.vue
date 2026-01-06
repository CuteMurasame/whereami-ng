<template>
  <DashboardLayout page="none">
    
    <div v-if="loading" class="center-state">
      <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
    </div>

    <div v-else-if="!profile" class="center-state">
      <h2>{{ t('profile.userNotFound') }}</h2>
      <button @click="router.push('/lobby')" class="btn secondary-btn">{{ t('profile.backToLobby') }}</button>
    </div>

    <div v-else class="profile-layout">
      
      <!-- Left Sidebar -->
      <aside class="profile-sidebar">
        <div class="sidebar-header">
          <div class="avatar-wrapper">
            <img :src="getAvatar(profile)" alt="User Avatar">
          </div>
          <h1 class="username">{{ profile.username }}</h1>
          
          <div class="badges">
            <span v-if="profile.is_banned" class="badge banned"><i class="fa-solid fa-ban"></i> BANNED</span>
            <span v-else-if="profile.is_root" class="badge root"><i class="fa-solid fa-shield-cat"></i> ROOT</span>
            <span v-else-if="profile.is_admin" class="badge admin"><i class="fa-solid fa-shield-halved"></i> ADMIN</span>
            <span v-else class="badge explorer">EXPLORER</span>
          </div>

          <p class="join-date"><i class="fa-regular fa-calendar"></i> {{ t('profile.joined') }} {{ formatDate(profile.created_at) }}</p>
          
          <button v-if="isMe" @click="router.push('/settings')" class="btn-edit">
            <i class="fa-solid fa-pen"></i> {{ t('profile.editProfile') }}
          </button>
        </div>

        <nav class="sidebar-nav">
          <button @click="activeTab = 'overview'" :class="{ active: activeTab === 'overview' }">
            <i class="fa-solid fa-id-card"></i> {{ t('profile.overview') }}
          </button>
          <button @click="activeTab = 'rating'" :class="{ active: activeTab === 'rating' }">
            <i class="fa-solid fa-chart-line"></i> {{ t('profile.rating') }}
          </button>
          <button @click="activeTab = 'history'" :class="{ active: activeTab === 'history' }">
            <i class="fa-solid fa-clock-rotate-left"></i> {{ t('profile.history') }}
          </button>
        </nav>
      </aside>

      <!-- Main Content Area -->
      <main class="profile-content">
        
        <!-- Overview Tab -->
        <div v-if="activeTab === 'overview'" class="tab-pane fade-in">
          <div class="content-header">
            <h2>{{ t('profile.overview') }}</h2>
            <p>User profile and statistics</p>
          </div>

          <div class="overview-grid">
            <!-- Bio Card -->
            <div class="content-card bio-card">
              <div class="card-title"><i class="fa-solid fa-quote-left"></i> {{ t('profile.about') }}</div>
              <div class="bio-content">
                <p v-if="profile.bio">{{ profile.bio }}</p>
                <p v-else class="empty-bio">This user is a mystery. No bio yet.</p>
              </div>
            </div>

            <!-- Stats Card -->
            <div class="content-card stats-card">
              <div class="card-title"><i class="fa-solid fa-chart-simple"></i> {{ t('profile.careerStats') }}</div>
              <div class="stats-list">
                <div class="stat-row">
                  <div class="stat-icon icon-blue"><i class="fa-solid fa-earth-americas"></i></div>
                  <div class="stat-data">
                    <span class="stat-val">0</span>
                    <span class="stat-label">{{ t('profile.matches') }}</span>
                  </div>
                </div>
                <div class="stat-row">
                  <div class="stat-icon icon-green"><i class="fa-solid fa-trophy"></i></div>
                  <div class="stat-data">
                    <span class="stat-val">-</span>
                    <span class="stat-label">{{ t('profile.winRate') }}</span>
                  </div>
                </div>
                <div class="stat-row">
                  <div class="stat-icon icon-purple"><i class="fa-solid fa-bolt"></i></div>
                  <div class="stat-data">
                    <span class="stat-val">0</span>
                    <span class="stat-label">{{ t('profile.rating') }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Rating Tab -->
        <div v-if="activeTab === 'rating'" class="tab-pane fade-in">
          <div class="content-header">
            <h2>{{ t('profile.ratingHistory') }}</h2>
            <p>Performance in Duels over time</p>
          </div>
          <div class="chart-wrapper">
            <RatingChart :userId="profile.id" />
          </div>
        </div>

        <!-- History Tab -->
        <div v-if="activeTab === 'history'" class="tab-pane fade-in">
          <div class="content-header">
            <h2>{{ t('profile.gameHistory') }}</h2>
            <div class="filter-controls">
              <label><input type="checkbox" v-model="filters.singleplayer"> {{ t('profile.filters.single') }}</label>
              <label><input type="checkbox" v-model="filters.duels"> {{ t('profile.filters.duels') }}</label>
              <label><input type="checkbox" v-model="filters.battleroyales"> {{ t('profile.filters.br') }}</label>
            </div>
          </div>

          <div class="history-list">
            <div v-if="loadingGames" class="loading-games">Loading games...</div>
            <div v-else-if="filteredGames.length === 0" class="no-games">No games found.</div>
            <div v-else v-for="game in filteredGames" :key="game.id" class="game-row" @click="viewGame(game)" :class="{ clickable: game.type === 'singleplayer' }">
              <div class="game-icon" :class="game.type">
                <i v-if="game.type === 'singleplayer'" class="fa-solid fa-person-hiking"></i>
                <i v-else-if="game.type === 'duels'" class="fa-solid fa-fire"></i>
                <i v-else class="fa-solid fa-trophy"></i>
              </div>
              <div class="game-info">
                <div class="game-type">{{ formatType(game.type) }}</div>
                <div class="game-mode">{{ game.mode }}</div>
              </div>
              <div class="game-meta">
                <span v-if="game.type === 'singleplayer'" class="game-score">{{ game.total_score }} pts</span>
                <span class="game-date">{{ formatDate(game.created_at) }}</span>
                <span class="game-status" :class="game.status">{{ game.status }}</span>
              </div>
            </div>
          </div>
        </div>

      </main>

    </div>

  </DashboardLayout>
</template>

<script setup>
import DashboardLayout from '../components/DashboardLayout.vue';
import RatingChart from '../components/RatingChart.vue';
import { ref, onMounted, computed, watch, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, authState } from '../auth';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const profile = ref(null);
const loading = ref(true);
const games = ref([]);
const loadingGames = ref(false);
const activeTab = ref('overview');

const filters = reactive({
  singleplayer: true,
  duels: true,
  battleroyales: true
});

const currentUser = computed(() => authState.user);
const isMe = computed(() => currentUser.value?.id === profile.value?.id);

const filteredGames = computed(() => {
  return games.value.filter(g => filters[g.type]);
});

const getAvatar = (u) => {
  if (!u) return '';
  if (u.avatar_url) return `http://localhost:3000${u.avatar_url}`;
  return `https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y`;
};

const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatType = (type) => {
  const map = {
    'singleplayer': 'lobby.singlePlayer',
    'duels': 'lobby.duels',
    'battleroyales': 'lobby.battleRoyale'
  };
  return map[type] ? t(map[type]) : type;
};

const fetchProfile = async () => {
  loading.value = true;
  try {
    const res = await api.get(`/user/${route.params.id}`);
    profile.value = res.data;
    fetchGames();
  } catch (err) { profile.value = null; } 
  finally { loading.value = false; }
};

const fetchGames = async () => {
  if (!profile.value) return;
  loadingGames.value = true;
  try {
    const res = await api.get(`/user/${profile.value.id}/games`);
    games.value = res.data;
  } catch (err) { console.error(err); }
  finally { loadingGames.value = false; }
};

const viewGame = (game) => {
  if (game.type === 'singleplayer' && game.status === 'finished') {
    router.push(`/singleplayer/analysis/${game.id}`);
  }
};

onMounted(fetchProfile);
watch(() => route.params.id, fetchProfile);
</script>

<style scoped>
.profile-layout {
  display: flex;
  height: 100%;
  background: var(--color-bg);
  overflow: hidden;
}

/* Sidebar */
.profile-sidebar {
  width: 280px;
  background: #fff;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: 2rem;
  flex-shrink: 0;
}

.sidebar-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 2rem;
}

.avatar-wrapper {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  margin-bottom: 1rem;
  border: 4px solid var(--color-bg);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.avatar-wrapper img { width: 100%; height: 100%; object-fit: cover; }

.username { font-size: 1.5rem; font-weight: 800; margin: 0 0 0.5rem 0; color: var(--color-text-main); }

.badges { display: flex; gap: 8px; margin-bottom: 1rem; flex-wrap: wrap; justify-content: center; }
.badge { font-size: 0.7rem; font-weight: 700; padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 4px; }
.root { background: #000; color: #fff; }
.admin { background: #4f46e5; color: #fff; }
.banned { background: #fee2e2; color: #ef4444; }
.explorer { background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text-muted); }

.join-date { font-size: 0.85rem; color: var(--color-text-muted); margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 6px; }

.btn-edit {
  width: 100%;
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  background: transparent;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.btn-edit:hover { background: var(--color-surface); border-color: var(--color-text-muted); }

.sidebar-nav { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.sidebar-nav button {
  text-align: left;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex; align-items: center; gap: 12px;
  transition: all 0.2s;
}
.sidebar-nav button:hover { background: var(--color-surface); color: var(--color-text-main); }
.sidebar-nav button.active { background: #eff6ff; color: #4f46e5; font-weight: 600; }
.sidebar-nav button.active i { color: #4f46e5; }

/* Main Content */
.profile-content {
  flex: 1;
  padding: 2rem 3rem;
  overflow-y: auto;
}

.content-header {
  margin-bottom: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 1rem;
}
.content-header h2 { font-size: 1.8rem; margin: 0 0 4px 0; font-weight: 700; }
.content-header p { margin: 0; color: var(--color-text-muted); }

.tab-pane { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* Overview Grid */
.overview-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
.content-card { background: #fff; border: 1px solid var(--color-border); border-radius: 12px; padding: 1.5rem; box-shadow: var(--shadow-sm); }
.card-title { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 1rem; display: flex; align-items: center; gap: 8px; }

.bio-content p { line-height: 1.6; color: var(--color-text-main); }
.empty-bio { font-style: italic; color: var(--color-text-muted); }

.stats-list { display: flex; flex-direction: column; gap: 16px; }
.stat-row { display: flex; align-items: center; gap: 12px; }
.stat-icon { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
.icon-blue { background: #e0e7ff; color: #4338ca; }
.icon-green { background: #dcfce7; color: #15803d; }
.icon-purple { background: #f3e8ff; color: #7e22ce; }
.stat-data { display: flex; flex-direction: column; }
.stat-val { font-weight: 700; font-size: 1.1rem; }
.stat-label { font-size: 0.8rem; color: var(--color-text-muted); }

/* History List */
.filter-controls { display: flex; gap: 15px; }
.filter-controls label { display: flex; align-items: center; gap: 6px; font-size: 0.9rem; cursor: pointer; user-select: none; }

.history-list { display: flex; flex-direction: column; gap: 10px; }
.game-row { display: flex; align-items: center; background: #fff; border: 1px solid var(--color-border); padding: 1rem; border-radius: 10px; gap: 15px; transition: transform 0.2s; }
.game-row:hover { transform: translateX(4px); border-color: var(--color-accent); }
.game-row.clickable { cursor: pointer; }

.game-icon { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.2rem; }
.game-icon.singleplayer { background: #10b981; }
.game-icon.duels { background: #f59e0b; }
.game-icon.battleroyales { background: #ef4444; }

.game-info { flex: 1; }
.game-type { font-weight: 700; font-size: 1rem; }
.game-mode { font-size: 0.85rem; color: var(--color-text-muted); text-transform: uppercase; }

.game-meta { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
.game-score { font-weight: 800; color: var(--color-primary); font-size: 1.1rem; }
.game-date { font-size: 0.85rem; color: var(--color-text-muted); }
.game-status { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: var(--color-surface); }
.game-status.finished { color: var(--color-text-muted); }
.game-status.active { color: #10b981; background: #d1fae5; }

.center-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); gap: 1rem; }

@media (max-width: 900px) {
  .profile-layout { flex-direction: column; overflow-y: auto; }
  .profile-sidebar { width: 100%; border-right: none; border-bottom: 1px solid var(--color-border); padding: 1.5rem; }
  .sidebar-nav { flex-direction: row; overflow-x: auto; padding-bottom: 5px; }
  .sidebar-nav button { white-space: nowrap; }
  .overview-grid { grid-template-columns: 1fr; }
  .content-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
}
</style>
