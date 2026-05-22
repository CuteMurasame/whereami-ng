// Centralized runtime configuration for API and server URLs.
// In production, prefer VITE_API_BASE_URL=/api behind a reverse proxy.

const trimTrailingSlash = (value) => (value || '').replace(/\/+$/, '');

export const API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_API_BASE_URL || '/api'
);

export const SERVER_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_SERVER_BASE_URL
  || (API_BASE_URL.startsWith('http') ? API_BASE_URL.replace(/\/api$/, '') : '')
);

export const SOCKET_URL = trimTrailingSlash(
  import.meta.env.VITE_SOCKET_URL
  || SERVER_BASE_URL
  || window.location.origin
);

export const toServerUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return SERVER_BASE_URL ? `${SERVER_BASE_URL}${normalizedPath}` : normalizedPath;
};

export const toApiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};
