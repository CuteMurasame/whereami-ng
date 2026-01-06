<template>
  <div class="center-container">
    <div class="auth-card">
      
      <header class="auth-header">
        <div class="brand-icon">
          <i class="fa-solid fa-map-location-dot"></i>
        </div>
        <h1>{{ t('auth.loginTitle') }}</h1>
        <p>{{ t('auth.loginDesc') }}</p>
      </header>

      <form @submit.prevent="handleLogin">
        
        <div class="input-group">
          <label>{{ t('auth.username') }}</label>
          <div class="input-wrapper">
            <i class="fa-solid fa-user input-icon"></i>
            <input 
              v-model="username" 
              type="text" 
              :placeholder="t('auth.username')" 
              required 
              autofocus
            />
          </div>
        </div>

        <div class="input-group">
          <label>{{ t('common.password') }}</label>
          <div class="input-wrapper">
            <i class="fa-solid fa-lock input-icon"></i>
            <input 
              v-model="password" 
              type="password" 
              placeholder="••••••••" 
              required 
            />
          </div>
        </div>

        <div v-if="error" class="error-msg">
          <i class="fa-solid fa-circle-exclamation"></i> {{ error }}
        </div>

        <button type="submit" class="primary-btn" :disabled="isLoading">
          <span v-if="isLoading"><i class="fa-solid fa-spinner fa-spin"></i> {{ t('auth.loggingIn') }}</span>
          <span v-else>{{ t('auth.loginButton') }}</span>
        </button>
      
      </form>

      <div class="divider"><span>{{ t('common.or') }}</span></div>

      <a :href="googleAuthUrl" class="google-btn">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20px" height="20px"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg> {{ $t('auth.continueWithGoogle') }}
      </a>

      <div class="auth-footer">
        <p>{{ t('auth.noAccount') }} <router-link to="/register">{{ t('auth.register') }}</router-link></p>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { authState } from '../auth';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const router = useRouter();
const username = ref('');
const password = ref('');
const error = ref('');
const isLoading = ref(false);
const googleAuthUrl = `http://${window.location.hostname}:3000/api/auth/google`;

const handleLogin = async () => {
  error.value = '';
  isLoading.value = true;
  
  try {
    await authState.login(username.value, password.value);
    router.push('/lobby');
  } catch (err) {
    error.value = err.response?.data?.error || "Login failed. Check your connection.";
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
/* Scoped overrides for icons inside inputs */
.auth-header { text-align: center; margin-bottom: 2rem; }
.brand-icon { 
  font-size: 2rem; color: var(--color-primary); 
  margin-bottom: 1rem; 
  background: rgba(79, 70, 229, 0.1); 
  width: 64px; height: 64px; border-radius: 50%; 
  display: flex; align-items: center; justify-content: center; 
  margin-left: auto; margin-right: auto;
}

.input-wrapper { position: relative; }
.input-icon {
  position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
  color: var(--color-text-muted); font-size: 0.9rem; pointer-events: none;
}
/* Padding to make room for icon */
input { padding-left: 40px; }

.auth-footer { margin-top: 2rem; text-align: center; font-size: 0.9rem; color: var(--color-text-muted); border-top: 1px solid var(--color-border); padding-top: 1.5rem; }

.error-msg { display: flex; align-items: center; gap: 8px; font-weight: 500; margin-bottom: 1.5rem; }

.divider {
  display: flex; align-items: center; text-align: center; margin: 1.5rem 0; color: var(--color-text-muted); font-size: 0.85rem;
}
.divider::before, .divider::after {
  content: ''; flex: 1; border-bottom: 1px solid var(--color-border);
}
.divider span { padding: 0 10px; }

.google-btn {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%; padding: 0.8rem;
  background: #fff; color: #333;
  border: 1px solid #ddd; border-radius: 8px;
  font-weight: 600; text-decoration: none;
  transition: all 0.2s;
}
.google-btn:hover { background: #f5f5f5; border-color: #ccc; }
</style>
