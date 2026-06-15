/* ============================================================
   RUMION NOVEL HUB — Home page
   ============================================================ */

const HERO_ROTATE_MS = 6000;
let heroTimer = null;
let heroIndex = 0;

document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("novel-grid");
  const hero = document.getElementById("hero");

  grid.innerHTML = loadingState();

  try {
    const res = await api.userNovels.public(1, 24);
    const novels = res.data || [];

    if (!novels.length) {
      grid.innerHTML = emptyState(
        "No stories yet",
        "Be the first to publish a novel on Rumion."
      );
      hero.innerHTML = emptyState(
        "Your story could be here",
        "Trending novels with covers will rotate through this space once authors start publishing."
      ).replace("state-msg", "state-msg hero-empty");
      return;
    }

    grid.innerHTML = novels.map(novelCardHtml).join("");

    // Hero carousel: only feature novels that have a cover image
    const withCovers = novels.filter((n) => n.cover_url);
    const heroNovels = (withCovers.length ? withCovers : novels).slice(0, 5);
    buildHero(hero, heroNovels);
  } catch (err) {
    grid.innerHTML = errorState(err.message);
    hero.innerHTML = errorState(err.message);
  }

  // Search redirect
  const searchInput = document.getElementById("nav-search-input");
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && searchInput.value.trim()) {
      window.location.href = `home.html?q=${encodeURIComponent(searchInput.value.trim())}`;
    }
  });
});

function buildHero(hero, novels) {
  if (!novels.length) {
    hero.innerHTML = `<div class="hero-empty"><h1>Welcome to Rumion</h1><p>Trending stories will appear here once published.</p></div>`;
    return;
  }

  const slides = novels
    .map((novel, i) => {
      const desc = novel.description || "An original story, only on Rumion Novel Hub.";
      const cover = novel.cover_url || "";
      return `
        <div class="hero-slide ${i === 0 ? "active" : ""}" data-index="${i}">
          ${cover ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(novel.title)} cover">` : ""}
          <div class="hero-content">
            <div class="hero-eyebrow">♥ Trending now</div>
            <h1>${escapeHtml(novel.title)}</h1>
            <p>${escapeHtml(desc)}</p>
            <a href="novel.html?id=${encodeURIComponent(novel.id)}" class="btn btn-primary">Read now</a>
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
