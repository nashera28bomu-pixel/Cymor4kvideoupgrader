/* ============================================================
   RUMION NOVEL HUB — Reader page
   Reads ?novel=&chapter= from the URL.
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  const contentEl = document.getElementById("reader-content");
  const titleEl = document.getElementById("reader-title");
  const backLink = document.getElementById("back-to-novel");

  const params = new URLSearchParams(window.location.search);
  const novelId = params.get("novel");
  const chapterId = params.get("chapter");

  if (!novelId || !chapterId) {
    contentEl.innerHTML = errorState("No chapter was specified.");
    return;
  }

  backLink.href = `novel.html?id=${encodeURIComponent(novelId)}`;

  try {
    // Fetch chapter content + novel's full chapter list (for prev/next nav) in parallel
    const [chapterRes, novelRes] = await Promise.all([
      api.userNovels.getChapter(chapterId),
      api.userNovels.get(novelId),
    ]);

    const chapter = chapterRes.data;
    const { novel, chapters } = novelRes.data;

    const sorted = [...(chapters || [])].sort(
      (a, b) => (a.chapter_number ?? 0) - (b.chapter_number ?? 0)
    );
    const idx = sorted.findIndex((c) => String(c.id) === String(chapterId));
    const prev = idx > 0 ? sorted[idx - 1] : null;
    const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;

    document.title = `${chapter.title || "Chapter"} — ${novel.title} — Rumion`;
    titleEl.textContent = novel.title;

    const paragraphs = (chapter.content || "")
      .split(/\n+/)
      .filter((p) => p.trim())
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join("");

    contentEl.innerHTML = `
      <h1>${chapter.chapter_number != null ? "Chapter " + chapter.chapter_number + " — " : ""}${escapeHtml(chapter.title || "")}</h1>
      <div class="reader-text">${paragraphs || "<p>This chapter has no content.</p>"}</div>
      <div class="reader-nav">
        ${
          prev
            ? `<a class="btn btn-ghost" href="reader.html?novel=${encodeURIComponent(novelId)}&chapter=${encodeURIComponent(prev.id)}">← Previous</a>`
            : `<span></span>`
        }
        ${
          next
            ? `<a class="btn btn-primary" href="reader.html?novel=${encodeURIComponent(novelId)}&chapter=${encodeURIComponent(next.id)}">Next chapter →</a>`
            : `<a class="btn btn-ghost" href="novel.html?id=${encodeURIComponent(novelId)}">Back to novel</a>`
        }
      </div>
    `;

    window.scrollTo(0, 0);
  } catch (err) {
    contentEl.innerHTML = errorState(err.message);
  }
});
