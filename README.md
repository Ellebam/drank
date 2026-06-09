# Unsere Getränke 🥂

Statische Website zur Übersicht unseres Getränkebestands – läuft kostenlos über
**GitHub Pages**. Kein Build-Schritt, keine Abhängigkeiten: reines HTML, CSS und
JavaScript. Die gesamten Inhalte stehen in **einer** Datei: [`data/beverages.json`](data/beverages.json).

## Aufbau

```
index.html                 # Seitengerüst (inkl. Suche, Sortierung, Skeleton)
manifest.webmanifest       # PWA: „Zum Homescreen hinzufügen“
sw.js                      # Service Worker (Offline-Cache)
assets/css/styles.css      # Design (modern & minimal, responsiv, Light/Dark)
assets/js/app.js           # rendert die Seite aus den Daten
assets/fonts/              # selbst gehostete Schriften (DSGVO-freundlich)
assets/icons/              # App-Icons (PWA / Apple Touch)
assets/images/             # Produktbilder (WebP, max. 800 px)
assets/og-image.png        # Vorschaubild fürs Teilen (WhatsApp & Co.)
data/beverages.json        # >>> hier wird der Bestand gepflegt <<<
.nojekyll                  # GitHub Pages ohne Jekyll ausliefern
```

## Bestand pflegen

Alles passiert in `data/beverages.json`. Ein Getränk sieht so aus:

```json
{
  "id": "mionetto-prosecco-doc-treviso-brut",
  "name": "Mionetto Prosecco DOC Treviso Brut",
  "brand": "Mionetto",
  "category": "Sekt & Prosecco",
  "alcoholic": true,
  "abv": 11,
  "bottleVolume": 0.75,
  "unit": "Flasche",
  "quantity": 3,
  "image": "assets/images/mionetto-prosecco-doc-treviso-brut.webp",
  "description": "Kurze Beschreibung …"
}
```

| Feld           | Bedeutung |
|----------------|-----------|
| `id`           | eindeutiger Slug (kleinbuchstaben, Bindestriche) |
| `category`     | muss zu `categoryOrder` passen (sonst wird sie hinten angehängt) |
| `alcoholic`    | `true` / `false` |
| `abv`          | Alkoholgehalt in % vol (nur bei alkoholischen) |
| `bottleVolume` | Inhalt **pro Einheit** in Litern (z. B. `0.75`) |
| `unit`         | `Flasche`, `Dose`, `Kasten` … (optional `unitPlural`) |
| `quantity`     | Anzahl der Einheiten |
| `image`        | Pfad zum Bild in `assets/images/` |

**Menge ändern:** einfach `quantity` anpassen.
**Neues Getränk:** Objekt zur Liste `beverages` hinzufügen und ein hochwertiges
Bild in `assets/images/` ablegen. Liter- und Mengen-Summen berechnet die Seite
automatisch.

> ⚠️ Auf der Website werden **nur** hochwertige Bilder aus dem Internet gezeigt –
> niemals die eigenen Quell-Fotos. Eigene Fotos (`*.HEIC`, `source-photos/`) sind
> per `.gitignore` ausgeschlossen.

## Lokal ansehen

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

(`fetch()` auf die JSON-Datei braucht einen Webserver – Doppelklick auf
`index.html` reicht nicht.)

## Veröffentlichen (GitHub Pages)

1. Repository auf GitHub anlegen und pushen.
2. **Settings → Pages → Build and deployment → Source: _Deploy from a branch_**,
   Branch `main`, Ordner `/ (root)`.
3. Nach einer Minute ist die Seite unter
   `https://<user>.github.io/<repo>/` erreichbar.

Updates: Änderung an `data/beverages.json` committen & pushen – fertig.
