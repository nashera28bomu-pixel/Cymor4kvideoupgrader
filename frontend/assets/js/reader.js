/* ============================================================
   RUMION NOVEL HUB — User novel reader
   Features: prev/next floating nav, star ratings, comments, view count
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  const contentEl = document.getElementById("reader-content");
  const titleEl = document.getElementById("reader-title");
  const backLink = document.getElementById("back-to-novel");
  const floatNav = document.getElementById("reader-float-nav");
  const floatPrev = document.getElementById("float-prev");
  const floatNext = document.getElementById("float-next");
  const floatLabel = document.getElementById("float-label");

  const params = new URLSearchParams(window.location.search);
  const novelId = params.get("novel");
  const chapterId = params.get("chapter");

  if (!novelId || !chapterId) {
    contentEl.innerHTML = errorState("No chapter was specified.");
    return;
  }

  backLink.href = `novel.html?id=${encodeURIComponent(novelId)}`;

  try {
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

    const prevUrl = prev ? `reader.html?novel=${encodeURIComponent(novelId)}&chapter=${encodeURIComponent(prev.id)}` : null;
    const nextUrl = next ? `reader.html?novel=${encodeURIComponent(novelId)}&chapter=${encodeURIComponent(next.id)}` : null;

    const paragraphs = (chapter.content || "")
      .split(/\n+/)
      .filter((p) => p.trim())
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join("");

    contentEl.innerHTML = `
      <div class="views-badge" id="views-badge">👁 …</div>
      <h1>${escapeHtml(chapterLabel)}</h1>
      <div class="reader-text">${paragraphs || "<p>This chapter has no content.</p>"}</div>
      <div class="reader-nav" style="margin-bottom:0;">
        ${prevUrl ? `<a class="btn btn-ghost" href="${prevUrl}">← Previous</a>` : `<span></span>`}
        ${nextUrl ? `<a class="btn btn-primary" href="${nextUrl}">Next chapter →</a>`
          : `<a class="btn btn-ghost" href="novel.html?id=${encodeURIComponent(novelId)}">Back to novel</a>`}
      </div>
      <div id="rating-section-mount"></div>
      <div id="comments-section-mount"></div>
    `;

    // Float nav
    floatNav.style.display = "flex";
    floatLabel.textContent = chapterLabel;
    floatPrev.innerHTML = prevUrl ? `<a class="btn btn-ghost btn-sm" href="${prevUrl}">← Prev</a>` : "";
    floatNext.innerHTML = nextUrl ? `<a class="btn btn-primary btn-sm" href="${nextUrl}">Next →</a>` : "";

    window.scrollTo(0, 0);

    // Save progress
    saveReadingProgress({
      type: "user", novelId, chapterId,
      chapterTitle: chapterLabel,
      novelTitle: novel.title,
      cover: novel.cover_url || null,
    });

    // Load interactions in parallel (non-blocking)
    trackView(novelId, "user");
    renderRatings("rating-section-mount", novelId, "user");
    renderComments("comments-section-mount", novelId, chapterId, "user");

  } catch (err) {
    contentEl.innerHTML = errorState(err.message);
  }
});

/* ============================================================
   VIEW TRACKING
   ============================================================ */
async function trackView(novelId, novelType) {
  try {
    await api.interactions.view(novelId, novelType);
    const res = await api.interactions.getViews(novelId);
    const badge = document.getElementById("views-badge");
    if (badge) badge.textContent = `👁 ${formatCount(res.views)} views`;
  } catch { /* silent */ }
}

/* ============================================================
   STAR RATINGS
   ============================================================ */
async function renderRatings(mountId, novelId, novelType) {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  mount.innerHTML = `
    <div class="rating-section">
      <h3>Rate this novel</h3>
      <div class="stars-display">
        <span class="star-avg" id="avg-display">—</span>
        <span class="star-count" id="count-display">No ratings yet</span>
      </div>
      <div class="stars-input" id="stars-input" aria-label="Rate this novel">
        ${[1,2,3,4,5].map(n => `<button class="star-btn" data-val="${n}" title="${n} star${n>1?'s':''}">★</button>`).join("")}
      </div>
      <div class="rating-msg" id="rating-msg"></div>
    </div>
  `;

  // Load current ratings
  try {
    const res = await api.interactions.getRating(novelId);
    const avgEl = document.getElementById("avg-display");
    const countEl = document.getElementById("count-display");
    if (avgEl) avgEl.textContent = res.average ? `★ ${res.average}` : "—";
    if (countEl) countEl.textContent = res.count ? `${res.count} rating${res.count !== 1 ? "s" : ""}` : "No ratings yet";

    // Highlight user's existing rating
    if (res.userRating) highlightStars(res.userRating);
  } catch { /* silent */ }

  // Star hover & click
  const starsInput = document.getElementById("stars-input");
  if (!starsInput) return;

  starsInput.querySelectorAll(".star-btn").forEach((btn) => {
    btn.addEventListener("mouseenter", () => highlightStars(parseInt(btn.dataset.val, 10), true));
    btn.addEventListener("mouseleave", () => {
      // reset to active state
      const activeStar = starsInput.querySelector(".star-btn.active");
      const activeVal = activeStar ? parseInt(activeStar.dataset.val, 10) : 0;
      highlightStars(activeVal, false);
    });
    btn.addEventListener("click", async () => {
      if (!AUTH.isLoggedIn()) {
        showToast("Log in to rate novels");
        return;
      }
      const val = parseInt(btn.dataset.val, 10);
      try {
        await api.interactions.rate(novelId, novelType, val);
        highlightStars(val);
        document.getElementById("rating-msg").textContent = `You rated this ${val} star${val > 1 ? "s" : ""} ♥`;
        // Refresh average
        const res = await api.interactions.getRating(novelId);
        const avgEl = document.getElementById("avg-display");
        const countEl = document.getElementById("count-display");
        if (avgEl) avgEl.textContent = res.average ? `★ ${res.average}` : "—";
        if (countEl) countEl.textContent = res.count ? `${res.count} rating${res.count !== 1 ? "s" : ""}` : "";
      } catch (err) {
        showToast(err.message);
      }
    });
  });
}

function highlightStars(val, isHover = false) {
  const starsInput = document.getElementById("stars-input");
  if (!starsInput) return;
  starsInput.querySelectorAll(".star-btn").forEach((btn) => {
    const n = parseInt(btn.dataset.val, 10);
    if (isHover) {
      btn.classList.toggle("hover", n <= val);
      btn.classList.remove("active");
    } else {
      btn.classList.toggle("active", n <= val);
      btn.classList.remove("hover");
    }
  });
}

/* ============================================================
   COMMENTS
   ============================================================ */
async function renderComments(mountId, novelId, chapterId, novelType) {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  const isLoggedIn = AUTH.isLoggedIn();

  mount.innerHTML = `
    <div class="comments-section">
      <h3>Comments</h3>
      ${isLoggedIn ? `
        <div class="comment-form">
          <textarea id="comment-input" placeholder="Share your thoughts on this chapter…"></textarea>
          <button class="btn btn-primary btn-sm" id="post-comment-btn">Post comment</button>
        </div>
      ` : `<p style="color:var(--rose);font-size:.9rem;margin-bottom:20px;"><a href="login.html" style="color:var(--crimson-bright);">Log in</a> to leave a comment.</p>`}
      <div class="comment-list" id="comment-list">
        <div class="state-msg"><div class="spinner"></div></div>
      </div>
      <button class="btn btn-ghost btn-sm" id="load-more-comments" style="display:none;margin-top:12px;">Load more</button>
    </div>
  `;

  let page = 1;
  let allComments = [];

  const loadComments = async (append = false) => {
    try {
      const res = await api.interactions.getComments(novelId, chapterId, page);
      const comments = res.data || [];
      if (!append) allComments = comments;
      else allComments = [...allComments, ...comments];

      renderCommentList(allComments, novelId, novelType);

      const loadMoreBtn = document.getElementById("load-more-comments");
      if (loadMoreBtn) loadMoreBtn.style.display = comments.length === 20 ? "block" : "none";
    } catch {
      const list = document.getElementById("comment-list");
      if (list) list.innerHTML = `<p style="color:var(--rose);font-size:.85rem;">Could not load comments.</p>`;
    }
  };

  loadComments();

  if (isLoggedIn) {
    const postBtn = document.getElementById("post-comment-btn");
    postBtn?.addEventListener("click", async () => {
      const input = document.getElementById("comment-input");
      const content = input?.value.trim();
      if (!content) return;
      postBtn.disabled = true;
      postBtn.textContent = "Posting…";
      try {
        await api.interactions.postComment(novelId, chapterId, novelType, content);
        input.value = "";
        page = 1;
        await loadComments();
        showToast("Comment posted ♥");
      } catch (err) {
        showToast(err.message);
      } finally {
        postBtn.disabled = false;
        postBtn.textContent = "Post comment";
      }
    });
  }

  document.getElementById("load-more-comments")?.addEventListener("click", async () => {
    page++;
    await loadComments(true);
  });
}

function renderCommentList(comments, novelId, novelType) {
  const list = document.getElementById("comment-list");
  if (!list) return;

  const currentUser = AUTH.getUser();

  if (!comments.length) {
    list.innerHTML = `<p style="color:var(--rose);font-size:.88rem;">No comments yet — be the first!</p>`;
    return;
  }

  list.innerHTML = comments.map((c) => {
    const isOwn = currentUser && String(c.user_id) === String(currentUser.id);
    const date = c.created_at ? new Date(c.created_at).toLocaleDateString() : "";
    return `
      <div class="comment-card" data-id="${escapeHtml(c.id)}">
        <div class="comment-header">
          <span class="comment-user">♥ ${escapeHtml(c.username || "Reader")}</span>
          <span class="comment-date">${escapeHtml(date)}</span>
          ${isOwn ? `<button class="delete-btn" onclick="deleteComment('${escapeHtml(c.id)}')">Delete</button>` : ""}
        </div>
        <div class="comment-text">${escapeHtml(c.content)}</div>
      </div>
    `;
  }).join("");
}

async function deleteComment(id) {
  if (!confirm("Delete this comment?")) return;
  try {
    await api.interactions.deleteComment(id);
    document.querySelector(`.comment-card[data-id="${id}"]`)?.remove();
    showToast("Comment deleted");
  } catch (err) {
    showToast(err.message);
  }
}

function formatCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}
