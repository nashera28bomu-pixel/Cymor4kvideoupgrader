/* ============================================================
   RUMION NOVEL HUB — External novel detail page
   ?id=    -> novelId, used for chapters list
   ?path=  -> detailPath, used for /api/novels/:detailPath
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  const detailEl = document.getElementById("novel-detail");
  const chapterListEl = document.getElementById("chapter-list");

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const detailPath = params.get("path");

  if (!id) {
    detailEl.innerHTML = errorState("No novel was specified.");
    return;
  }

  detailEl.innerHTML = loadingState();
  chapterListEl.innerHTML = loadingState();

  // Fetch details (requires detailPath) and chapters (requires novelId) in parallel
  const detailPromise = detailPath
    ? api.novels.detail(detailPath).catch(() => null)
    : Promise.resolve(null);

  const [detailRes, chRes] = await Promise.all([
    detailPromise,
    api.novels.chapters(id, 1, 200).catch((err) => ({ error: err })),
  ]);

  // ---- Render details ----
  const novelMeta = detailRes?.data?.data ?? detailRes?.data ?? null;

  if (novelMeta && (novelMeta.title || novelMeta.bookName)) {
    renderNovel(detailEl, novelMeta);
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

  // ---- Render chapters ----
  if (chRes?.error) {
    chapterListEl.innerHTML = errorState(chRes.error.message);
    return;
  }

  const chapters = chRes?.data?.data?.chapterList || chRes?.data?.chapterList || [];

  if (!chapters.length) {
    chapterListEl.innerHTML = emptyState("No chapters found", "This story has no chapters available.");
    return;
  }

  const sorted = [...chapters].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

  chapterListEl.innerHTML = sorted
    .map((ch) => `
      <a class="chapter-row" href="external-reader.html?novel=${encodeURIComponent(id)}&chapter=${encodeURIComponent(ch.chapterId)}">
        <span class="ch-name">${escapeHtml(ch.chapterName || `Chapter ${ch.seq}`)}</span>
        <span class="ch-meta">${ch.totalWords ? ch.totalWords + " words" : ""}</span>
      </a>
    `)
    .join("");

  const startBtn = document.getElementById("start-reading-btn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      window.location.href = `external-reader.html?novel=${encodeURIComponent(id)}&chapter=${encodeURIComponent(sorted[0].chapterId)}`;
    });
  }

  const searchInput = document.getElementById("nav-search-input");
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && searchInput.value.trim()) {
      window.location.href = `home.html?q=${encodeURIComponent(searchInput.value.trim())}`;
    }
  });
});

function renderNovel(el, novel) {
  const title = pick(novel, "title", "bookName", "novelName", "name") || "Untitled";
  const cover = pickCover(novel);
  const desc = pick(novel, "summary", "introduction", "description", "intro") || "No description available.";
  const author = pick(novel, "author", "authorName");
  const genres = Array.isArray(novel.genres) ? novel.genres : (Array.isArray(novel.tags) ? novel.tags : null);

  const coverHtml = cover
    ? `<img class="novel-cover" src="${escapeHtml(cover)}" alt="${escapeHtml(title)} cover">`
    : `<div class="novel-cover-placeholder">${escapeHtml(title)}</div>`;

  const genreHtml = genres && genres.length
    ? `<div class="genres">${genres.map((g) => `<span class="genre-tag">${escapeHtml(String(g))}</span>`).join("")}</div>`
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
