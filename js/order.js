/* ============================================================
   Il Chiosco — table menu (customer side, browse only)
   The table QR opens /order?table=N. Orders are taken by the
   waiter; this page only shows the menu and prices.
   Menu source: the backend (/api/menu) when reachable, otherwise
   the static product list shipped with the site.
   ============================================================ */
(function () {
  "use strict";

  var API = (window.IL_CHIOSCO_API || "") + "/api";
  var STATIC_MENU = "server/data/products.json";
  var state = { menu: [], category: null, lang: "it", table: null };

  var el = function (id) { return document.getElementById(id); };
  var money = function (cents) {
    return (cents / 100).toFixed(2).replace(".", ",") + " €";
  };

  var TEXT = {
    it: {
      title: "Menu al tavolo",
      notice: "Per ordinare, rivolgiti al cameriere.",
      loading: "Caricamento menu…",
      empty: "Nessun prodotto disponibile.",
      error: "Il menu non è disponibile al momento. Chiedi pure al cameriere.",
      table: "Tavolo",
      toggle: "EN",
      toggleLabel: "Switch to English",
    },
    en: {
      title: "Table menu",
      notice: "To place an order, please speak to your waiter.",
      loading: "Loading menu…",
      empty: "No products available.",
      error: "The menu is not available right now. Please ask your waiter.",
      table: "Table",
      toggle: "IT",
      toggleLabel: "Passa all\u2019italiano",
    },
  };

  var CATEGORY_LABELS = {
    it: {
      alba: "Alba",
      mezzogiorno: "Mezzogiorno",
      bibite: "Soft drink & Drink",
      cocktail: "Cocktail & Drinks",
    },
    en: {
      alba: "Morning",
      mezzogiorno: "Midday",
      bibite: "Soft drinks & Drinks",
      cocktail: "Cocktails & Drinks",
    },
  };

  function t(key) { return TEXT[state.lang][key]; }
  function categoryLabel(category) {
    return CATEGORY_LABELS[state.lang][category] || category;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function fetchJson(url) {
    return fetch(url, { headers: { Accept: "application/json" } }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  /** Groups the static products.json the same way /api/menu does. */
  function groupStatic(products) {
    var groups = [];
    var index = {};
    products
      .slice()
      .sort(function (a, b) { return a.sortOrder - b.sortOrder; })
      .forEach(function (product) {
        var key = product.category + "|" + (product.subcategory || "");
        if (!index[key]) {
          index[key] = { category: product.category, subcategory: product.subcategory, items: [] };
          groups.push(index[key]);
        }
        index[key].items.push(product);
      });
    return groups;
  }

  function loadMenu() {
    return fetchJson(API + "/menu")
      .then(function (data) { return data.categories; })
      .catch(function () {
        return fetchJson(STATIC_MENU).then(groupStatic);
      });
  }

  /* ---------------- rendering ---------------- */
  function categories() {
    var list = [];
    state.menu.forEach(function (group) {
      if (list.indexOf(group.category) === -1) list.push(group.category);
    });
    return list;
  }

  function renderTabs() {
    var list = categories();
    if (list.indexOf(state.category) === -1) state.category = list[0];
    el("categoryTabs").innerHTML = list
      .map(function (category) {
        return (
          '<button class="menu-tab' + (category === state.category ? " active" : "") +
          '" role="tab" aria-selected="' + (category === state.category) +
          '" data-category="' + escapeHtml(category) + '">' +
          escapeHtml(categoryLabel(category)) + "</button>"
        );
      })
      .join("");
  }

  function itemRow(item) {
    return (
      '<div class="order-item">' +
      '  <div class="order-item__info">' +
      '    <span class="order-item__name">' + escapeHtml(item.name) + "</span>" +
      (item.description ? '<span class="order-item__desc">' + escapeHtml(item.description) + "</span>" : "") +
      "  </div>" +
      '  <span class="order-item__price">' + money(item.priceCents) + "</span>" +
      "</div>"
    );
  }

  function renderMenu() {
    var html = state.menu
      .filter(function (group) { return group.category === state.category; })
      .map(function (group) {
        return (
          '<div class="menu-group">' +
          "<h3>" + escapeHtml(group.subcategory || categoryLabel(group.category)) + "</h3>" +
          group.items.map(itemRow).join("") +
          "</div>"
        );
      })
      .join("");
    el("menuList").innerHTML = html || '<p class="order-lead">' + t("empty") + "</p>";
  }

  function applyLanguage() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      node.textContent = t(node.dataset.i18n);
    });
    document.title = t("title") + " · Il Chiosco | Taste & Beyond";
    var toggle = el("langToggle");
    toggle.textContent = t("toggle");
    toggle.setAttribute("aria-label", t("toggleLabel"));
    if (state.table) el("tableBadge").textContent = t("table") + " " + state.table;
    if (state.menu.length) {
      renderTabs();
      renderMenu();
    }
  }

  /* ---------------- wiring ---------------- */
  function tableFromUrl() {
    var number = parseInt(new URLSearchParams(window.location.search).get("table"), 10);
    return Number.isInteger(number) && number > 0 && number < 1000 ? number : null;
  }

  try { state.lang = window.localStorage.getItem("ic-lang") === "en" ? "en" : "it"; } catch (e) {}
  state.table = tableFromUrl();
  el("tableBadge").hidden = !state.table;
  applyLanguage();

  el("langToggle").addEventListener("click", function () {
    state.lang = state.lang === "it" ? "en" : "it";
    try { window.localStorage.setItem("ic-lang", state.lang); } catch (e) {}
    applyLanguage();
  });

  el("categoryTabs").addEventListener("click", function (event) {
    var tab = event.target.closest("[data-category]");
    if (!tab) return;
    state.category = tab.dataset.category;
    renderTabs();
    renderMenu();
  });

  loadMenu()
    .then(function (groups) {
      state.menu = groups;
      renderTabs();
      renderMenu();
    })
    .catch(function () {
      el("menuList").innerHTML = '<p class="order-error">' + t("error") + "</p>";
    });
})();
