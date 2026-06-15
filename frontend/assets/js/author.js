/* ============================================================
   RUMION NOVEL HUB — Shared author-area helpers
   Used by dashboard.html, my-novels.html, edit.html
   ============================================================ */

/** Render a single novel row for an author's "My Novels" list */
function authorNovelRowHtml(novel) {
  const cover = novel.cover_url
    ? `<img class="cover-sm" src="${escapeHtml(novel.cover_url)}" alt="${escapeHtml(novel.title)} cover">`
    : `<div class="cover-sm" style="display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:var(--rose);text-align:center;padding:4px;">${escapeHtml(novel.title)}</div>`;

  const statusClass = novel.is_published ? "published" : "draft";
  const statusLabel = novel.is_published ? "Published" : "Draft";
  const genres = Array.isArray(novel.genre) && novel.genre.length ? novel.genre.join(", ") : "No genre set";

  return `
    <div class="my-novel-row" data-id="${escapeHtml(novel.id)}">
      ${cover}
      <div class="info">
        <h3>${escapeHtml(novel.title)}</h3>
        <div class="meta">${escapeHtml(genres)}</div>
        <span class="status-pill ${statusClass}">${statusLabel}</span>
      </div>
      <div class="row-actions">
        <a class="btn btn-ghost btn-sm" href="edit.html?id=${encodeURIComponent(novel.id)}">Edit</a>
        <a class="btn btn-ghost btn-sm" href="upload-chapter.html?novel=${encodeURIComponent(novel.id)}">Add chapter</a>
        <button class="btn btn-sm ${novel.is_published ? "btn-ghost" : "btn-primary"}" data-action="publish" data-publish="${!novel.is_published}">
          ${novel.is_published ? "Unpublish" : "Publish"}
        </button>
        <button class="btn btn-danger btn-sm" data-action="delete">Delete</button>
      </div>
    </div>
  `;
}

/**
 * Attaches click handlers for publish/unpublish/delete buttons
 * inside a container of .my-novel-row elements. Call after rendering rows.
 * onChange (optional) is called after a successful action, useful for re-fetching.
 */
function attachRowActions(container, onChange) {
  container.querySelectorAll(".my-novel-row").forEach((row) => {
    const id = row.dataset.id;

    const publishBtn = row.querySelector('[data-action="publish"]');
    if (publishBtn) {
      publishBtn.addEventListener("click", async () => {
        const publish = publishBtn.dataset.publish === "true";
        publishBtn.disabled = true;
        try {
          await api.userNovels.setPublish(id, publish);
          showToast(publish ? "Novel published" : "Novel unpublished");
          if (onChange) {
            onChange();
          } else {
            location.reload();
          }
        } catch (err) {
          showToast(err.message);
          publishBtn.disabled = false;
        }
      });
    }

    const deleteBtn = row.querySelector('[data-action="delete"]');
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        if (!confirm("Delete this novel and all its chapters? This cannot be undone.")) return;
        deleteBtn.disabled = true;
        try {
          await api.userNovels.remove(id);
          showToast("Novel deleted");
          row.remove();
          if (onChange) onChange();
        } catch (err) {
          showToast(err.message);
          deleteBtn.disabled = false;
        }
      });
    }
  });
}
