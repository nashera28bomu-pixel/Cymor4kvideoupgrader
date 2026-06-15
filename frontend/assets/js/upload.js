/* ============================================================
   RUMION NOVEL HUB — Upload handlers
   Used by create.html (new novel) and upload-chapter.html
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  if (!AUTH.requireAuth()) return;

  initCreateForm();
  initChapterForm();
});

/* ------------------------------------------------------------
   Create novel form (create.html)
   ------------------------------------------------------------ */
function initCreateForm() {
  const form = document.getElementById("create-form");
  if (!form) return;

  const coverInput = document.getElementById("cover");
  const coverPreview = document.getElementById("cover-preview");

  coverInput.addEventListener("change", () => {
    const file = coverInput.files[0];
    if (!file) {
      coverPreview.innerHTML = "No cover";
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      coverPreview.innerHTML = `<img src="${e.target.result}" alt="Cover preview">`;
    };
    reader.readAsDataURL(file);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const alertEl = document.getElementById("form-alert");
    const btn = document.getElementById("submit-btn");

    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const genre = document.getElementById("genre").value.trim();
    const coverFile = coverInput.files[0];

    alertEl.innerHTML = "";

    if (!title) {
      alertEl.innerHTML = `<div class="alert alert-error">Title is required.</div>`;
      return;
    }

    const fd = new FormData();
    fd.append("title", title);
    fd.append("description", description);
    fd.append("genre", genre);
    if (coverFile) fd.append("cover", coverFile);

    btn.disabled = true;
    btn.textContent = "Creating…";

    try {
      const res = await api.userNovels.upload(fd);
      showToast("Novel created — add chapters from My Novels");
      setTimeout(() => {
        window.location.href = `upload-chapter.html?novel=${encodeURIComponent(res.data.id)}`;
      }, 600);
    } catch (err) {
      alertEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
      btn.disabled = false;
      btn.textContent = "Create novel";
    }
  });
}

/* ------------------------------------------------------------
   Add chapter form (upload-chapter.html)
   ------------------------------------------------------------ */
function initChapterForm() {
  const form = document.getElementById("chapter-form");
  if (!form) return;

  const novelSelect = document.getElementById("novel-select");
  const params = new URLSearchParams(window.location.search);
  const presetNovelId = params.get("novel");

  // Populate novel dropdown from the author's own novels
  loadNovelOptions(novelSelect, presetNovelId);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const alertEl = document.getElementById("form-alert");
    const btn = document.getElementById("submit-btn");

    const novel_id = novelSelect.value;
    const title = document.getElementById("chapter-title").value.trim();
    const chapter_number = document.getElementById("chapter-number").value;
    const content = document.getElementById("chapter-content").value;

    alertEl.innerHTML = "";

    if (!novel_id) {
      alertEl.innerHTML = `<div class="alert alert-error">Please select a novel.</div>`;
      return;
    }
    if (!content.trim()) {
      alertEl.innerHTML = `<div class="alert alert-error">Chapter content is required.</div>`;
      return;
    }

    btn.disabled = true;
    btn.textContent = "Publishing…";

    try {
      await api.userNovels.addChapter({
        novel_id,
        title: title || null,
        content,
        chapter_number: chapter_number ? Number(chapter_number) : null,
      });
      showToast("Chapter added");
      form.reset();
      // Keep the novel selection for adding the next chapter
      novelSelect.value = novel_id;
      const numField = document.getElementById("chapter-number");
      if (chapter_number) numField.value = Number(chapter_number) + 1;
    } catch (err) {
      alertEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Publish chapter";
    }
  });
}

async function loadNovelOptions(selectEl, presetId) {
  try {
    const res = await api.userNovels.myNovels();
    const novels = res.data || [];

    if (!novels.length) {
      selectEl.innerHTML = `<option value="">No novels yet — create one first</option>`;
      selectEl.disabled = true;
      return;
    }

    selectEl.innerHTML = novels
      .map((n) => `<option value="${escapeHtml(n.id)}">${escapeHtml(n.title)}</option>`)
      .join("");

    if (presetId && novels.some((n) => String(n.id) === String(presetId))) {
      selectEl.value = presetId;
    }
  } catch (err) {
    selectEl.innerHTML = `<option value="">Failed to load novels</option>`;
    showToast(err.message);
  }
}
