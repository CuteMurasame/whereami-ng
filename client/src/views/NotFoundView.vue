<template>
  <div class="center-container">
    <div class="auth-card not-found-card">
      <div class="icon-404">🗺️❓</div>
      <h1>404</h1>
      <h2>You are lost.</h2>
      <p>
        We couldn't locate this page on the map. 
        It looks like you've wandered out of bounds.
      </p>
      
      <div class="actions">
        <button @click="goBack" class="secondary-btn">Go Back</button>
        <button @click="goHome" class="primary-btn">Return to Base</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { authState } from '../auth';

const router = useRouter();

const goBack = () => router.back();

const goHome = () => {
  // Smart redirect: Lobby if logged in, Login if guest
  const target = authState.token ? '/lobby' : '/login';
  router.push(target);
};
</script>

<style scoped>
.not-found-card {
  max-width: 450px;
  padding: 3rem;
}

.icon-404 {
  font-size: 5rem;
  margin-bottom: 1rem;
  animation: float 3s ease-in-out infinite;
}

h1 {
  font-size: 4rem;
  font-weight: 800;
  color: var(--primary);
  margin: 0;
  line-height: 1;
}

h2 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

p {
  color: var(--text-color);
  opacity: 0.8;
  margin-bottom: 2rem;
}

.actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.secondary-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.2s;
}

.secondary-btn:hover {
  background: var(--input-bg);
  border-color: var(--text-color);
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
</style>
