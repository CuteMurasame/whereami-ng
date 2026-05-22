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
      <div class="profile-shell">
        <div class="profile-topbar">
          <BackButton fallback="/lobby" />
          <div class="profile-route-tabs" aria-label="Profile sections">
            <button type="button" @click="goToTab('overview')" :class="{ active: activeTab === 'overview' }">
              <i class="fa-solid fa-id-card"></i>
              {{ t('profile.overview') }}
            </button>
            <button type="button" @click="goToTab('history')" :class="{ active: activeTab === 'history' }">
              <i class="fa-solid fa-clock-rotate-left"></i>
              {{ t('profile.history') }}
            </button>
          </div>
        </div>

        <div class="profile-grid">
          <aside class="profile-card">
            <div class="avatar-wrapper">
              <img :src="getAvatar(profile)" alt="User Avatar">
            </div>

            <div class="profile-name-block">
              <h1 class="username"><RatingName :user="profile" :clickable="false" /></h1>
              <div class="badges">
                <span v-if="profile.is_banned" class="badge banned"><i class="fa-solid fa-ban"></i> BANNED</span>
                <span v-else-if="profile.is_root" class="badge root"><i class="fa-solid fa-shield-cat"></i> ROOT</span>
                <span v-else-if="profile.is_admin" class="badge admin"><i class="fa-solid fa-shield-halved"></i> ADMIN</span>
                <span v-else class="badge explorer">EXPLORER</span>
              </div>
            </div>

            <div class="bio-section">
              <p v-if="profile.bio">{{ profile.bio }}</p>
              <p v-else class="empty-bio">{{ t('profile.noBio') }}</p>
            </div>

            <button v-if="isMe" @click="router.push('/settings')" class="btn-edit">
              <i class="fa-solid fa-pen"></i> {{ t('profile.editProfile') }}
            </button>

            <div class="profile-meta-grid">
              <div class="meta-cell">
                <span>UID</span>
                <strong>#{{ profile.id }}</strong>
              </div>
              <div class="meta-cell">
                <span>{{ t('profile.joined', { date: '' }).replace(':', '').trim() || 'Joined' }}</span>
                <strong>{{ formatDateTime(profile.created_at) }}</strong>
              </div>
              <div class="meta-cell">
                <span>{{ t('profile.rating') }}</span>
                <strong :class="ratingToneClass(profile.elo_rating || 1500)">{{ profile.elo_rating || 1500 }}</strong>
              </div>
              <div class="meta-cell">
                <span>{{ t('duels.peak') }}</span>
                <strong :class="ratingToneClass(profile.peak_elo || profile.elo_rating || 1500)">{{ profile.peak_elo || profile.elo_rating || 1500 }}</strong>
              </div>
            </div>
          </aside>

          <main class="profile-main">
            <div v-if="activeTab === 'overview'" class="profile-dashboard fade-in">
              <section class="stats-strip">
                <div class="duel-stat">
                  <strong>{{ profile.total_duels || 0 }}</strong>
                  <span>{{ t('profile.matches') }}</span>
                </div>
                <div class="duel-stat win">
                  <strong>{{ profile.total_wins || 0 }}</strong>
                  <span>Wins</span>
                </div>
                <div class="duel-stat loss">
                  <strong>{{ profile.total_losses || 0 }}</strong>
                  <span>Losses</span>
                </div>
                <div class="duel-stat draw">
                  <strong>{{ profile.total_draws || 0 }}</strong>
                  <span>Draws</span>
                </div>
                <div class="duel-stat rate">
                  <strong>{{ winRate }}%</strong>
                  <span>{{ t('profile.winRate') }}</span>
                </div>
              </section>

              <section class="content-card rating-panel">
                <div class="rating-title-line">
                  <h2>
                    Rating:
                    <span :class="ratingToneClass(profile.elo_rating || 1500)">{{ profile.elo_rating || 1500 }}</span>
                    <small>&nbsp;(max. <span :class="ratingToneClass(profile.peak_elo || profile.elo_rating || 1500)">{{ profile.peak_elo || profile.elo_rating || 1500 }}</span>)</small>
                  </h2>
                  <span class="chart-caption"><i class="fa-solid fa-chart-line"></i> {{ t('profile.ratingHistory') }}</span>
                </div>
                <RatingChart :userId="profile.id" />
              </section>

              <section class="content-card recent-panel">
                <div class="section-heading recent-heading">
                  <div>
                    <h2>{{ t('profile.gamesTitle') }}</h2>
                    <p>{{ t('profile.gameHistory') }}</p>
                  </div>
                  <button type="button" class="history-link" @click="goToTab('history')">
                    {{ t('profile.viewFullHistory') || 'View full history' }} <i class="fa-solid fa-arrow-right"></i>
                  </button>
                </div>

                <div class="history-list compact">
                  <div v-if="loadingGames" class="loading-games">Loading games...</div>
                  <div v-else-if="recentGames.length === 0" class="no-games">{{ t('profile.noGames') }}</div>
                  <div
                    v-else
                    v-for="game in recentGames"
                    :key="`recent-${game.type}-${game.id}`"
                    class="game-row"
                    @click="viewGame(game)"
                    :class="{ clickable: game.type === 'singleplayer' || game.type === 'duels' }"
                  >
                    <div class="game-icon" :class="game.type">
                      <i v-if="game.type === 'singleplayer'" class="fa-solid fa-person-hiking"></i>
                      <i v-else-if="game.type === 'duels'" class="fa-solid fa-fire"></i>
                      <i v-else class="fa-solid fa-trophy"></i>
                    </div>
                    <div class="game-info">
                      <div class="game-type">
                        <template v-if="game.type === 'duels' && game.opponent_name">
                          <span class="duel-matchup"><span>{{ profile.username }}</span> <span class="vs-text">vs.</span> <span>{{ game.opponent_name }}</span></span>
                        </template>
                        <template v-else>{{ formatType(game.type) }}</template>
                      </div>
                      <div class="game-mode">{{ game.map_name || game.mode }} · {{ game.mode }}</div>
                    </div>
                    <div class="game-meta">
                      <span v-if="game.type === 'singleplayer'" class="game-score">{{ game.total_score }} pts</span>
                      <span v-else-if="game.type === 'duels'" class="game-score">{{ game.total_score }} pts <small v-if="game.rating_change">({{ game.rating_change > 0 ? '+' : '' }}{{ game.rating_change }})</small></span>
                      <span class="game-date">{{ formatDate(game.created_at) }}</span>
                      <span class="game-status" :class="game.status || game.result">{{ game.result || game.status }}</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div v-else class="tab-pane fade-in">
              <div class="history-header">
                <div>
                  <h2>{{ t('profile.gameHistory') }}</h2>
                  <p>{{ t('profile.gamesTitle') }}</p>
                </div>
                <div class="filter-controls">
                  <label><input type="checkbox" v-model="filters.singleplayer"> {{ t('profile.filters.single') }}</label>
                  <label><input type="checkbox" v-model="filters.duels"> {{ t('profile.filters.duels') }}</label>
                  <label><input type="checkbox" v-model="filters.battleroyales"> {{ t('profile.filters.br') }}</label>
                </div>
              </div>

              <div class="history-list full-history-list">
                <div v-if="loadingGames" class="loading-games">Loading games...</div>
                <div v-else-if="filteredGames.length === 0" class="no-games">{{ t('profile.noGames') }}</div>
                <div
                  v-else
                  v-for="game in filteredGames"
                  :key="`${game.type}-${game.id}`"
                  class="game-row"
                  @click="viewGame(game)"
                  :class="{ clickable: game.type === 'singleplayer' || game.type === 'duels' }"
                >
                  <div class="game-icon" :class="game.type">
                    <i v-if="game.type === 'singleplayer'" class="fa-solid fa-person-hiking"></i>
                    <i v-else-if="game.type === 'duels'" class="fa-solid fa-fire"></i>
                    <i v-else class="fa-solid fa-trophy"></i>
                  </div>
                  <div class="game-info">
                    <div class="game-type">
                        <template v-if="game.type === 'duels' && game.opponent_name">
                          <span class="duel-matchup"><span>{{ profile.username }}</span> <span class="vs-text">vs.</span> <span>{{ game.opponent_name }}</span></span>
                        </template>
                        <template v-else>{{ formatType(game.type) }}</template>
                      </div>
                    <div class="game-mode">{{ game.map_name || game.mode }} · {{ game.mode }}</div>
                  </div>
                  <div class="game-meta">
                    <span v-if="game.type === 'singleplayer'" class="game-score">{{ game.total_score }} pts</span>
                    <span v-else-if="game.type === 'duels'" class="game-score">{{ game.total_score }} pts <small v-if="game.rating_change">({{ game.rating_change > 0 ? '+' : '' }}{{ game.rating_change }})</small></span>
                    <span class="game-date">{{ formatDate(game.created_at) }}</span>
                    <span class="game-status" :class="game.status || game.result">{{ game.result || game.status }}</span>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>

<script setup>
import DashboardLayout from '../components/DashboardLayout.vue';
import RatingChart from '../components/RatingChart.vue';
import RatingName from '../components/RatingName.vue';
import BackButton from '../components/BackButton.vue';
import { ref, onMounted, computed, watch, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, authState } from '../auth';
import { useI18n } from 'vue-i18n';
import { toServerUrl } from '../config';
import { getRatingClass } from '../utils/rating';
import { formatLocaleDate, formatLocaleDateTime } from '../utils/dateFormat';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const profile = ref(null);
const loading = ref(true);
const games = ref([]);
const loadingGames = ref(false);
const validTabs = ['overview', 'history'];
const activeTab = computed(() => route.params.tab === 'history' ? 'history' : 'overview');

const filters = reactive({
  singleplayer: true,
  duels: true,
  battleroyales: true
});

const currentUser = computed(() => authState.user);
const isMe = computed(() => currentUser.value?.id === profile.value?.id);
const winRate = computed(() => {
  if (!profile.value?.total_duels) return 0;
  return Math.round((profile.value.total_wins / profile.value.total_duels) * 1000) / 10;
});

const sortedGames = computed(() => [...games.value].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
const filteredGames = computed(() => sortedGames.value.filter(g => filters[g.type]));
const recentGames = computed(() => sortedGames.value.slice(0, 6));

const goToTab = (tab) => {
  const target = validTabs.includes(tab) ? tab : 'overview';
  router.push(`/user/${route.params.id}/${target}`);
};

const getAvatar = (u) => {
  if (!u) return '';
  if (u.avatar_url) return toServerUrl(u.avatar_url);
  return `https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y`;
};

const ratingToneClass = (rating) => `rating-tone-${getRatingClass(rating || 1500).replace('-rating', '')}`;
const formatDate = (d) => formatLocaleDate(d, { month: 'short', day: 'numeric', year: 'numeric' }, 'en-US');
const formatDateTime = (d) => formatLocaleDateTime(d, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  } catch (err) {
    profile.value = null;
  } finally {
    loading.value = false;
  }
};

const fetchGames = async () => {
  if (!profile.value) return;
  loadingGames.value = true;
  try {
    const res = await api.get(`/user/${profile.value.id}/games`);
    games.value = Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error(err);
    games.value = [];
  } finally {
    loadingGames.value = false;
  }
};

const viewGame = (game) => {
  if (game.type === 'singleplayer' && game.status === 'finished') {
    router.push(`/singleplayer/analysis/${game.id}`);
  } else if (game.type === 'duels') {
    router.push(`/duels/${game.id}`);
  }
};

onMounted(fetchProfile);
watch(() => route.params.id, fetchProfile);
</script>

<style scoped>
.profile-layout {
  height: 100%;
  background: var(--color-page, var(--color-bg));
  overflow-y: auto;
}

.profile-shell {
  width: min(100%, 1220px);
  margin: 0 auto;
  padding: 1rem clamp(.9rem, 2vw, 1.35rem) 1.4rem;
}

.profile-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .9rem;
  margin-bottom: .9rem;
}

.profile-route-tabs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  border-radius: 999px;
  box-shadow: var(--shadow-sm);
}

.profile-route-tabs button {
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  border-radius: 999px;
  padding: .45rem .72rem;
  font-weight: 700;
  font-size: .86rem;
  display: inline-flex;
  align-items: center;
  gap: .45rem;
  cursor: pointer;
}
.profile-route-tabs button i {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.profile-route-tabs button.active {
  background: var(--color-surface);
  color: var(--color-text-main);
  box-shadow: inset 0 0 0 1px var(--color-border);
}

.profile-grid {
  display: grid;
  grid-template-columns: minmax(270px, 340px) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.profile-card,
.content-card,
.stats-strip {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
}

.profile-card {
  padding: 1.05rem;
  position: sticky;
  top: .8rem;
}

.avatar-wrapper {
  width: 92px;
  height: 92px;
  border-radius: 50%;
  overflow: hidden;
  margin: 0 0 .8rem;
  border: 4px solid var(--color-bg);
  box-shadow: 0 8px 22px rgba(15, 23, 42, .12);
}
.avatar-wrapper img { width: 100%; height: 100%; object-fit: cover; }
.profile-name-block { margin-bottom: .65rem; }
.username { font-size: 1.34rem; font-weight: 700; margin: 0 0 .45rem 0; color: var(--color-text-main); line-height: 1.15; }
.badges { display: flex; gap: 6px; flex-wrap: wrap; }
.badge { font-size: 0.68rem; font-weight: 700; padding: 3px 7px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; }
.root { background: #000; color: #fff; }
.admin { background: #4f46e5; color: #fff; }
.banned { background: #fee2e2; color: #ef4444; }
.explorer { background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text-muted); }

.bio-section {
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  padding: .8rem 0;
  margin: .65rem 0 .85rem;
  color: var(--color-text-main);
}
.bio-section p { margin: 0; line-height: 1.55; font-size: .95rem; }
.empty-bio { font-style: italic; color: var(--color-text-muted); }

.btn-edit {
  width: 100%;
  padding: 8px 12px;
  margin-bottom: .85rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-main);
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.btn-edit:hover { border-color: var(--color-primary); color: var(--color-primary); }

.profile-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
}
.meta-cell {
  padding: .62rem .68rem;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  min-width: 0;
}
.meta-cell:nth-child(2n) { border-right: 0; }
.meta-cell:nth-last-child(-n + 2) { border-bottom: 0; }
.meta-cell span {
  display: block;
  color: var(--color-text-muted);
  font-size: .68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
  margin-bottom: .18rem;
}
.meta-cell strong {
  display: block;
  color: var(--color-text-main);
  font-size: .88rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-main { min-width: 0; }
.profile-dashboard,
.tab-pane {
  display: flex;
  flex-direction: column;
  gap: .85rem;
}

.fade-in { animation: fadeIn 0.2s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

.stats-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  padding: .75rem .85rem;
  gap: .55rem;
}
.duel-stat {
  min-width: 0;
  text-align: center;
  padding: .28rem .35rem;
}
.duel-stat strong {
  display: block;
  font-size: 1.72rem;
  line-height: .98;
  font-weight: 750;
  letter-spacing: -.05em;
  color: var(--color-text-main);
}
.duel-stat span {
  display: block;
  margin-top: .28rem;
  font-size: .72rem;
  text-transform: uppercase;
  letter-spacing: .05em;
  font-weight: 700;
  color: var(--color-text-muted);
}
.duel-stat.win strong { color: #15803d; }
.duel-stat.loss strong { color: #dc2626; }
.duel-stat.draw strong { color: #ca8a04; }
.duel-stat.rate strong { color: var(--color-primary); }

.content-card { padding: .9rem; }
.rating-panel { padding-bottom: .55rem; }
.rating-title-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: .55rem;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: .55rem;
}
.rating-title-line h2 {
  margin: 0;
  font-size: 1.22rem;
  font-weight: 700;
  letter-spacing: -.02em;
}
.rating-title-line small {
  font-size: .9rem;
  color: var(--color-text-muted);
  font-weight: 700;
}
.chart-caption {
  color: var(--color-text-muted);
  font-size: .82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
  white-space: nowrap;
}
.rating-panel :deep(.rating-chart-container) {
  margin: 0;
  max-width: none;
  box-shadow: none;
  border-color: var(--color-border);
  background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
}
.rating-panel :deep(.chart-frame) {
  width: 100%;
  max-width: none;
}
.rating-panel :deep(.chart-expand-btn) {
  top: 92px;
}

.section-heading,
.history-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: .65rem;
}
.section-heading h2,
.history-header h2 { margin: 0 0 .12rem; font-size: 1.06rem; font-weight: 700; letter-spacing: -.02em; }
.section-heading p,
.history-header p { margin: 0; color: var(--color-text-muted); font-size: .86rem; }
.history-link {
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text-main);
  border-radius: 999px;
  padding: .44rem .76rem;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: .45rem;
  white-space: nowrap;
}
.history-link:hover { border-color: var(--color-primary); color: var(--color-primary); background: rgba(79,70,229,.05); }

.history-header {
  border-bottom: 1px solid var(--color-border);
  padding: .8rem .9rem .75rem;
  margin-bottom: .75rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
}
.filter-controls { display: flex; gap: 12px; flex-wrap: nowrap; white-space: nowrap; overflow-x: auto; max-width: 100%; padding-bottom: 2px; }
.filter-controls label { display: inline-flex; align-items: center; gap: 6px; font-size: .86rem; cursor: pointer; user-select: none; color: var(--color-text-muted); font-weight: 700; white-space: nowrap; flex: 0 0 auto; }

.history-list { display: flex; flex-direction: column; gap: .44rem; width: 100%; }
.history-list.compact { gap: .42rem; }
.game-row {
  display: flex;
  align-items: center;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: .55rem .68rem;
  border-radius: 9px;
  gap: 11px;
  transition: transform 0.16s, border-color .16s, background .16s;
  box-shadow: var(--shadow-sm);
}
.game-row:hover { transform: translateX(2px); border-color: var(--color-accent); }
.game-row.clickable { cursor: pointer; }
.game-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1rem; flex: 0 0 auto; }
.game-icon.singleplayer { background: #10b981; }
.game-icon.duels { background: #f59e0b; }
.game-icon.battleroyales { background: #ef4444; }
.game-info { flex: 1; min-width: 0; }
.game-type { font-weight: 700; font-size: .92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.duel-matchup { display: inline-flex; align-items: baseline; gap: .32rem; min-width: 0; max-width: 100%; }
.vs-text { color: var(--color-text-muted); font-weight: 700; }
.game-mode { font-size: .78rem; color: var(--color-text-muted); text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.game-meta { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 1px; flex: 0 0 auto; }
.game-score { font-weight: 750; color: var(--color-primary); font-size: .94rem; }
.game-date { font-size: .78rem; color: var(--color-text-muted); }
.game-status { font-size: .68rem; font-weight: 700; text-transform: uppercase; padding: 1px 6px; border-radius: 4px; background: var(--color-surface); color: var(--color-text-muted); }
.game-status.finished { color: var(--color-text-muted); }
.game-status.active { color: #10b981; background: #d1fae5; }
.game-status.win { color: #15803d; background: #dcfce7; }
.game-status.loss { color: #dc2626; background: #fee2e2; }
.game-status.draw { color: #ca8a04; background: #fef3c7; }
.loading-games,
.no-games { padding: 1rem; border: 1px dashed var(--color-border); border-radius: 10px; color: var(--color-text-muted); background: var(--color-bg); }
.center-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); gap: 1rem; }

.rating-tone-grey { color: #808080; }
.rating-tone-green { color: #008000; }
.rating-tone-cyan { color: #00c0c0; }
.rating-tone-blue { color: #0000ff; }
.rating-tone-yellow { color: #c0c000; }
.rating-tone-orange { color: #ff8000; }
.rating-tone-red { color: #ff0000; }
.rating-tone-nutella { color: #000; }
.rating-tone-tourist { color: #ff0000; }
.rating-tone-rainbow {
  background: linear-gradient(135deg, #ff0000, #ff0000, #ffd700, #ff0000, #ff0000);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

@media (min-width: 1440px) {
  .profile-shell { width: min(100%, 1280px); }
  .profile-grid { grid-template-columns: minmax(290px, 360px) minmax(0, 1fr); }
}

@media (max-width: 980px) {
  .profile-shell { padding: .85rem; }
  .profile-grid { grid-template-columns: 1fr; }
  .profile-card { position: static; }
  .avatar-wrapper { width: 78px; height: 78px; }
  .stats-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .rating-title-line,
  .history-header,
  .section-heading { flex-direction: column; align-items: flex-start; }
}

@media (max-width: 640px) {
  .profile-topbar { flex-direction: column; align-items: stretch; }
  .profile-route-tabs { align-self: stretch; justify-content: center; }
  .profile-route-tabs button { flex: 1; justify-content: center; }
  .profile-meta-grid { grid-template-columns: 1fr; }
  .meta-cell,
  .meta-cell:nth-child(2n),
  .meta-cell:nth-last-child(-n + 2) { border-right: 0; border-bottom: 1px solid var(--color-border); }
  .meta-cell:last-child { border-bottom: 0; }
  .stats-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .duel-stat strong { font-size: 1.45rem; }
  .game-row { align-items: flex-start; }
  .game-meta { min-width: 82px; }
}
</style>
