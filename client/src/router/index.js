// client/src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import { authState } from '../auth'; // Import auth state to check status

// Import Views
import LoginView from '../views/LoginView.vue';
import RegisterView from '../views/RegisterView.vue';
import LobbyView from '../views/LobbyView.vue';
import SingleplayerView from '../views/SingleplayerView.vue';
import GameAnalysisView from '../views/GameAnalysisView.vue';
import NotFoundView from '../views/NotFoundView.vue';
import AdminView from '../views/AdminView.vue';
import SettingsView from '../views/SettingsView.vue';
import PublicProfileView from '../views/PublicProfileView.vue';
import GoogleRegisterView from '../views/GoogleRegisterView.vue';
import AuthCallbackView from '../views/AuthCallbackView.vue';
import MapsView from '../views/MapsView.vue';
import MapEditorView from '../views/MapEditorView.vue';
import MapDetailView from '../views/MapDetailView.vue';
import StatisticsView from '../views/StatisticsView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { 
      path: '/', 
      redirect: to => {
        // Redirect based on auth status
        return authState.token ? '/lobby' : '/login';
      }
    },
    { 
      path: '/login', 
      name: 'login', 
      component: LoginView,
      meta: { guestOnly: true } // Custom flag: Only guests can see this
    },
    { 
      path: '/register', 
      name: 'register', 
      component: RegisterView,
      meta: { guestOnly: true }
    },
    { 
      path: '/register/google', 
      name: 'google-register', 
      component: GoogleRegisterView,
      meta: { guestOnly: true }
    },
    { 
      path: '/auth/callback', 
      name: 'auth-callback', 
      component: AuthCallbackView,
      meta: { guestOnly: true }
    },
    { 
      path: '/lobby', 
      name: 'lobby', 
      component: LobbyView,
      meta: { requiresAuth: true } // Custom flag: Must be logged in
    },
    {
      path: '/statistics',
      name: 'statistics',
      component: StatisticsView,
      meta: { requiresAuth: true }
    },
    { 
      path: '/singleplayer', 
      name: 'singleplayer', 
      component: SingleplayerView,
      meta: { requiresAuth: true }
    },
    { 
      path: '/singleplayer/analysis/:id', 
      name: 'game-analysis', 
      component: GameAnalysisView,
      meta: { requiresAuth: true }
    },
	{
      path: '/admin',
      name: 'admin',
      component: AdminView,
      meta: { requiresAuth: true, requiresAdmin: true }
    },
	{
	  path: '/settings',
	  name: 'settings',
	  component: SettingsView,
	  meta: { requiresAuth: true }
	},
	{
	  path: '/user/:id',
	  name: 'public-profile',
	  component: PublicProfileView,
	  meta: { requiresAuth: true }
	},
    {
      path: '/maps',
      name: 'maps',
      component: MapsView,
      meta: { requiresAuth: true }
    },
    {
      path: '/maps/create',
      name: 'map-create',
      component: MapEditorView,
      meta: { requiresAuth: true }
    },
    {
      path: '/maps/:id/edit',
      name: 'map-edit',
      component: MapEditorView,
      meta: { requiresAuth: true }
    },
    {
      path: '/maps/:id',
      name: 'map-detail',
      component: MapDetailView,
      meta: { requiresAuth: true }
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundView
    }
  ]
});

// --- NAVIGATION GUARD ---
router.beforeEach((to, from, next) => {
  const isLoggedIn = !!authState.token; // Check if token exists
  const isAdmin = authState.user?.is_admin; // Check the state

  // Case 1: Route requires Auth, but user is NOT logged in
  if (to.meta.requiresAuth && !isLoggedIn) {
    return next('/login');
  }

  if (to.meta.requiresAdmin && !isAdmin) {
    // If user tries to force URL but isn't admin, kick to lobby
    return next('/lobby');
  }

  // Case 2: Route is Guest Only (Login/Register), but user IS logged in
  if (to.meta.guestOnly && isLoggedIn) {
    return next('/lobby');
  }

  // Case 3: Allow navigation
  next();
});

export default router;
