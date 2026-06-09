/* ============================================================
   Unsere Getränke – Rendering
   Liest data/beverages.json und baut die Seite auf.
   ============================================================ */
(() => {
  "use strict";

  const nf0 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
  const nfL = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const state = { data: null, filterAlcohol: "all", filterCategory: "all" };

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
      byType: { alc: { units: 0, liter: 0 }, nonalc: { units: 0, liter: 0 } },
      byCategory: {},
    };
    for (const b of items) {
      const q = Number(b.quantity) || 0;
      const vol = Number(b.bottleVolume) || 0;
      const liter = q * vol;
      totals.einheiten += q;
      totals.liter += liter;
      const t = b.alcoholic ? "alc" : "nonalc";
      totals.byType[t].units += q;
      totals.byType[t].liter += liter;
      const c = (totals.byCategory[b.category] ||= { units: 0, liter: 0, sorten: 0 });
      c.units += q; c.liter += liter; c.sorten += 1;
    }
    return totals;
  }

  /* ---------- Stats ---------- */
  function renderStats(all) {
    const t = aggregate(all);
    const cats = Object.keys(t.byCategory).length;
    const cards = [
      { value: nf0.format(t.sorten), label: t.sorten === 1 ? "Sorte" : "Sorten" },
      { value: nf0.format(t.einheiten), label: "Einheiten gesamt" },
      { value: nfL.format(t.liter), unit: "L", label: "Liter gesamt" },
      { value: nf0.format(cats), label: cats === 1 ? "Kategorie" : "Kategorien" },
    ];
    $("#stat-grid").innerHTML = cards.map(c => `
      <div class="stat">
        <div class="stat-value">${c.value}${c.unit ? `<span class="unit">${c.unit}</span>` : ""}</div>
        <div class="stat-label">${c.label}</div>
      </div>`).join("");

    renderBreakdown(t);
  }

  function bar(name, dotClass, count, sub, value, max) {
    const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
    return `
      <div class="bd-row">
        <div class="bd-head">
          <span class="bd-name">${dotClass ? `<span class="dot ${dotClass}"></span>` : ""}${esc(name)}</span>
          <span class="bd-count">${count}${sub ? ` · ${sub}` : ""}</span>
        </div>
        <div class="bd-bar"><div class="bd-fill" style="width:${pct}%"></div></div>
      </div>`;
  }

  function renderBreakdown(t) {
    const typeMax = Math.max(t.byType.alc.liter, t.byType.nonalc.liter, 0.0001);
    const typeRows = [
      ["Alkoholisch", "alc", t.byType.alc],
      ["Alkoholfrei", "nonalc", t.byType.nonalc],
    ].filter(([, , v]) => v.units > 0)
     .map(([name, cls, v]) =>
        bar(name, cls, `${nf0.format(v.units)}×`, fmtLiter(v.liter), v.liter, typeMax));

    const catEntries = orderedCategories(Object.keys(t.byCategory));
    const catMax = Math.max(...catEntries.map(c => t.byCategory[c].liter), 0.0001);
    const catRows = catEntries.map(c =>
      bar(c, null, `${nf0.format(t.byCategory[c].units)}×`, fmtLiter(t.byCategory[c].liter), t.byCategory[c].liter, catMax));

    $("#breakdown").innerHTML = `
      <div class="bd-group">
        <p class="bd-title">Nach Art</p>
        ${typeRows.join("")}
      </div>
      <div class="bd-group">
        <p class="bd-title">Nach Kategorie</p>
        ${catRows.join("")}
      </div>`;
  }

  /* ---------- Filters ---------- */
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

  function orderedCategories(present) {
    const order = state.data?.categoryOrder || [];
    const inOrder = order.filter(c => present.includes(c));
    const rest = present.filter(c => !order.includes(c)).sort((a, b) => a.localeCompare(b, "de"));
    return [...inOrder, ...rest];
  }

  /* ---------- Inventory ---------- */
  function applyFilters(all) {
    return all.filter(b => {
      if (state.filterAlcohol === "alc" && !b.alcoholic) return false;
      if (state.filterAlcohol === "nonalc" && b.alcoholic) return false;
      if (state.filterCategory !== "all" && b.category !== state.filterCategory) return false;
      return true;
    });
  }

  function renderInventory(all, announce = false) {
    const items = applyFilters(all);
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
          <span class="cat-sum">${nf0.format(agg.einheiten)} Einheiten · ${fmtLiter(agg.liter)}</span>
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

  /* ---------- Render + events ---------- */
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
    renderStats(all);
    renderFilters(all);
    renderInventory(all);
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-alc]");
    const c = e.target.closest("[data-cat]");
    if (a) { state.filterAlcohol = a.dataset.alc; refresh(); }
    else if (c) { state.filterCategory = c.dataset.cat; refresh(); }
  });

  function refresh() {
    const all = Array.isArray(state.data?.beverages) ? state.data.beverages : [];
    renderFilters(all);
    renderInventory(all, true);
  }

  load();
})();
