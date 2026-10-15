/*
 * Cont Google + salvarea fișelor în Firestore.
 *
 * Model de date:
 *   users/{uid}                 → profil (displayName, email, photoURL, lastLoginAt, createdAt)
 *   users/{uid}/fise/{fisaId}   → { title, nume, text, targetPublic, progress, total, data, createdAt, updatedAt }
 *
 * Fișa deschisă în formular este „legată” de un document din cloud prin localStorage (CURRENT_KEY).
 * Cât timp utilizatorul este conectat, orice modificare se salvează automat (debounce).
 */

const FIREBASE_VERSION = "12.3.0";
const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
const CURRENT_KEY = "fisa-current";
const SAVE_DEBOUNCE_MS = 1200;

const App = window.FisaApp;
const getConfig = () => window.FIREBASE_CONFIG;

const state = {
  fb: null,
  auth: null,
  db: null,
  user: null,
  fise: [],
  current: null, // { id, uid }
  save: "local", // local | idle | saving | saved | error | unsaved
  lastSavedAt: null,
  pendingData: null,
  saveTimer: null,
  unsubscribeList: null,
  menuOpen: false,
  drawerOpen: false,
  ready: false
};

/* ---------- Utilitare ---------- */

const $ = (sel, parent) => (parent || document).querySelector(sel);

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isConfigured() {
  const config = getConfig();
  return Boolean(config && config.apiKey && config.projectId && !/^REPLACE/.test(config.apiKey));
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return "";
  return d.toLocaleString("ro-RO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatTime(value) {
  const d = toDate(value);
  if (!d) return "";
  return d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

function fisaTitle(item) {
  const nume = (item.nume || "").trim();
  const text = (item.text || "").trim();
  if (nume && text) return `${nume} – ${text}`;
  if (text) return text;
  if (nume) return `${nume} – fișă fără pasaj`;
  return "Fișă fără titlu";
}

function initials(name, email) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function avatarHtml(user, extraClass) {
  const cls = "avatar" + (extraClass ? " " + extraClass : "");
  if (user.photoURL) {
    return `<span class="${cls}"><img src="${escapeHtml(user.photoURL)}" alt="" referrerpolicy="no-referrer" /></span>`;
  }
  return `<span class="${cls}" aria-hidden="true">${escapeHtml(initials(user.displayName, user.email))}</span>`;
}

function readCurrent() {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeCurrent(value) {
  state.current = value;
  if (value) localStorage.setItem(CURRENT_KEY, JSON.stringify(value));
  else localStorage.removeItem(CURRENT_KEY);
}

function localUpdatedAt() {
  return toDate(localStorage.getItem(App.storageKeys.UPDATED_AT_KEY));
}

function shareUrl(shareId) {
  const base = location.origin + location.pathname.replace(/[^/]*$/, "");
  return `${base}view?id=${encodeURIComponent(shareId)}`;
}

function publicPayload(data, sourceId) {
  const { serverTimestamp } = state.fb.firestore;
  const clean = Object.assign({}, data);
  delete clean.date;
  delete clean["note-personale"]; // notele personale nu se publică
  return {
    title: App.getPageTitle(clean.nume, clean.text),
    nume: clean.nume || "",
    text: clean.text || "",
    ownerUid: state.user.uid,
    ownerName: state.user.displayName || "",
    sourceId: sourceId,
    data: clean,
    updatedAt: serverTimestamp()
  };
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const tmp = document.createElement("textarea");
    tmp.value = text;
    tmp.style.position = "fixed";
    tmp.style.opacity = "0";
    document.body.appendChild(tmp);
    tmp.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (err) {}
    document.body.removeChild(tmp);
    return ok;
  }
}

/* ---------- Iconițe ---------- */

const ICONS = {
  google: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.55-5.17 3.55-8.87z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.37-2.29V6.62H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"/></svg>`,
  chevron: `<svg class="user-panel__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`,
  list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`,
  cloudCheck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A7 7 0 0 0 4.3 12.6 3.5 3.5 0 0 0 5.5 19z"/><path d="M9 14l2 2 4-4"/></svg>`,
  cloudOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A7 7 0 0 0 4.3 12.6 3.5 3.5 0 0 0 5.5 19z"/></svg>`,
  spinner: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`,
  device: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>`,
  link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  open: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3h7v7"/><path d="M10 14L21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>`
};

/* ---------- Randare: panoul de utilizator ---------- */

function renderUserPanel() {
  const panel = $("#user-panel");
  if (!panel) return;

  if (!isConfigured()) {
    panel.innerHTML = "";
    return;
  }

  if (!state.ready) {
    panel.innerHTML = `<span class="cloud-unconfigured">Se verifică contul…</span>`;
    return;
  }

  if (!state.user) {
    panel.innerHTML = `
      <button type="button" class="btn btn-outline btn-sm user-panel__login" id="cloud-login">
        ${ICONS.google}
        <span class="label-long">Conectare cu Google</span>
        <span class="label-short">Conectare</span>
      </button>`;
    $("#cloud-login", panel).addEventListener("click", login);
    return;
  }

  const u = state.user;
  const total = state.fise.length;
  const complete = state.fise.filter(f => f.total && f.progress >= f.total).length;
  panel.innerHTML = `
    <button type="button" class="user-panel__trigger" id="user-menu-trigger" aria-haspopup="true" aria-expanded="${state.menuOpen}">
      ${avatarHtml(u)}
      <span class="user-panel__name">${escapeHtml(u.displayName || u.email)}</span>
      ${ICONS.chevron}
    </button>
    <div class="user-menu" id="user-menu" ${state.menuOpen ? "" : "hidden"}>
      <div class="user-menu__profile">
        ${avatarHtml(u, "avatar--lg")}
        <div class="user-menu__profile-text">
          <div class="name">${escapeHtml(u.displayName || "Utilizator")}</div>
          <div class="email">${escapeHtml(u.email || "")}</div>
        </div>
      </div>
      <div class="user-menu__stats">
        <div class="user-menu__stat">
          <div class="value">${total}</div>
          <div class="label">${total === 1 ? "fișă salvată" : "fișe salvate"}</div>
        </div>
        <div class="user-menu__stat">
          <div class="value">${complete}</div>
          <div class="label">${complete === 1 ? "completă" : "complete"}</div>
        </div>
      </div>
      <div class="user-menu__actions">
        <button type="button" data-action="list">${ICONS.list} Fișele mele</button>
        <button type="button" data-action="new">${ICONS.plus} Fișă nouă</button>
        <button type="button" data-action="logout" class="danger">${ICONS.logout} Deconectare</button>
      </div>
    </div>`;

  $("#user-menu-trigger", panel).addEventListener("click", e => {
    e.stopPropagation();
    toggleMenu();
  });
  $("[data-action='list']", panel).addEventListener("click", () => {
    toggleMenu(false);
    openDrawer();
  });
  $("[data-action='new']", panel).addEventListener("click", () => {
    toggleMenu(false);
    newFisa();
  });
  $("[data-action='logout']", panel).addEventListener("click", () => {
    toggleMenu(false);
    logout();
  });
}

function toggleMenu(force) {
  state.menuOpen = typeof force === "boolean" ? force : !state.menuOpen;
  const menu = $("#user-menu");
  const trigger = $("#user-menu-trigger");
  if (menu) menu.hidden = !state.menuOpen;
  if (trigger) trigger.setAttribute("aria-expanded", String(state.menuOpen));
}

document.addEventListener("click", e => {
  if (state.menuOpen && !e.target.closest("#user-panel")) toggleMenu(false);
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (state.menuOpen) toggleMenu(false);
    if (state.drawerOpen) closeDrawer();
  }
});

/* ---------- Randare: starea de salvare ---------- */

function currentItem() {
  if (!state.current) return null;
  return state.fise.find(f => f.id === state.current.id) || null;
}

function renderStatus() {
  const box = $("#cloud-status");
  if (!box) return;
  box.className = "cloud-status";

  if (!isConfigured()) {
    box.classList.add("is-local");
    box.innerHTML = `
      <div class="cloud-status__row">${ICONS.device}<strong>Salvat doar în acest browser</strong></div>
      <div class="cloud-status__meta">Datele rămân în browserul curent. Folosește „Descarcă raw.json” pentru o copie de siguranță.</div>`;
    return;
  }

  if (!state.user) {
    box.classList.add("is-local");
    box.innerHTML = `
      <div class="cloud-status__row">${ICONS.device}<strong>Salvat doar în acest browser</strong></div>
      <div class="cloud-status__meta">Conectează-te cu Google ca să păstrezi fișele în cont și să revii la ele de pe orice dispozitiv.</div>
      <div class="cloud-status__actions">
        <button type="button" class="btn btn-primary btn-sm" data-action="login" ${state.ready ? "" : "disabled"}>${ICONS.google} Conectare cu Google</button>
      </div>`;
    $("[data-action='login']", box).addEventListener("click", login);
    return;
  }

  const item = currentItem();
  const count = state.fise.length;
  let icon = ICONS.cloudCheck;
  let label = "";
  let meta = "";
  let syncTitle = "Salvează acum în cont";

  if (state.save === "saving") {
    box.classList.add("is-saving");
    icon = ICONS.spinner;
    label = "Se salvează în cont…";
    syncTitle = "Se salvează…";
  } else if (state.save === "unsaved") {
    box.classList.add("is-saving");
    icon = ICONS.spinner;
    label = "Modificări în așteptare…";
    syncTitle = "Salvează acum, fără să aștepți";
  } else if (state.save === "error") {
    box.classList.add("is-error");
    icon = ICONS.alert;
    label = "Nu s-a putut salva în cont";
    syncTitle = "Reîncearcă salvarea";
    const e = state.lastError;
    const detail = e ? escapeHtml((e.code ? e.code + ": " : "") + (e.message || String(e))) : "";
    meta = `Datele rămân salvate în acest browser.${detail ? `<br /><code style="font-size:12px">${detail}</code>` : ""}`;
  } else if (state.current && item) {
    const when = state.lastSavedAt ? formatTime(state.lastSavedAt) : item.updatedAt ? formatDateTime(item.updatedAt) : "";
    label = `Salvat în cont${when ? `<span class="cloud-status__meta">${when}</span>` : ""}`;
  } else if (state.current) {
    label = "Salvat în cont";
  } else {
    icon = ICONS.cloudOff;
    label = "Fișă nouă";
    meta = "Se salvează automat în contul tău de la prima modificare.";
  }

  const title = item ? fisaTitle(item) : App.getPageTitle($("#nume")?.value, $("#text")?.value);
  const iconBtn = (action, svg, text, extra) =>
    `<button type="button" class="cloud-status__btn${extra && extra.cls ? " " + extra.cls : ""}" data-action="${action}" title="${escapeHtml(text)}" aria-label="${escapeHtml(text)}">${svg}${extra && extra.badge ? `<span class="cloud-status__badge">${extra.badge}</span>` : ""}</button>`;

  box.innerHTML = `
    <div class="cloud-status__row">
      <button type="button" class="cloud-status__sync" data-action="sync" title="${escapeHtml(syncTitle)}" aria-label="${escapeHtml(syncTitle)}" ${state.save === "saving" ? "disabled" : ""}>${icon}</button>
      <strong>${label}</strong>
    </div>
    ${state.current ? `<div class="cloud-status__title">${escapeHtml(title)}</div>` : ""}
    ${meta ? `<div class="cloud-status__meta cloud-status__meta--block">${meta}</div>` : ""}
    <div class="cloud-status__actions">
      ${iconBtn("list", ICONS.list, `Fișele mele${count ? ` (${count})` : ""}`, { badge: count || "" })}
      ${iconBtn("new", ICONS.plus, "Fișă nouă")}
      ${item ? iconBtn("share", item.shareId ? ICONS.link : ICONS.share, item.shareId ? "Link public – copiază" : "Partajează", item.shareId ? { cls: "is-public" } : null) : ""}
      ${state.save === "error" ? iconBtn("retry", ICONS.refresh, "Reîncearcă salvarea") : ""}
    </div>`;
  $("[data-action='sync']", box).addEventListener("click", syncNow);
  $("[data-action='list']", box).addEventListener("click", openDrawer);
  $("[data-action='new']", box).addEventListener("click", newFisa);
  const share = $("[data-action='share']", box);
  if (share && item) share.addEventListener("click", () => shareFisa(item.id));
  const retry = $("[data-action='retry']", box);
  if (retry) retry.addEventListener("click", syncNow);
}

/** Salvare imediată, declanșată manual (norișorul din banda de stare / „Reîncearcă”). */
function syncNow() {
  if (!state.user || state.save === "saving") return;
  scheduleSave(App.getFormValues(), true);
}

/* ---------- Randare: panoul „Fișele mele” ---------- */

function renderDrawer() {
  const drawer = $("#fise-drawer");
  if (!drawer) return;
  const items = state.fise;
  const currentId = state.current ? state.current.id : null;

  const itemBtn = (action, svg, text, cls) =>
    `<button type="button" class="fisa-item__btn${cls ? " " + cls : ""}" data-action="${action}" title="${escapeHtml(text)}" aria-label="${escapeHtml(text)}">${svg}</button>`;

  const list = items.length
    ? items
        .map(item => {
          const isCurrent = item.id === currentId;
          const pct = item.total ? Math.round((item.progress / item.total) * 100) : 0;
          return `
        <article class="fisa-item" data-id="${escapeHtml(item.id)}">
          <div class="fisa-item__top">
            <button type="button" class="fisa-item__title" data-action="open" title="Deschide fișa">${escapeHtml(fisaTitle(item))}</button>
            <span class="fisa-item__badges">
              ${item.shareId ? `<span class="fisa-item__badge fisa-item__badge--public">Publică</span>` : ""}
              ${isCurrent ? `<span class="fisa-item__badge">Deschisă</span>` : ""}
            </span>
          </div>
          <div class="fisa-item__meta">
            ${item.text ? `<span class="pasaj">${escapeHtml(item.text)}</span>` : ""}
            ${item.targetPublic ? `<span>${escapeHtml(item.targetPublic)}</span>` : ""}
            <span>Modificată ${escapeHtml(formatDateTime(item.updatedAt) || "recent")}</span>
          </div>
          <div class="fisa-item__progress" title="${pct}% completat" aria-label="${pct}% completat">
            <div class="bar"><span style="width:${pct}%"></span></div>
          </div>
          <div class="fisa-item__actions">
            ${isCurrent ? "" : itemBtn("open", ICONS.open, "Deschide fișa")}
            ${item.shareId ? itemBtn("share", ICONS.link, "Link public – copiază", "is-public") : itemBtn("share", ICONS.share, "Partajează")}
            ${itemBtn("duplicate", ICONS.copy, "Duplică")}
            ${itemBtn("download", ICONS.download, "Descarcă JSON")}
            ${itemBtn("delete", ICONS.trash, "Șterge", "danger")}
          </div>
        </article>`;
        })
        .join("")
    : `<div class="drawer__empty">
        <strong>Nicio fișă salvată încă</strong>
        Completează formularul și fișa se salvează automat în contul tău. O regăsești aici de pe orice dispozitiv.
      </div>`;

  drawer.innerHTML = `
    <div class="drawer__header">
      <div>
        <p class="kicker">${escapeHtml(state.user ? state.user.displayName || state.user.email : "")}</p>
        <h2 id="fiseDrawerTitle">Fișele mele</h2>
      </div>
      <button type="button" class="close-modal" data-action="close" aria-label="Închide">${ICONS.close}</button>
    </div>
    <div class="drawer__toolbar">
      <span>${items.length === 0 ? "Nicio fișă" : items.length === 1 ? "1 fișă salvată" : `${items.length} fișe salvate`}</span>
      <button type="button" class="btn btn-primary btn-sm" data-action="new">${ICONS.plus} Fișă nouă</button>
    </div>
    <div class="drawer__list">${list}</div>`;

  $("[data-action='close']", drawer).addEventListener("click", closeDrawer);
  $("[data-action='new']", drawer).addEventListener("click", () => {
    closeDrawer();
    newFisa();
  });
  drawer.querySelectorAll(".fisa-item").forEach(el => {
    const id = el.dataset.id;
    el.querySelectorAll("[data-action='open']").forEach(b => b.addEventListener("click", () => openFisa(id)));
    $("[data-action='share']", el).addEventListener("click", () => shareFisa(id));
    $("[data-action='duplicate']", el).addEventListener("click", () => duplicateFisa(id));
    $("[data-action='download']", el).addEventListener("click", () => downloadFisa(id));
    $("[data-action='delete']", el).addEventListener("click", () => deleteFisa(id));
  });
}

function openDrawer() {
  if (!state.user) {
    login();
    return;
  }
  renderDrawer();
  state.drawerOpen = true;
  $("#fise-drawer").classList.add("is-open");
  $("#fise-drawer").setAttribute("aria-hidden", "false");
  $("#fise-drawer-backdrop").classList.add("is-open");
  document.body.style.overflow = "hidden";
}

function closeDrawer() {
  state.drawerOpen = false;
  const drawer = $("#fise-drawer");
  if (drawer) {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
  }
  const backdrop = $("#fise-drawer-backdrop");
  if (backdrop) backdrop.classList.remove("is-open");
  document.body.style.overflow = "";
}

function renderAll() {
  renderUserPanel();
  renderStatus();
  if (state.drawerOpen) renderDrawer();
}

/* ---------- Firebase ---------- */

async function loadFirebase() {
  const [app, auth, firestore] = await Promise.all([
    import(`${CDN}/firebase-app.js`),
    import(`${CDN}/firebase-auth.js`),
    import(`${CDN}/firebase-firestore.js`)
  ]);
  state.fb = { app, auth, firestore };
  const firebaseApp = app.initializeApp(getConfig());
  state.auth = auth.getAuth(firebaseApp);
  state.auth.languageCode = "ro";
  state.db = firestore.getFirestore(firebaseApp);
}

function fiseCollection(uid) {
  const { collection } = state.fb.firestore;
  return collection(state.db, "users", uid, "fise");
}

function fisaRef(uid, id) {
  const { doc } = state.fb.firestore;
  return doc(state.db, "users", uid, "fise", id);
}

async function login() {
  if (!state.auth) return;
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = state.fb.auth;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(state.auth, provider);
  } catch (err) {
    if (err && (err.code === "auth/popup-blocked" || err.code === "auth/operation-not-supported-in-this-environment")) {
      await signInWithRedirect(state.auth, provider);
      return;
    }
    if (err && err.code === "auth/popup-closed-by-user") return;
    console.error("Login error:", err);
    App.showCustomAlert(
      `Conectarea nu a reușit.<br /><span class="small">${escapeHtml((err && err.message) || "Eroare necunoscută")}</span>`
    );
  }
}

async function logout() {
  if (!state.auth) return;
  flushSave();
  await state.fb.auth.signOut(state.auth);
  // Legătura cu documentul din cont rămâne în localStorage (conține uid-ul),
  // ca la o reconectare cu același cont să nu creăm un duplicat.
  App.showToast("Te-ai deconectat. Fișa rămâne salvată în acest browser.");
}

async function upsertProfile(user) {
  const { doc, getDoc, setDoc, serverTimestamp } = state.fb.firestore;
  const ref = doc(state.db, "users", user.uid);
  const payload = {
    displayName: user.displayName || "",
    email: user.email || "",
    photoURL: user.photoURL || "",
    lastLoginAt: serverTimestamp()
  };
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) payload.createdAt = serverTimestamp();
    await setDoc(ref, payload, { merge: true });
  } catch (err) {
    console.warn("Profile update failed:", err);
  }
}

function subscribeList(uid) {
  if (state.unsubscribeList) state.unsubscribeList();
  const { onSnapshot } = state.fb.firestore;
  state.unsubscribeList = onSnapshot(
    fiseCollection(uid),
    snapshot => {
      state.fise = snapshot.docs
        .map(d => Object.assign({ id: d.id }, d.data({ serverTimestamps: "estimate" })))
        .sort((a, b) => {
          const da = toDate(a.updatedAt);
          const db = toDate(b.updatedAt);
          return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
        });
      renderAll();
    },
    err => {
      console.error("Firestore list error:", err);
      state.save = "error";
      state.lastError = err;
      renderAll();
    }
  );
}

function buildPayload(data) {
  const progress = App.getProgress();
  const clean = Object.assign({}, data);
  delete clean.date;
  return {
    title: App.getPageTitle(clean.nume, clean.text),
    nume: clean.nume || "",
    text: clean.text || "",
    targetPublic: clean["target-public"] || "",
    progress: progress.completed,
    total: progress.total,
    data: clean
  };
}

async function createFisa(data, options) {
  const opts = options || {};
  const { doc, setDoc, serverTimestamp } = state.fb.firestore;
  const ref = doc(fiseCollection(state.user.uid));
  const payload = buildPayload(data);
  payload.createdAt = serverTimestamp();
  payload.updatedAt = serverTimestamp();
  await setDoc(ref, payload);
  if (opts.link !== false) writeCurrent({ id: ref.id, uid: state.user.uid });
  return ref.id;
}

async function saveNow(data) {
  if (!state.user) return;
  const { setDoc, serverTimestamp } = state.fb.firestore;
  state.save = "saving";
  renderStatus();
  try {
    if (state.current && state.current.uid === state.user.uid) {
      const payload = buildPayload(data);
      payload.updatedAt = serverTimestamp();
      await setDoc(fisaRef(state.user.uid, state.current.id), payload, { merge: true });
      const item = currentItem();
      if (item && item.shareId) {
        const { doc } = state.fb.firestore;
        await setDoc(doc(state.db, "public", item.shareId), publicPayload(data, item.id), { merge: true });
      }
    } else {
      if (!App.hasContent(data)) {
        state.save = "idle";
        renderStatus();
        return;
      }
      await createFisa(data);
    }
    state.save = "saved";
    state.lastSavedAt = new Date();
  } catch (err) {
    console.error("Save error:", err);
    state.save = "error";
    state.lastError = err;
  }
  renderStatus();
}

function scheduleSave(data, immediate) {
  if (!state.user) return;
  state.pendingData = data;
  clearTimeout(state.saveTimer);
  if (immediate) {
    const d = state.pendingData;
    state.pendingData = null;
    saveNow(d);
    return;
  }
  if (state.save !== "saving") {
    state.save = "unsaved";
  }
  state.saveTimer = setTimeout(() => {
    const d = state.pendingData;
    state.pendingData = null;
    saveNow(d);
  }, SAVE_DEBOUNCE_MS);
}

function flushSave() {
  if (state.pendingData) {
    clearTimeout(state.saveTimer);
    const d = state.pendingData;
    state.pendingData = null;
    saveNow(d);
  }
}

/* ---------- Acțiuni pe fișe ---------- */

function loadIntoForm(item) {
  App.clearFormFields();
  App.setFormValues(item.data || {});
  App.persistFormData(null, { silent: true });
  App.updateProgress();
  writeCurrent({ id: item.id, uid: state.user.uid });
  state.save = "saved";
  state.lastSavedAt = null;
  renderAll();
}

function openFisa(id) {
  const item = state.fise.find(f => f.id === id);
  if (!item) return;
  if (state.current && state.current.id === id) {
    closeDrawer();
    return;
  }
  const proceed = () => {
    flushSave();
    loadIntoForm(item);
    closeDrawer();
    App.showToast(`Ai deschis „${escapeHtml(fisaTitle(item))}”.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  // Fișa curentă nelegată de cont și cu conținut: ar fi pierdută.
  if (!state.current && App.hasContent()) {
    App.showCustomAlert(
      "Fișa curentă nu este salvată în cont. O salvăm înainte de a deschide fișa selectată?",
      async () => {
        try {
          await createFisa(App.getFormValues(), { link: false });
        } catch (err) {
          console.error(err);
        }
        proceed();
      },
      true,
      { confirmLabel: "Salvează și deschide", cancelLabel: "Renunță", extraActions: [{ label: "Deschide fără salvare", onClick: proceed }] }
    );
    return;
  }
  proceed();
}

function newFisa() {
  const start = () => {
    flushSave();
    App.clearFormFields({ keepName: true });
    App.persistFormData(null, { silent: true });
    writeCurrent(null);
    state.save = "idle";
    state.lastSavedAt = null;
    renderAll();
    closeDrawer();
    const pasaj = $("#text");
    if (pasaj) pasaj.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  if (!state.current && App.hasContent()) {
    App.showCustomAlert(
      "Fișa curentă nu este salvată în cont. O salvăm înainte de a începe una nouă?",
      async () => {
        try {
          await createFisa(App.getFormValues(), { link: false });
        } catch (err) {
          console.error(err);
        }
        start();
      },
      true,
      { confirmLabel: "Salvează și continuă", cancelLabel: "Renunță", extraActions: [{ label: "Continuă fără salvare", onClick: start }] }
    );
    return;
  }
  start();
}

async function duplicateFisa(id) {
  const item = state.fise.find(f => f.id === id);
  if (!item) return;
  try {
    const data = Object.assign({}, item.data || {});
    data.text = data.text ? `${data.text} (copie)` : "(copie)";
    const { doc, setDoc, serverTimestamp } = state.fb.firestore;
    const ref = doc(fiseCollection(state.user.uid));
    const payload = buildPayloadFrom(data, item);
    payload.createdAt = serverTimestamp();
    payload.updatedAt = serverTimestamp();
    await setDoc(ref, payload);
    App.showToast("Fișa a fost duplicată.");
  } catch (err) {
    console.error(err);
    App.showCustomAlert("Duplicarea nu a reușit. Încearcă din nou.");
  }
}

function buildPayloadFrom(data, item) {
  return {
    title: App.getPageTitle(data.nume, data.text),
    nume: data.nume || "",
    text: data.text || "",
    targetPublic: data["target-public"] || "",
    progress: item.progress || 0,
    total: item.total || 7,
    data
  };
}

function downloadFisa(id) {
  const item = state.fise.find(f => f.id === id);
  if (!item) return;
  App.downloadJson(item.data || {});
}

function showShareDialog(id, shareId) {
  const url = shareUrl(shareId);
  const item = state.fise.find(f => f.id === id);
  App.showCustomAlert(
    `<div class="share-box">
      <p><strong>${escapeHtml(item ? fisaTitle(item) : "Fișa")}</strong> este publică. Oricine are linkul o poate vedea, în format de tipărire, fără cont.</p>
      <div class="share-box__link">
        <input type="text" readonly value="${escapeHtml(url)}" id="share-link-input" />
        <a class="btn btn-outline btn-sm" href="${escapeHtml(url)}" target="_blank" rel="noopener">${ICONS.open} Deschide</a>
      </div>
      <span class="small">Modificările ulterioare apar automat în pagina publică. Poți opri partajarea oricând.</span>
    </div>`,
    async () => {
      const ok = await copyText(url);
      App.showToast(ok ? "Linkul a fost copiat." : "Nu am putut copia linkul. Selectează-l și copiază-l manual.");
    },
    true,
    {
      confirmLabel: "Copiază linkul",
      cancelLabel: "Închide",
      extraActions: [{ label: "Oprește partajarea", className: "btn-danger", onClick: () => unshareFisa(id) }]
    }
  );
  const input = document.getElementById("share-link-input");
  if (input) input.addEventListener("focus", () => input.select());
}

async function shareFisa(id) {
  const item = state.fise.find(f => f.id === id);
  if (!item) return;
  if (item.shareId) {
    showShareDialog(id, item.shareId);
    return;
  }
  try {
    flushSave();
    const { doc, collection, setDoc, updateDoc } = state.fb.firestore;
    const ref = doc(collection(state.db, "public"));
    const data = state.current && state.current.id === id ? App.getFormValues() : item.data || {};
    await setDoc(ref, publicPayload(data, id));
    await updateDoc(fisaRef(state.user.uid, id), { shareId: ref.id });
    App.showToast("Fișa este acum publică.");
    showShareDialog(id, ref.id);
  } catch (err) {
    console.error(err);
    App.showCustomAlert(`Partajarea nu a reușit.<br /><span class="small">${escapeHtml((err && err.message) || "")}</span>`);
  }
}

function unshareFisa(id) {
  const item = state.fise.find(f => f.id === id);
  if (!item || !item.shareId) return;
  App.showCustomAlert(
    `Oprești partajarea fișei „<strong>${escapeHtml(fisaTitle(item))}</strong>”?<br /><span class="small">Linkul public nu va mai funcționa.</span>`,
    async () => {
      try {
        const { doc, deleteDoc, updateDoc, deleteField } = state.fb.firestore;
        await deleteDoc(doc(state.db, "public", item.shareId));
        await updateDoc(fisaRef(state.user.uid, id), { shareId: deleteField() });
        App.showToast("Partajarea a fost oprită.");
      } catch (err) {
        console.error(err);
        App.showCustomAlert("Oprirea partajării nu a reușit. Încearcă din nou.");
      }
    },
    true,
    { confirmLabel: "Oprește partajarea", cancelLabel: "Renunță", danger: true }
  );
}

function deleteFisa(id) {
  const item = state.fise.find(f => f.id === id);
  if (!item) return;
  App.showCustomAlert(
    `Ștergi definitiv fișa „<strong>${escapeHtml(fisaTitle(item))}</strong>”?`,
    async () => {
      try {
        const { deleteDoc, doc } = state.fb.firestore;
        if (item.shareId) {
          try {
            await deleteDoc(doc(state.db, "public", item.shareId));
          } catch (e) {
            console.warn("Public copy not removed:", e);
          }
        }
        await deleteDoc(fisaRef(state.user.uid, id));
        if (state.current && state.current.id === id) {
          clearTimeout(state.saveTimer);
          state.pendingData = null;
          App.clearFormFields({ keepName: true });
          App.persistFormData(null, { silent: true });
          writeCurrent(null);
          state.save = "idle";
        }
        App.showToast("Fișa a fost ștearsă.");
        renderAll();
      } catch (err) {
        console.error(err);
        App.showCustomAlert("Ștergerea nu a reușit. Încearcă din nou.");
      }
    },
    true,
    { confirmLabel: "Șterge", cancelLabel: "Renunță", danger: true }
  );
}

/* ---------- Sincronizarea fișei curente la conectare ---------- */

async function reconcileOnLogin(user) {
  const stored = readCurrent();
  const localData = App.getFormValues();
  const localHas = App.hasContent(localData);

  if (stored && stored.uid === user.uid) {
    state.current = stored;
    try {
      const { getDoc } = state.fb.firestore;
      const snap = await getDoc(fisaRef(user.uid, stored.id));
      if (!snap.exists()) {
        writeCurrent(null);
      } else {
        const remote = snap.data();
        const remoteAt = toDate(remote.updatedAt);
        const localAt = localUpdatedAt();
        if (remoteAt && (!localAt || remoteAt.getTime() - localAt.getTime() > 2000)) {
          loadIntoForm(Object.assign({ id: snap.id }, remote));
          App.showToast("Am încărcat versiunea mai nouă din contul tău.");
          return;
        }
        if (localAt && remoteAt && localAt.getTime() - remoteAt.getTime() > 2000) {
          scheduleSave(localData, true);
        } else {
          state.save = "saved";
        }
        return;
      }
    } catch (err) {
      console.error("Reconcile error:", err);
      state.save = "error";
      state.lastError = err;
      return;
    }
  } else if (stored) {
    writeCurrent(null);
  }

  if (localHas) {
    try {
      await createFisa(localData);
      state.save = "saved";
      state.lastSavedAt = new Date();
      App.showToast("Fișa curentă a fost salvată în contul tău.");
    } catch (err) {
      console.error(err);
      state.save = "error";
      state.lastError = err;
    }
  } else {
    state.save = "idle";
  }
}

/* ---------- Hook-uri în aplicație ---------- */

App.hooks.onImport = function (data, fileName) {
  if (!state.user) return false;
  const applyReplace = () => App.applyImportedData(data, fileName);
  const applyNew = () => {
    flushSave();
    writeCurrent(null);
    App.clearFormFields();
    App.applyImportedData(data, fileName);
  };
  if (!state.current) {
    applyNew();
    return true;
  }
  const item = currentItem();
  App.showCustomAlert(
    `Cum încărcăm <strong>${escapeHtml(fileName)}</strong>?<br /><span class="small">Poți înlocui conținutul fișei „${escapeHtml(item ? fisaTitle(item) : "curente")}” sau poți crea o fișă nouă în cont.</span>`,
    applyReplace,
    true,
    { confirmLabel: "Înlocuiește fișa curentă", cancelLabel: "Renunță", extraActions: [{ label: "Fișă nouă", onClick: applyNew }] }
  );
  return true;
};

App.hooks.onReset = function () {
  if (!state.user || !state.current) return false;
  const item = currentItem();
  App.showCustomAlert(
    `Golești toate câmpurile fișei „<strong>${escapeHtml(item ? fisaTitle(item) : "curente")}</strong>”?<br /><span class="small">Fișa rămâne în cont, dar fără conținut. Dacă vrei să o elimini complet, folosește „Șterge” din Fișele mele.</span>`,
    () => {
      App.clearFormFields({ keepName: true });
      App.persistFormData(null, { source: "reset" });
    },
    true,
    { confirmLabel: "Golește", cancelLabel: "Renunță" }
  );
  return true;
};

document.addEventListener("fisa:change", e => {
  if (!state.user) return;
  scheduleSave(e.detail.data);
});

window.addEventListener("beforeunload", () => {
  flushSave();
});

/* ---------- Pornire ---------- */

async function init() {
  renderUserPanel();
  renderStatus();
  if (!isConfigured()) {
    console.info("[fisa] Firebase neconfigurat: salvarea în cont este dezactivată. Vezi assets/js/firebase-config.js");
    return;
  }

  try {
    await loadFirebase();
  } catch (err) {
    console.error("Firebase nu a putut fi încărcat:", err);
    return;
  }

  const { onAuthStateChanged, getRedirectResult } = state.fb.auth;
  getRedirectResult(state.auth).catch(err => console.warn("Redirect result:", err));

  onAuthStateChanged(state.auth, async user => {
    state.ready = true;
    if (user) {
      state.user = { uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL };
      renderAll();
      upsertProfile(user);
      subscribeList(user.uid);
      await reconcileOnLogin(user);
    } else {
      if (state.unsubscribeList) state.unsubscribeList();
      state.unsubscribeList = null;
      state.user = null;
      state.fise = [];
      state.current = null;
      state.save = "local";
      closeDrawer();
    }
    renderAll();
  });

  $("#fise-drawer-backdrop").addEventListener("click", closeDrawer);
}

// Pentru depanare din consolă.
window.FisaCloud = { state, renderAll, openDrawer, closeDrawer };

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
