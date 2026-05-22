<template>
  <div class="app-layout">
    <nav v-if="showTopNavbar" class="navbar">
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

    <div v-if="showActiveGamePrompt" class="active-game-nudge">
      <div class="active-game-icon"><i class="fa-solid fa-gamepad"></i></div>
      <div class="active-game-copy">
        <strong>{{ t('common.activeGameTitle') }}</strong>
        <span>{{ activeGameSummary }}</span>
      </div>
      <div class="active-game-actions">
        <button
          v-for="item in activeGameItems"
          :key="item.type"
          type="button"
          class="resume-game-btn"
          @click="resumeActiveGame(item)"
        >
          {{ item.label }}
        </button>
        <button type="button" class="dismiss-game-btn" :aria-label="t('common.close')" @click="dismissActiveGamePrompt">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>

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
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { authState, api } from './auth';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import LanguageSwitcher from './components/LanguageSwitcher.vue';

const router = useRouter();
const { locale, t } = useI18n();
const user = computed(() => authState.user);
const showTopNavbar = computed(() => !authState.token);
const isDark = ref(false);
const showLangModal = ref(false);
const activeGameItems = ref([]);
const activeGameDismissed = ref(false);
const activeGameSignature = ref('');
let activeGamePoller = null;

const showActiveGamePrompt = computed(() => Boolean(user.value && activeGameItems.value.length && !activeGameDismissed.value));
const activeGameSummary = computed(() => {
  const types = activeGameItems.value.map(item => item.type);
  if (types.includes('duel') && types.includes('singleplayer')) return t('common.activeGamesSummary');
  if (types.includes('duel')) return t('common.activeDuelSummary');
  return t('common.activeSingleplayerSummary');
});

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

const dismissActiveGamePrompt = () => {
  activeGameDismissed.value = true;
};

const resumeActiveGame = (item) => {
  activeGameDismissed.value = true;
  router.push(item.to);
};

const refreshActiveGamePrompt = async () => {
  if (!authState.token) {
    activeGameItems.value = [];
    activeGameSignature.value = '';
    activeGameDismissed.value = false;
    return;
  }

  const route = router.currentRoute.value;
  const items = [];
  const isGameRoute = route.name === 'singleplayer' || route.name === 'duel';

  if (isGameRoute) {
    const signature = '';
    if (signature !== activeGameSignature.value) {
      activeGameDismissed.value = false;
      activeGameSignature.value = signature;
    }
    activeGameItems.value = items;
    return;
  }

  try {
    const [singleRes, duelRes] = await Promise.allSettled([
      api.get('/games/active'),
      api.get('/duels/queue/status')
    ]);

    const activeSingle = singleRes.status === 'fulfilled' ? singleRes.value.data : null;
    if (activeSingle && route.name !== 'singleplayer') {
      items.push({
        type: 'singleplayer',
        to: '/singleplayer',
        label: t('common.resumeSingleplayer')
      });
    }

    const duelStatus = duelRes.status === 'fulfilled' ? duelRes.value.data : null;
    const duelId = duelStatus?.status === 'active' ? duelStatus.duelId : null;
    const alreadyOnDuel = route.name === 'duel' && String(route.params.id) === String(duelId);
    if (duelId && !alreadyOnDuel) {
      items.push({
        type: 'duel',
        to: `/duels/${duelId}`,
        label: t('common.resumeDuel')
      });
    }
  } catch (err) {
    // The nudge should never interfere with normal navigation or gameplay.
  }

  const signature = items.map(item => `${item.type}:${item.to}`).join('|');
  if (signature !== activeGameSignature.value) {
    activeGameDismissed.value = false;
    activeGameSignature.value = signature;
  }
  activeGameItems.value = items;
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

  refreshActiveGamePrompt();
  activeGamePoller = window.setInterval(refreshActiveGamePrompt, 30000);
});

watch(() => [authState.token, router.currentRoute.value.fullPath], refreshActiveGamePrompt);

onUnmounted(() => {
  if (activeGamePoller) window.clearInterval(activeGamePoller);
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

.active-game-nudge {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 9000;
  width: min(460px, calc(100vw - 36px));
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.96);
  color: var(--color-text-main);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.22);
  padding: 12px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
[data-theme="dark"] .active-game-nudge {
  background: rgba(24, 24, 27, 0.94);
}
.active-game-icon {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
}
.active-game-copy { min-width: 0; flex: 1; display: grid; gap: 2px; }
.active-game-copy strong { font-size: .92rem; }
.active-game-copy span { color: var(--color-text-muted); font-size: .82rem; line-height: 1.35; }
.active-game-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.resume-game-btn, .dismiss-game-btn {
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text-main);
  border-radius: 999px;
  cursor: pointer;
  font-weight: 800;
}
.resume-game-btn { padding: 7px 10px; }
.resume-game-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.dismiss-game-btn { width: 30px; height: 30px; display: grid; place-items: center; color: var(--color-text-muted); }
.dismiss-game-btn:hover { color: var(--color-danger); border-color: var(--color-danger); }

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

@media (max-width: 640px) {
  .active-game-nudge { left: 10px; right: 10px; bottom: 10px; width: auto; align-items: flex-start; }
  .active-game-actions { justify-content: flex-start; }
}
</style>
