<template>
  <DashboardLayout page="statistics">
    <header class="content-header">
      <div class="header-title">
        <h2>{{ t('statistics.title') }}</h2>
        <p>{{ t('statistics.subtitle') }}</p>
      </div>
    </header>

    <div class="scroll-content">
      <div v-if="loading" class="loading-state">
        <i class="fa-solid fa-circle-notch fa-spin"></i> {{ t('common.loading') }}
      </div>
      
      <div v-else class="stats-container">
        
        <!-- Singleplayer Stats -->
        <section class="stats-section">
          <div class="section-header">
            <div class="icon-box sp-icon">
              <i class="fa-solid fa-person-hiking"></i>
            </div>
            <h3>{{ t('lobby.singlePlayer') }}</h3>
          </div>

          <div class="chart-wrapper">
             <ScoreChart :userId="user.id" v-if="user" />
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">{{ t('statistics.games_played') }}</div>
              <div class="stat-value">{{ stats.singleplayer.totalGames }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">{{ t('statistics.avg_score') }}</div>
              <div class="stat-value">{{ stats.singleplayer.avgScore }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">{{ t('statistics.best_score') }}</div>
              <div class="stat-value highlight">{{ stats.singleplayer.maxScore }}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">{{ t('statistics.total_score') }}</div>
                <div class="stat-value">{{ formatNumber(stats.singleplayer.totalScore) }}</div>
            </div>
          </div>

          <div class="mode-breakdown" v-if="stats.singleplayer.modeStats.length > 0">
            <h4>{{ t('statistics.mode_breakdown') }}</h4>
            <div class="table-wrapper">
              <table class="stats-table">
                <thead>
                  <tr>
                    <th>{{ t('analysis.mode') }}</th>
                    <th>{{ t('statistics.games_played') }}</th>
                    <th>{{ t('statistics.avg_score') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="mode in stats.singleplayer.modeStats" :key="mode.mode">
                    <td class="capitalize">{{ mode.mode }}</td>
                    <td>{{ mode.count }}</td>
                    <td>{{ mode.avgScore }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-else class="empty-state">
            {{ t('statistics.no_data') }}
          </div>
        </section>

        <!-- Other Modes (Placeholders) -->
        <section class="stats-section locked">
            <div class="section-header">
                <div class="icon-box duels-icon">
                <i class="fa-solid fa-fire"></i>
                </div>
                <h3>{{ t('lobby.duels') }}</h3>
                <span class="badge">{{ t('lobby.soon') }}</span>
            </div>
        </section>

        <section class="stats-section locked">
            <div class="section-header">
                <div class="icon-box br-icon">
                <i class="fa-solid fa-trophy"></i>
                </div>
                <h3>{{ t('lobby.battleRoyale') }}</h3>
                <span class="badge">{{ t('lobby.soon') }}</span>
            </div>
        </section>

      </div>
    </div>
  </DashboardLayout>
</template>

<script setup>
import DashboardLayout from '../components/DashboardLayout.vue';
import ScoreChart from '../components/ScoreChart.vue';
import { ref, onMounted, computed } from 'vue';
import { api, authState } from '../auth';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const loading = ref(true);
const stats = ref({
  singleplayer: {
    totalGames: 0,
    totalScore: 0,
    avgScore: 0,
    maxScore: 0,
    modeStats: []
  }
});

const user = computed(() => authState.user);

const formatNumber = (num) => {
    return num.toLocaleString();
};

const fetchStats = async () => {
  if (!user.value) return;
  
  loading.value = true;
  try {
    const res = await api.get(`/user/${user.value.id}/stats`);
    if (res.data) {
        stats.value = res.data;
    }
  } catch (err) {
    console.error("Failed to fetch stats", err);
  } finally {
    loading.value = false;
  }
};

onMounted(fetchStats);
</script>

<style scoped>
.content-header { padding: 2rem 3rem; border-bottom: 1px solid var(--color-border); }
.header-title h2 { font-size: 1.5rem; margin-bottom: 4px; }
.header-title p { color: var(--color-text-muted); margin: 0; }
.scroll-content { padding: 2rem 3rem; overflow-y: auto; flex: 1; }

.loading-state { text-align: center; padding: 4rem; color: var(--color-text-muted); font-size: 1.2rem; }

.stats-container { display: flex; flex-direction: column; gap: 2rem; max-width: 1000px; margin: 0 auto; }

.stats-section {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
}

.stats-section.locked {
    opacity: 0.7;
    background: var(--color-surface);
}

.section-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.section-header h3 { margin: 0; font-size: 1.2rem; }

.icon-box {
  width: 40px; height: 40px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.2rem;
}
.sp-icon { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.duels-icon { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
.br-icon { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
.stat-card {
  background: var(--color-surface);
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  text-align: center;
}
.stat-label { font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px; }
.stat-value { font-size: 1.5rem; font-weight: 700; color: var(--color-text-main); }
.stat-value.highlight { color: var(--color-primary); }

.mode-breakdown h4 { margin-bottom: 1rem; font-size: 1rem; color: var(--color-text-muted); }
.table-wrapper { overflow-x: auto; }
.stats-table { width: 100%; border-collapse: collapse; }
.stats-table th { text-align: left; padding: 10px; border-bottom: 1px solid var(--color-border); color: var(--color-text-muted); font-size: 0.85rem; }
.stats-table td { padding: 10px; border-bottom: 1px solid var(--color-border); }
.stats-table tr:last-child td { border-bottom: none; }
.capitalize { text-transform: capitalize; }

.badge { font-size: 0.7rem; background: var(--color-border); padding: 2px 8px; border-radius: 10px; color: var(--color-text-muted); font-weight: 600; margin-left: auto; }
.empty-state { text-align: center; color: var(--color-text-muted); padding: 2rem; font-style: italic; }
</style>
