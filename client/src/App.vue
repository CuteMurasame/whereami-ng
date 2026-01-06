<template>
  <div class="app-layout">
    <nav class="navbar">
      <div class="brand" @click="goHome">
        <i class="fa-solid fa-map-location-dot"></i> WhereAmI
      </div>
      
      <div class="nav-right">
        <span v-if="user" class="user-badge">
          <i class="fa-solid fa-user-astronaut"></i> {{ user.username }}
        </span>
        
        <div v-if="!user" class="navbar-lang-switcher">
          <LanguageSwitcher direction="down" />
        </div>

        <button @click="toggleTheme" class="theme-toggle" title="Toggle Theme">
          <i v-if="isDark" class="fa-solid fa-sun"></i>
          <i v-else class="fa-solid fa-moon"></i>
        </button>
      </div>
    </nav>
    <router-view></router-view>

    <!-- Language Selection Modal -->
    <div v-if="showLangModal" class="modal-overlay">
      <div class="modal-content animate__animated animate__zoomIn animate__faster">
        <h2>Language</h2>
        <div class="lang-options">
          <button @click="selectLang('en')">
            <span class="lang-name">English</span>
            <span class="lang-flag">🇺🇸</span>
          </button>
          <button @click="selectLang('zh')">
            <span class="lang-name">中文</span>
            <span class="lang-flag">🇨🇳</span>
          </button>
          <button @click="selectLang('ja')">
            <span class="lang-name">日本語</span>
            <span class="lang-flag">🇯🇵</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { authState } from './auth';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import LanguageSwitcher from './components/LanguageSwitcher.vue';

const router = useRouter();
const { locale } = useI18n();
const user = computed(() => authState.user);
const isDark = ref(false);
const showLangModal = ref(false);

const toggleTheme = () => {
  isDark.value = !isDark.value;
  // This attribute triggers the CSS [data-theme="dark"] selector
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light');
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
};

const goHome = () => router.push(authState.token ? '/lobby' : '/login');

const selectLang = (lang) => {
  locale.value = lang;
  localStorage.setItem('locale', lang);
  showLangModal.value = false;
};

onMounted(() => {
  // Check preference or system default
  const saved = localStorage.getItem('theme');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (saved === 'dark' || (!saved && systemDark)) {
    isDark.value = true;
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  // Check if language is selected
  if (!localStorage.getItem('locale')) {
    showLangModal.value = true;
  }
});
</script>

<style scoped>
.navbar {
  height: 64px;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
}

.brand {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text-main);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-right { display: flex; align-items: center; gap: 16px; }

.user-badge {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

.navbar-lang-switcher {
  width: 140px;
}

.theme-toggle {
  background: transparent;
  border: 1px solid var(--color-border);
  width: 32px;
  height: 32px;
  border-radius: var(--radius);
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.theme-toggle:hover {
  background: var(--color-surface);
  color: var(--color-text-main);
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: var(--color-surface);
  padding: 32px;
  border-radius: 16px;
  border: 1px solid var(--color-border);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 400px;
  width: 90%;
  text-align: center;
  animation-duration: 0.25s;
}

.modal-content h2 {
  font-size: 1.25rem;
  margin-bottom: 24px;
  color: var(--color-text-main);
  line-height: 1.5;
}

.lang-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lang-options button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 16px 20px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.lang-options button:hover {
  border-color: var(--color-primary);
  background: rgba(79, 70, 229, 0.05);
  transform: translateY(-2px);
}

.lang-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.lang-flag {
  font-size: 1.5rem;
}
</style>
