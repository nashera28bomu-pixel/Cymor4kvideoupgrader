/* ============================================================
   RUMION NOVEL HUB — External reader page
   Reads ?novel=&chapter= (chapterId).
   Uses /api/novels/chapter/:id which returns full content +
   /api/novels/:id/chapters for prev/next navigation.
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  const contentEl = document.getElementById("reader-content");
  const titleEl = document.getElementById("reader-title");
  const backLink = document.getElementById("back-to-novel");

  const params = new URLSearchParams(window.location.search);
  const novelId = params.get("novel");
  const chapterId = params.get("chapter");
  const detailPath = params.get("path");

  if (!chapterId) {
    contentEl.innerHTML = errorState("No chapter was specified.");
    return;
  }

  if (novelId) {
    const backHref = `external-novel.html?id=${encodeURIComponent(novelId)}${detailPath ? `&path=${encodeURIComponent(detailPath)}` : ""}`;
    backLink.href = backHref;
  }

  try {
    const [chapterRes, chaptersRes] = await Promise.all([
      api.novels.chapter(chapterId),
      novelId ? api.novels.chapters(novelId, 1, 200).catch(() => null) : Promise.resolve(null),
    ]);

    const chapter = chapterRes?.data?.data || chapterRes?.data;
    if (!chapter || !chapter.content) {
      contentEl.innerHTML = errorState("This chapter could not be loaded.");
      return;
    }

    let prev = null;
    let next = null;

    if (chaptersRes) {
      const list = chaptersRes?.data?.data?.chapterList || chaptersRes?.data?.chapterList || [];
      const sorted = [...list].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
      const idx = sorted.findIndex((c) => String(c.chapterId) === String(chapterId));
      prev = idx > 0 ? sorted[idx - 1] : null;
      next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
    }

    document.title = `${chapter.chapterName || "Chapter"} — Rumion`;
    titleEl.textContent = chapter.chapterName || "Chapter";

    const paragraphs = (chapter.content || "")
      .split(/\n+/)
      .filter((p) => p.trim())
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join("");

    contentEl.innerHTML = `
      <h1>${escapeHtml(chapter.chapterName || "")}</h1>
      <div class="reader-text">${paragraphs}</div>
      <div class="reader-nav">
        ${
          prev
            ? `<a class="btn btn-ghost" href="external-reader.html?novel=${encodeURIComponent(novelId)}&chapter=${encodeURIComponent(prev.chapterId)}${detailPath ? `&path=${encodeURIComponent(detailPath)}` : ""}">← Previous</a>`
            : `<span></span>`
        }
        ${
          next
            ? `<a class="btn btn-primary" href="external-reader.html?novel=${encodeURIComponent(novelId)}&chapter=${encodeURIComponent(next.chapterId)}${detailPath ? `&path=${encodeURIComponent(detailPath)}` : ""}">Next chapter →</a>`
            : novelId
              ? `<a class="btn btn-ghost" href="external-novel.html?id=${encodeURIComponent(novelId)}${detailPath ? `&path=${encodeURIComponent(detailPath)}` : ""}">Back to novel</a>`
              : `<span></span>`
        }
      </div>
    `;

    window.scrollTo(0, 0);

    // Save reading progress (best-effort; fetch novel title/cover if we have a detail path)
    if (novelId) {
      let novelTitle = chapter.chapterName || "Story";
      let cover = null;

      if (detailPath) {
        try {
          const detailRes = await api.novels.detail(detailPath);
          const meta = detailRes?.data?.data ?? detailRes?.data ?? {};
          novelTitle = pick(meta, "title", "bookName", "novelName", "name") || novelTitle;
          cover = pickCover(meta);
        } catch {
          /* keep fallback title */
        }
      }

      saveReadingProgress({
        type: "external",
        novelId,
        detailPath: detailPath || null,
        chapterId,
        chapterTitle: chapter.chapterName || "",
        novelTitle,
        cover,
      });
    }
  } catch (err) {
    contentEl.innerHTML = errorState(err.message);
  }
});
