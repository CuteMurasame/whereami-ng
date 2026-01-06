<template>
  <DashboardLayout page="maps">
    <header class="content-header">
      <div class="header-left">
        <button @click="router.push('/maps')" class="back-link">
          <i class="fa-solid fa-arrow-left"></i>
        </button>
        <div class="header-title">
          <h2>{{ map.name }}</h2>
          <div class="subtitle">
            <span v-if="map.is_official" class="badge official"><i class="fa-solid fa-certificate"></i> {{ t('maps.is_official') }}</span>
            <span class="author" @click="router.push(`/user/${map.creator_id}`)" style="cursor: pointer">
              <i class="fa-solid fa-user"></i> {{ map.User?.username || 'Unknown' }}
            </span>
            <span class="date"><i class="fa-regular fa-calendar"></i> {{ formatDate(map.created_at) }}</span>
          </div>
        </div>
      </div>
      <div class="header-actions" v-if="canEdit">
        <button @click="router.push(`/maps/${map.id}/edit`)" class="primary-btn">
          <i class="fa-solid fa-pen"></i> {{ t('common.edit') }}
        </button>
      </div>
    </header>

    <div class="scroll-content">
      <div class="detail-container">
        
        <!-- Description Card -->
        <div class="card info-card">
          <h3>{{ t('maps.desc_label') }}</h3>
          <p class="description">{{ map.description || t('maps.no_desc') }}</p>
          
          <div class="play-actions">
            <button @click="playRandom" class="primary-btn play-btn" :disabled="totalLocations === 0">
              <i class="fa-solid fa-dice"></i> {{ t('maps.random_view') }}
            </button>
          </div>
        </div>

        <!-- Leaderboard -->
        <div class="card list-card">
          <div class="list-header" style="display: flex; justify-content: space-between; align-items: center;">
            <h3>{{ t('analysis.leaderboard') }}</h3>
            <div class="mode-tabs">
              <button 
                v-for="m in ['moving', 'nm', 'nmpz']" 
                :key="m"
                :class="['tab-btn', { active: leaderboardMode === m }]"
                @click="changeLeaderboardMode(m)"
              >
                {{ t(`analysis.${m}`) }}
              </button>
            </div>
          </div>

          <div v-if="loadingLeaderboard" class="loading-box">
            <i class="fa-solid fa-spinner fa-spin"></i>
          </div>

          <div v-else-if="leaderboard.length === 0" class="empty-box">
            {{ t('maps.no_scores') }}
          </div>

          <div v-else class="table-wrapper">
            <table class="locations-table">
              <thead>
                <tr>
                  <th style="width: 80px">{{ t('analysis.rank') }}</th>
                  <th>{{ t('analysis.player') }}</th>
                  <th>{{ t('analysis.score') }}</th>
                  <th>{{ t('analysis.date') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(entry, index) in leaderboard" :key="entry.userId">
                  <td>
                    <span :class="['rank-badge', `rank-${(leaderboardPage - 1) * leaderboardLimit + index + 1}`]">
                      #{{ (leaderboardPage - 1) * leaderboardLimit + index + 1 }}
                    </span>
                  </td>
                  <td>
                    <div class="user-cell" @click="router.push(`/user/${entry.userId}`)" style="cursor: pointer">
                      <img :src="authState.getAvatar(entry)" class="avatar-mini" />
                      <span>{{ entry.username }}</span>
                    </div>
                  </td>
                  <td class="mono font-bold">{{ entry.max_score.toLocaleString() }}</td>
                  <td class="mono">{{ formatDate(entry.achieved_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="pagination" v-if="leaderboard.length === leaderboardLimit || leaderboardPage > 1">
            <button :disabled="leaderboardPage === 1" @click="changeLeaderboardPage(leaderboardPage - 1)" class="page-btn">
              <i class="fa-solid fa-chevron-left"></i>
            </button>
            <span class="page-info">{{ leaderboardPage }}</span>
            <button :disabled="leaderboard.length < leaderboardLimit" @click="changeLeaderboardPage(leaderboardPage + 1)" class="page-btn">
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>

        <!-- Locations List (Admins/Creators Only) -->
        <div class="card list-card" v-if="canEdit">
          <div class="list-header">
            <h3>{{ t('maps.locations_label') }} ({{ totalLocations }})</h3>
          </div>
          
          <div v-if="loadingLocations" class="loading-box">
            <i class="fa-solid fa-spinner fa-spin"></i>
          </div>

          <div v-else-if="locations.length === 0" class="empty-box">
            {{ t('maps.no_locations') }}
          </div>

          <div v-else class="table-wrapper">
            <table class="locations-table">
              <thead>
                <tr>
                  <th style="width: 60px">ID</th>
                  <th>{{ t('maps.pano_id') }}</th>
                  <th>{{ t('maps.lat_lng') }}</th>
                  <th style="width: 80px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="loc in locations" :key="loc.id">
                  <td>{{ loc.id }}</td>
                  <td class="mono">{{ loc.pano_id }}</td>
                  <td class="mono">{{ loc.lat.toFixed(5) }}, {{ loc.lng.toFixed(5) }}</td>
                  <td class="text-right">
                    <a :href="`https://www.google.com/maps/@?api=1&map_action=pano&pano=${loc.pano_id}`" target="_blank" class="icon-btn view-btn" :title="t('analysis.open_maps')">
                      <i class="fa-solid fa-external-link-alt"></i>
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="pagination" v-if="totalPages > 1">
            <button :disabled="page === 1" @click="changePage(page - 1)" class="page-btn">
              <i class="fa-solid fa-chevron-left"></i>
            </button>
            <span class="page-info">{{ page }} / {{ totalPages }}</span>
            <button :disabled="page === totalPages" @click="changePage(page + 1)" class="page-btn">
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>

      </div>
    </div>
  </DashboardLayout>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api, authState } from '../auth';
import DashboardLayout from '../components/DashboardLayout.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const map = ref({});
const locations = ref([]);
const totalLocations = ref(0);
const page = ref(1);
const totalPages = ref(1);
const limit = 50;
const loadingLocations = ref(false);

const leaderboard = ref([]);
const leaderboardMode = ref('moving');
const leaderboardPage = ref(1);
const leaderboardLimit = 50;
const loadingLeaderboard = ref(false);

const user = computed(() => authState.user);
const canEdit = computed(() => {
  if (!user.value) return false;
  if (user.value.is_root) return true;
  if (user.value.is_admin && map.value.creator_id === user.value.id) return true;
  return false;
});

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString();
};

const fetchMapDetails = async () => {
  try {
    const res = await api.get(`/maps/${route.params.id}`);
    map.value = res.data;
    totalLocations.value = res.data.locationCount || 0;
  } catch (err) {
    console.error(err);
    router.push('/maps');
  }
};

const fetchLocations = async () => {
  if (!canEdit.value) return; // Don't fetch list if not allowed
  
  loadingLocations.value = true;
  try {
    const res = await api.get(`/maps/${route.params.id}/locations`, {
      params: { page: page.value, limit }
    });
    locations.value = res.data.locations;
    totalLocations.value = res.data.total;
    totalPages.value = res.data.totalPages;
  } catch (err) {
    console.error(err);
  } finally {
    loadingLocations.value = false;
  }
};

const fetchLeaderboard = async () => {
  loadingLeaderboard.value = true;
  try {
    const res = await api.get(`/maps/${route.params.id}/leaderboard`, {
      params: { 
        mode: leaderboardMode.value, 
        page: leaderboardPage.value, 
        limit: leaderboardLimit 
      }
    });
    leaderboard.value = res.data;
  } catch (err) {
    console.error(err);
  } finally {
    loadingLeaderboard.value = false;
  }
};

const changeLeaderboardMode = (mode) => {
  leaderboardMode.value = mode;
  leaderboardPage.value = 1;
  fetchLeaderboard();
};

const changeLeaderboardPage = (newPage) => {
  leaderboardPage.value = newPage;
  fetchLeaderboard();
};

const changePage = (newPage) => {
  if (newPage >= 1 && newPage <= totalPages.value) {
    page.value = newPage;
    fetchLocations();
  }
};

const playRandom = async () => {
  try {
    const res = await api.get(`/maps/${route.params.id}/random`);
    const loc = res.data;
    window.open(`https://www.google.com/maps/@?api=1&map_action=pano&pano=${loc.pano_id}`, '_blank');
  } catch (err) {
    alert(t('maps.no_locations_play'));
  }
};

onMounted(async () => {
  await fetchMapDetails();
  fetchLeaderboard();
  if (canEdit.value) {
    await fetchLocations();
  }
});
</script>

<style scoped>
.content-header { 
  padding: 2rem 3rem; 
  border-bottom: 1px solid var(--color-border); 
  display: flex; 
  justify-content: space-between;
  align-items: center; 
}
.header-left { display: flex; align-items: center; gap: 1.5rem; }
.back-link { 
  background: var(--color-surface); border: 1px solid var(--color-border); 
  width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  color: var(--color-text-muted); cursor: pointer; transition: all 0.2s;
}
.back-link:hover { color: var(--color-primary); border-color: var(--color-primary); }

.header-title h2 { font-size: 1.8rem; margin: 0 0 0.5rem 0; }
.subtitle { display: flex; align-items: center; gap: 1rem; color: var(--color-text-muted); font-size: 0.9rem; }
.subtitle span { display: flex; align-items: center; gap: 5px; }

.badge { font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600; text-transform: uppercase; }
.badge.official { background: rgba(51, 187, 173, 0.1); color: var(--color-accent); }

.scroll-content { padding: 2rem 3rem; overflow-y: auto; flex: 1; }
.detail-container { max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; gap: 2rem; }

.card { 
  background: var(--color-bg); border: 1px solid var(--color-border); 
  border-radius: var(--radius); padding: 1.5rem; 
}

.info-card h3 { margin-top: 0; font-size: 1.1rem; margin-bottom: 1rem; }
.description { line-height: 1.6; color: var(--color-text-main); white-space: pre-wrap; margin-bottom: 1.5rem; }

.play-actions { border-top: 1px solid var(--color-border); padding-top: 1.5rem; }
.play-btn { max-width: 250px; background-color: var(--color-accent); }
.play-btn:hover { background-color: var(--color-accent-hover); }

/* List Card */
.list-card { padding: 0; overflow: hidden; display: flex; flex-direction: column; }
.list-header { padding: 1.5rem; border-bottom: 1px solid var(--color-border); }
.list-header h3 { margin: 0; }

.table-wrapper { overflow-x: auto; }
.locations-table { width: 100%; border-collapse: collapse; }
.locations-table th { 
  text-align: left; padding: 12px 1.5rem; background: var(--color-surface); 
  font-weight: 600; font-size: 0.85rem; color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
}
.locations-table td { 
  padding: 10px 1.5rem; border-bottom: 1px solid var(--color-border); 
  font-size: 0.9rem; color: var(--color-text-main);
}
.locations-table tr:last-child td { border-bottom: none; }
.locations-table tr:hover { background: var(--color-surface); }

.mono { font-family: monospace; }
.text-right { text-align: right; }

.icon-btn {
  background: transparent; border: none; color: var(--color-text-muted);
  cursor: pointer; padding: 6px; border-radius: 4px; transition: all 0.2s;
  display: inline-flex; align-items: center; justify-content: center;
}
.view-btn:hover { color: var(--color-primary); background: rgba(79, 70, 229, 0.1); }

.pagination { 
  padding: 1rem; border-top: 1px solid var(--color-border); 
  display: flex; justify-content: center; align-items: center; gap: 1rem; 
}
.page-btn {
  background: var(--color-surface); border: 1px solid var(--color-border);
  width: 32px; height: 32px; border-radius: 4px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.page-info { font-size: 0.9rem; color: var(--color-text-muted); }

.loading-box, .empty-box { padding: 3rem; text-align: center; color: var(--color-text-muted); }

.mode-tabs { display: flex; gap: 5px; background: var(--color-surface); padding: 4px; border-radius: 6px; border: 1px solid var(--color-border); }
.tab-btn { 
  background: transparent; border: none; padding: 6px 12px; border-radius: 4px; 
  color: var(--color-text-muted); cursor: pointer; font-size: 0.85rem; font-weight: 600;
  transition: all 0.2s;
}
.tab-btn.active { background: var(--color-bg); color: var(--color-primary); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.tab-btn:hover:not(.active) { color: var(--color-text-main); }

.user-cell { display: flex; align-items: center; gap: 10px; }
.avatar-mini { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; background: var(--color-border); }
.font-bold { font-weight: 600; }

.rank-badge { font-weight: 700; color: var(--color-text-muted); }
.rank-1 { color: #fbbf24; } /* Gold */
.rank-2 { color: #9ca3af; } /* Silver */
.rank-3 { color: #b45309; } /* Bronze */
</style>
