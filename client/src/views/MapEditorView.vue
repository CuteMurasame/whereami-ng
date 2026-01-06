<template>
  <DashboardLayout page="maps">
    <header class="content-header">
      <div class="header-left">
        <button @click="router.push('/maps')" class="back-link">
          <i class="fa-solid fa-arrow-left"></i>
        </button>
        <div class="header-title">
          <h2>{{ isEditMode ? t('maps.edit_title') : t('maps.create_title') }}</h2>
          <p v-if="isEditMode">{{ t('maps.location_count', { count: totalLocations }) }}</p>
        </div>
      </div>
    </header>

    <div class="scroll-content">
      
      <!-- CREATE MODE -->
      <div v-if="!isEditMode" class="create-container">
        <div class="card form-card">
          <div class="form-group">
            <label>{{ t('maps.name_label') }}</label>
            <input v-model="form.name" type="text" :placeholder="t('maps.name_placeholder')" />
          </div>
          <div class="form-group">
            <label>{{ t('maps.desc_label') }}</label>
            <textarea v-model="form.description" rows="3"></textarea>
          </div>
          <div class="form-group checkbox-group" v-if="isRoot">
            <input type="checkbox" id="official-check" v-model="form.is_official">
            <label for="official-check">{{ t('maps.is_official') }}</label>
          </div>
          <div class="form-group">
            <label>{{ t('maps.locations_label') }}</label>
            <div class="info-box">
              <i class="fa-solid fa-circle-info"></i>
              {{ t('maps.locations_help') }}
            </div>
            <textarea 
              v-model="form.newLocations" 
              rows="10" 
              class="code-font"
              :placeholder="t('maps.locations_placeholder')"
            ></textarea>
          </div>
          <div class="actions">
            <button @click="createMap" :disabled="saving" class="primary-btn save-btn">
              <i v-if="saving" class="fa-solid fa-spinner fa-spin"></i>
              <span v-else>{{ t('maps.create') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- EDIT MODE -->
      <div v-else class="editor-grid">
        
        <!-- LEFT COLUMN: Metadata & Add -->
        <div class="editor-sidebar">
          <!-- Metadata Card -->
          <div class="card form-card">
            <h3>{{ t('maps.metadata_title') }}</h3>
            <div class="form-group">
              <label>{{ t('maps.name_label') }}</label>
              <input v-model="form.name" type="text" />
            </div>
            <div class="form-group">
              <label>{{ t('maps.desc_label') }}</label>
              <textarea v-model="form.description" rows="3"></textarea>
            </div>
            <div class="form-group checkbox-group" v-if="isRoot">
              <input type="checkbox" id="official-check-edit" v-model="form.is_official">
              <label for="official-check-edit">{{ t('maps.is_official') }}</label>
            </div>
            <div class="form-group checkbox-group" v-if="isRoot">
              <input type="checkbox" id="singleplayer-check-edit" v-model="form.is_singleplayer">
              <label for="singleplayer-check-edit">{{ t('maps.is_singleplayer') }}</label>
            </div>
            <button @click="saveMetadata" :disabled="saving" class="primary-btn full-width">
              {{ t('maps.save_metadata') }}
            </button>
            
            <div class="delete-section">
              <button 
                @click="handleDeleteMap" 
                @keydown.prevent 
                class="danger-btn full-width"
                :class="{ 'confirming': deleteCount < 10 }"
              >
                <i class="fa-solid fa-trash"></i>
                <span v-if="deleteCount === 10">{{ t('maps.delete_map') }}</span>
                <span v-else>{{ t('maps.delete_map_confirm', { count: deleteCount }) }}</span>
              </button>
            </div>
          </div>

          <!-- Add Locations Card -->
          <div class="card form-card">
            <h3>{{ t('maps.add_locations_title') }}</h3>
            <div class="info-box">
              <i class="fa-solid fa-circle-info"></i>
              {{ t('maps.locations_help') }}
            </div>
            <textarea 
              v-model="form.newLocations" 
              rows="6" 
              class="code-font"
              :placeholder="t('maps.locations_placeholder')"
            ></textarea>
            <button @click="addLocations" :disabled="adding || !form.newLocations" class="primary-btn full-width add-btn">
              <i v-if="adding" class="fa-solid fa-spinner fa-spin"></i>
              <span v-else>{{ t('maps.add_btn') }}</span>
            </button>
          </div>

          <!-- Import Vali JSON Card -->
          <div class="card form-card">
            <h3>Import Vali JSON</h3>
            <div class="info-box">
              <i class="fa-solid fa-circle-info"></i>
              Import JSON from Vali generator
            </div>
            <input 
              type="file" 
              accept=".json"
              ref="fileInput"
              @change="handleFileSelect"
              class="file-input"
            />
            <button @click="importValiJson" :disabled="importing || !selectedFile" class="primary-btn full-width add-btn">
              <i v-if="importing" class="fa-solid fa-spinner fa-spin"></i>
              <span v-else>Import JSON</span>
            </button>
          </div>
        </div>

        <!-- RIGHT COLUMN: Location List -->
        <div class="editor-main">
          <div class="card list-card">
            <div class="list-header">
              <h3>{{ t('maps.manage_locations') }}</h3>
              <div class="header-actions">
                <button v-if="isRoot" @click="refreshAllLocations" :disabled="refreshing" class="icon-btn refresh-all-btn" :title="t('maps.refresh_all')">
                  <i :class="['fa-solid fa-arrows-rotate', refreshing ? 'fa-spin' : '']"></i>
                </button>
                <button @click="fetchLocations" class="icon-btn refresh-btn"><i class="fa-solid fa-rotate-right"></i></button>
              </div>
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
                    <th class="text-right" style="width: 80px">{{ t('common.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="loc in locations" :key="loc.id">
                    <td>{{ loc.id }}</td>
                    <td class="mono">{{ loc.pano_id }}</td>
                    <td class="mono">{{ loc.lat.toFixed(5) }}, {{ loc.lng.toFixed(5) }}</td>
                    <td class="text-right">
                      <button @click="deleteLocation(loc.id)" class="icon-btn delete-btn">
                        <i class="fa-solid fa-trash"></i>
                      </button>
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
    </div>
  </DashboardLayout>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api, authState } from '../auth';
import DashboardLayout from '../components/DashboardLayout.vue';
import Swal from 'sweetalert2';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const user = computed(() => authState.user);
const isRoot = computed(() => user.value?.is_root);

const isEditMode = computed(() => !!route.params.id);
const saving = ref(false);
const adding = ref(false);
const refreshing = ref(false);
const importing = ref(false);
const selectedFile = ref(null);
const fileInput = ref(null);
const loadingLocations = ref(false);
const deleteCount = ref(10);

const form = ref({
  name: '',
  description: '',
  newLocations: '',
  is_official: false,
  is_singleplayer: false
});

// Location Management State
const locations = ref([]);
const totalLocations = ref(0);
const page = ref(1);
const totalPages = ref(1);
const limit = 50;

onMounted(async () => {
  if (isEditMode.value) {
    await fetchMapDetails();
    await fetchLocations();
  }
});

const fetchMapDetails = async () => {
  try {
    const res = await api.get(`/maps/${route.params.id}`);
    form.value.name = res.data.name;
    form.value.description = res.data.description;
    form.value.is_official = res.data.is_official;
    form.value.is_singleplayer = res.data.is_singleplayer;
    totalLocations.value = res.data.locationCount || 0;
  } catch (err) {
    console.error(err);
    router.push('/maps');
  }
};

const fetchLocations = async () => {
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

const changePage = (newPage) => {
  if (newPage >= 1 && newPage <= totalPages.value) {
    page.value = newPage;
    fetchLocations();
  }
};

// --- ACTIONS ---

const createMap = async () => {
  if (!form.value.name) return Swal.fire(t('admin.error'), t('maps.name_required'), 'error');
  
  saving.value = true;
  try {
    const res = await api.post('/maps', {
      name: form.value.name,
      description: form.value.description,
      locations: form.value.newLocations,
      is_official: form.value.is_official
    });
    Swal.fire(t('common.status'), t('maps.created'), 'success');
    // Redirect to edit mode of the new map
    router.push(`/maps/${res.data.id}/edit`);
  } catch (err) {
    Swal.fire(t('admin.error'), err.response?.data?.error || t('admin.error'), 'error');
  } finally {
    saving.value = false;
  }
};

const saveMetadata = async () => {
  saving.value = true;
  try {
    await api.put(`/maps/${route.params.id}`, {
      name: form.value.name,
      description: form.value.description,
      is_official: form.value.is_official,
      is_singleplayer: form.value.is_singleplayer
    });
    Swal.fire(t('common.status'), t('maps.updated'), 'success');
  } catch (err) {
    Swal.fire(t('admin.error'), err.response?.data?.error || t('admin.error'), 'error');
  } finally {
    saving.value = false;
  }
};

const addLocations = async () => {
  if (!form.value.newLocations) return;
  adding.value = true;
  try {
    await api.post(`/maps/${route.params.id}/locations`, {
      locations: form.value.newLocations
    });
    form.value.newLocations = ''; // Clear input
    await fetchLocations(); // Refresh list
    Swal.fire(t('common.status'), t('maps.updated'), 'success');
  } catch (err) {
    Swal.fire(t('admin.error'), err.response?.data?.error || t('admin.error'), 'error');
  } finally {
    adding.value = false;
  }
};

const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (file) {
    selectedFile.value = file;
  } else {
    selectedFile.value = null;
  }
};

const importValiJson = async () => {
  if (!selectedFile.value) return;
  
  importing.value = true;
  const reader = new FileReader();
  
  reader.onload = async (e) => {
    try {
      const jsonContent = JSON.parse(e.target.result);
      
      const res = await api.post(`/maps/${route.params.id}/import-vali`, jsonContent);
      
      Swal.fire(t('common.status'), `Imported ${res.data.added} locations`, 'success');
      if (fileInput.value) fileInput.value.value = '';
      selectedFile.value = null;
      await fetchLocations();
      
    } catch (err) {
      console.error(err);
      Swal.fire(t('admin.error'), err.response?.data?.error || 'Invalid JSON or API Error', 'error');
    } finally {
      importing.value = false;
    }
  };
  
  reader.onerror = () => {
    Swal.fire(t('admin.error'), 'Failed to read file', 'error');
    importing.value = false;
  };
  
  reader.readAsText(selectedFile.value);
};

const deleteLocation = async (id) => {
  if (!confirm(t('maps.delete_confirm'))) return;
  
  try {
    await api.delete(`/maps/${route.params.id}/locations/${id}`);
    fetchLocations(); // Refresh
  } catch (err) {
    Swal.fire(t('admin.error'), t('admin.error'), 'error');
  }
};

const refreshAllLocations = async () => {
  if (!confirm(t('maps.refresh_confirm'))) return;
  
  refreshing.value = true;
  try {
    const res = await api.post(`/maps/${route.params.id}/refresh-locations`);
    Swal.fire(t('common.status'), `Updated: ${res.data.updated}, Failed: ${res.data.failed}`, 'success');
    fetchLocations();
  } catch (err) {
    Swal.fire(t('admin.error'), err.response?.data?.error || t('admin.error'), 'error');
  } finally {
    refreshing.value = false;
  }
};

const handleDeleteMap = async (e) => {
  // Prevent keyboard activation
  if (e.detail === 0) return; 

  if (deleteCount.value > 1) {
    deleteCount.value--;
    return;
  }

  // Final confirmation
  if (!confirm(t('maps.delete_map_final'))) {
    deleteCount.value = 10;
    return;
  }

  try {
    await api.delete(`/maps/${route.params.id}`);
    Swal.fire(t('common.status'), t('maps.map_deleted'), 'success');
    router.push('/maps');
  } catch (err) {
    Swal.fire(t('admin.error'), err.response?.data?.error || t('admin.error'), 'error');
    deleteCount.value = 10;
  }
};
</script>

<style scoped>
.content-header { 
  padding: 2rem 3rem; 
  border-bottom: 1px solid var(--color-border); 
  display: flex; 
  align-items: center; 
}
.header-left { display: flex; align-items: center; gap: 1.5rem; }
.back-link { 
  background: var(--color-surface); border: 1px solid var(--color-border); 
  width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  color: var(--color-text-muted); cursor: pointer; transition: all 0.2s;
}
.back-link:hover { color: var(--color-primary); border-color: var(--color-primary); }
.header-title h2 { font-size: 1.5rem; margin: 0; }
.header-title p { color: var(--color-text-muted); margin: 0; font-size: 0.9rem; }

.scroll-content { padding: 2rem 3rem; overflow-y: auto; flex: 1; }

/* Create Mode Container */
.create-container { max-width: 800px; margin: 0 auto; }

/* Editor Grid Layout */
.editor-grid { 
  display: grid; 
  grid-template-columns: 350px 1fr; 
  gap: 2rem; 
  height: 100%;
}

.editor-sidebar { display: flex; flex-direction: column; gap: 1.5rem; }
.editor-main { display: flex; flex-direction: column; min-width: 0; }

.card { 
  background: var(--color-bg); border: 1px solid var(--color-border); 
  border-radius: var(--radius); padding: 1.5rem; 
}

.form-card h3, .list-card h3 { margin-top: 0; font-size: 1.1rem; margin-bottom: 1rem; }

.form-group { margin-bottom: 1.2rem; }
.form-group label { display: block; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.9rem; }

.checkbox-group { display: flex; align-items: center; gap: 10px; }
.checkbox-group input { width: auto; margin: 0; }
.checkbox-group label { margin: 0; cursor: pointer; }

.info-box {
  background: rgba(51, 187, 173, 0.08); color: var(--color-accent-hover); 
  padding: 10px; border-radius: var(--radius); font-size: 0.85rem; 
  margin-bottom: 10px; display: flex; align-items: center; gap: 8px;
}

.code-font { font-family: monospace; font-size: 0.85rem; }

.full-width { width: 100%; }
.add-btn { margin-top: 10px; }

.delete-section { margin-top: 1rem; border-top: 1px solid var(--color-border); padding-top: 1rem; }
.danger-btn {
  background: transparent; border: 1px solid #ef4444; color: #ef4444;
  padding: 10px; border-radius: var(--radius); cursor: pointer; font-weight: 600;
  transition: all 0.1s; display: flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 40px;
}
.danger-btn:hover { background: #ef4444; color: white; }
.danger-btn.confirming { background: #ef4444; color: white; animation: shake 0.3s; }

@keyframes shake {
  0% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  50% { transform: translateX(5px); }
  75% { transform: translateX(-5px); }
  100% { transform: translateX(0); }
}

/* List Card */
.list-card { flex: 1; display: flex; flex-direction: column; padding: 0; overflow: hidden; }
.list-header { padding: 1.5rem; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; }
.list-header h3 { margin: 0; }
.header-actions { display: flex; gap: 10px; }

.table-wrapper { flex: 1; overflow-y: auto; }
.locations-table { width: 100%; border-collapse: collapse; }
.locations-table th { 
  text-align: left; padding: 12px 1.5rem; background: var(--color-surface); 
  font-weight: 600; font-size: 0.85rem; color: var(--color-text-muted);
  position: sticky; top: 0; z-index: 1; border-bottom: 1px solid var(--color-border);
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
}
.delete-btn:hover { color: var(--color-danger); background: rgba(239, 68, 68, 0.1); }
.refresh-btn:hover { color: var(--color-primary); background: rgba(79, 70, 229, 0.1); }
.refresh-all-btn { color: var(--color-accent); }
.refresh-all-btn:hover { color: var(--color-accent-hover); background: rgba(51, 187, 173, 0.1); }

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

input, textarea {
  width: 100%; 
  padding: 12px 16px; 
  border: 1px solid var(--color-border); 
  border-radius: var(--radius);
  background: var(--color-bg); 
  color: var(--color-text-main); 
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

textarea {
  resize: vertical;
  min-height: 100px;
}

input:focus, textarea:focus { 
  outline: none; 
  border-color: var(--color-primary); 
  box-shadow: 0 0 0 3px rgba(51, 187, 173, 0.1);
}

.file-input {
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.loading-box, .empty-box { padding: 3rem; text-align: center; color: var(--color-text-muted); }

@media (max-width: 1000px) {
  .editor-grid { grid-template-columns: 1fr; }
  .table-wrapper { max-height: 500px; }
}
</style>