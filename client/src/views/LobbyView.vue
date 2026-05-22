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

        <div class="mode-strip active-strip duel-strip">
          <div class="strip-left">
            <div class="strip-icon duel-icon"><i class="fa-solid fa-fire"></i></div>
            <div class="strip-info">
              <h3>{{ t('lobby.duels') }}</h3>
              <p>{{ t('lobby.duelsDesc') }}</p>
            </div>
          </div>
          <button class="primary-btn play-btn action-btn" @click="router.push('/duels')">
            <i class="fa-solid fa-bolt"></i> {{ t('lobby.play') }}
          </button>
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
.content-header { padding: var(--page-y) var(--page-x); border-bottom: 1px solid var(--color-border); background: var(--color-bg); }
.header-title h2 { font-size: 1.34rem; line-height: 1.1; margin: 0 0 3px; font-weight: 700; letter-spacing: -.02em; }
.header-title p { color: var(--color-text-muted); margin: 0; }
.scroll-content { padding: var(--page-y) var(--page-x); overflow-y: auto; flex: 1; background: var(--color-page, var(--color-bg)); }

.mode-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(315px, 1fr)); gap: .85rem; width: 100%; }
.mode-strip {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--color-bg); border: 1px solid var(--color-border);
  border-radius: 12px; padding: 1rem 1.05rem; transition: all 0.2s; min-height: 112px; box-shadow: var(--shadow-card);
  }
.mode-strip.active-strip:hover { border-color: var(--color-accent); box-shadow: var(--shadow-sm); transform: translateX(4px); }

.strip-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
.strip-icon { width: 44px; height: 44px; border-radius: 10px; background: var(--color-surface); color: var(--color-text-muted); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; }
.main-icon { background: rgba(51, 187, 173, 0.1); color: var(--color-accent); }
.duel-icon { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }
.strip-info h3 { font-size: 1.02rem; margin: 0 0 4px 0; font-weight: 700; }
.strip-info p { margin: 0; color: var(--color-text-muted); font-size: 0.88rem; line-height: 1.35; }

.action-btn { width: auto; min-width: 112px; padding: 9px 18px; border-radius: 6px; font-weight: 700; }
.locked { opacity: 0.6; background: var(--color-surface); }
.locked .primary-btn { background: var(--color-border); color: var(--color-text-muted); border: 1px solid transparent; cursor: not-allowed; }
</style>
