import { io } from 'socket.io-client';
import { SOCKET_URL } from './config';

let socket = null;

const getToken = () => localStorage.getItem('token') || null;

export function getSocket() {
  if (socket) return socket;

  socket = io(SOCKET_URL || undefined, {
    autoConnect: false,
    withCredentials: true,
    auth: () => ({ token: getToken() })
  });

  return socket;
}

export function connectSocket() {
  const s = getSocket();
  const token = getToken();
  if (!s.connected && token) {
    s.auth = { token };
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket) socket.disconnect();
}
