<template>
  <button type="button" class="back-button" @click="goBack">
    <i class="fa-solid fa-arrow-left"></i>
    <span>{{ label }}</span>
  </button>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  fallback: { type: String, default: '/lobby' },
  text: { type: String, default: '' }
});

const router = useRouter();
const { t } = useI18n();
const label = computed(() => props.text || t('analysis.back') || 'Back');

const goBack = () => {
  if (window.history.length > 1) router.back();
  else router.push(props.fallback);
};
</script>

<style scoped>
.back-button {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
  border-radius: 999px;
  padding: .55rem .85rem;
  font-weight: 700;
  cursor: pointer;
  transition: all .2s;
}
.back-button:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: rgba(79, 70, 229, .06);
}
</style>
