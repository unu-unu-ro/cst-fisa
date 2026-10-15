/*
 * Vizualizare publică (doar citire) a unei fișe partajate prin link: view?id=<shareId>
 * Citește documentul public/{shareId} din Firestore, fără autentificare.
 */
const FIREBASE_VERSION = "12.3.0";
const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showState(title, text) {
  const el = document.getElementById("view-state");
  el.innerHTML = `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p><p><a href="./">Deschide fișa interactivă</a></p>`;
  el.hidden = false;
  document.getElementById("view-doc").hidden = true;
  document.getElementById("share-meta").textContent = "";
}

function formatDate(value) {
  if (!value) return "";
  const d = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("ro-RO", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function main() {
  const id = new URLSearchParams(location.search).get("id");
  const config = window.FIREBASE_CONFIG;
  if (!id) {
    showState("Link incomplet", "Adresa nu conține identificatorul fișei.");
    return;
  }
  if (!config || !config.apiKey || /^REPLACE/.test(config.apiKey)) {
    showState("Partajarea nu este disponibilă", "Aplicația nu este configurată pentru fișe publice.");
    return;
  }

  try {
    const [{ initializeApp }, { getFirestore, doc, getDoc }] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-firestore.js`)
    ]);
    const db = getFirestore(initializeApp(config));
    const snap = await getDoc(doc(db, "public", id));
    if (!snap.exists()) {
      showState("Această fișă nu mai este publică", "Autorul a oprit partajarea sau linkul este greșit.");
      return;
    }
    const item = snap.data();
    const values = item.data || {};
    document.title = `${getPageTitle(values.nume, values.text)} — fișă partajată`;
    renderPreview(STEPS, values, "#preview-content");
    document.getElementById("view-doc").hidden = false;

    const owner = item.ownerName || values.nume || "";
    const when = formatDate(item.updatedAt);
    document.getElementById("share-meta").innerHTML =
      `Fișă partajată${owner ? ` de <strong>${escapeHtml(owner)}</strong>` : ""}${when ? ` · actualizată ${escapeHtml(when)}` : ""}`;
  } catch (err) {
    console.error(err);
    showState("Fișa nu a putut fi încărcată", "Verifică conexiunea la internet și încearcă din nou.");
  }
}

main();
