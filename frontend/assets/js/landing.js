/* ============================================================
   RUMION NOVEL HUB — Landing page interactions
   - Falling petal animation
   - "Rumion Novel Hub loading…" transition on navigation
   - Best-effort "upcoming authors" from published novels
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  initLoader();
  initPetals();
  initTransitionLinks();
  loadUpcomingAuthors();
});

/* ------------------------------------------------------------
   Page loader — shows briefly on entry, and on outgoing nav
   ------------------------------------------------------------ */
function initLoader() {
  const loader = document.getElementById("page-loader");
  if (!loader) return;

  // Fade out shortly after the page is ready
  setTimeout(() => loader.classList.add("fade-out"), 600);
}

function initTransitionLinks() {
  const loader = document.getElementById("page-loader");
  if (!loader) return;

  document.querySelectorAll("[data-transition]").forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (!href || link.target === "_blank") return;

      e.preventDefault();
      loader.classList.remove("fade-out");
      setTimeout(() => {
        window.location.href = href;
      }, 450);
    });
  });
}

/* ------------------------------------------------------------
   Falling petals
   ------------------------------------------------------------ */
function initPetals() {
  const container = document.getElementById("petals");
  if (!container) return;

  // Respect reduced-motion preference
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const PETAL_COUNT = 14;
  const colors = ["#c41e3a", "#e8324a", "#e8b4bc", "#d4a574"];

  for (let i = 0; i < PETAL_COUNT; i++) {
    const petal = document.createElement("div");
    petal.className = "petal";

    const size = 10 + Math.random() * 14;
    const left = Math.random() * 100;
    const duration = 12 + Math.random() * 14;
    const delay = Math.random() * -duration;
    const drift = (Math.random() - 0.5) * 160;
    const color = colors[Math.floor(Math.random() * colors.length)];

    petal.style.left = `${left}vw`;
    petal.style.width = `${size}px`;
    petal.style.height = `${size}px`;
    petal.style.animationDuration = `${duration}s`;
    petal.style.animationDelay = `${delay}s`;
    petal.style.setProperty("--drift", `${drift}px`);

    petal.innerHTML = `
      <svg viewBox="0 0 32 32" width="${size}" height="${size}">
        <path d="M16 2 C24 8, 28 16, 16 30 C4 16, 8 8, 16 2 Z" fill="${color}" opacity="0.55"/>
      </svg>
    `;

    container.appendChild(petal);
  }
}

/* ------------------------------------------------------------
   Upcoming authors — best-effort from published novels
   ------------------------------------------------------------ */
async function loadUpcomingAuthors() {
  const grid = document.getElementById("authors-grid");
  if (!grid) return;

  try {
    const res = await api.userNovels.public(1, 8);
    const novels = res.data || [];

    if (!novels.length) return; // keep placeholder cards

    // Dedupe by title as a stand-in for author (no author/username field on user_novels)
    const cards = novels.slice(0, 4).map((novel) => {
      const initial = (novel.title || "?").trim().charAt(0).toUpperCase();
      const genre = Array.isArray(novel.genre) && novel.genre.length ? novel.genre[0] : "New story";
      return `
        <a class="author-card" href="novel.html?id=${encodeURIComponent(novel.id)}" style="display:block;">
          <div class="author-avatar">${escapeHtml(initial)}</div>
          <h3>${escapeHtml(novel.title)}</h3>
          <p>${escapeHtml(genre)}</p>
        </a>
      `;
    });

    grid.innerHTML = cards.join("");
  } catch {
    // keep placeholders silently
  }
}
