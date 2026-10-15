# CST – Fișă de lucru (7 Pași)

[![Live](https://img.shields.io/badge/Site-fisa.predicare--expozitiva.ro-brightgreen?style=for-the-badge)](https://fisa.predicare-expozitiva.ro)

Aplicație web statică pentru completarea fișei de studiu biblic după metoda **CST (Charles Simeon Trust)**. Este instrumentul participanților la [Atelierele de predicare expozitivă](https://predicare-expozitiva.ro) pentru pregătirea predicilor expozitive într-un mod structurat.

Designul urmează sistemul editorial al site-ului părinte: albastru royal + cupru, Playfair Display pentru titluri, Source Sans 3 pentru text, linii în loc de carduri.

## Caracteristici principale

- **Proces în 7 Pași**: structura textului, context, ideea autorului, legătura cu Evanghelia, ideea centrală, titlu și schiță, aplicații.
- **Salvare automată locală**: datele sunt salvate în browser (`localStorage`), nu pierzi progresul la reîncărcare.
- **Cont Google + salvare în cloud** (opțional): conectare cu Google (Firebase Auth), fișele se salvează automat în Firestore. Din panoul de utilizator vezi cine e conectat, câte fișe are salvate, iar din „Fișele mele” poți deschide, duplica, descărca sau șterge fișe de pe orice dispozitiv.
- **Previzualizare PDF & Printare**: versiune curată a fișei, gata pentru PDF sau imprimantă.
- **Formatare rich-text**: îngroșat, cursiv, subliniat, culori, liste, indentare.
- **Import/Export JSON**: backup în `raw.json` și încărcare ulterioară pe alt dispozitiv.
- **Fără backend propriu**: totul rulează în browser; cloud-ul este Firebase, direct din client.

## Tehnologii folosite

- **HTML5 & Vanilla CSS**: fără framework-uri, fără build step.
- **Vanilla JavaScript**: logică rapidă și ușoară.
- **[Firebase](https://firebase.google.com/)** (Auth + Firestore), încărcat din CDN ca modul ES, doar dacă este configurat.
- **[Marked.js](https://marked.js.org/)**: Markdown → HTML (pentru fișele vechi, v1).
- **[DOMPurify](https://github.com/cure53/dompurify)**: curățarea HTML-ului.

## 📚 Instalare locală

```bash
git clone https://github.com/unu-unu-ro/cst-fisa.git
cd cst-fisa
npm install

npm start
```

## ☁️ Configurare Firebase (cont Google + salvare în cloud)

Fără configurare, aplicația funcționează complet, doar cu salvare locală. Pentru a activa contul:

1. Creează un proiect în [Firebase Console](https://console.firebase.google.com).
2. **Authentication → Sign-in method** → activează **Google**.
3. **Authentication → Settings → Authorized domains** → adaugă `fisa.predicare-expozitiva.ro` (și `localhost` pentru dezvoltare).
4. **Firestore Database → Create database** (production mode) → în tab-ul **Rules** lipește conținutul din [`firestore.rules`](firestore.rules) și publică.
5. **Project settings → Your apps → Add app (Web)** → copiază obiectul `firebaseConfig` în [`assets/js/firebase-config.js`](assets/js/firebase-config.js).

Valorile din `firebase-config.js` sunt identificatori publici (nu secrete); accesul la date este protejat de regulile Firestore, care permit fiecărui utilizator să citească și să scrie doar sub `users/{uid}`.

### Model de date

```
users/{uid}                  profil: displayName, email, photoURL, lastLoginAt, createdAt
users/{uid}/fise/{fisaId}    title, nume, text, targetPublic, progress, total, data{…}, createdAt, updatedAt
```

`data` este exact obiectul exportat în `raw.json` (versiunea 2, câmpurile rich-text ca HTML curățat).

### Partajare publică prin link

Din „Fișele mele” sau din banda de stare, „Partajează” face fișa publică: se creează un document în `public/{shareId}` (ID aleator de 20 de caractere) cu o copie a datelor, iar fișa primește câmpul `shareId`. Linkul este `https://fisa.predicare-expozitiva.ro/view?id=<shareId>` și deschide [`view.html`](view.html): fișa în format de tipărire, doar pentru citire, fără cont. Cât timp fișa e publică, autosave-ul actualizează și copia publică. „Oprește partajarea” șterge documentul public și linkul nu mai funcționează. Ștergerea fișei șterge și copia publică.

```
public/{shareId}    title, nume, text, ownerUid, ownerName, sourceId, data{…}, updatedAt
```

Regulile permit citirea de către oricine și scrierea/ștergerea doar de către `ownerUid`.

### Cum funcționează sincronizarea

- Fișa deschisă în formular este legată de un document din cont (`localStorage["fisa-current"]`).
- Conectat fiind, orice modificare se salvează automat (debounce ~1s). Starea se vede în caseta „Salvat în cont”.
- La conectare, dacă există o fișă locală nelegată de cont, este salvată automat în cont. Dacă documentul din cont este mai nou decât copia locală (editat pe alt dispozitiv), se încarcă versiunea din cont.
- Deconectarea păstrează datele locale; la reconectarea cu același cont, legătura se reface fără duplicate.

## Structura Proiectului

- `index.html`: pagina principală a aplicației.
- `print-preview.html`: pagina dedicată generării PDF-ului.
- `firestore.rules`: regulile de securitate Firestore.
- `assets/css/`: `common.css` (tokenuri de design), `style.css` (layout), `fisa.css` (formular), `rich-editor.css`, `cloud.css` (cont + fișe), `print-preview.css`.
- `assets/js/`:
  - `fisa.js`: formularul, progresul, import/export, alerte; expune `window.FisaApp` pentru alte module.
  - `cloud.js`: modul ES cu Firebase Auth + Firestore, panoul de utilizator, „Fișele mele”, autosave.
  - `firebase-config.js`: configurarea proiectului Firebase.
  - `fisa-utilities.js`, `utilities.js`, `rich-editor.js`, `print-preview.js`.
- `assets/external/`: biblioteci externe (Marked, DOMPurify).

## Resurse

Pentru metoda de lucru și ghidul complet: [predicare-expozitiva.ro/ghid](https://predicare-expozitiva.ro/ghid)

---

© Ateliere de predicare expozitivă. Fișa de lucru © Charles Simeon Trust.

## Contribuții & Dev notes

- [ ] Split point 4 into individual sub-points. (Legătura cu Evanghelia)
- [ ] When save pdf also save the raw json file.
- [x] Ctrl+P on the main page opens the print preview with `?print=1` (auto-print) instead of printing the raw form.
- [ ] Rich Text Toolbar improvements:
  - [ ] reuse 'Rich Text Toolbar' into the print preview page, so users can edit the content there as well.
  - [x] button for handling clear formatting of the text (remove all styles but keep the text content and line breaks)
  - [ ] copy/paste formatting
  - [ ] when pressing Tab key inside the rich editor and we are at the end of the line, move focus to the next element instead of indenting the text
- [ ] Mobile improvements:
  - [ ] on mobile when focus in a contenteditable field toolbar is moved to upper and not visible.
  - [ ] disable some autocomplete features like autocomplete with card details, or address autocomplete, which are not relevant for this form and can cause issues on mobile.
- [x] "Note personale" section at the end of the form: stored locally, in the account and in raw.json, but not shown in the print preview, PDF or public page.
- [ ] Cloud: share a fișă read-only with a link (public snapshot); conflict handling when the same fișă is edited simultaneously on two devices.
- [x] after import json re-validate fields (only when errors were already displayed).
- [x] Remove enters at the end of the text fields when printing to avoid extra spaces in the pdf.
- [ ] print preview improvements:
  - [ ] page size should be A4 to have a similar layout with the printed version.
  - [ ] suggest possile page breaks in the print preview, so users can adjust the content to fit better on pages when printed.
  - [ ] after we calculate that the content exceeds 2 pages, show a warning message in the print preview...
  - [x] "într-o singură propoziție scurtă" is hidden in the print preview (flag `hideLabelInPrint` in STEPS).
