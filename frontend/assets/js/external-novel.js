/* ============================================================
   RUMION NOVEL HUB — External novel detail page
   Reads ?id= (novelId). Tries /api/novels/:id for details,
   falls back to chapter-list-only view if that fails
   (the worker's detail route expects a slug, not always an id).
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  const detailEl = document.getElementById("novel-detail");
  const chapterListEl = document.getElementById("chapter-list");

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    detailEl.innerHTML = errorState("No novel was specified.");
    return;
  }

  chapterListEl.innerHTML = loadingState();

  // Try to get rich details; if the worker rejects this id as a detail path, fall back gracefully
  let novelMeta = null;
  try {
    const detailRes = await api.novels.detail(id);
    const inner = detailRes?.data?.data ?? detailRes?.data;
    if (inner && (inner.bookName || inner.novelName || inner.title)) {
      novelMeta = inner;
    }
  } catch {
    /* fall through — render from chapter list only */
  }

  if (novelMeta) {
    renderNovel(detailEl, novelMeta, id);
  } else {
    detailEl.innerHTML = `
      <div class="novel-header">
        <div class="novel-cover-placeholder">Story #${escapeHtml(id)}</div>
        <div>
          <h1>Story details unavailable</h1>
          <p class="desc">We couldn't load the full description for this story right now, but its chapters are below.</p>
        </div>
      </div>
    `;
  }

  try {
    const chRes = await api.novels.chapters(id, 1, 100);
    const chapters = chRes?.data?.data?.chapterList || chRes?.data?.chapterList || [];

    if (!chapters.length) {
      chapterListEl.innerHTML = emptyState("No chapters found", "This story has no chapters available.");
      return;
    }

    const sorted = [...chapters].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

    chapterListEl.innerHTML = sorted
      .map((ch) => {
        return `
          <a class="chapter-row" href="external-reader.html?novel=${encodeURIComponent(id)}&chapter=${encodeURIComponent(ch.chapterId)}">
            <span class="ch-name">${escapeHtml(ch.chapterName || `Chapter ${ch.seq}`)}</span>
            <span class="ch-meta">${ch.totalWords ? ch.totalWords + " words" : ""}</span>
          </a>
        `;
      })
      .join("");

    // Wire "Start reading" if it exists
    const startBtn = document.getElementById("start-reading-btn");
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        window.location.href = `external-reader.html?novel=${encodeURIComponent(id)}&chapter=${encodeURIComponent(sorted[0].chapterId)}`;
      });
    }
  } catch (err) {
    chapterListEl.innerHTML = errorState(err.message);
  }

  const searchInput = document.getElementById("nav-search-input");
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && searchInput.value.trim()) {
      window.location.href = `home.html?q=${encodeURIComponent(searchInput.value.trim())}`;
    }
  });
});

function renderNovel(el, novel, id) {
  const title = pick(novel, "bookName", "novelName", "title", "name") || "Untitled";
  const cover = pick(novel, "cover", "coverUrl", "coverImg", "thumbUrl", "image");
  const desc = pick(novel, "introduction", "description", "intro") || "No description available.";
  const author = pick(novel, "authorName", "author");
  const genres = pick(novel, "genreNames", "categories", "tags");

  const coverHtml = cover
    ? `<img class="novel-cover" src="${escapeHtml(cover)}" alt="${escapeHtml(title)} cover">`
    : `<div class="novel-cover-placeholder">${escapeHtml(title)}</div>`;

  const genreHtml = Array.isArray(genres) && genres.length
    ? `<div class="genres">${genres.map((g) => `<span class="genre-tag">${escapeHtml(typeof g === "string" ? g : g.name || "")}</span>`).join("")}</div>`
    : "";

  document.title = `${title} — Rumion Novel Hub`;

  el.innerHTML = `
    <div class="novel-header">
      ${coverHtml}
      <div>
        <h1>${escapeHtml(title)}</h1>
        ${author ? `<p class="desc" style="margin:0 0 8px;">by ${escapeHtml(author)}</p>` : ""}
        ${genreHtml}
        <p class="desc">${escapeHtml(desc)}</p>
        <div class="actions">
          <button class="btn btn-primary" id="start-reading-btn">Start reading</button>
        </div>
      </div>
    </div>
  `;
}
