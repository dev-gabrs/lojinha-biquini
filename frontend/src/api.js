const BASE = 'http://127.0.0.1:5000/api';
const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function saveTokens({ access, refresh }) {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// se várias chamadas expirarem juntas, só uma renovação acontece
let refreshing = null;

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${refreshToken}` }
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data || !data.access_token) {
          clearTokens();
          return null;
        }
        localStorage.setItem(ACCESS_KEY, data.access_token);
        return data.access_token;
      })
      .catch(() => {
        clearTokens();
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }

  return refreshing;
}

async function send(path, options, token) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${BASE}${path}`, { ...options, headers });
}

async function request(path, options = {}) {
  let response = await send(path, options, getAccessToken());

  // token de acesso venceu: renova uma vez e tenta de novo
  if (response.status === 401 && localStorage.getItem(REFRESH_KEY)) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await send(path, options, newToken);
    }
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401) clearTokens();
    const message = (data && (data.error || data.msg)) || 'Algo deu errado';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body || {}) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body || {}) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body || {}) }),
  del: (path) => request(path, { method: 'DELETE' })
};