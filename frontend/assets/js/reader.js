const API_BASE = "https://rumionnovelhubapi.onrender.com/api";

const params = new URLSearchParams(window.location.search);
const chapterId = params.get("id");

const loading = document.getElementById("loading");
const chapterBox = document.getElementById("chapter-box");
const nav = document.getElementById("nav");

const titleEl = document.getElementById("chapter-title");
const contentEl = document.getElementById("chapter-content");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

let currentChapter = null;

/* LOAD CHAPTER */
async function loadChapter() {
  try {
    const res = await fetch(`${API_BASE}/novels/chapter/${chapterId}`);
    const data = await res.json();

    if (!data.success) throw new Error("Failed to load chapter");

    const chapter = data.data.data; // IMPORTANT: nested response from API

    currentChapter = chapter;

    titleEl.textContent = chapter.chapterName || chapter.title || "Chapter";
    contentEl.textContent = chapter.content;

    loading.classList.add("hidden");
    chapterBox.classList.remove("hidden");
    nav.classList.remove("hidden");

  } catch (err) {
    loading.textContent = "Failed to load chapter 😢";
    console.error(err);
  }
}

/* NAV (basic placeholder logic for now) */
prevBtn.onclick = () => {
  alert("Previous chapter logic will be linked from chapter list later 🔥");
};

nextBtn.onclick = () => {
  alert("Next chapter logic will be linked from chapter list later 🔥");
};

loadChapter();
