/* ============================================================
   RUMION NOVEL HUB — API client
   ============================================================ */

const API_BASE = "https://rumionnovelhubapi.onrender.com";

/**
 * Core request helper. Adds Authorization header if a token is stored.
 * Handles JSON and FormData bodies.
 */
async function request(path, { method = "GET", body, auth = false, formData = false } = {}) {
  const headers = {};
  if (!formData) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = localStorage.getItem("rumion_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: formData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error("Network error — could not reach the server. It may be waking up, try again in a moment.");
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Server returned an unexpected response (${res.status})`);
  }

  if (!res.ok || json.success === false) {
    throw new Error(json.message || `Request failed (${res.status})`);
  }

  return json;
}

const api = {
  /* ---------------- Auth ---------------- */
  auth: {
    register: (email, password, username) =>
      request("/api/auth/register", { method: "POST", body: { email, password, username } }),

    login: (email, password) =>
      request("/api/auth/login", { method: "POST", body: { email, password } }),

    me: () => request("/api/auth/me", { auth: true }),

    logout: () => request("/api/auth/logout", { method: "POST", auth: true }),
  },

  /* ---------------- User Novels ---------------- */
  userNovels: {
    /** Public, published novels feed. page/limit optional */
    public: (page = 1, limit = 20) =>
      request(`/api/user-novels/public?page=${page}&limit=${limit}`),

    /** Logged-in author's own novels */
    myNovels: () => request("/api/user-novels/my-novels", { auth: true }),

    /** Single novel + its chapters */
    get: (id) => request(`/api/user-novels/${id}`),

    /** Single chapter with full content (requires GET /api/user-novels/chapter/:id on the backend) */
    getChapter: (chapterId) => request(`/api/user-novels/chapter/${chapterId}`),

    /** Upload a new novel. formDataObj should be a FormData instance */
    upload: (formDataObj) =>
      request("/api/user-novels/upload", { method: "POST", body: formDataObj, auth: true, formData: true }),

    /** Add a chapter: { novel_id, title, content, chapter_number } */
    addChapter: (payload) =>
      request("/api/user-novels/chapter", { method: "POST", body: payload, auth: true }),

    update: (id, payload) =>
      request(`/api/user-novels/${id}`, { method: "PUT", body: payload, auth: true }),

    remove: (id) => request(`/api/user-novels/${id}`, { method: "DELETE", auth: true }),

    setPublish: (id, publish) =>
      request(`/api/user-novels/${id}/publish`, { method: "PATCH", body: { publish }, auth: true }),
  },
};

/* ============================================================
   Small UI helpers shared across pages
   ============================================================ */

function showToast(message, ms = 3500) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render a single novel as a clickable card */
function novelCardHtml(novel) {
  const cover = novel.cover_url
    ? `<img class="novel-cover" src="${escapeHtml(novel.cover_url)}" alt="${escapeHtml(novel.title)} cover" loading="lazy">`
    : `<div class="novel-cover-placeholder">${escapeHtml(novel.title || "Untitled")}</div>`;

  const genres = Array.isArray(novel.genre) && novel.genre.length ? novel.genre[0] : "";

  return `
    <a class="novel-card" href="novel.html?id=${encodeURIComponent(novel.id)}">
      ${cover}
      <div class="novel-info">
        <h3>${escapeHtml(novel.title)}</h3>
        ${genres ? `<span class="badge">${escapeHtml(genres)}</span>` : ""}
      </div>
    </a>
  `;
}

function emptyState(title, body) {
  return `<div class="state-msg"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`;
}

function loadingState() {
  return `<div class="state-msg"><div class="spinner"></div><p>Loading…</p></div>`;
}

function errorState(message) {
  return `<div class="state-msg"><h3>Something went wrong</h3><p>${escapeHtml(message)}</p></div>`;
}
