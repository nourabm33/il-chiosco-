/* Shared, browse-only catalogue for the website and table menu. */
(function () {
  "use strict";

  const root = document.querySelector("[data-catalogue]");
  if (!root) return;

  const atTable = root.dataset.catalogue === "table";
  const viewer = window.IlChioscoViewer;
  const translate = window.IlChioscoI18n.translate;
  const state = { catalogue: null, category: "all", query: "", failed: false };
  const groups = {
    all: ["Tutte", "All"],
    coffee: ["Caffetteria & Colazione", "Coffee & Breakfast"],
    bakery: ["Dolci & Bakery", "Pastries & Bakery"],
    brunch: ["Brunch & Cucina", "Brunch & Kitchen"],
    soft: ["Soft Drinks", "Soft Drinks"],
    cocktail: ["Aperitivo & Cocktail", "Aperitivo & Cocktails"],
    beer: ["Gin & Birre", "Gin & Beers"],
  };
  const subgroupNotes = {
    Coffee: "Per il nostro espresso usiamo la miscela Club Kavè · latte vegetale +0,3€ · deca +0,2€ · extra shot caffè +1,3€",
    Latte: "Latte vegetale +0,3€ · deca +0,2€ · extra shot caffè +1,3€",
    "Best seller": "Chiedi al nostro staff per gli speciali del mese.",
    Extras: "Da aggiungere ai vostri piatti.",
    Signatures: "La proposta di Davide — cocktail d'autore, creati al bancone.",
    "I Gin": "Il nostro gin è distillato da Ngricca, laboratorio artigianale marchigiano.",
  };
  const productTags = {
    "cocktail-sun-kissed": "Analcolico",
    "cocktail-purple-mirage": "Analcolico",
    "cocktail-forst-0-0": "Analcolica",
    "cocktail-ngricca-house-gin": "Best in Ancona",
  };
  const text = {
    it: {
      categories: "Categorie del menu", search: "Cerca nel menu", example: "Cerca caffè, avocado, spritz…",
      clear: "Cancella ricerca", all: "Il menu completo", results: "Risultati della ricerca",
      count: n => n === 1 ? "1 prodotto" : n + " prodotti",
      loading: "Caricamento menu…", empty: "Nessun prodotto trovato",
      hint: "Prova un altro nome o ingrediente.", unavailable: "Nessun prodotto disponibile al momento.",
      error: "Il menu non è disponibile al momento. Chiedi pure al cameriere.",
      nextCats: "Altre categorie", previousCats: "Categorie precedenti", other: "Altre proposte", jump: "Sezioni di questa categoria", table: "Tavolo",
    },
    en: {
      categories: "Menu categories", search: "Search the menu", example: "Search coffee, avocado, spritz…",
      clear: "Clear search", all: "The full menu", results: "Search results",
      count: n => n === 1 ? "1 item" : n + " items",
      loading: "Loading the menu…", empty: "No items found",
      hint: "Try another name or ingredient.", unavailable: "No items are currently available.",
      error: "The menu is not available right now. Please ask your waiter.",
      nextCats: "More categories", previousCats: "Previous categories", other: "More from the menu", jump: "Sections in this category", table: "Table",
    },
  };
  const icons = {
    all: '<rect x="3.5" y="3.5" width="6" height="6" rx="1"/><rect x="14.5" y="3.5" width="6" height="6" rx="1"/><rect x="3.5" y="14.5" width="6" height="6" rx="1"/><rect x="14.5" y="14.5" width="6" height="6" rx="1"/>',
    coffee: '<path d="M4 8h13v5a5 5 0 0 1-5 5h-3a5 5 0 0 1-5-5zm13 1h2a2.5 2.5 0 0 1 0 5h-2M3 21h16M8 5V3m5 2V3"/>',
    bakery: '<path d="M3.5 17c-2.4-2.3 1.2-9 4.6-11.3C10.1 4.3 14 4.3 16 5.7c3.4 2.3 7 9 4.6 11.3-1.5 1.4-3.7-1-5.2-2.5a4.8 4.8 0 0 0-6.8 0C7.2 16 5 18.4 3.5 17Zm4.7-11.1 1.1 8.1m6.5-8.1-1.1 8.1"/>',
    brunch: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>',
    soft: '<path d="M5 9h14l-2 12H7zm7 0 2-5 4-2M6 13c3 2 9-2 12 0"/>',
    cocktail: '<path d="M3 5h18l-9 10L3 5zm9 10v6m-4 0h8M6 8h12m-4 0 3-6"/>',
    beer: '<path d="M5 8h12v12H5zm12 2h3v6h-3M5 8a2.5 2.5 0 0 1 4-2 3 3 0 0 1 5 0 2 2 0 0 1 3 2m-8 4v5m4-5v5"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    arrow: '<path d="m9 5 7 7-7 7"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
  };

  function icon(key) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[key] + "</svg>";
  }

  const escape = value => String(value ?? "").replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const lang = () => document.documentElement.lang === "en" ? "en" : "it";
  const label = key => text[lang()][key];
  const groupName = key => groups[key]?.[lang() === "en" ? 1 : 0] || label("other");
  const normalize = value => value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const motion = () => matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";

  function displayGroup(item) {
    const { category, subcategory, slug } = item;
    switch (category) {
      case "alba": return ["Best seller", "Dolce", "Salato"].includes(subcategory) ? "bakery" : "coffee";
      case "mezzogiorno": return "brunch";
      case "bibite":
        if (slug === "bibite-birra-alla-spina") return "beer";
        return subcategory === "Drink" ? "cocktail" : "soft";
      case "cocktail": return ["I Gin", "Le Birre"].includes(subcategory) ? "beer" : "cocktail";
      default: return "other";
    }
  }

  function makeCatalogue(items) {
    return items.map(item => {
      const group = displayGroup(item);
      const section = item.slug === "bibite-birra-alla-spina" ? "Birra alla spina" : item.subcategory;
      const tag = productTags[item.slug];
      const searchTerms = [item.name, item.description, item.ingredients, section, tag].filter(Boolean);
      const search = normalize([
        ...searchTerms, ...searchTerms.map(value => translate(String(value), "en")), ...(groups[group] || []),
      ].join(" "));
      return { ...item, group, section, tag, search };
    });
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, { ...options, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  }

  async function loadCatalogue() {
    const api = window.IL_CHIOSCO_API;
    if (atTable && (api || !location.hostname.endsWith(".github.io"))) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      try {
        const data = await fetchJson((api || "") + "/api/menu", { signal: controller.signal });
        return data.categories.flatMap(({ category, subcategory, items }) =>
          items.map(item => ({ ...item, category, subcategory })));
      } catch {
        // Static hosting and temporary API failures use the same catalogue as the homepage.
      } finally {
        clearTimeout(timer);
      }
    }
    const products = await fetchJson("server/data/products.json");
    return products.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  root.innerHTML = `
    <div class="catalogue-controls" hidden>
      <div class="catalogue-shell catalogue-toolbar">
        <div class="catalogue-search" role="search">
          ${icon("search")}
          <label class="catalogue-sr" for="catalogue-search"></label>
          <input id="catalogue-search" type="search" autocomplete="off" spellcheck="false" aria-controls="catalogue-content">
          <button class="catalogue-clear" type="button" hidden>${icon("close")}</button>
        </div>
        <p class="catalogue-total"></p>
        <div class="catalogue-navigation">
          <nav class="catalogue-nav"></nav>
          <button class="catalogue-nav-edge" type="button" data-direction="-1" hidden>${icon("arrow")}</button>
          <button class="catalogue-nav-edge" type="button" data-direction="1" hidden>${icon("arrow")}</button>
        </div>
      </div>
    </div>
    <div class="catalogue-shell catalogue-content" id="catalogue-content"></div>`;

  const controls = root.querySelector(".catalogue-controls");
  const search = root.querySelector("input");
  const clear = root.querySelector(".catalogue-clear");
  const nav = root.querySelector(".catalogue-nav");
  const [previous, next] = root.querySelectorAll(".catalogue-nav-edge");
  const total = root.querySelector(".catalogue-total");
  const currencyFormatters = new Map();
  const content = root.querySelector(".catalogue-content");
  const bartender = document.getElementById("catalogue-bartender")?.content.firstElementChild;
  const bartenderQuote = bartender?.querySelector("blockquote").textContent;
  const status = document.createElement("p");
  status.className = "catalogue-sr";
  status.setAttribute("role", "status");
  controls.after(status);

  function price(item) {
    // The printed menu has a range whose lower bound is stored in the catalogue.
    const language = lang();
    if (item.slug === "alba-crumbl-cookies" && item.priceCents === 350) {
      return language === "it" ? "3,50–5,00 €" : "€3.50–€5.00";
    }
    const currency = item.currency || "EUR";
    const key = language + currency;
    if (!currencyFormatters.has(key)) {
      currencyFormatters.set(key, new Intl.NumberFormat(language === "it" ? "it-IT" : "en-IE", { style: "currency", currency }));
    }
    return currencyFormatters.get(key).format(item.priceCents / 100);
  }

  function groupItems(items, field) {
    const result = new Map();
    for (const item of items) {
      const key = item[field];
      if (!result.has(key)) result.set(key, []);
      result.get(key).push(item);
    }
    return result;
  }

  function card(item, format) {
    const name = translate(item.name);
    const description = translate(item.description);
    const section = translate(item.section);
    const amount = price(item);
    const art = icon(icons[item.group] ? item.group : "all");
    return `<li><button class="catalogue-card" type="button" data-slug="${escape(item.slug)}" aria-haspopup="dialog"
      data-kicker="${escape(section || groupName(item.group))}" data-tag="${escape(translate(item.tag))}" data-ingredients="${escape(translate(item.ingredients))}">
      ${viewer.thumb(item.slug, art)}
      <span class="catalogue-card__body">
        ${format === "result" ? `<span class="catalogue-card__context">${escape(groupName(item.group))} · ${escape(section || name)}</span>` : ""}
        <span class="catalogue-card__top">
          <span class="catalogue-card__name">${escape(name)}</span>
          <span class="catalogue-card__price">${escape(amount)}</span>
        </span>
        ${description ? `<span class="catalogue-card__description">${escape(description)}</span>` : ""}
        ${item.tag ? `<span class="catalogue-card__tag">${escape(translate(item.tag))}</span>` : ""}
      </span>
    </button></li>`;
  }

  function cardGrid(items, format) {
    return '<ul class="catalogue-grid">' + items.map(item => card(item, format)).join("") + "</ul>";
  }

  function renderCategories() {
    const present = new Set(state.catalogue.map(item => item.group));
    // Reuse category buttons so selection and language changes preserve keyboard focus.
    for (const key of [...Object.keys(groups), "other"]) {
      if (key !== "all" && !present.has(key)) continue;
      let button = nav.querySelector('[data-category="' + key + '"]');
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.dataset.category = key;
        button.innerHTML = icon(icons[key] ? key : "all") + "<span></span>";
        nav.append(button);
      }
      button.lastElementChild.textContent = groupName(key);
      button.setAttribute("aria-pressed", String(!state.query && key === state.category));
    }
  }

  function renderSections(items, group) {
    const sections = groupItems(items, "section");
    const titleId = "catalogue-" + group;
    const entries = [...sections.entries()];
    const single = state.category !== "all";
    const jumps = single && entries.length > 1
      ? `<nav class="catalogue-jumps" aria-label="${escape(label("jump"))}">
          ${entries.map(([section], index) => `<a href="#${titleId}-${index}">${escape(translate(section) || groupName(group))}</a>`).join("")}
         </nav>`
      : "";
    return `<section class="catalogue-category" aria-labelledby="${titleId}">
      <div class="catalogue-heading">
        <span class="catalogue-heading__icon">${icon(icons[group] ? group : "all")}</span>
        <${single ? "h2" : "h3"} id="${titleId}" tabindex="-1">${escape(groupName(group))}</${single ? "h2" : "h3"}>
        <span class="catalogue-heading__count">${label("count")(items.length)}</span>
      </div>
      ${jumps}
      ${entries.map(([section, rows], index) => {
        const note = Object.hasOwn(subgroupNotes, section) && subgroupNotes[section];
        const heading = single ? "h3" : "h4";
        return `<div class="catalogue-subgroup">
          ${section ? `<${heading} id="${titleId}-${index}" tabindex="-1">${escape(translate(section))}</${heading}>` : ""}
          ${note ? '<p class="catalogue-note">' + escape(translate(note)) + "</p>" : ""}
          ${cardGrid(rows)}
        </div>`;
      }).join("")}
      ${group === "brunch" ? `<aside class="catalogue-aside">
        <strong>${escape(translate("A pranzo ci piace variare!"))}</strong>
        <p>${escape(translate("Trovi le proposte del giorno sulla lavagna, oppure chiedi al nostro personale di sala."))}</p>
      </aside>` : ""}
    </section>`;
  }

  function render() {
    nav.setAttribute("aria-label", label("categories"));
    previous.setAttribute("aria-label", label("previousCats"));
    next.setAttribute("aria-label", label("nextCats"));
    root.querySelector("label").textContent = label("search");
    search.placeholder = label("example");
    clear.setAttribute("aria-label", label("clear"));
    clear.hidden = !search.value;

    if (!state.catalogue) {
      content.innerHTML = '<p class="catalogue-message" role="status">' + label(state.failed ? "error" : "loading") + "</p>";
      return;
    }

    controls.hidden = false;
    renderCategories();
    const terms = state.query.split(" ");
    const items = state.catalogue.filter(item => state.query
      ? terms.every(term => item.search.includes(term))
      : state.category === "all" || item.group === state.category);
    let html = "";
    total.textContent = state.query ? "" : label("count")(state.catalogue.length);
    if (!state.query && state.category === "all") {
      html = `<h2 class="catalogue-sr">${label("all")}</h2>`;
    }
    if (state.query) {
      html = `<div class="catalogue-index">
        <h2>${label("results")}</h2>
        <span>${label("count")(items.length)}</span>
      </div>`;
    }

    if (!items.length) {
      html += `<div class="catalogue-message">
        <h3>${label(state.query ? "empty" : "unavailable")}</h3>
        ${state.query ? '<p>' + label("hint") + '</p><button type="button" data-clear>' + label("clear") + '</button>' : ""}
      </div>`;
    } else if (state.query) {
      html += cardGrid(items, "result");
    } else {
      const byGroup = groupItems(items, "group");
      html += [...Object.keys(groups), "other"]
        .filter(group => byGroup.has(group))
        .map(group => renderSections(byGroup.get(group), group)).join("");
    }

    content.innerHTML = html;
    const cocktails = content.querySelector("#catalogue-cocktail")?.closest("section");
    if (cocktails && bartender) {
      bartender.querySelector("blockquote").textContent = translate(bartenderQuote);
      cocktails.append(bartender);
    }
    updateCategoryOverflow();
    status.textContent = state.query ? label("results") + ". " + label("count")(items.length) : "";
  }

  function updateScrollPadding() {
    root.style.setProperty("--catalogue-controls-height", controls.offsetHeight + "px");
  }

  function updateCategoryOverflow() {
    const focus = document.activeElement;
    previous.hidden = nav.scrollLeft < 2;
    next.hidden = nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 2;
    // Preserve focus when a scroll control reaches the end of the strip.
    if (previous.hidden && focus === previous) nav.firstElementChild?.focus({ preventScroll: true });
    if (next.hidden && focus === next) nav.lastElementChild?.focus({ preventScroll: true });
  }

  for (const edge of [previous, next]) {
    edge.addEventListener("click", () => nav.scrollBy({
      left: Number(edge.dataset.direction) * nav.clientWidth * .72,
      behavior: motion(),
    }));
  }
  nav.addEventListener("scroll", updateCategoryOverflow, { passive: true });
  nav.addEventListener("focusin", event => {
    const button = event.target;
    if (!button.matches("[data-category]")) return;
    const target = button.getBoundingClientRect();
    const strip = nav.getBoundingClientRect();
    const left = strip.left + (previous.hidden ? 0 : 48);
    const right = strip.right - (next.hidden ? 0 : 48);
    if (target.left < left) nav.scrollBy({ left: target.left - left - 3, behavior: "instant" });
    else if (target.right > right) nav.scrollBy({ left: target.right - right + 3, behavior: "instant" });
  });
  new ResizeObserver(updateCategoryOverflow).observe(nav);

  // Keep jump targets and focused cards clear of the sticky controls.
  new ResizeObserver(updateScrollPadding).observe(controls);

  function returnToControls() {
    if (root.getBoundingClientRect().top < controls.getBoundingClientRect().top - 1) {
      root.scrollIntoView({ behavior: motion(), block: "start" });
    }
  }

  function updateSearch() {
    state.query = normalize(search.value);
    render();
    returnToControls();
  }

  function clearSearch() {
    search.value = "";
    updateSearch();
    search.focus({ preventScroll: true });
  }

  function selectCategory(category) {
    state.category = category;
    state.query = "";
    search.value = "";
    render();
  }

  search.addEventListener("input", updateSearch);
  clear.addEventListener("click", clearSearch);
  nav.addEventListener("click", event => {
    const button = event.target.closest("button[data-category]");
    if (!button) return;
    selectCategory(button.dataset.category);
    if (!atTable && ["#menu", "#cocktail"].includes(location.hash)) {
      const anchor = state.category === "cocktail" ? "#cocktail" : "#menu";
      history.replaceState(null, "", anchor);
      window.dispatchEvent(new Event("cataloguecategorychange"));
    }
    returnToControls();
  });

  content.addEventListener("error", event => {
    if (event.target.matches(".xr-thumb img")) event.target.hidden = true;
  }, true);

  content.addEventListener("click", event => {
    if (event.target.closest("[data-clear]")) clearSearch();
    const link = event.target.closest(".catalogue-jumps a");
    if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      const heading = document.getElementById(link.hash.slice(1));
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ behavior: motion(), block: "start" });
    }
    const card = event.target.closest(".catalogue-card");
    if (card) viewer.open(card);
  });

  if (!atTable) {
    // Preserve the marketing page's public food and cocktail anchors.
    const categoryFromHash = () => location.hash === "#cocktail" ? "cocktail" : "all";
    state.category = categoryFromHash();
    window.addEventListener("hashchange", () => {
      if (state.catalogue && ["#menu", "#cocktail"].includes(location.hash)) selectCategory(categoryFromHash());
    });
    document.querySelectorAll('a[href="#menu"], a[href="#cocktail"]').forEach(link => {
      link.addEventListener("click", event => {
        if (!state.catalogue || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        selectCategory(link.hash === "#cocktail" ? "cocktail" : "all");
      });
    });
  }

  function applyLanguage() {
    if (atTable) {
      const table = Number.parseInt(new URLSearchParams(location.search).get("table"), 10);
      const badge = document.getElementById("tableBadge");
      badge.hidden = !(table > 0 && table < 1000);
      badge.textContent = badge.hidden ? "" : label("table") + " " + table;
      document.title = translate("Menu al tavolo") + " · Il Chiosco | Taste & Beyond";
    }
    render();
  }

  new MutationObserver(applyLanguage).observe(document.documentElement, { attributeFilter: ["lang"] });
  applyLanguage();
  loadCatalogue().then(items => {
    state.catalogue = makeCatalogue(items);
    render();
  }).catch(() => {
    state.failed = true;
    render();
  });
})();
