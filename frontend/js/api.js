/* =========================================================
RUMION NOVEL HUB - API CLIENT (PRODUCTION READY)
========================================================= */

const API_BASE = 'https://rumionnovelhubapi.onrender.com/api';

/* =========================
DEBUG MODE
========================= */
const isDev = () => location.hostname === 'localhost';

const log = (...args) => {
if (isDev()) console.log('[API]', ...args);
};

/* =========================
AUTH HELPERS
========================= */

export const getToken = () => localStorage.getItem('rumion_token');

export const getUser = () =>
JSON.parse(localStorage.getItem('rumion_user') || 'null');

export const isLoggedIn = () => !!getToken();

/* =========================
AUTH STORAGE
========================= */

export function saveAuth(user, token) {
localStorage.setItem('rumion_token', token);
localStorage.setItem('rumion_user', JSON.stringify(user));
}

/* =========================
LOGOUT
========================= */

export function logout() {
localStorage.removeItem('rumion_token');
localStorage.removeItem('rumion_user');
window.location.replace('/index.html');
}

/* =========================
REQUEST TIMEOUT WRAPPER
========================= */

const timeoutPromise = (ms) =>
new Promise((_, reject) =>
setTimeout(() => reject(new Error('Request timeout')), ms)
);

/* =========================
CORE FETCH WRAPPER
========================= */

export async function apiFetch(path, options = {}) {
const token = getToken();

const headers = { ...(options.headers || {}) };

// Only set JSON header if not FormData
if (!(options.body instanceof FormData)) {
headers['Content-Type'] = 'application/json';
}

if (token) {
headers['Authorization'] = "Bearer ${token}";
}

try {
log('Request:', path);

const res = await Promise.race([
  fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  }),
  timeoutPromise(20000) // 20s timeout for Render cold starts
]);

const data = await res.json();

log('Response:', data);

if (!res.ok) {
  throw new Error(data.message || 'Request failed');
}

// Normalize backend response (important)
return data.data ?? data;

} catch (err) {
log('Error:', err.message);
throw err;
}
}

/* =========================
NAV AUTH UI HANDLER
========================= */

export function updateNavAuth() {
const user = getUser();

const navAuth = document.getElementById('nav-auth');
const navUser = document.getElementById('nav-user');

if (!navAuth || !navUser) return;

if (user) {
navAuth.style.display = 'none';
navUser.style.display = 'flex';

const nameEl = document.getElementById('nav-username');
if (nameEl) nameEl.textContent = user.username || user.email;

const roleEl = document.getElementById('nav-role');
if (roleEl) {
  roleEl.textContent =
    user.role === 'admin' ? 'Admin' : '✍️';

  roleEl.className = `role-badge role-${user.role}`;
}

// Show writer tools for all creators
const canWrite =
  user.role === 'member' ||
  user.role === 'author' ||
  user.role === 'admin';

document.querySelectorAll('.author-only')
  .forEach(el => el.style.display = canWrite ? '' : 'none');

document.querySelectorAll('.admin-only')
  .forEach(el =>
    el.style.display =
      user.role === 'admin' ? '' : 'none'
  );

} else {
navAuth.style.display = 'flex';
navUser.style.display = 'none';
}
}
