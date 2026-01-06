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

onMounted(async () => {
  const token = route.query.token;
  if (token) {
    // Temporarily set token so api interceptor works
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
