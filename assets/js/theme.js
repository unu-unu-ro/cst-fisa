/*
 * Comutator de temă: auto (după sistem) → luminos → întunecat.
 * Alegerea se păstrează în localStorage. Atributul data-theme e setat deja
 * de scriptul inline din <head> (fără „flash”), aici doar legăm butonul.
 */
(function () {
  const KEY = "cst-theme";
  const MODES = ["auto", "light", "dark"];
  const LABELS = {
    auto: "Temă: automată (după sistem)",
    light: "Temă: luminoasă",
    dark: "Temă: întunecată",
  };
  const root = document.documentElement;
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function readMode() {
    try {
      const v = localStorage.getItem(KEY);
      return MODES.includes(v) ? v : "auto";
    } catch {
      return "auto";
    }
  }

  function isDark(mode) {
    return mode === "dark" || (mode === "auto" && darkQuery.matches);
  }

  function apply(mode) {
    if (mode === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", mode);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", isDark(mode) ? "#0d1424" : "#1848A8");

    const btn = document.getElementById("themeToggle");
    if (btn) {
      const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      btn.dataset.mode = mode;
      btn.title = `${LABELS[mode]} — clic pentru ${LABELS[next].replace("Temă: ", "")}`;
      btn.setAttribute("aria-label", btn.title);
    }
  }

  let mode = readMode();
  apply(mode);

  document.getElementById("themeToggle")?.addEventListener("click", () => {
    mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    try {
      if (mode === "auto") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, mode);
    } catch {}
    apply(mode);
  });

  darkQuery.addEventListener?.("change", () => {
    if (mode === "auto") apply(mode);
  });
})();
