const THEMES = ["theme-black", "theme-red"];

function applyTheme(theme) {
  document.body.classList.remove(...THEMES);
  document.body.classList.add(theme);
  localStorage.setItem("print-preview-theme", theme);
  const btn = document.getElementById("toggle-themes");
  if (btn) {
    btn.classList.remove(...THEMES);
    btn.classList.add(theme);
  }
}

function initThemeToggle() {
  const btn = document.getElementById("toggle-themes");
  const stored = localStorage.getItem("print-preview-theme") || THEMES[0];
  applyTheme(stored);

  btn.addEventListener("click", () => {
    const current = THEMES.find(t => document.body.classList.contains(t)) || THEMES[0];
    const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    applyTheme(next);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  let values = getPersistedData();
  // ?src=item → fișă trimisă din lista „Fișele mele”, nu cea din formular.
  if (params.get("src") === "item") {
    try {
      const raw = localStorage.getItem("cst-print-data");
      if (raw) values = migrateToV2(JSON.parse(raw));
    } catch (e) {
      console.error("Error parsing print data:", e);
    }
  }
  document.title = getPageTitle(values["nume"], values["text"]);
  renderPreview(STEPS, values, "#preview-content");
  initThemeToggle();

  // Auto-print if ?print=1 is in the URL
  if (params.get("print") === "1") {
    window.addEventListener("load", function () {
      setTimeout(() => {
        window.print();
        // remove ?print=1 from URL after printing to prevent accidental reprints on reload
        params.delete("print");
        const qs = params.toString();
        history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
      }, 500);
    });
  }
});
