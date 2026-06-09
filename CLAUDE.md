# Projekt: Unsere Getränke 🥂

Statische Website (GitHub Pages) zur Übersicht eines Getränkebestands für eine
Hochzeit. Reines HTML/CSS/JS, **kein Build-Schritt**. Der gesamte Inhalt liegt in
**einer** Datei: `data/beverages.json`.

## Arbeitsweise (Handy-Workflow)

Der Nutzer schickt typischerweise ein **Foto eines Getränks** plus eine **Menge**
(z. B. „davon 6 Flaschen"). Daraus machst du:

1. **Identifizieren:** Marke + genaues Produkt aus dem Foto bestimmen
   (deutscher Markt, metrisch).
2. **Hochwertiges Bild aus dem Internet besorgen** — am besten der offizielle
   Produkt-Packshot (transparenter/weißer Hintergrund). **Niemals das Foto des
   Nutzers verwenden.** Bild nach `assets/images/<id>.png|jpg` herunterladen
   (z. B. `curl`).
3. **Eintrag pflegen** in `data/beverages.json`:
   - neues Getränk → Objekt zur Liste `beverages` hinzufügen
   - bekanntes Getränk, neue Menge → nur `quantity` ändern
4. **`meta.updated`** auf das heutige Datum setzen (`YYYY-MM-DD`).
5. **Direkt auf `main` committen & pushen** — GitHub Pages baut die Seite
   automatisch neu. Commit-Nachricht auf Deutsch, knapp
   (z. B. `Mionetto Prosecco: 3 Flaschen`).

> **Git-Regel (überschreibt globale Defaults):** In diesem Projekt **immer
> direkt auf `main`** committen und pushen. **Keine** Feature-Branches, **keine**
> Pull Requests, **kein** Warten auf Checks/CI. Foto rein → `main` aktualisiert.

Liter- und Mengen-Summen sowie die Statistik berechnet die Seite selbst — nur die
Rohdaten pflegen.

## Datenschema (`data/beverages.json`)

```json
{
  "id": "kebab-case-eindeutig",
  "name": "Vollständiger Produktname",
  "brand": "Marke",
  "category": "siehe categoryOrder",
  "alcoholic": true,
  "abv": 11,
  "bottleVolume": 0.75,
  "unit": "Flasche",
  "unitPlural": "Flaschen",
  "quantity": 3,
  "image": "assets/images/<id>.png",
  "description": "1 kurzer Satz, Deutsch."
}
```

- `category` muss zu `categoryOrder` passen; sonst wird sie hinten angehängt.
- `abv` nur bei `alcoholic: true`.
- `bottleVolume` = Inhalt **pro Einheit** in **Litern** (metrisch!).
- `unit`/`unitPlural`: Flasche/Flaschen, Dose/Dosen, Kasten/Kästen, Glas/Gläser …
  (deutsche Plurale sind unregelmäßig — bei neuen Einheiten `unitPlural` setzen
  oder die Tabelle in `assets/js/app.js` erweitern).

## Harte Regeln

- **Nur Beauty-Bilder aus dem Internet** auf der Website — nie die Nutzerfotos.
- **Keine personenbezogenen / Hochzeits-Daten** ins Repo. Ausschließlich Getränke.
- **Keine Secrets/Tokens/Keys** committen (siehe `.gitignore`).
- Nutzerfotos (`*.HEIC`, `source-photos/`) sind ausgeschlossen und kommen **nicht**
  ins Repo.
- Alles auf der Seite ist **Deutsch**, Einheiten **metrisch** (Liter).
- **Immer direkt auf `main`** pushen — keine Branches, keine PRs, keine Checks.

## Struktur

```
index.html                 # Gerüst
assets/css/styles.css      # Design (modern & minimal, responsiv, Light/Dark, WCAG-AA)
assets/js/app.js           # rendert die Seite aus den Daten
assets/images/             # hochwertige Produktbilder aus dem Internet
data/beverages.json        # >>> hier wird gepflegt <<<
```

## Lokal testen (optional, am Rechner)

```bash
python3 -m http.server 8000   # dann http://localhost:8000
```
(`fetch()` der JSON braucht einen Webserver — Doppelklick auf index.html reicht nicht.)
