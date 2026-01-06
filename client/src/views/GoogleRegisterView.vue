<template>
  <div class="center-container">
    <div class="auth-card">
      <header class="auth-header">
        <div class="brand-icon icon-google">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="32px" height="32px"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
        </div>
        <h1>{{ t('auth.finalizeRegistration') }}</h1>
        <p>{{ t('auth.setCredentials') }}</p>
      </header>

      <form @submit.prevent="handleFinalize">
        <div class="input-group">
          <label>{{ t('settings.email') }}</label>
          <div class="input-wrapper">
            <i class="fa-solid fa-envelope input-icon"></i>
            <input :value="email" type="email" disabled />
          </div>
        </div>

        <div class="input-group">
          <label>{{ t('settings.username') }}</label>
          <div class="input-wrapper">
            <i class="fa-solid fa-user input-icon"></i>
            <input v-model="username" type="text" :placeholder="t('settings.username')" required />
          </div>
        </div>

        <div class="input-group">
          <label>{{ t('common.password') }}</label>
          <div class="input-wrapper">
            <i class="fa-solid fa-lock input-icon"></i>
            <input v-model="password" type="password" :placeholder="t('auth.passwordPlaceholder')" required />
          </div>
        </div>

        <div v-if="error" class="error-msg">
          <i class="fa-solid fa-circle-exclamation"></i> {{ error }}
        </div>

        <button type="submit" class="primary-btn" :disabled="isLoading">
          <span v-if="isLoading"><i class="fa-solid fa-spinner fa-spin"></i> {{ t('auth.creatingAccount') }}</span>
          <span v-else>{{ t('auth.finalizeRegistration') }}</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, authState } from '../auth';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const token = ref('');
const email = ref('');
const username = ref('');
const password = ref('');
const error = ref('');
const isLoading = ref(false);

onMounted(() => {
  token.value = route.query.token;
  email.value = route.query.email;
  if (!token.value) {
    error.value = t('auth.invalidSession');
  }
});

const handleFinalize = async () => {
  error.value = '';
  isLoading.value = true;

  try {
    const res = await api.post('/auth/google/finalize', {
      token: token.value,
      username: username.value,
      password: password.value
    });

    // Login
    authState.setSession(res.data.token, res.data.user);
    router.push('/lobby');

  } catch (err) {
    error.value = err.response?.data?.error || t('settings.errorText');
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.center-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: var(--color-bg); padding: 20px; }
.auth-card { background: var(--color-surface); padding: 2.5rem; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); width: 100%; max-width: 400px; border: 1px solid var(--color-border); }
.auth-header { text-align: center; margin-bottom: 2rem; }
.brand-icon { font-size: 2rem; color: var(--color-primary); margin-bottom: 1rem; background: rgba(79, 70, 229, 0.1); width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-left: auto; margin-right: auto; }
.icon-google { background: rgba(255, 255, 255, 0.8); border: 1px solid #eee; }
.input-group { margin-bottom: 1.2rem; }
.input-group label { display: block; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.9rem; color: var(--color-text-main); }
.input-wrapper { position: relative; }
.input-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); font-size: 0.9rem; pointer-events: none; }
input { width: 100%; padding: 12px 12px 12px 40px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-bg); color: var(--color-text-main); font-size: 0.95rem; transition: all 0.2s; }
input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); }
input:disabled { background: var(--color-bg-secondary); cursor: not-allowed; opacity: 0.7; }
.primary-btn { width: 100%; padding: 12px; background: var(--color-primary); color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
.primary-btn:hover:not(:disabled) { background: var(--color-primary-hover); transform: translateY(-1px); }
.primary-btn:disabled { opacity: 0.7; cursor: wait; }
.error-msg { color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 10px; border-radius: 8px; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; font-weight: 500; margin-bottom: 1.5rem; }
</style>
