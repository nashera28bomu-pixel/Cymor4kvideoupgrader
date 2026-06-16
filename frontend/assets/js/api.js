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

  /* ---------------- External NovelHub catalog ---------------- */
  novels: {
    featured: (page = 1, limit = 20) =>
      request(`/api/novels/featured?page=${page}&limit=${limit}`),

    rankings: (rank = 1, page = 1, limit = 20) =>
      request(`/api/novels/rankings/${rank}?page=${page}&limit=${limit}`),

    chapters: (id, page = 1, limit = 50) =>
      request(`/api/novels/${id}/chapters?page=${page}&limit=${limit}`),

    chapter: (chapterId) => request(`/api/novels/chapter/${chapterId}`),

    detail: (detailPath) => request(`/api/novels/${detailPath}`),

    search: (q, page = 1) => request(`/api/novels/search?q=${encodeURIComponent(q)}&page=${page}`),
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

/**
 * The external NovelHub worker API wraps results inconsistently across
 * endpoints. This digs through common shapes to find the list of novels.
 */
function extractNovelList(res) {
  const data = res?.data?.data ?? res?.data ?? res;
  if (Array.isArray(data)) return data;

  const candidates = ["list", "bookList", "novelList", "items", "rankList", "data"];
  for (const key of candidates) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

/** Pull a usable field regardless of which naming convention the worker used */
function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj?.[k] != null && obj[k] !== "") return obj[k];
  }
  return null;
}

/** Get a cover image URL, handling both string covers and {url: ...} cover objects */
function pickCover(novel) {
  const cover = pick(novel, "cover", "coverUrl", "coverImg", "thumbUrl", "image");
  if (!cover) return null;
  if (typeof cover === "string") return cover;
  if (typeof cover === "object") return cover.url || cover.thumbnail || null;
  return null;
}

/** Render a card for an EXTERNAL NovelHub novel (links to external-novel.html) */
function externalNovelCardHtml(novel) {
  const novelId = pick(novel, "novelId", "bookId", "id");
  const detailPath = pick(novel, "detailPath", "link");
  const title = pick(novel, "title", "bookName", "novelName", "name") || "Untitled";
  const cover = pickCover(novel);
  const genre = Array.isArray(novel?.genres) ? novel.genres[0] : pick(novel, "genreName", "categoryName", "tag");

  const coverHtml = cover
    ? `<img class="novel-cover" src="${escapeHtml(cover)}" alt="${escapeHtml(title)} cover" loading="lazy">`
    : `<div class="novel-cover-placeholder">${escapeHtml(title)}</div>`;

  const href = `external-novel.html?id=${encodeURIComponent(novelId)}${detailPath ? `&path=${encodeURIComponent(detailPath)}` : ""}`;

  return `
    <a class="novel-card" href="${href}">
      ${coverHtml}
      <div class="novel-info">
        <h3>${escapeHtml(title)}</h3>
        ${genre ? `<span class="badge">${escapeHtml(genre)}</span>` : ""}
      </div>
    </a>
  `;
}

/* ============================================================
   Reading history / "Continue Reading" (stored in localStorage)
   ============================================================ */

const READING_HISTORY_KEY = "rumion_reading_history";
const READING_HISTORY_MAX = 30;

function getReadingHistory() {
  try {
    const raw = localStorage.getItem(READING_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Record/update progress for a novel.
 * entry: {
 *   type: "external" | "user",
 *   novelId, detailPath (external only),
 *   chapterId, chapterTitle,
 *   novelTitle, cover
 * }
 */
function saveReadingProgress(entry) {
  try {
    const history = getReadingHistory();
    const key = `${entry.type}:${entry.novelId}`;
    const filtered = history.filter((h) => `${h.type}:${h.novelId}` !== key);
    filtered.unshift({ ...entry, updatedAt: Date.now() });
    localStorage.setItem(READING_HISTORY_KEY, JSON.stringify(filtered.slice(0, READING_HISTORY_MAX)));
  } catch {
    /* localStorage unavailable — silently skip */
  }
}

function removeReadingProgress(type, novelId) {
  try {
    const history = getReadingHistory();
    const key = `${type}:${novelId}`;
    const filtered = history.filter((h) => `${h.type}:${h.novelId}` !== key);
    localStorage.setItem(READING_HISTORY_KEY, JSON.stringify(filtered));
  } catch {
    /* ignore */
  }
}

/** Render a "continue reading" card pointing back to the exact chapter */
function continueCardHtml(entry) {
  const cover = entry.cover
    ? `<img class="novel-cover" src="${escapeHtml(entry.cover)}" alt="${escapeHtml(entry.novelTitle)} cover" loading="lazy">`
    : `<div class="novel-cover-placeholder">${escapeHtml(entry.novelTitle || "Untitled")}</div>`;

  let href;
  if (entry.type === "external") {
    href = `external-reader.html?novel=${encodeURIComponent(entry.novelId)}&chapter=${encodeURIComponent(entry.chapterId)}`;
  } else {
    href = `reader.html?novel=${encodeURIComponent(entry.novelId)}&chapter=${encodeURIComponent(entry.chapterId)}`;
  }

  return `
    <a class="novel-card" href="${href}">
      ${cover}
      <div class="novel-info">
        <h3>${escapeHtml(entry.novelTitle || "Untitled")}</h3>
        <span class="meta">${escapeHtml(entry.chapterTitle || "Continue")}</span>
      </div>
    </a>
  `;
}

/** Render a single novel as a clickable card (USER-UPLOADED novels) */
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
