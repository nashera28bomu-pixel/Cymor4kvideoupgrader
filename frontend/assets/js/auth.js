/* ============================================================
   RUMION NOVEL HUB — Auth state & shared navbar behavior
   ============================================================ */

const AUTH = {
  getToken() {
    return localStorage.getItem("rumion_token");
  },
  getUser() {
    const raw = localStorage.getItem("rumion_user");
    return raw ? JSON.parse(raw) : null;
  },
  isLoggedIn() {
    return !!this.getToken();
  },
  setSession(token, user) {
    localStorage.setItem("rumion_token", token);
    localStorage.setItem("rumion_user", JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem("rumion_token");
    localStorage.removeItem("rumion_user");
  },
  /** Redirect to login if not authenticated, returns false if redirected */
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = "login.html";
      return false;
    }
    return true;
  },
};

/* ------------------------------------------------------------
   Mobile nav toggle (used on every page with .navbar)
   ------------------------------------------------------------ */
function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }

  // Swap auth-dependent nav links
  const authSlot = document.querySelector("[data-auth-slot]");
  if (authSlot) {
    if (AUTH.isLoggedIn()) {
      authSlot.innerHTML = `
        <a href="author/dashboard.html">Dashboard</a>
        <a href="#" id="logout-link">Log out</a>
      `;
      const logoutLink = document.getElementById("logout-link");
      logoutLink.addEventListener("click", async (e) => {
        e.preventDefault();
        AUTH.clearSession();
        showToast("Logged out");
        setTimeout(() => (window.location.href = "../index.html"), 600);
      });
    } else {
      authSlot.innerHTML = `<a href="login.html">Log in</a>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", initNav);
