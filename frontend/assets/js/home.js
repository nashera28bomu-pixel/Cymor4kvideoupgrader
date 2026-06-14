async function loadFeatured() {
  const res = await fetchAPI("/novels/featured");

  const novels = res.data?.data || [];

  const container = document.getElementById("featuredList");

  container.innerHTML = novels.map(n => `
    <div class="card" onclick="openNovel('${n.id}')">
      <h4>${n.title}</h4>
      <p>${(n.description || "").slice(0, 60)}...</p>
    </div>
  `).join("");
}

async function loadTrending() {
  const res = await fetchAPI("/novels/featured");

  const novels = res.data?.data || [];

  const container = document.getElementById("trendingList");

  container.innerHTML = novels.map(n => `
    <div class="card" onclick="openNovel('${n.id}')">
      <h4>${n.title}</h4>
      <p>🔥 Trending</p>
    </div>
  `).join("");
}

function openNovel(id) {
  window.location.href = `novel.html?id=${id}`;
}

function goAuthor() {
  window.location.href = "author/dashboard.html";
}

async function searchNovels() {
  const q = document.getElementById("searchInput").value;

  if (!q) return;

  const res = await fetchAPI(`/novels/search?q=${q}`);

  const novels = res.data?.data || [];

  const container = document.getElementById("featuredList");

  container.innerHTML = novels.map(n => `
    <div class="card" onclick="openNovel('${n.id}')">
      <h4>${n.title}</h4>
      <p>${(n.description || "").slice(0, 60)}...</p>
    </div>
  `).join("");
}

loadFeatured();
loadTrending();
