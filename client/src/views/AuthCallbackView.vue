<template>
  <div class="center-container">
    <div class="loading-card">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <p>{{ $t('auth.loggingIn') }}</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authState } from '../auth';

const route = useRoute();
const router = useRouter();

const readCallbackParams = () => {
  const hash = window.location.hash?.replace(/^#/, '') || '';
  const params = new URLSearchParams(hash);

  // Backward-compatible fallback for older redirects.
  if (!params.get('token') && route.query.token) {
    params.set('token', route.query.token);
  }

  return params;
};

onMounted(async () => {
  const params = readCallbackParams();
  const token = params.get('token');

  // Remove token from the visible URL as soon as possible.
  window.history.replaceState(null, document.title, window.location.pathname);

  if (token) {
    authState.setSession(token, null);
    
    try {
        await authState.refreshSession();
        router.push('/lobby');
    } catch (err) {
        router.push('/login?error=auth_failed');
    }
  } else {
    router.push('/login');
  }
});
</script>

<style scoped>
.center-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: var(--color-bg); }
.loading-card { text-align: center; font-size: 1.2rem; color: var(--color-text-muted); }
.loading-card i { font-size: 2rem; margin-bottom: 1rem; color: var(--color-primary); }
</style>
