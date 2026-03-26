# CST – Fișă de lucru (7 Pași)

[![Live](https://img.shields.io/badge/Site-fisa.predicare--expozitiva.ro-brightgreen?style=for-the-badge)](https://fisa.predicare-expozitiva.ro)

Acest proiect este o aplicație web de sine stătătoare (standalone) care oferă o interfață interactivă pentru completarea fișei de studiu biblic bazată pe metoda **CST (Charles Simeon Trust)**. Este un instrument esențial pentru pastori și studenți care doresc să pregătească predici expozitive într-un mod structurat și eficient.

## Caracteristici principale

- **Proces în 7 Pași**: Ghidare pas cu pas prin structura textului, context, ideea autorului, legătura cu Evanghelia, ideea centrală, aplicații și schița mesajului.
- **Salvare Automată**: Datele introduse sunt salvate automat în browser (prin `localStorage`), astfel încât nu vei pierde progresul dacă închizi pagina sau reîncarci accidental.
- **Previzualizare PDF & Printare**: Generează o versiune curată și profesională a fișei, gata pentru a fi salvată ca PDF sau trimisă la imprimantă.
- **Formatare Markdown**: Suport pentru formatare text (îngroșat, cursiv, liste) direct în câmpurile de text, vizibilă în previzualizarea PDF.
- **Import/Export JSON**: Posibilitatea de a descărca datele într-un fișier `raw.json` pentru backup sau pentru a le încărca ulterior pe un alt dispozitiv.
- **Standalone**: Nu necesită backend sau bază de date. Totul rulează local în browser.

## Tehnologii folosite

- **HTML5 & Vanilla CSS**: Structură și stilizare modernă, fără framework-uri greoaie.
- **Vanilla JavaScript**: Logică de aplicație rapidă și ușoară.
- **[Marked.js](https://marked.js.org/)**: Pentru transformarea textului Markdown în HTML.
- **[DOMPurify](https://github.com/cure53/dompurify)**: Pentru curățarea și securizarea HTML-ului generat.

## Cum se folosește


## 📚 Instrucțiuni de instalare

```bash
git clone https://github.com/unu-unu-ro/cst-fisa.git
cd cst-fisa
npm install

npm start
```


## Structura Proiectului

- `index.html`: Pagina principală a aplicației.
- `print-preview.html`: Pagina dedicată generării PDF-ului.
- `assets/css/`: Fișierele de stilizare (`style.css`, `fisa.css`, `print-preview.css`).
- `assets/js/`: Logica aplicației și utilitarele.
- `assets/external/`: Biblioteci externe (Marked, DOMPurify).

## Resurse
Pentru mai multe detalii despre metoda de lucru și ghidul complet, vizitați: [predicare-expozitiva.ro/ghid](https://predicare-expozitiva.ro/ghid)

---
©  Ateliere de predicare expozitivă.
