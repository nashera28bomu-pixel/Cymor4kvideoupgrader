const API_BASE = "https://rumionnovelhubapi.onrender.com/api";

const params = new URLSearchParams(window.location.search);
const novelId = params.get("id");

const loading = document.getElementById("loading");
const header = document.getElementById("novel-header");
const chaptersSection = document.getElementById("chapters-section");

const cover = document.getElementById("cover");
const title = document.getElementById("title");
const description = document.getElementById("description");
const genre = document.getElementById("genre");
const chaptersDiv = document.getElementById("chapters");
const readBtn = document.getElementById("readBtn");

/* LOAD NOVEL */
async function loadNovel() {
  try {
    const res = await fetch(`${API_BASE}/novels/${novelId}`);
    const data = await res.json();

    if (!data.success) throw new Error("Failed to load novel");

    const novel = data.data.novel;
    const chapters = data.data.chapters;

    cover.src = novel.cover_url || "https://via.placeholder.com/200x300";
    title.textContent = novel.title;
    description.textContent = novel.description;
    genre.textContent = (novel.genre || []).join(", ");

    /* CHAPTER LIST */
    chaptersDiv.innerHTML = "";

    chapters.forEach(ch => {
      const div = document.createElement("div");
      div.className = "chapter";
      div.textContent = `Chapter ${ch.chapter_number || ""} - ${ch.title}`;

      div.onclick = () => {
        window.location.href = `reader.html?id=${ch.id}`;
      };

      chaptersDiv.appendChild(div);
    });

    /* READ BUTTON */
    if (chapters.length > 0) {
      readBtn.onclick = () => {
        window.location.href = `reader.html?id=${chapters[0].id}`;
      };
    }

    loading.classList.add("hidden");
    header.classList.remove("hidden");
    chaptersSection.classList.remove("hidden");

  } catch (err) {
    loading.textContent = "Failed to load novel 😢";
    console.error(err);
  }
}

loadNovel();
