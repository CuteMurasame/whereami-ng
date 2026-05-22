<template>
  <div class="maintenance-page">
    <div class="maintenance-card soft-fade-in">
      <div class="icon-wrap">
        <i class="fa-solid fa-screwdriver-wrench"></i>
      </div>
      <h1>{{ t('maintenance.title') }}</h1>
      <p>{{ t('maintenance.desc') }}</p>

      <p v-if="statusMessage" class="status-message" role="status" aria-live="polite">
        {{ statusMessage }}
      </p>

      <div class="actions">
        <button class="btn primary" :disabled="isChecking" @click="checkAgain">
          <i class="fa-solid" :class="isChecking ? 'fa-circle-notch fa-spin' : 'fa-rotate-right'"></i>
          {{ isChecking ? t('maintenance.checking') : t('maintenance.retry') }}
        </button>
        <button v-if="!token" class="btn secondary" @click="router.push('/login')">
          <i class="fa-solid fa-right-to-bracket"></i> {{ t('maintenance.adminLogin') }}
        </button>
        <button v-if="user?.is_admin" class="btn secondary" @click="router.push('/admin')">
          <i class="fa-solid fa-sliders"></i> {{ t('maintenance.openAdmin') }}
        </button>
        <button v-if="token" class="btn secondary danger" :disabled="isLoggingOut" @click="handleLogout">
          <i class="fa-solid" :class="isLoggingOut ? 'fa-circle-notch fa-spin' : 'fa-right-from-bracket'"></i>
          {{ isLoggingOut ? t('maintenance.loggingOut') : t('nav.logout') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { authState, api } from '../auth';
import { fetchMaintenanceStatus, setMaintenanceStatusCache } from '../router';

const router = useRouter();
const { t } = useI18n();
const user = computed(() => authState.user);
const token = computed(() => authState.token);
const isChecking = ref(false);
const isLoggingOut = ref(false);
const statusMessage = ref('');

const destinationAfterMaintenance = () => {
  if (authState.user?.is_admin) return '/admin';
  return authState.token ? '/lobby' : '/login';
};

const checkAgain = async () => {
  if (isChecking.value) return;
  isChecking.value = true;
  statusMessage.value = '';

  try {
    const maintenanceEnabled = await fetchMaintenanceStatus({ force: true, failOpen: false });
    setMaintenanceStatusCache(maintenanceEnabled);

    if (maintenanceEnabled) {
      statusMessage.value = t('maintenance.stillOn');
      return;
    }

    statusMessage.value = t('maintenance.backOnline');
    await router.replace(destinationAfterMaintenance());
  } catch (err) {
    statusMessage.value = t('maintenance.checkFailed');
  } finally {
    isChecking.value = false;
  }
};

const handleLogout = async () => {
  if (isLoggingOut.value) return;
  isLoggingOut.value = true;
  statusMessage.value = '';

  try {
    await api.post('/auth/logout').catch(() => {});
  } finally {
    authState.logout({ skipServer: true });
    setMaintenanceStatusCache(true);
    isLoggingOut.value = false;
    await router.replace('/login');
  }
};
</script>

<style scoped>
.maintenance-page {
  min-height: calc(100vh - 64px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background:
    radial-gradient(circle at top left, rgba(79, 70, 229, 0.12), transparent 30%),
    var(--color-surface);
}

.maintenance-card {
  width: min(520px, 100%);
  padding: 2.5rem;
  border-radius: 20px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  text-align: center;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
}

.soft-fade-in {
  animation: softFadeIn 420ms ease-out both;
}

@keyframes softFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.icon-wrap {
  width: 76px;
  height: 76px;
  margin: 0 auto 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 22px;
  background: rgba(245, 158, 11, 0.12);
  color: #d97706;
  font-size: 2rem;
}

h1 {
  margin: 0 0 0.75rem;
  font-size: 1.8rem;
  color: var(--color-text-main);
}

p {
  margin: 0;
  color: var(--color-text-muted);
  line-height: 1.7;
}

.status-message {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: 0.95rem;
}

.actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 2rem;
}

.btn {
  border: none;
  border-radius: 10px;
  padding: 0.8rem 1.1rem;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

.btn:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(15, 23, 42, 0.08);
}

.btn:not(:disabled):active {
  transform: translateY(0);
  box-shadow: none;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.68;
}

.primary {
  background: var(--color-primary);
  color: white;
}

.secondary {
  background: var(--color-surface);
  color: var(--color-text-main);
  border: 1px solid var(--color-border);
}

.danger {
  color: #b91c1c;
}
</style>
