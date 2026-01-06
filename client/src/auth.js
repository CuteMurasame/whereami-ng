// client/src/auth.js
import { reactive } from 'vue';
import axios from 'axios';
import router from './router'; // We need router to redirect banned users
import md5 from 'md5';

export const api = axios.create({
  baseURL: `http://${window.location.hostname}:3000/api`
});

const state = reactive({
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user')) || null
});

// --- 1. AXIOS INTERCEPTOR (The Security Guard) ---
api.interceptors.request.use(config => {
  if (state.token) config.headers.Authorization = `Bearer ${state.token}`;
  return config;
});

api.interceptors.response.use(
  response => response, 
  error => {
    // CHECK FOR BAN OR EXPIRED TOKEN
    if (error.response) {
      const errMsg = error.response.data?.error;
      
      // If Banned OR Token Invalid -> Force Logout
      if (error.response.status === 401 || errMsg === 'YOUR_ACCOUNT_IS_BANNED') {
        authState.logout();
        router.push('/login'); // Kick them out
        if (errMsg === 'YOUR_ACCOUNT_IS_BANNED') alert("You have been banned.");
      }
    }
    return Promise.reject(error);
  }
);

// --- 2. ACTIONS ---

const login = async (username, password) => {
  const res = await api.post('/auth/login', { username, password });
  state.token = res.data.token;
  state.user = res.data.user; 
  localStorage.setItem('token', state.token);
  localStorage.setItem('user', JSON.stringify(state.user));
};

const setSession = (token, user) => {
  state.token = token;
  state.user = user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
};

const logout = () => {
  state.token = null;
  state.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

const getAvatar = (user) => {
  if (!user) return 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';

  // 1. If Custom Upload exists, use it (prepend server URL)
  if (user.avatar_url) {
    return `http://${window.location.hostname}:3000${user.avatar_url}`;
  }

  // 2. Fallback to Gravatar (using Email Hash)
  const emailHash = user.email ? md5(user.email.trim().toLowerCase()) : '00000000000000000000000000000000';
  return `https://www.gravatar.com/avatar/${emailHash}?d=identicon`;
};

// Call this when the app loads to ensure roles are fresh
const refreshSession = async () => {
  if (!state.token) return;
  try {
    const res = await api.get('/auth/me');
    state.user = res.data; // Update local user data with fresh DB data
    localStorage.setItem('user', JSON.stringify(state.user));
  } catch (err) {
    // If check fails (e.g. token expired), logout happens via interceptor above
  }
};

export const authState = {
  get token() { return state.token },
  get user() { return state.user },
  login,
  setSession,
  logout,
  refreshSession,
  getAvatar
};
