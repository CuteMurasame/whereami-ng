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
import MaintenanceView from '../views/MaintenanceView.vue';
import DuelQueueView from '../views/DuelQueueView.vue';
import DuelView from '../views/DuelView.vue';
import DuelLeaderboardView from '../views/DuelLeaderboardView.vue';
import DuelReviewView from '../views/DuelReviewView.vue';
import { API_BASE_URL } from '../config';

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
      meta: { guestOnly: true, allowDuringMaintenance: true } // Admins must be able to log in during maintenance
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
      meta: { guestOnly: true, allowDuringMaintenance: true }
    },
    { 
      path: '/lobby', 
      name: 'lobby', 
      component: LobbyView,
      meta: { requiresAuth: true } // Custom flag: Must be logged in
    },
    {
      path: '/maintenance',
      name: 'maintenance',
      component: MaintenanceView,
      meta: { allowDuringMaintenance: true }
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
      path: '/duels',
      name: 'duels',
      component: DuelQueueView,
      meta: { requiresAuth: true }
    },
    {
      path: '/duels/leaderboard',
      name: 'duel-leaderboard',
      component: DuelLeaderboardView,
      meta: { requiresAuth: true }
    },
    {
      path: '/duels/:id/review',
      name: 'duel-review',
      component: DuelReviewView,
      meta: { requiresAuth: true }
    },
    {
      path: '/duels/:id',
      name: 'duel',
      component: DuelView,
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
	  redirect: to => `/user/${to.params.id}/overview`,
	  meta: { requiresAuth: true }
	},
	{
	  path: '/user/:id/rating',
	  redirect: to => `/user/${to.params.id}/overview`,
	  meta: { requiresAuth: true }
	},
	{
	  path: '/user/:id/:tab(overview|history)',
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

let maintenanceCache = {
  checkedAt: 0,
  enabled: false
};

export const setMaintenanceStatusCache = (enabled) => {
  maintenanceCache = {
    checkedAt: Date.now(),
    enabled: Boolean(enabled)
  };
};

export const clearMaintenanceStatusCache = () => {
  maintenanceCache = {
    checkedAt: 0,
    enabled: maintenanceCache.enabled
  };
};

export const fetchMaintenanceStatus = async ({ force = false, failOpen = true } = {}) => {
  const now = Date.now();
  if (!force && now - maintenanceCache.checkedAt < 5000) return maintenanceCache.enabled;

  try {
    const res = await fetch(`${API_BASE_URL}/settings/public?_=${Date.now()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) {
      if (failOpen) return maintenanceCache.enabled;
      throw new Error('Unable to fetch maintenance status');
    }
    const data = await res.json();
    maintenanceCache = {
      checkedAt: now,
      enabled: Boolean(data.maintenance_mode)
    };
  } catch (err) {
    if (!failOpen) throw err;
    // If the status endpoint is unreachable, do not trap users on the maintenance page.
    maintenanceCache = { checkedAt: now, enabled: false };
  }

  return maintenanceCache.enabled;
};

// --- NAVIGATION GUARD ---
router.beforeEach(async (to, from, next) => {
  const isLoggedIn = !!authState.token; // Check if token exists
  const isAdmin = authState.user?.is_admin; // Check the state
  const maintenanceEnabled = await fetchMaintenanceStatus();

  if (maintenanceEnabled && !isAdmin && !to.meta.allowDuringMaintenance) {
    return next('/maintenance');
  }

  if (to.name === 'maintenance' && (!maintenanceEnabled || isAdmin)) {
    return next(isAdmin ? '/admin' : '/login');
  }

  // Case 1: Route requires Auth, but user is NOT logged in
  if (to.meta.requiresAuth && !isLoggedIn) {
    return next('/login');
  }

  if (to.meta.requiresAdmin && !isAdmin) {
    // If user tries to force URL but isn't admin, kick to lobby
    return next(maintenanceEnabled ? '/maintenance' : '/lobby');
  }

  // Case 2: Route is Guest Only (Login/Register), but user IS logged in
  if (to.meta.guestOnly && isLoggedIn) {
    return next(maintenanceEnabled && !isAdmin ? '/maintenance' : '/lobby');
  }

  // Case 3: Allow navigation
  next();
});

export default router;
