/* ============================================================
   RUMION NOVEL HUB — Home page
   Hero: /api/novels/featured (external NovelHub catalog)
   Trending grid: /api/novels/rankings/1
   Original grid: /api/user-novels/public (your authors)
   ============================================================ */

const HERO_ROTATE_MS = 6000;
let heroTimer = null;
let heroIndex = 0;

document.addEventListener("DOMContentLoaded", () => {
  loadHero();
  loadTrending();
  loadOriginals();

  const searchInput = document.getElementById("nav-search-input");
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && searchInput.value.trim()) {
      window.location.href = `home.html?q=${encodeURIComponent(searchInput.value.trim())}`;
    }
  });
});

/* ------------------------------------------------------------
   Hero — featured novels
   ------------------------------------------------------------ */
async function loadHero() {
  const hero = document.getElementById("hero");
  try {
    const res = await api.novels.featured(1, 10);
    const novels = extractNovelList(res);
    const withCovers = novels.filter((n) => pickCover(n));
    buildHero(hero, (withCovers.length ? withCovers : novels).slice(0, 6));
  } catch (err) {
    hero.innerHTML = `<div class="hero-empty"><h1>Welcome to Rumion</h1><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function buildHero(hero, novels) {
  if (!novels.length) {
    hero.innerHTML = `<div class="hero-empty"><h1>Welcome to Rumion</h1><p>Trending stories will appear here.</p></div>`;
    return;
  }

  const slides = novels
    .map((novel, i) => {
      const novelId = pick(novel, "novelId", "bookId", "id");
      const detailPath = pick(novel, "detailPath", "link");
      const title = pick(novel, "title", "bookName", "novelName", "name") || "Untitled";
      const desc = pick(novel, "summary", "introduction", "description", "intro") || "An original story on Rumion Novel Hub.";
      const cover = pickCover(novel) || "";
      const href = `external-novel.html?id=${encodeURIComponent(novelId)}${detailPath ? `&path=${encodeURIComponent(detailPath)}` : ""}`;

      return `
        <div class="hero-slide ${i === 0 ? "active" : ""}" data-index="${i}">
          ${cover ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(title)} cover">` : ""}
          <div class="hero-content">
            <div class="hero-eyebrow">♥ Trending now</div>
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(desc)}</p>
            <a href="${href}" class="btn btn-primary">Read now</a>
          </div>
        </div>
      `;
    })
    .join("");

  const dots = novels
    .map((_, i) => `<button class="hero-dot ${i === 0 ? "active" : ""}" data-index="${i}" aria-label="Slide ${i + 1}"></button>`)
    .join("");

  hero.innerHTML = `${slides}<div class="hero-dots">${dots}</div>`;

  heroIndex = 0;
  hero.querySelectorAll(".hero-dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      goToSlide(hero, novels.length, parseInt(dot.dataset.index, 10));
      restartHeroTimer(hero, novels.length);
    });
  });

  restartHeroTimer(hero, novels.length);
}

function goToSlide(hero, total, index) {
  heroIndex = ((index % total) + total) % total;
  hero.querySelectorAll(".hero-slide").forEach((el) => {
    el.classList.toggle("active", parseInt(el.dataset.index, 10) === heroIndex);
  });
  hero.querySelectorAll(".hero-dot").forEach((el) => {
    el.classList.toggle("active", parseInt(el.dataset.index, 10) === heroIndex);
  });
}

function restartHeroTimer(hero, total) {
  if (total <= 1) return;
  clearInterval(heroTimer);
  heroTimer = setInterval(() => {
    goToSlide(hero, total, heroIndex + 1);
  }, HERO_ROTATE_MS);
}

/* ------------------------------------------------------------
   Trending grid — rankings
   ------------------------------------------------------------ */
async function loadTrending() {
  const grid = document.getElementById("trending-grid");
  grid.innerHTML = loadingState();
  try {
    const res = await api.novels.rankings(1, 1, 12);
    const novels = extractNovelList(res);

    if (!novels.length) {
      grid.innerHTML = emptyState("Nothing trending right now", "Check back soon for trending stories.");
      return;
    }

    grid.innerHTML = novels.map(externalNovelCardHtml).join("");
  } catch (err) {
    grid.innerHTML = errorState(err.message);
  }
}

/* ------------------------------------------------------------
   Original grid — your authors' published novels
   ------------------------------------------------------------ */
async function loadOriginals() {
  const grid = document.getElementById("novel-grid");
  grid.innerHTML = loadingState();
  try {
    const res = await api.userNovels.public(1, 24);
    const novels = res.data || [];

    if (!novels.length) {
      grid.innerHTML = emptyState(
        "No original stories yet",
        "Be the first to publish a novel on Rumion."
      );
      return;
    }

    grid.innerHTML = novels.map(novelCardHtml).join("");
  } catch (err) {
    grid.innerHTML = errorState(err.message);
  }
}
