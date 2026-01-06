<template>
  <DashboardLayout page="admin">
    
    <div class="admin-header">
      <div class="header-text">
        <h2>{{ t('admin.title') }}</h2>
        <span class="badge" :class="currentUser.is_root ? 'root' : 'admin'">
          {{ currentUser.is_root ? t('admin.rootAccess') : t('admin.adminAccess') }}
        </span>
      </div>

      <div class="sub-nav">
        <button 
          @click="activeTab = 'users'" 
          :class="['tab-btn', activeTab === 'users' ? 'active' : '']"
        >
          <i class="fa-solid fa-users"></i> {{ t('admin.users') }}
        </button>
        
        <button 
          v-if="currentUser.is_root"
          @click="activeTab = 'settings'" 
          :class="['tab-btn', activeTab === 'settings' ? 'active' : '']"
        >
          <i class="fa-solid fa-sliders"></i> {{ t('admin.system') }}
        </button>
      </div>
    </div>

    <div class="admin-content">
      
      <div v-if="activeTab === 'users'" class="tab-pane">
        
        <div class="pane-header">
          <h3>{{ t('admin.userDatabase') }}</h3>
          <p>{{ users.length }} {{ t('admin.registeredAccounts') }}</p>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{{ t('admin.identity') }}</th>
                <th>{{ t('admin.role') }}</th>
                <th>{{ t('admin.status') }}</th>
                <th>{{ t('admin.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in paginatedUsers" :key="u.id" :class="{ 'row-banned': u.is_banned }">
                <td>
                  <div class="u-name">{{ u.username }}</div>
                  <div class="u-email">{{ u.email || t('admin.noEmail') }}</div>
                </td>
                
                <td>
                  <span v-if="u.is_root" class="badge root">ROOT</span>
                  <span v-else-if="u.is_admin" class="badge admin">ADMIN</span>
                  <span v-else class="badge user">USER</span>
                </td>

                <td>
                  <span v-if="u.is_banned" class="badge banned">{{ t('admin.banned') }}</span>
                  <span v-else class="badge active">{{ t('admin.active') }}</span>
                </td>

                <td>
                  <div class="actions" v-if="canManage(u)">
                    <button v-if="!u.is_banned" @click="toggleBan(u, true)" class="btn-icon ban" title="Ban">
                      <i class="fa-solid fa-gavel"></i>
                    </button>
                    <button v-else @click="toggleBan(u, false)" class="btn-icon unban" title="Unban">
                      <i class="fa-solid fa-lock-open"></i>
                    </button>

                    <template v-if="currentUser.is_root">
                      <button v-if="!u.is_admin" @click="setRole(u, 'admin')" class="btn-icon promote" title="Promote">
                        <i class="fa-solid fa-arrow-up"></i>
                      </button>
                      <button v-if="u.is_admin" @click="setRole(u, 'user')" class="btn-icon demote" title="Demote">
                        <i class="fa-solid fa-arrow-down"></i>
                      </button>
                    </template>
                  </div>
                  <div v-else class="protected-text"><i class="fa-solid fa-shield"></i> {{ t('admin.protected') }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pagination-footer" v-if="totalPages > 1">
          <button :disabled="currentPage === 1" @click="currentPage--" class="page-btn">{{ t('admin.prev') }}</button>
          <span>{{ t('admin.page') }} {{ currentPage }} / {{ totalPages }}</span>
          <button :disabled="currentPage === totalPages" @click="currentPage++" class="page-btn">{{ t('admin.next') }}</button>
        </div>
      </div>

      <div v-if="activeTab === 'settings'" class="tab-pane settings-pane">
        
        <div class="pane-header">
          <h3>{{ t('admin.globalConfig') }}</h3>
          <p>{{ t('admin.globalConfigDesc') }}</p>
        </div>

        <div class="settings-grid">
          <div class="setting-card">
            <div class="s-icon"><i class="fa-solid fa-envelope"></i></div>
            <div class="s-info">
              <h4>{{ t('admin.emailSystem') }}</h4>
              <p>{{ t('admin.emailSystemDesc') }}</p>
            </div>
            <label class="switch">
              <input type="checkbox" v-model="settings.email_enabled" @change="toggleEmail">
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-card disabled">
            <div class="s-icon"><i class="fa-solid fa-server"></i></div>
            <div class="s-info">
              <h4>{{ t('admin.maintenanceMode') }}</h4>
              <p>{{ t('admin.maintenanceModeDesc') }}</p>
            </div>
            <span class="coming-soon">{{ t('lobby.soon') }}</span>
          </div>
        </div>

      </div>

    </div>
  </DashboardLayout>
</template>

<script setup>
import DashboardLayout from '../components/DashboardLayout.vue';
import { ref, onMounted, computed } from 'vue';
import { api, authState } from '../auth';
import { useI18n } from 'vue-i18n';
import Swal from 'sweetalert2';

// Force update
const { t } = useI18n();
// State
const activeTab = ref('users');
const users = ref([]);
const settings = ref({ email_enabled: false });
const currentPage = ref(1);
const itemsPerPage = 50;

// Auth
const currentUser = computed(() => authState.user || {});

// Computed
const totalPages = computed(() => Math.ceil(users.value.length / itemsPerPage));
const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return users.value.slice(start, start + itemsPerPage);
});

const canManage = (target) => {
  if (target.id === currentUser.value.id) return false;
  if (currentUser.value.is_root) return true;
  if (currentUser.value.is_admin && !target.is_admin && !target.is_root) return true;
  return false;
};

// API Actions
const fetchUsers = async () => {
  try { users.value = (await api.get('/admin/users')).data; } catch (e) {}
};

const fetchSettings = async () => {
  if (currentUser.value.is_root) {
    try { settings.value = (await api.get('/settings')).data; } catch (e) {}
  }
};

const toggleBan = async (user, banStatus) => {
  const action = banStatus ? 'BAN' : 'UNBAN';
  const result = await Swal.fire({
    title: t('admin.confirmTitle'),
    text: t('admin.confirmBanText', { action, username: user.username }),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: t('admin.confirmButton'),
    cancelButtonText: t('common.cancel'),
    showClass: {
      popup: 'animate__animated animate__zoomIn animate__faster'
    },
    hideClass: {
      popup: 'animate__animated animate__fadeOut animate__faster'
    }
  });

  if (result.isConfirmed) {
    await api.post('/admin/ban-status', { userId: user.id, ban: banStatus });
    fetchUsers();
    Swal.fire({
      title: t('admin.updatedTitle'),
      text: t('admin.banUpdatedText', { username: user.username, action: banStatus ? 'BANNED' : 'UNBANNED' }),
      icon: 'success',
      showClass: {
        popup: 'animate__animated animate__zoomIn animate__faster'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOut animate__faster'
      }
    });
  }
};

const setRole = async (user, role) => {
  const result = await Swal.fire({
    title: t('admin.confirmTitle'),
    text: t('admin.confirmRoleText', { username: user.username, role }),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#d33',
    confirmButtonText: t('admin.confirmRoleButton'),
    cancelButtonText: t('common.cancel'),
    showClass: {
      popup: 'animate__animated animate__zoomIn animate__faster'
    },
    hideClass: {
      popup: 'animate__animated animate__fadeOut animate__faster'
    }
  });

  if (result.isConfirmed) {
    await api.post('/admin/role', { userId: user.id, role });
    fetchUsers();
    Swal.fire({
      title: t('admin.updatedTitle'),
      text: t('admin.roleUpdatedText', { username: user.username, role }),
      icon: 'success',
      showClass: {
        popup: 'animate__animated animate__zoomIn animate__faster'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOut animate__faster'
      }
    });
  }
};

const toggleEmail = async () => {
  try { await api.post('/settings/toggle-email', { enabled: settings.value.email_enabled }); }
  catch (e) { settings.value.email_enabled = !settings.value.email_enabled; } // Revert
};

onMounted(() => {
  fetchUsers();
  fetchSettings();
});
</script>

<style>
.swal2-popup.animate__faster {
  animation-duration: 200ms !important;
}
</style>

<style scoped>
/* --- HEADER AREA --- */
.admin-header {
  padding: 2rem 3rem 0 3rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
}

.header-text { display: flex; align-items: center; gap: 12px; margin-bottom: 1.5rem; }
.header-text h2 { font-size: 1.5rem; margin: 0; }
.badge { font-size: 0.7rem; font-weight: 700; padding: 4px 8px; border-radius: 4px; }
.root { background: black; color: white; }
.admin { background: #e0e7ff; color: #4338ca; }

/* --- SUB-NAV (TABS) --- */
.sub-nav { display: flex; gap: 2rem; }
.tab-btn {
  background: none; border: none; padding: 10px 0;
  cursor: pointer; color: var(--color-text-muted); font-weight: 600;
  font-size: 0.95rem; border-bottom: 2px solid transparent;
  display: flex; align-items: center; gap: 8px;
  transition: all 0.2s;
}
.tab-btn:hover { color: var(--color-text-main); }
.tab-btn.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }

/* --- CONTENT AREA --- */
.admin-content { flex: 1; overflow-y: auto; background: var(--color-surface); padding: 2rem 3rem; }

.tab-pane { max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; height: 100%; }
.pane-header { margin-bottom: 1.5rem; }
.pane-header h3 { margin: 0 0 4px 0; font-size: 1.1rem; }
.pane-header p { margin: 0; color: var(--color-text-muted); font-size: 0.9rem; }

/* --- TABLE STYLES --- */
.table-wrapper { 
  background: var(--color-bg); border: 1px solid var(--color-border); 
  border-radius: var(--radius); overflow: hidden; flex: 1; overflow-y: auto;
}
table { width: 100%; border-collapse: collapse; }
th, td { padding: 12px 20px; text-align: left; border-bottom: 1px solid var(--color-border); }
th { background: var(--color-surface); font-size: 0.75rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 700; position: sticky; top: 0; }

.u-name { font-weight: 600; font-size: 0.95rem; }
.u-email { font-size: 0.8rem; color: var(--color-text-muted); }
.row-banned { background: rgba(239, 68, 68, 0.05); }

/* Status Badges */
.badge.user { background: #f3f4f6; color: #374151; }
.badge.banned { background: #fee2e2; color: #ef4444; }
.badge.active { background: #dcfce7; color: #166534; }

/* Actions */
.actions { display: flex; gap: 6px; }
.btn-icon { width: 28px; height: 28px; border-radius: 4px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; transition: transform 0.1s; }
.ban { background: #fee2e2; color: #dc2626; }
.unban { background: #dcfce7; color: #166534; }
.promote { background: #e0e7ff; color: #4f46e5; }
.demote { background: #f3f4f6; color: #4b5563; }
.btn-icon:hover { transform: scale(1.1); }
.protected-text { font-size: 0.75rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 5px; }

/* Pagination */
.pagination-footer { margin-top: 1rem; display: flex; justify-content: center; align-items: center; gap: 1rem; font-size: 0.9rem; }
.page-btn { padding: 4px 12px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 4px; cursor: pointer; }

/* --- SETTINGS GRID --- */
.settings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
.setting-card { background: var(--color-bg); padding: 1.5rem; border: 1px solid var(--color-border); border-radius: var(--radius); display: flex; align-items: center; gap: 15px; }
.setting-card.disabled { opacity: 0.6; }

.s-icon { width: 40px; height: 40px; background: var(--color-surface); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--color-text-muted); font-size: 1.1rem; }
.s-info { flex: 1; }
.s-info h4 { margin: 0 0 4px 0; font-size: 1rem; }
.s-info p { margin: 0; font-size: 0.8rem; color: var(--color-text-muted); }
.coming-soon { font-size: 0.7rem; background: var(--color-border); padding: 2px 6px; border-radius: 4px; font-weight: 700; }

/* Switch */
.switch { position: relative; display: inline-block; width: 40px; height: 22px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .3s; border-radius: 34px; }
.slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
input:checked + .slider { background-color: var(--color-accent); }
input:checked + .slider:before { transform: translateX(18px); }
</style>
