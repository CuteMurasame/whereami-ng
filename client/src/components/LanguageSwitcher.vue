<template>
  <div class="lang-menu-container" :class="direction" @mouseenter="isHovered = true" @mouseleave="isHovered = false">
    <div class="lang-menu" :class="{ open: isOpen, down: direction === 'down' }">
      <button @click="setLanguage('en')" :class="{ active: locale === 'en' }">English</button>
      <button @click="setLanguage('zh')" :class="{ active: locale === 'zh' }">中文</button>
      <button @click="setLanguage('ja')" :class="{ active: locale === 'ja' }">日本語</button>
    </div>
    <button @click="toggleMenu" class="back-btn lang-btn">
      <i class="fa-solid fa-language"></i> {{ getLanguageName() }}
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  direction: {
    type: String,
    default: 'up'
  }
});

const { locale } = useI18n();
const isHovered = ref(false);
const isClicked = ref(false);
const isOpen = computed(() => isHovered.value || isClicked.value);

const toggleMenu = () => {
  isClicked.value = !isClicked.value;
};

const setLanguage = (lang) => {
  locale.value = lang;
  localStorage.setItem('locale', lang);
  isClicked.value = false;
  isHovered.value = false;
};

const getLanguageName = () => {
  const map = {
    'en': 'English',
    'zh': '中文',
    'ja': '日本語'
  };
  return map[locale.value] || 'English';
};
</script>

<style scoped>
.lang-menu-container { position: relative; width: 100%; }
.lang-menu-container::before {
  content: '';
  position: absolute;
  left: 0;
  width: 100%;
  height: 20px;
  background: transparent;
  display: none;
}
.lang-menu-container.up::before {
  display: block;
  bottom: 100%;
}
.lang-menu-container.down::before {
  display: block;
  top: 100%;
}
.lang-menu {
  position: absolute; bottom: 100%; left: 0; width: 100%;
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius); margin-bottom: 8px;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: var(--shadow-lg); z-index: 10;
  opacity: 0; transform: translateY(10px) scale(0.95); pointer-events: none;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: bottom center;
}
.lang-menu.down {
  bottom: auto; top: 100%;
  margin-bottom: 0; margin-top: 8px;
  transform: translateY(-10px) scale(0.95);
  transform-origin: top center;
}
.lang-menu.open {
  opacity: 1; transform: translateY(0) scale(1); pointer-events: auto;
}
.lang-menu button {
  background: none; border: none; padding: 12px; text-align: center;
  cursor: pointer; color: var(--color-text-muted); font-weight: 600;
  transition: all 0.2s; border-bottom: 1px solid var(--color-border);
}
.lang-menu button:last-child { border-bottom: none; }
.lang-menu button:hover { background: rgba(0,0,0,0.03); color: var(--color-text-main); }
.lang-menu button.active { color: var(--color-primary); background: rgba(79, 70, 229, 0.05); }

.back-btn { width: 100%; background: none; border: 1px solid var(--color-border); padding: 10px; border-radius: var(--radius); cursor: pointer; color: var(--color-text-muted); font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.2s; }
.lang-btn:hover { border-color: var(--color-primary) !important; color: var(--color-primary) !important; background: rgba(79, 70, 229, 0.05) !important; }
</style>
