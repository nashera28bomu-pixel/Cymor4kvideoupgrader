/* ============================================================
   RUMION NOVEL HUB — User novel reader
   Reads ?novel=&chapter= (both are UUIDs from Supabase)
   Fetches full chapter content from GET /api/user-novels/chapter/:id
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
    // Fetch chapter content + novel chapter list (for prev/next nav) in parallel
    const [chapterRes, novelRes] = await Promise.all([
      api.userNovels.getChapter(chapterId),
      api.userNovels.get(novelId),
    ]);

    const chapter = chapterRes.data;
    const { novel, chapters } = novelRes.data;

    if (!chapter || !chapter.content) {
      contentEl.innerHTML = errorState("This chapter has no content yet.");
      return;
    }

    const sorted = [...(chapters || [])].sort(
      (a, b) => (a.chapter_number ?? 0) - (b.chapter_number ?? 0)
    );
    const idx = sorted.findIndex((c) => String(c.id) === String(chapterId));
    const prev = idx > 0 ? sorted[idx - 1] : null;
    const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;

    const chapterLabel = chapter.chapter_number != null
      ? `Chapter ${chapter.chapter_number}${chapter.title ? " — " + chapter.title : ""}`
      : chapter.title || "Chapter";

    document.title = `${chapterLabel} — ${novel.title} — Rumion`;
    titleEl.textContent = novel.title;

    const paragraphs = (chapter.content || "")
      .split(/\n+/)
      .filter((p) => p.trim())
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join("");

    const prevUrl = prev
      ? `reader.html?novel=${encodeURIComponent(novelId)}&chapter=${encodeURIComponent(prev.id)}`
      : null;
    const nextUrl = next
      ? `reader.html?novel=${encodeURIComponent(novelId)}&chapter=${encodeURIComponent(next.id)}`
      : null;

    contentEl.innerHTML = `
      <h1>${escapeHtml(chapterLabel)}</h1>
      <div class="reader-text">${paragraphs || "<p>This chapter has no content.</p>"}</div>
      <div class="reader-nav">
        ${prevUrl
          ? `<a class="btn btn-ghost" href="${prevUrl}">← Previous</a>`
          : `<span></span>`
        }
        ${nextUrl
          ? `<a class="btn btn-primary" href="${nextUrl}">Next chapter →</a>`
          : `<a class="btn btn-ghost" href="novel.html?id=${encodeURIComponent(novelId)}">Back to novel</a>`
        }
      </div>
    `;

    window.scrollTo(0, 0);

    // Save reading progress to library
    saveReadingProgress({
      type: "user",
      novelId,
      chapterId,
      chapterTitle: chapterLabel,
      novelTitle: novel.title,
      cover: novel.cover_url || null,
    });

  } catch (err) {
    contentEl.innerHTML = errorState(err.message);
  }
});
