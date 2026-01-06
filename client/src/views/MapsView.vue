<template>
  <DashboardLayout page="maps">
    
    <header class="content-header">
      <div class="header-title">
        <h2>{{ t('maps.title') }}</h2>
        <p>{{ t('maps.subtitle') || 'Explore and manage game maps' }}</p>
      </div>
      <button v-if="canCreate" @click="router.push('/maps/create')" class="primary-btn create-btn">
        <i class="fa-solid fa-plus"></i> {{ t('maps.create') }}
      </button>
    </header>

    <div class="scroll-content">
      <div v-if="loading" class="loading">
        <i class="fa-solid fa-spinner fa-spin"></i> {{ t('common.loading') }}
      </div>

      <div v-else-if="maps.length === 0" class="empty-state">
        <i class="fa-solid fa-map"></i>
        <p>{{ t('maps.no_maps') }}</p>
      </div>

      <div v-else class="maps-grid">
        <div v-for="map in maps" :key="map.id" class="map-card">
          <div class="map-info">
            <div class="map-header" @click="router.push(`/maps/${map.id}`)" style="cursor: pointer">
              <h3>{{ map.name }}</h3>
              <span v-if="map.is_official" class="badge official"><i class="fa-solid fa-certificate"></i> {{ t('maps.is_official') }}</span>
            </div>
            <p class="description">{{ map.description || t('maps.no_desc') }}</p>
            <div class="meta">
              <span class="author" @click.stop="router.push(`/user/${map.creator_id}`)" style="cursor: pointer">
                <i class="fa-solid fa-user"></i> {{ map.User?.username || 'Unknown' }}
              </span>
              <span class="date"><i class="fa-regular fa-calendar"></i> {{ formatDate(map.created_at) }}</span>
            </div>
          </div>
          <div class="actions" v-if="canEdit(map)">
            <button @click="router.push(`/maps/${map.id}/edit`)" class="icon-btn edit-btn" :title="t('common.edit')">
              <i class="fa-solid fa-pen"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

  </DashboardLayout>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api, authState } from '../auth';
import DashboardLayout from '../components/DashboardLayout.vue';

const { t } = useI18n();
const router = useRouter();
const maps = ref([]);
const loading = ref(true);
const user = computed(() => authState.user);

const canCreate = computed(() => user.value?.is_admin || user.value?.is_root);

const canEdit = (map) => {
  if (!user.value) return false;
  if (user.value.is_root) return true;
  if (user.value.is_admin && map.creator_id === user.value.id) return true;
  return false;
};

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString();
};

const fetchMaps = async () => {
  try {
    const res = await api.get('/maps');
    maps.value = res.data;
  } catch (err) {
    console.error('Failed to fetch maps:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(fetchMaps);
</script>

<style scoped>
.content-header { 
  padding: 2rem 3rem; 
  border-bottom: 1px solid var(--color-border); 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
}
.header-title h2 { font-size: 1.5rem; margin-bottom: 4px; }
.header-title p { color: var(--color-text-muted); margin: 0; }

.scroll-content { padding: 2rem 3rem; overflow-y: auto; flex: 1; }

.create-btn { width: auto; }

.loading, .empty-state { text-align: center; padding: 4rem; color: var(--color-text-muted); }
.empty-state i { font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; }

.maps-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }

.map-card {
  background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius);
  padding: 1.5rem; display: flex; justify-content: space-between; align-items: flex-start;
  transition: all 0.2s;
}
.map-card:hover { border-color: var(--color-primary); box-shadow: var(--shadow-sm); transform: translateY(-2px); }

.map-info { flex: 1; min-width: 0; }
.map-header { display: flex; align-items: center; gap: 10px; margin-bottom: 0.5rem; }
.map-header h3 { margin: 0; font-size: 1.1rem; font-weight: 700; color: var(--color-text-main); }

.badge { font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600; text-transform: uppercase; }
.badge.official { background: rgba(51, 187, 173, 0.1); color: var(--color-accent); }

.description { color: var(--color-text-muted); font-size: 0.9rem; margin-bottom: 1rem; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.meta { display: flex; gap: 1rem; font-size: 0.8rem; color: var(--color-text-muted); }
.meta span { display: flex; align-items: center; gap: 5px; }

.icon-btn {
  background: transparent; border: 1px solid var(--color-border); color: var(--color-text-muted);
  width: 36px; height: 36px; border-radius: var(--radius); display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s; flex-shrink: 0; margin-left: 1rem;
}
.icon-btn:hover { border-color: var(--color-primary); color: var(--color-primary); background: rgba(79, 70, 229, 0.05); }
</style>
