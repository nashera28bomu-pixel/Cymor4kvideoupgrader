// ─── CONFIG ───────────────────────────────────────────────
const API_BASE = 'https://rumion-novel-hub.onrender.com'; // ← change after deploy

// ─── HELPERS ──────────────────────────────────────────────
export const getToken = () => localStorage.getItem('rumion_token');
export const getUser  = () => JSON.parse(localStorage.getItem('rumion_user') || 'null');
export const isLoggedIn = () => !!getToken();

export function logout() {
  localStorage.removeItem('rumion_token');
  localStorage.removeItem('rumion_user');
  window.location.href = '/index.html';
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Don't set Content-Type for FormData (browser sets boundary)
  if (options.body instanceof FormData) delete headers['Content-Type'];

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export function saveAuth(user, token) {
  localStorage.setItem('rumion_token', token);
  localStorage.setItem('rumion_user', JSON.stringify(user));
}

export function updateNavAuth() {
  const user = getUser();
  const navAuth = document.getElementById('nav-auth');
  const navUser = document.getElementById('nav-user');
  if (!navAuth || !navUser) return;

  if (user) {
    navAuth.style.display = 'none';
    navUser.style.display = 'flex';
    const nameEl = document.getElementById('nav-username');
    if (nameEl) nameEl.textContent = user.username;
    const roleEl = document.getElementById('nav-role');
    if (roleEl) {
      roleEl.textContent = user.role;
      roleEl.className = `role-badge role-${user.role}`;
    }
    // Show/hide role-specific links
    if (user.role === 'author' || user.role === 'admin') {
      document.querySelectorAll('.author-only').forEach(el => el.style.display = '');
    }
    if (user.role === 'admin') {
      document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
    }
  } else {
    navAuth.style.display = 'flex';
    navUser.style.display = 'none';
  }
}
