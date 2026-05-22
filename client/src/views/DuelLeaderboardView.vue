<template>
  <DashboardLayout page="duels">
    <header class="content-header competition-header">
      <div class="header-title">
        <span class="eyebrow"><i class="fa-solid fa-ranking-star"></i> Rated Duels</span>
        <h2>{{ t('duels.leaderboard') }}</h2>
        <p>{{ t('duels.leaderboardDesc') }}</p>
      </div>
      <div class="header-actions">
        <div class="leaderboard-meta" v-if="!loading && players.length">
          <span><b>{{ players.length }}</b> {{ t('analysis.player') }}</span>
          <span><b>{{ topRating }}</b> Top</span>
          <span><b>{{ averageWinRate }}%</b> Avg win</span>
        </div>
        <button class="secondary-btn" @click="router.push('/duels')">
          <i class="fa-solid fa-fire"></i> {{ t('duels.backToQueue') }}
        </button>
      </div>
    </header>

    <div class="scroll-content leaderboard-content">
      <section class="board-card">
        <div class="board-toolbar">
          <strong>Duel Rating Board</strong>
          <span>Rating · Peak · Games · W-L-D · Win%</span>
        </div>

        <div v-if="loading" class="center-state"><i class="fa-solid fa-circle-notch fa-spin"></i> {{ t('common.loading') }}</div>
        <div v-else-if="players.length === 0" class="center-state">{{ t('duels.noRatedPlayers') }}</div>
        <div v-else class="table-wrapper">
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th class="rank-col">{{ t('analysis.rank') }}</th>
                <th>{{ t('analysis.player') }}</th>
                <th class="numeric">{{ t('duels.rating') }}</th>
                <th class="numeric">{{ t('duels.peak') }}</th>
                <th class="numeric">Games</th>
                <th class="numeric">{{ t('duels.record') }}</th>
                <th class="numeric win-col">{{ t('profile.winRate') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="player in players"
                :key="player.id"
                :class="['player-row', { mine: player.id === user?.id, podium: player.rank <= 3 }]"
                @click="router.push(`/user/${player.id}`)"
              >
                <td class="rank">
                  <span :class="['rank-badge', rankClass(player.rank)]">{{ player.rank }}</span>
                </td>
                <td class="player-cell">
                  <div class="player-line">
                    <RatingName :user="player" />
                    <span v-if="player.id === user?.id" class="you-chip">YOU</span>
                  </div>
                </td>
                <td class="rating-value numeric" :class="player.rating_class">{{ player.elo_rating }}</td>
                <td class="peak-value numeric">{{ player.peak_elo }}</td>
                <td class="numeric games-value">{{ player.elo_games || player.total_duels || 0 }}</td>
                <td class="numeric record-cell">
                  <span class="wins">{{ player.total_wins }}</span><span class="record-sep">-</span><span class="losses">{{ player.total_losses }}</span><span class="record-sep">-</span><span class="draws">{{ player.total_draws }}</span>
                </td>
                <td class="numeric win-col">
                  <div class="winrate-wrap">
                    <span :class="['win-pill', winClass(player.win_rate)]">{{ player.win_rate }}%</span>
                    <span class="win-bar"><i :style="{ width: `${Math.min(100, Math.max(0, player.win_rate || 0))}%` }"></i></span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </DashboardLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import DashboardLayout from '../components/DashboardLayout.vue';
import RatingName from '../components/RatingName.vue';
import { api, authState } from '../auth';

const router = useRouter();
const { t } = useI18n();
const players = ref([]);
const loading = ref(true);
const user = computed(() => authState.user);

const topRating = computed(() => players.value[0]?.elo_rating || '—');
const averageWinRate = computed(() => {
  if (!players.value.length) return 0;
  const total = players.value.reduce((sum, player) => sum + Number(player.win_rate || 0), 0);
  return Math.round((total / players.value.length) * 10) / 10;
});

const rankClass = (rank) => {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return '';
};

const winClass = (rate) => {
  if (rate >= 60) return 'strong';
  if (rate >= 45) return 'steady';
  return 'danger';
};

const fetchLeaderboard = async () => {
  loading.value = true;
  try {
    const res = await api.get('/duels/leaderboard?limit=100');
    players.value = res.data.players || [];
  } finally {
    loading.value = false;
  }
};

onMounted(fetchLeaderboard);
</script>

<style scoped>
.content-header {
  padding: var(--page-y) var(--page-x);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  background: var(--color-bg);
}
.header-title { min-width: 0; display: flex; align-items: baseline; gap: .8rem; flex-wrap: wrap; }
.eyebrow { display: inline-flex; align-items: center; gap: 6px; color: var(--color-primary); font-weight: 700; font-size: .72rem; text-transform: uppercase; letter-spacing: .08em; }
.header-title h2 { font-size: 1.34rem; line-height: 1.1; margin: 0; font-weight: 700; letter-spacing: -.02em; }
.header-title p { color: var(--color-text-muted); margin: 0; font-size: .86rem; }
.header-actions { display: flex; align-items: center; gap: .75rem; }
.leaderboard-meta { display: inline-flex; align-items: center; gap: .45rem; flex-wrap: wrap; justify-content: flex-end; }
.leaderboard-meta span { display: inline-flex; align-items: center; gap: .28rem; height: 30px; padding: 0 .65rem; border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-surface); color: var(--color-text-muted); font-size: .78rem; font-weight: 700; white-space: nowrap; }
.leaderboard-meta b { color: var(--color-text-main); font-weight: 700; }
.scroll-content { padding: var(--page-y) var(--page-x); overflow-y: auto; flex: 1; background: var(--color-page, var(--color-bg)); }
.board-card { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 12px; box-shadow: var(--shadow-card); width: 100%; margin: 0; overflow: hidden; }
.board-toolbar { min-height: 38px; display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0 .85rem; border-bottom: 1px solid var(--color-border); background: var(--color-surface); }
.board-toolbar strong { font-weight: 700; letter-spacing: -.01em; }
.board-toolbar span { color: var(--color-text-muted); font-weight: 700; font-size: .78rem; text-transform: uppercase; letter-spacing: .05em; }
.table-wrapper { overflow: auto; max-height: calc(100vh - 138px); }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
thead th { position: sticky; top: 0; z-index: 1; }
th { height: 34px; text-align: left; padding: 0 .72rem; color: var(--color-text-muted); font-size: .72rem; text-transform: uppercase; letter-spacing: .06em; background: var(--color-surface); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
td { height: 42px; padding: 0 .72rem; border-top: 1px solid var(--color-border); vertical-align: middle; }
.player-row { cursor: pointer; transition: background .12s ease, box-shadow .12s ease; }
.player-row:nth-child(even) { background: color-mix(in srgb, var(--color-surface) 32%, transparent); }
.player-row:hover { background: rgba(79, 70, 229, .055); box-shadow: inset 3px 0 0 var(--color-primary); }
tr.mine { background: rgba(51,187,173,.11) !important; box-shadow: inset 3px 0 0 var(--color-accent); }
.rank-col { width: 74px; }
.rank { font-weight: 700; }
.rank-badge { min-width: 28px; height: 24px; border-radius: 999px; display: inline-grid; place-items: center; padding: 0 .42rem; background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text-muted); font-size: .8rem; }
.rank-badge.gold { background: #111827; color: #fbbf24; border-color: rgba(251,191,36,.68); }
.rank-badge.silver { background: #1f2937; color: #e5e7eb; border-color: rgba(229,231,235,.7); }
.rank-badge.bronze { background: #292524; color: #fb923c; border-color: rgba(251,146,60,.7); }
.player-cell { min-width: 230px; }
.player-line { display: flex; align-items: center; gap: .5rem; min-width: 0; font-weight: 700; }
.you-chip { font-size: .63rem; padding: .1rem .34rem; border-radius: 999px; background: rgba(51,187,173,.14); color: var(--color-accent); font-weight: 700; border: 1px solid rgba(51,187,173,.25); }
.numeric { text-align: right; white-space: nowrap; }
.rating-value { font-weight: 750; font-size: 1.04rem; }
.peak-value { font-weight: 700; color: var(--color-text-main); }
.games-value { color: var(--color-text-muted); font-weight: 700; }
.record-cell { font-weight: 700; }
.wins { color: #059669; }
.losses { color: #dc2626; }
.draws { color: #b45309; }
.record-sep { color: var(--color-text-muted); padding: 0 .15rem; }
.win-col { min-width: 118px; }
.winrate-wrap { display: inline-grid; grid-template-columns: auto 54px; align-items: center; gap: .5rem; }
.win-pill { display: inline-flex; justify-content: center; min-width: 54px; padding: .16rem .42rem; border-radius: 999px; font-weight: 750; font-size: .78rem; border: 1px solid transparent; }
.win-pill.strong { color: #047857; background: rgba(16,185,129,.12); border-color: rgba(16,185,129,.20); }
.win-pill.steady { color: #92400e; background: rgba(245,158,11,.14); border-color: rgba(245,158,11,.22); }
.win-pill.danger { color: #b91c1c; background: rgba(239,68,68,.10); border-color: rgba(239,68,68,.18); }
.win-bar { width: 54px; height: 5px; border-radius: 999px; background: var(--color-border); overflow: hidden; display: inline-block; }
.win-bar i { display: block; height: 100%; background: #111827; border-radius: inherit; }
.center-state { padding: 3rem; text-align: center; color: var(--color-text-muted); }
.secondary-btn { border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-main); border-radius: var(--radius); padding: .48rem .8rem; font-weight: 700; cursor: pointer; display: inline-flex; gap: .5rem; align-items: center; justify-content: center; white-space: nowrap; }
.secondary-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
[data-theme="dark"] .win-bar i { background: #f8fafc; }
@media (max-width: 880px) {
  .content-header { flex-direction: column; align-items: stretch; }
  .header-title { align-items: flex-start; }
  .header-actions { align-items: stretch; flex-direction: column; }
  .leaderboard-meta { justify-content: flex-start; }
  .table-wrapper { max-height: none; }
}
@media (max-width: 620px) {
  .board-toolbar { align-items: flex-start; flex-direction: column; gap: .2rem; padding: .55rem .75rem; }
}
</style>
