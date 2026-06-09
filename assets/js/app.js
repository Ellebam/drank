/* ============================================================
   Unsere Getränke – Rendering
   Liest data/beverages.json und baut die Seite auf.
   Der Überblick oben reagiert auf die Auswahl: Art, Kategorie,
   Suche oder ein einzelnes angeklicktes Getränk.
   Auswahl & Suche stehen im URL-Hash und sind damit teilbar.
   ============================================================ */
(() => {
  "use strict";

  const nf0 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
  const nfL = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const nfPct = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

  const SORTS = ["standard", "menge", "anzahl", "name"];
  const LS_GUESTS = "drank.guests";

  const state = {
    data: null,
    filterAlcohol: "all",
    filterCategory: "all",
    selectedId: null,
    search: "",
    sort: "standard",
    guests: null,
  };

  const $ = (sel, root = document) => root.querySelector(sel);

  const NBSP = " ";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Liter/Einheiten zusammenhalten (kein Umbruch zwischen Wert und Einheit)
  const fmtLiter = (l) => `${nfL.format(l)}${NBSP}L`;

  // Deutsche Plurale sind unregelmäßig -> explizite Tabelle statt Heuristik
  const PLURALS = {
    "Flasche": "Flaschen", "Dose": "Dosen", "Kasten": "Kästen",
    "Glas": "Gläser", "Karton": "Kartons", "Stück": "Stück",
    "Fass": "Fässer", "Packung": "Packungen", "Tüte": "Tüten",
  };
  const plural = (n, b) => {
    const u = b.unit || "Stück";
    if (n === 1) return u;
    return b.unitPlural || PLURALS[u] || u;
  };

  // Realistische Portionsgrößen je Kategorie (Liter pro Glas/Portion).
  // Daraus schätzt die Seite, wie viele Gläser/Drinks der Bestand ergibt –
  // die für eine Feier eigentlich interessante Zahl.
  const SERVING_L = {
    "Sekt & Prosecco": 0.1,
    "Wein": 0.2,
    "Bier": 0.3,
    "Aperitif & Spritz": 0.07,
    "Spirituosen": 0.04,
    "Softdrinks": 0.2,
    "Säfte": 0.2,
    "Wasser": 0.25,
    "Heißgetränke": 0.2,
  };
  const SERVING_DEFAULT = 0.2;
  const servingSize = (cat) => SERVING_L[cat] || SERVING_DEFAULT;

  // Dezente, zueinander passende Farben für die Zusammensetzungs-Balken.
  const SEG_COLORS = [
    "#b8893b", "#7f9b6e", "#9c6b4f", "#6e84a3",
    "#b56b80", "#5f9ea0", "#8a7bb0", "#c0a062",
  ];

  async function load() {
    try {
      const res = await fetch("data/beverages.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
      readHash();
      restoreGuests();
      renderWarnings(validateData(state.data));
      syncControls();
      render();
    } catch (err) {
      $("#inventory").innerHTML =
        `<p class="empty">Die Getränkedaten konnten gerade nicht geladen werden.<br>Bitte später erneut versuchen.</p>`;
      console.error(err);
    }
  }

  /* ============================================================
     URL-Hash: Auswahl teilbar machen (#art=…&kat=…&q=…&drink=…)
     ============================================================ */
  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    const art = p.get("art");
    state.filterAlcohol = (art === "alc" || art === "nonalc") ? art : "all";
    state.filterCategory = p.get("kat") || "all";
    state.search = (p.get("q") || "").trim();
    state.sort = SORTS.includes(p.get("sort")) ? p.get("sort") : "standard";
    state.selectedId = p.get("drink") || null;
  }

  function writeHash() {
    const p = new URLSearchParams();
    if (state.filterAlcohol !== "all") p.set("art", state.filterAlcohol);
    if (state.filterCategory !== "all") p.set("kat", state.filterCategory);
    if (state.search) p.set("q", state.search);
    if (state.sort !== "standard") p.set("sort", state.sort);
    if (state.selectedId) p.set("drink", state.selectedId);
    const h = p.toString();
    history.replaceState(null, "", h ? `#${h}` : location.pathname + location.search);
  }

  // Eingabefelder an den State angleichen (nach Laden / Hash-Navigation)
  function syncControls() {
    const search = $("#search-input");
    if (search && search.value !== state.search) search.value = state.search;
    const sort = $("#sort-select");
    if (sort && sort.value !== state.sort) sort.value = state.sort;
  }

  /* ============================================================
     Datenvalidierung – fängt Tippfehler beim Pflegen der JSON ab
     ============================================================ */
  function validateData(d) {
    const problems = [];
    if (!d || !Array.isArray(d.beverages)) {
      problems.push("»beverages« fehlt oder ist keine Liste.");
      return problems;
    }
    const order = Array.isArray(d.categoryOrder) ? d.categoryOrder : [];
    const seen = new Set();
    d.beverages.forEach((b, i) => {
      const ref = b.name || b.id || `Eintrag ${i + 1}`;
      for (const field of ["id", "name", "category"]) {
        if (!b[field]) problems.push(`${ref}: Pflichtfeld »${field}« fehlt.`);
      }
      if (b.id && seen.has(b.id)) problems.push(`${ref}: id »${b.id}« ist doppelt vergeben.`);
      if (b.id) seen.add(b.id);
      if (!Number.isFinite(Number(b.quantity))) problems.push(`${ref}: »quantity« ist keine Zahl.`);
      if (b.bottleVolume != null && !(Number(b.bottleVolume) > 0)) problems.push(`${ref}: »bottleVolume« muss eine Zahl > 0 sein (Liter).`);
      if (b.bottleVolume == null) problems.push(`${ref}: »bottleVolume« fehlt (Liter pro Einheit).`);
      if (b.alcoholic === true && b.abv == null) problems.push(`${ref}: »abv« fehlt (alkoholisch).`);
      if (typeof b.alcoholic !== "boolean") problems.push(`${ref}: »alcoholic« fehlt oder ist nicht true/false.`);
      if (b.category && order.length && !order.includes(b.category)) problems.push(`${ref}: Kategorie »${b.category}« steht nicht in categoryOrder.`);
      if (!b.image) problems.push(`${ref}: »image« fehlt.`);
    });
    if (d.meta?.updated && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.meta.updated))) {
      problems.push(`meta.updated »${d.meta.updated}« ist nicht im Format YYYY-MM-DD.`);
    }
    return problems;
  }

  function renderWarnings(problems) {
    const host = $("#data-warnings");
    if (!host) return;
    if (!problems.length) { host.innerHTML = ""; return; }
    problems.forEach((p) => console.warn("[Daten]", p));
    host.innerHTML = `
      <details class="data-warning">
        <summary>⚠️ ${problems.length} ${problems.length === 1 ? "Hinweis" : "Hinweise"} zu data/beverages.json</summary>
        <ul>${problems.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
      </details>`;
  }

  /* ---------- Aggregation ---------- */
  function aggregate(items) {
    const totals = {
      sorten: items.length,
      einheiten: 0,
      liter: 0,
      gläser: 0,
      byType: { alc: { units: 0, liter: 0, gläser: 0 }, nonalc: { units: 0, liter: 0, gläser: 0 } },
      byCategory: {},
    };
    for (const b of items) {
      const q = Number(b.quantity) || 0;
      const vol = Number(b.bottleVolume) || 0;
      const liter = q * vol;
      const gläser = liter / servingSize(b.category);
      totals.einheiten += q;
      totals.liter += liter;
      totals.gläser += gläser;
      const t = b.alcoholic ? "alc" : "nonalc";
      totals.byType[t].units += q;
      totals.byType[t].liter += liter;
      totals.byType[t].gläser += gläser;
      const c = (totals.byCategory[b.category] ||= { units: 0, liter: 0, sorten: 0, gläser: 0 });
      c.units += q; c.liter += liter; c.sorten += 1; c.gläser += gläser;
    }
    return totals;
  }

  function orderedCategories(present) {
    const order = state.data?.categoryOrder || [];
    const inOrder = order.filter(c => present.includes(c));
    const rest = present.filter(c => !order.includes(c)).sort((a, b) => a.localeCompare(b, "de"));
    return [...inOrder, ...rest];
  }

  /* ---------- Aktuelle Auswahl (Art + Kategorie + Suche) ---------- */
  function matchesSearch(b, q) {
    if (!q) return true;
    const hay = `${b.name} ${b.brand || ""} ${b.category || ""} ${b.description || ""}`.toLowerCase();
    return q.toLowerCase().split(/\s+/).every(w => hay.includes(w));
  }

  function selectionItems() {
    const all = Array.isArray(state.data?.beverages) ? state.data.beverages : [];
    return all.filter(b => {
      if (state.filterAlcohol === "alc" && !b.alcoholic) return false;
      if (state.filterAlcohol === "nonalc" && b.alcoholic) return false;
      if (state.filterCategory !== "all" && b.category !== state.filterCategory) return false;
      if (!matchesSearch(b, state.search)) return false;
      return true;
    });
  }

  function selectionLabel() {
    const parts = [];
    if (state.filterCategory !== "all") parts.push(state.filterCategory);
    else if (state.filterAlcohol === "alc") parts.push("Alkoholische Getränke");
    else if (state.filterAlcohol === "nonalc") parts.push("Alkoholfreie Getränke");
    if (state.search) parts.push(`Suche „${state.search}“`);
    return parts.join(" · ") || "Gesamter Bestand";
  }

  const isFiltered = () =>
    state.filterAlcohol !== "all" || state.filterCategory !== "all" || state.search !== "";

  /* ============================================================
     Überblick (oberer Bereich) – reagiert auf die Auswahl
     ============================================================ */
  function renderOverview() {
    const host = $("#overview-body");
    if (state.selectedId) {
      const item = (state.data?.beverages || []).find(b => b.id === state.selectedId);
      if (item) { host.innerHTML = overviewDetail(item); return; }
      state.selectedId = null;
    }
    host.innerHTML = overviewSummary();
  }

  function statTiles(tiles) {
    return `<div class="stat-grid">${tiles.map(c => `
      <div class="stat">
        <div class="stat-value">${c.value}${c.unit ? `<span class="unit">${c.unit}</span>` : ""}</div>
        <div class="stat-label">${esc(c.label)}</div>
        ${c.hint ? `<div class="stat-hint">${esc(c.hint)}</div>` : ""}
      </div>`).join("")}</div>`;
  }

  function overviewSummary() {
    const items = selectionItems();
    const t = aggregate(items);

    const tiles = [
      { value: nf0.format(t.sorten), label: t.sorten === 1 ? "Sorte" : "Sorten" },
      { value: nf0.format(t.einheiten), label: "Flaschen & Einheiten" },
      { value: nfL.format(t.liter), unit: "L", label: "Gesamtmenge" },
      { value: "≈ " + nf0.format(Math.round(t.gläser)), label: "Gläser", hint: "geschätzte Portionen" },
    ];

    const head = `
      <div class="overview-head">
        <div>
          <p class="overview-eyebrow">Überblick</p>
          <p class="overview-title">${esc(selectionLabel())}</p>
        </div>
        ${isFiltered() ? `<button type="button" class="overview-reset" data-reset>Ganze Auswahl<span aria-hidden="true"> ↺</span></button>` : ""}
      </div>`;

    if (!items.length) {
      return head + `<p class="overview-empty">Für diese Auswahl gibt es derzeit keine Getränke.</p>`;
    }

    return head + statTiles(tiles) + plannerBlock(t) + composition(t, items);
  }

  /* ---------- „Reicht das?“ – Portionen pro Gast ---------- */
  function restoreGuests() {
    try {
      const v = parseInt(localStorage.getItem(LS_GUESTS), 10);
      if (Number.isFinite(v) && v > 0) state.guests = v;
    } catch { /* localStorage gesperrt -> einfach ohne Vorbelegung */ }
  }

  function plannerText(t) {
    const g = Number(state.guests) || 0;
    if (!g) return "Anzahl der Gäste eingeben – die Seite rechnet aus, wie viel pro Person da ist.";
    const per = t.gläser / g;
    let s = `≈ <strong>${nf1.format(per)} Gläser</strong> und <strong>${fmtLiter(t.liter / g)}</strong> pro Person`;
    const alc = t.byType.alc, non = t.byType.nonalc;
    if (alc.liter > 0 && non.liter > 0) {
      s += ` – davon ≈ ${nf1.format(alc.gläser / g)} alkoholisch, ${nf1.format(non.gläser / g)} alkoholfrei`;
    }
    return s + ".";
  }

  function plannerBlock(t) {
    return `
      <div class="planner">
        <p class="comp-title">Reicht das?</p>
        <div class="planner-row">
          <label for="guest-input">Gäste</label>
          <input id="guest-input" type="number" min="1" max="2000" step="1" inputmode="numeric"
                 placeholder="z. B. 80" value="${state.guests ?? ""}" />
          <p class="planner-result" id="planner-result">${plannerText(t)}</p>
        </div>
      </div>`;
  }

  /* ---------- Zusammensetzung: gestapelte Anteils-Balken ---------- */
  function composition(t, items) {
    const blocks = [];

    // 1) Verhältnis alkoholisch / alkoholfrei – nur wenn beides vorhanden
    const alc = t.byType.alc, non = t.byType.nonalc;
    if (alc.liter > 0 && non.liter > 0) {
      blocks.push(stackedBlock("Alkoholisch vs. alkoholfrei", t.liter, [
        { label: "Alkoholisch", liter: alc.liter, units: alc.units, color: "var(--alc)" },
        { label: "Alkoholfrei", liter: non.liter, units: non.units, color: "var(--nonalc)" },
      ]));
    }

    // 2) Mischung – nach Kategorie, oder (wenn nur eine Kategorie) nach Produkt
    const catKeys = orderedCategories(Object.keys(t.byCategory));
    if (catKeys.length > 1) {
      const segs = catKeys.map((c, i) => ({
        label: c, liter: t.byCategory[c].liter, units: t.byCategory[c].units,
        color: SEG_COLORS[i % SEG_COLORS.length],
      }));
      blocks.push(stackedBlock("Mischung nach Kategorie", t.liter, segs));
    } else {
      const sorted = [...items].sort((a, b) =>
        (Number(b.quantity) * Number(b.bottleVolume)) - (Number(a.quantity) * Number(a.bottleVolume)));
      const top = sorted.slice(0, 6);
      const segs = top.map((b, i) => ({
        label: b.name,
        liter: (Number(b.quantity) || 0) * (Number(b.bottleVolume) || 0),
        units: Number(b.quantity) || 0,
        color: SEG_COLORS[i % SEG_COLORS.length],
      }));
      if (sorted.length > top.length) {
        const restL = sorted.slice(6).reduce((s, b) => s + (Number(b.quantity) || 0) * (Number(b.bottleVolume) || 0), 0);
        const restU = sorted.slice(6).reduce((s, b) => s + (Number(b.quantity) || 0), 0);
        segs.push({ label: "Weitere", liter: restL, units: restU, color: "var(--border-strong)" });
      }
      if (segs.length > 1) blocks.push(stackedBlock("Mischung nach Sorte", t.liter, segs));
    }

    if (!blocks.length) return "";
    return `<div class="composition">${blocks.join("")}</div>`;
  }

  function stackedBlock(title, total, segs) {
    const sum = total > 0 ? total : segs.reduce((s, x) => s + x.liter, 0) || 1;
    const used = segs.filter(s => s.liter > 0);
    const segHtml = used.map((s, i) => {
      const pct = (s.liter / sum) * 100;
      const info = `${s.label}: ${nfL.format(s.liter)} L · ${nfPct.format(Math.round(pct))} %`;
      // Buttons: per Tipp/Klick wird der Anteil in der Legende hervorgehoben
      return `<button type="button" class="comp-seg" data-seg="${i}" style="width:${pct}%;background:${s.color}"
                title="${esc(info)}" aria-label="${esc(info)}"></button>`;
    }).join("");
    const legend = used.map((s, i) => {
      const pct = (s.liter / sum) * 100;
      return `<li class="comp-item" data-leg="${i}">
        <span class="comp-swatch" style="background:${s.color}"></span>
        <span class="comp-label">${esc(s.label)}</span>
        <span class="comp-val">${fmtLiter(s.liter)} · ${nfPct.format(Math.round(pct))}${NBSP}%</span>
      </li>`;
    }).join("");
    return `
      <div class="comp-block">
        <p class="comp-title">${esc(title)}</p>
        <div class="comp-bar" role="group" aria-label="${esc(title)}">${segHtml}</div>
        <ul class="comp-legend">${legend}</ul>
      </div>`;
  }

  // Tipp/Klick auf ein Balkensegment hebt den Eintrag in der Legende hervor
  function toggleSegment(seg) {
    const block = seg.closest(".comp-block");
    if (!block) return;
    const wasActive = seg.classList.contains("is-active");
    block.querySelectorAll(".comp-seg").forEach(s => s.classList.remove("is-active", "is-dim"));
    block.querySelectorAll(".comp-item").forEach(l => l.classList.remove("is-hl"));
    if (wasActive) return;
    seg.classList.add("is-active");
    block.querySelectorAll(".comp-seg").forEach(s => { if (s !== seg) s.classList.add("is-dim"); });
    const leg = block.querySelector(`.comp-item[data-leg="${seg.dataset.seg}"]`);
    if (leg) leg.classList.add("is-hl");
  }

  /* ---------- Einzel-Getränk im Überblick ---------- */
  function overviewDetail(b) {
    const q = Number(b.quantity) || 0;
    const vol = Number(b.bottleVolume) || 0;
    const liter = q * vol;
    const gläser = Math.round(liter / servingSize(b.category));
    const status = b.alcoholic ? "Alkoholisch" : "Alkoholfrei";

    const tiles = [
      { value: nf0.format(q), label: plural(q, b) },
      vol ? { value: nfL.format(vol), unit: "L", label: "Inhalt je Einheit" } : null,
      { value: nfL.format(liter), unit: "L", label: "Gesamtmenge" },
      { value: "≈ " + nf0.format(gläser), label: "Gläser", hint: "geschätzte Portionen" },
      (b.alcoholic && b.abv != null) ? { value: nfL.format(b.abv), unit: "% vol", label: "Alkohol" } : null,
    ].filter(Boolean);

    const imgHtml = b.image
      ? `<img src="${esc(b.image)}" alt="${esc(b.name)}" loading="lazy" decoding="async" width="400" height="500" onerror="this.style.visibility='hidden'" />`
      : `<span class="detail-fallback" aria-hidden="true">🍾</span>`;

    return `
      <div class="overview-head">
        <div>
          <p class="overview-eyebrow"><span class="dot ${b.alcoholic ? "alc" : "nonalc"}"></span>${esc(status)} · ${esc(b.category)}</p>
          <p class="overview-title detail-title">${esc(b.name)}</p>
        </div>
        <button type="button" class="overview-reset" data-reset>Zur Übersicht<span aria-hidden="true"> ↺</span></button>
      </div>
      <div class="detail">
        <div class="detail-media">${imgHtml}</div>
        <div class="detail-info">
          ${b.brand ? `<p class="detail-brand">${esc(b.brand)}</p>` : ""}
          ${b.description ? `<p class="detail-desc">${esc(b.description)}</p>` : ""}
          ${statTiles(tiles)}
        </div>
      </div>`;
  }

  /* ============================================================
     Filter
     ============================================================ */
  function renderFilters(all) {
    const seg = [
      ["all", "Alle"],
      ["alc", "Alkoholisch"],
      ["nonalc", "Alkoholfrei"],
    ];
    $("#filter-alcohol").innerHTML = seg.map(([v, l]) =>
      `<button type="button" data-alc="${v}" aria-pressed="${state.filterAlcohol === v}">${l}</button>`).join("");

    const counts = {};
    for (const b of all) counts[b.category] = (counts[b.category] || 0) + 1;
    const cats = orderedCategories(Object.keys(counts));
    const chips = [`<button type="button" data-cat="all" aria-pressed="${state.filterCategory === "all"}">Alle Kategorien</button>`]
      .concat(cats.map(c =>
        `<button type="button" data-cat="${esc(c)}" aria-pressed="${state.filterCategory === c}">${esc(c)}<span class="c-count">${counts[c]}</span></button>`));
    $("#filter-category").innerHTML = chips.join("");
  }

  /* ============================================================
     Bestand
     ============================================================ */
  const SORTERS = {
    menge: (a, b) => ((Number(b.quantity) || 0) * (Number(b.bottleVolume) || 0)) -
                     ((Number(a.quantity) || 0) * (Number(a.bottleVolume) || 0)),
    anzahl: (a, b) => (Number(b.quantity) || 0) - (Number(a.quantity) || 0),
    name: (a, b) => String(a.name).localeCompare(String(b.name), "de"),
  };

  function renderInventory(announce = false) {
    const items = selectionItems();
    const host = $("#inventory");
    host.innerHTML = "";
    $("#empty-state").hidden = items.length > 0;
    if (announce) {
      const n = items.length;
      $("#sr-status").textContent = n
        ? `${nf0.format(n)} ${n === 1 ? "Getränk" : "Getränke"} angezeigt.`
        : "Keine Getränke in dieser Auswahl.";
    }
    if (!items.length) return;

    const byCat = {};
    for (const b of items) (byCat[b.category] ||= []).push(b);

    for (const cat of orderedCategories(Object.keys(byCat))) {
      let list = byCat[cat];
      if (SORTERS[state.sort]) list = [...list].sort(SORTERS[state.sort]);
      const agg = aggregate(list);
      const group = document.createElement("section");
      group.className = "cat-group";
      group.innerHTML = `
        <h2 class="cat-title">${esc(cat)}
          <span class="cat-sum">${nf0.format(agg.einheiten)} Einheiten · ${fmtLiter(agg.liter)} · ≈ ${nf0.format(Math.round(agg.gläser))} Gläser</span>
        </h2>
        <div class="grid"></div>`;
      const grid = $(".grid", group);
      for (const b of list) grid.appendChild(card(b));
      host.appendChild(group);
    }
  }

  function card(b) {
    const tpl = $("#card-template").content.firstElementChild.cloneNode(true);
    const q = Number(b.quantity) || 0;
    const vol = Number(b.bottleVolume) || 0;

    // Karte ist anklickbar -> zeigt das Getränk im Überblick
    tpl.dataset.cardId = b.id;
    tpl.tabIndex = 0;
    tpl.setAttribute("role", "button");
    tpl.setAttribute("aria-pressed", String(state.selectedId === b.id));
    tpl.setAttribute("aria-label", `${b.name} – Details im Überblick anzeigen`);
    tpl.classList.toggle("is-selected", state.selectedId === b.id);

    const img = $(".card-img", tpl);
    img.alt = b.name;
    if (b.image) {
      img.src = b.image;
      img.addEventListener("error", () => {
        img.removeAttribute("src");
        img.classList.add("img-missing");
      }, { once: true });
    } else {
      img.classList.add("img-missing");
    }

    const badge = $(".qty-badge", tpl);
    badge.textContent = `${nf0.format(q)}×`;
    badge.classList.toggle("zero", q === 0);
    badge.title = `${nf0.format(q)} ${plural(q, b)}`;

    const status = b.alcoholic ? "Alkoholisch" : "Alkoholfrei";
    const tag = $(".card-tag", tpl);
    tag.innerHTML = `<span class="dot ${b.alcoholic ? "alc" : "nonalc"}" aria-hidden="true"></span>` +
      `<span class="visually-hidden">${status} · </span>${esc(b.category)}`;

    $(".card-name", tpl).textContent = b.name;
    $(".card-desc", tpl).textContent = b.description || "";

    const meta = $(".card-meta", tpl);
    const rows = [
      ["Menge", `${nf0.format(q)} ${plural(q, b)}`],
      vol ? ["Inhalt", fmtLiter(vol)] : null,
      vol ? ["Gesamt", fmtLiter(q * vol)] : null,
      (b.alcoholic && b.abv != null) ? ["Alkohol", `${nfL.format(b.abv)}${NBSP}%${NBSP}vol`] : null,
    ].filter(Boolean);
    meta.innerHTML = rows.map(([dt, dd]) => `<div><dt>${dt}</dt><dd>${esc(dd)}</dd></div>`).join("");

    return tpl;
  }

  /* ============================================================
     Render + Events
     ============================================================ */
  function render() {
    const d = state.data;
    document.title = d.meta?.title || "Unsere Getränke";
    $("#page-title").textContent = d.meta?.title || "Unsere Getränke";
    $("#page-subtitle").textContent = d.meta?.subtitle || "";
    if (d.meta?.updated) {
      const [y, m, day] = String(d.meta.updated).split("-").map(Number);
      const dt = (y && m && day) ? new Date(y, m - 1, day) : null;
      const label = (dt && !isNaN(dt))
        ? dt.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })
        : d.meta.updated;
      $("#page-updated").textContent = `Zuletzt aktualisiert: ${label}`;
    }

    const all = Array.isArray(d.beverages) ? d.beverages : [];
    renderOverview();
    renderFilters(all);
    renderInventory();
  }

  // Überblick + Karten-Markierung aktualisieren, ohne die ganze Liste neu zu bauen
  function refreshSelectionUI() {
    renderOverview();
    document.querySelectorAll("[data-card-id]").forEach(el => {
      const on = el.dataset.cardId === state.selectedId;
      el.classList.toggle("is-selected", on);
      el.setAttribute("aria-pressed", String(on));
    });
  }

  function selectItem(id) {
    state.selectedId = (state.selectedId === id) ? null : id;
    writeHash();
    refreshSelectionUI();
    if (state.selectedId) {
      const ov = $("#overview");
      if (ov && typeof ov.scrollIntoView === "function") {
        ov.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  function applyFilter() {
    const all = Array.isArray(state.data?.beverages) ? state.data.beverages : [];
    writeHash();
    renderOverview();
    renderFilters(all);
    renderInventory(true);
  }

  document.addEventListener("click", (e) => {
    const seg = e.target.closest(".comp-seg");
    const reset = e.target.closest("[data-reset]");
    const a = e.target.closest("[data-alc]");
    const c = e.target.closest("[data-cat]");
    const cardEl = e.target.closest("[data-card-id]");

    if (seg) {
      toggleSegment(seg);
    } else if (reset) {
      state.selectedId = null;
      state.filterAlcohol = "all";
      state.filterCategory = "all";
      state.search = "";
      syncControls();
      applyFilter();
    } else if (a) {
      state.selectedId = null;
      state.filterAlcohol = a.dataset.alc;
      applyFilter();
    } else if (c) {
      state.selectedId = null;
      state.filterCategory = c.dataset.cat;
      applyFilter();
    } else if (cardEl) {
      selectItem(cardEl.dataset.cardId);
    }
  });

  // Tastaturbedienung für die anklickbaren Karten
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
    const cardEl = e.target.closest("[data-card-id]");
    if (!cardEl) return;
    e.preventDefault();
    selectItem(cardEl.dataset.cardId);
  });

  // Suche (entprellt) + Gäste-Rechner
  let searchTimer;
  document.addEventListener("input", (e) => {
    if (e.target.id === "search-input") {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = e.target.value.trim();
        state.selectedId = null;
        applyFilter();
      }, 150);
    } else if (e.target.id === "guest-input") {
      const v = parseInt(e.target.value, 10);
      state.guests = (Number.isFinite(v) && v > 0) ? Math.min(v, 2000) : null;
      try {
        if (state.guests) localStorage.setItem(LS_GUESTS, String(state.guests));
        else localStorage.removeItem(LS_GUESTS);
      } catch { /* localStorage gesperrt -> Wert gilt nur für diese Sitzung */ }
      const out = $("#planner-result");
      if (out) out.innerHTML = plannerText(aggregate(selectionItems()));
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.id === "sort-select") {
      state.sort = SORTS.includes(e.target.value) ? e.target.value : "standard";
      writeHash();
      renderInventory(true);
    }
  });

  // Vor/Zurück im Browser oder manuell geänderter Hash
  window.addEventListener("hashchange", () => {
    if (!state.data) return;
    readHash();
    syncControls();
    renderOverview();
    renderFilters(state.data.beverages || []);
    renderInventory(true);
  });

  // Offline-Fähigkeit (Service Worker) – nur über HTTPS bzw. lokal
  if ("serviceWorker" in navigator &&
      (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname))) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => console.warn("SW:", err));
    });
  }

  load();
})();
