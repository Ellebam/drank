/* ============================================================
   Unsere Getränke – Rendering
   Liest data/beverages.json und baut die Seite auf.
   Der Überblick oben reagiert auf die Auswahl: Art, Kategorie
   oder ein einzelnes angeklicktes Getränk.
   ============================================================ */
(() => {
  "use strict";

  const nf0 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
  const nfL = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const nfPct = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

  const state = { data: null, filterAlcohol: "all", filterCategory: "all", selectedId: null };

  const $ = (sel, root = document) => root.querySelector(sel);

  const NBSP = " ";
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
      render();
    } catch (err) {
      $("#inventory").innerHTML =
        `<p class="empty">Die Getränkedaten konnten gerade nicht geladen werden.<br>Bitte später erneut versuchen.</p>`;
      console.error(err);
    }
  }

  /* ---------- Aggregation ---------- */
  function aggregate(items) {
    const totals = {
      sorten: items.length,
      einheiten: 0,
      liter: 0,
      gläser: 0,
      byType: { alc: { units: 0, liter: 0 }, nonalc: { units: 0, liter: 0 } },
      byCategory: {},
    };
    for (const b of items) {
      const q = Number(b.quantity) || 0;
      const vol = Number(b.bottleVolume) || 0;
      const liter = q * vol;
      totals.einheiten += q;
      totals.liter += liter;
      totals.gläser += liter / servingSize(b.category);
      const t = b.alcoholic ? "alc" : "nonalc";
      totals.byType[t].units += q;
      totals.byType[t].liter += liter;
      const c = (totals.byCategory[b.category] ||= { units: 0, liter: 0, sorten: 0, gläser: 0 });
      c.units += q; c.liter += liter; c.sorten += 1; c.gläser += liter / servingSize(b.category);
    }
    return totals;
  }

  function orderedCategories(present) {
    const order = state.data?.categoryOrder || [];
    const inOrder = order.filter(c => present.includes(c));
    const rest = present.filter(c => !order.includes(c)).sort((a, b) => a.localeCompare(b, "de"));
    return [...inOrder, ...rest];
  }

  /* ---------- Aktuelle Auswahl (Art + Kategorie, ohne Einzel-Auswahl) ---------- */
  function selectionItems() {
    const all = Array.isArray(state.data?.beverages) ? state.data.beverages : [];
    return all.filter(b => {
      if (state.filterAlcohol === "alc" && !b.alcoholic) return false;
      if (state.filterAlcohol === "nonalc" && b.alcoholic) return false;
      if (state.filterCategory !== "all" && b.category !== state.filterCategory) return false;
      return true;
    });
  }

  function selectionLabel() {
    if (state.filterCategory !== "all") return state.filterCategory;
    if (state.filterAlcohol === "alc") return "Alkoholische Getränke";
    if (state.filterAlcohol === "nonalc") return "Alkoholfreie Getränke";
    return "Gesamter Bestand";
  }

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
    const cats = Object.keys(t.byCategory).length;
    const isFiltered = state.filterAlcohol !== "all" || state.filterCategory !== "all";

    const tiles = [
      { value: nf0.format(t.sorten), label: t.sorten === 1 ? "Sorte" : "Sorten" },
      { value: nf0.format(t.einheiten), label: "Flaschen & Einheiten" },
      { value: nfL.format(t.liter), unit: "L", label: "Gesamtmenge" },
      { value: "≈ " + nf0.format(Math.round(t.gläser)), label: "Gläser", hint: "geschätzte Portionen" },
    ];

    const head = `
      <div class="overview-head">
        <div>
          <p class="overview-eyebrow">Überblick</p>
          <p class="overview-title">${esc(selectionLabel())}</p>
        </div>
        ${isFiltered ? `<button type="button" class="overview-reset" data-reset>Ganze Auswahl<span aria-hidden="true"> ↺</span></button>` : ""}
      </div>`;

    if (!items.length) {
      return head + `<p class="overview-empty">Für diese Auswahl gibt es derzeit keine Getränke.</p>`;
    }

    return head + statTiles(tiles) + composition(t, items);
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
    const segHtml = segs.filter(s => s.liter > 0).map(s => {
      const pct = (s.liter / sum) * 100;
      return `<span class="comp-seg" style="width:${pct}%;background:${s.color}"
                title="${esc(s.label)}: ${fmtLiter(s.liter)} · ${nfPct.format(Math.round(pct))} %"></span>`;
    }).join("");
    const legend = segs.filter(s => s.liter > 0).map(s => {
      const pct = (s.liter / sum) * 100;
      return `<li class="comp-item">
        <span class="comp-swatch" style="background:${s.color}"></span>
        <span class="comp-label">${esc(s.label)}</span>
        <span class="comp-val">${fmtLiter(s.liter)} · ${nfPct.format(Math.round(pct))}${NBSP}%</span>
      </li>`;
    }).join("");
    return `
      <div class="comp-block">
        <p class="comp-title">${esc(title)}</p>
        <div class="comp-bar" role="img" aria-label="${esc(title)}">${segHtml}</div>
        <ul class="comp-legend">${legend}</ul>
      </div>`;
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
      { value: "≈ " + nf0.format(gläser), label: "Gläser", hint: "geschätzte Portionen" },
      (b.alcoholic && b.abv != null) ? { value: nfL.format(b.abv), unit: "% vol", label: "Alkohol" } : null,
    ].filter(Boolean);

    const imgHtml = b.image
      ? `<img src="${esc(b.image)}" alt="${esc(b.name)}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'" />`
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
      const list = byCat[cat];
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
    renderOverview();
    renderFilters(all);
    renderInventory(true);
  }

  document.addEventListener("click", (e) => {
    const reset = e.target.closest("[data-reset]");
    const a = e.target.closest("[data-alc]");
    const c = e.target.closest("[data-cat]");
    const cardEl = e.target.closest("[data-card-id]");

    if (reset) {
      state.selectedId = null;
      state.filterAlcohol = "all";
      state.filterCategory = "all";
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

  load();
})();
