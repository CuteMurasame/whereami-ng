<template>
  <DashboardLayout page="lobby">
    
    <header class="content-header">
      <div class="header-title">
        <h2>{{ t('lobby.gameModes') }}</h2>
        <p>{{ t('lobby.selectChallenge') }}</p>
      </div>
    </header>

    <div class="scroll-content">
      <div class="mode-list">
        
        <div class="mode-strip active-strip">
          <div class="strip-left">
            <div class="strip-icon main-icon"><i class="fa-solid fa-person-hiking"></i></div>
            <div class="strip-info">
              <h3>{{ t('lobby.singlePlayer') }}</h3>
              <p>{{ t('lobby.singlePlayerDesc') }}</p>
            </div>
          </div>
          <button class="primary-btn play-btn action-btn" @click="router.push('/singleplayer')">
            <i class="fa-solid fa-play"></i> {{ t('lobby.play') }}
          </button>
        </div>

        <div class="mode-strip locked">
          <div class="strip-left">
            <div class="strip-icon"><i class="fa-solid fa-fire"></i></div>
            <div class="strip-info">
              <h3>{{ t('lobby.duels') }}</h3>
              <p>{{ t('lobby.duelsDesc') }}</p>
            </div>
          </div>
          <button class="primary-btn action-btn" disabled><i class="fa-solid fa-lock"></i> {{ t('lobby.soon') }}</button>
        </div>

        <div class="mode-strip locked">
          <div class="strip-left">
            <div class="strip-icon"><i class="fa-solid fa-trophy"></i></div>
            <div class="strip-info">
              <h3>{{ t('lobby.battleRoyale') }}</h3>
              <p>{{ t('lobby.battleRoyaleDesc') }}</p>
            </div>
          </div>
          <button class="primary-btn action-btn" disabled><i class="fa-solid fa-lock"></i> {{ t('lobby.soon') }}</button>
        </div>

      </div>
    </div>

  </DashboardLayout>
</template>

<script setup>
import DashboardLayout from '../components/DashboardLayout.vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const router = useRouter();
</script>

<style scoped>
/* Only Game Mode specific styles remain */
.content-header { padding: 2rem 3rem; border-bottom: 1px solid var(--color-border); }
.header-title h2 { font-size: 1.5rem; margin-bottom: 4px; }
.header-title p { color: var(--color-text-muted); margin: 0; }
.scroll-content { padding: 2rem 3rem; overflow-y: auto; flex: 1; }

.mode-list { display: flex; flex-direction: column; gap: 16px; }
.mode-strip {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--color-bg); border: 1px solid var(--color-border);
  border-radius: var(--radius); padding: 1.5rem 2rem; transition: all 0.2s;
}
.mode-strip.active-strip:hover { border-color: var(--color-accent); box-shadow: var(--shadow-sm); transform: translateX(4px); }

.strip-left { display: flex; align-items: center; gap: 20px; }
.strip-icon { width: 50px; height: 50px; border-radius: 10px; background: var(--color-surface); color: var(--color-text-muted); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
.main-icon { background: rgba(51, 187, 173, 0.1); color: var(--color-accent); }
.strip-info h3 { font-size: 1.1rem; margin: 0 0 4px 0; font-weight: 700; }
.strip-info p { margin: 0; color: var(--color-text-muted); font-size: 0.9rem; }

.action-btn { width: auto; min-width: 120px; padding: 10px 20px; border-radius: 6px; }
.locked { opacity: 0.6; background: var(--color-surface); }
.locked .primary-btn { background: var(--color-border); color: var(--color-text-muted); border: 1px solid transparent; cursor: not-allowed; }
</style>
