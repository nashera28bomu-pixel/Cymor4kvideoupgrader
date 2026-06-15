/* ============================================================
   RUMION NOVEL HUB — Novel detail page
   Reads ?id= from the URL, fetches GET /api/user-novels/:id
   which returns { novel, chapters }
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  const detailEl = document.getElementById("novel-detail");
  const chapterListEl = document.getElementById("chapter-list");

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    detailEl.innerHTML = errorState("No novel was specified.");
    chapterListEl.innerHTML = "";
    return;
  }

  detailEl.innerHTML = loadingState();
  chapterListEl.innerHTML = "";

  try {
    const res = await api.userNovels.get(id);
    const { novel, chapters } = res.data;

    if (!novel) {
      detailEl.innerHTML = emptyState("Novel not found", "This story may have been removed or unpublished.");
      return;
    }

    renderNovel(detailEl, novel);
    renderChapters(chapterListEl, novel, chapters || []);
    document.title = `${novel.title} — Rumion Novel Hub`;
  } catch (err) {
    detailEl.innerHTML = errorState(err.message);
  }

  // Search redirect
  const searchInput = document.getElementById("nav-search-input");
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && searchInput.value.trim()) {
      window.location.href = `home.html?q=${encodeURIComponent(searchInput.value.trim())}`;
    }
  });
});

function renderNovel(el, novel) {
  const cover = novel.cover_url
    ? `<img class="novel-cover" src="${escapeHtml(novel.cover_url)}" alt="${escapeHtml(novel.title)} cover">`
    : `<div class="novel-cover-placeholder">${escapeHtml(novel.title)}</div>`;

  const genres = Array.isArray(novel.genre) && novel.genre.length
    ? `<div class="genres">${novel.genre.map((g) => `<span class="genre-tag">${escapeHtml(g)}</span>`).join("")}</div>`
    : "";

  const desc = novel.description
    ? `<p class="desc">${escapeHtml(novel.description)}</p>`
    : `<p class="desc">No description provided yet.</p>`;

  el.innerHTML = `
    <div class="novel-header">
      ${cover}
      <div>
        <h1>${escapeHtml(novel.title)}</h1>
        ${genres}
        ${desc}
        <div class="actions">
          <button class="btn btn-primary" id="start-reading-btn">Start reading</button>
        </div>
      </div>
    </div>
  `;
}

function renderChapters(el, novel, chapters) {
  if (!chapters.length) {
    el.innerHTML = emptyState("No chapters yet", "The author hasn't published any chapters for this novel.");
    document.getElementById("start-reading-btn")?.setAttribute("disabled", "true");
    return;
  }

  // Sort by chapter_number ascending (server already orders, but be safe)
  const sorted = [...chapters].sort((a, b) => (a.chapter_number ?? 0) - (b.chapter_number ?? 0));

  el.innerHTML = sorted
    .map((ch) => {
      const num = ch.chapter_number != null ? `Ch. ${ch.chapter_number}` : "";
      const title = ch.title || "Untitled chapter";
      const date = ch.created_at ? new Date(ch.created_at).toLocaleDateString() : "";
      return `
        <a class="chapter-row" href="reader.html?novel=${encodeURIComponent(novel.id)}&chapter=${encodeURIComponent(ch.id)}">
          <span class="ch-name">${num ? num + " — " : ""}${escapeHtml(title)}</span>
          <span class="ch-meta">${escapeHtml(date)}</span>
        </a>
      `;
    })
    .join("");

  const startBtn = document.getElementById("start-reading-btn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      window.location.href = `reader.html?novel=${encodeURIComponent(novel.id)}&chapter=${encodeURIComponent(sorted[0].id)}`;
    });
  }
}
