<template>
  <div class="player-card" :class="{ active }">
    <div>
      <small>{{ label }}</small>
      <RatingName :user="player" />
      <span class="rating">{{ player?.elo_rating || 1500 }}</span>
    </div>
    <div class="score-box">
      <strong>{{ score || 0 }}</strong>
      <span v-if="guessed" class="guessed"><i class="fa-solid fa-check"></i></span>
    </div>
  </div>
</template>

<script setup>
import RatingName from './RatingName.vue';

defineProps({
  player: { type: Object, required: true },
  score: { type: Number, default: 0 },
  active: { type: Boolean, default: false },
  guessed: { type: Boolean, default: false },
  label: { type: String, default: '' }
});
</script>

<style scoped>
.player-card { border: 1px solid var(--color-border); border-radius: 14px; padding: .9rem 1rem; display: flex; justify-content: space-between; align-items: center; background: var(--color-bg); }
.player-card.active { border-color: var(--color-accent); box-shadow: 0 0 0 3px rgba(51,187,173,.10); }
.player-card small { display: block; color: var(--color-text-muted); font-size: .75rem; margin-bottom: 2px; }
.rating { display: block; color: var(--color-text-muted); font-size: .8rem; margin-top: 2px; }
.score-box { display: flex; align-items: center; gap: .5rem; }
.score-box strong { font-size: 1.8rem; }
.guessed { color: var(--color-accent); }
</style>
