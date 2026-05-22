<template>
  <span class="rating-name" :class="ratingClass" @click="goProfile">
    <template v-if="specialClass === 'nutella' || specialClass === 'tourist'">
      <span :class="`${specialClass}-first-letter`">{{ firstLetter }}</span><span :class="`${specialClass}-other-letters`">{{ restName }}</span>
    </template>
    <template v-else>{{ user?.username || 'Unknown' }}</template>
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { getRatingClass } from '../utils/rating';

const props = defineProps({
  user: { type: Object, required: true },
  clickable: { type: Boolean, default: true }
});

const router = useRouter();
const specialClass = computed(() => props.user?.rating_class || getRatingClass(props.user?.elo_rating));
const ratingClass = computed(() => ({ [specialClass.value]: !['nutella', 'tourist'].includes(specialClass.value), clickable: props.clickable }));
const firstLetter = computed(() => (props.user?.username || '?').slice(0, 1));
const restName = computed(() => (props.user?.username || 'Unknown').slice(1));

const goProfile = () => {
  if (props.clickable && props.user?.id) router.push(`/user/${props.user.id}`);
};
</script>

<style scoped>
.rating-name { font-weight: 700; letter-spacing: -0.01em; }
.rating-name.clickable { cursor: pointer; }
.rating-name.clickable:hover { text-decoration: underline; }
</style>
