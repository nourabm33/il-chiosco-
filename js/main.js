/* ============================================================
   Il Chiosco | Taste & Beyond — interactions
   ============================================================ */
(function () {
  "use strict";

  /* ---------- year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- nav scrolled state + progress bar ---------- */
  var nav = document.getElementById("nav");
  var progress = document.getElementById("scrollProgress");

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (nav) nav.classList.toggle("scrolled", y > 40);
    if (progress) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- mobile menu ---------- */
  var toggle = document.getElementById("navToggle");
  var links = document.getElementById("navLinks");
  function closeMenu() {
    document.body.classList.remove("menu-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("menu-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  if (links) {
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
  }

  /* ---------- hero parallax ---------- */
  var heroBg = document.getElementById("heroBg");
  if (heroBg && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.addEventListener("scroll", function () {
      var y = window.scrollY || window.pageYOffset;
      if (y < window.innerHeight) {
        heroBg.style.transform = "scale(1.08) translateY(" + y * 0.18 + "px)";
      }
    }, { passive: true });
  }

  /* ---------- scroll reveal ---------- */
  var reveals = document.querySelectorAll(".reveal:not(.in)");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- menu tabs ---------- */
  function setupTabs(group) {
    var wrap = document.querySelector('.menu-tabs[data-tabs="' + group + '"]');
    if (!wrap) return;
    var tabs = Array.from(wrap.querySelectorAll(".menu-tab"));
    var title = wrap.closest(".premium-menu")?.querySelector(".section-title");
    wrap.setAttribute("role", "tablist");
    if (title) {
      title.id = "menu-title-" + group;
      wrap.setAttribute("aria-labelledby", title.id);
    }

    function select(selected) {
      tabs.forEach(function (tab) {
        var active = tab === selected;
        var panel = document.getElementById("panel-" + tab.dataset.tab);
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
        panel.classList.toggle("active", active);
        if (active) panel.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
      });
    }

    tabs.forEach(function (tab, index) {
      var panel = document.getElementById("panel-" + tab.dataset.tab);
      tab.id = "menu-tab-" + tab.dataset.tab;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", panel.id);
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tab.id);
      tab.addEventListener("click", function () { select(tab); });
      tab.addEventListener("keydown", function (event) {
        var destination = {
          ArrowLeft: (index + tabs.length - 1) % tabs.length,
          ArrowRight: (index + 1) % tabs.length,
          Home: 0,
          End: tabs.length - 1,
        }[event.key];
        if (destination === undefined) return;
        event.preventDefault();
        select(tabs[destination]);
        tabs[destination].focus();
      });
    });
    select(tabs.find(function (tab) { return tab.classList.contains("active"); }) || tabs[0]);
  }
  setupTabs("food");
  setupTabs("drink");

  /* Jump to a subsection without scrolling back to the top of the menu. */
  var jumpMenus = [];
  document.querySelectorAll("#menu .menu-panel").forEach(function (panel) {
    var sections = Array.from(panel.querySelectorAll(".menu-cat")).filter(function (section) {
      return section.querySelector(".menu-cat__head h3");
    });
    if (sections.length < 2) return;
    var nav = document.createElement("nav");
    nav.className = "menu-jumps";
    var entries = sections.map(function (section, index) {
      section.id = panel.id + "-section-" + (index + 1);
      var link = document.createElement("a");
      link.href = "#" + section.id;
      link.addEventListener("click", function (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        var heading = section.querySelector(".menu-cat__head h3");
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        section.scrollIntoView({ behavior: motionBehavior(), block: "start" });
      });
      nav.appendChild(link);
      return [link, section.querySelector(".menu-cat__head h3")];
    });
    panel.querySelector(".menu-banner").after(nav);
    jumpMenus.push([nav, entries]);
  });

  function motionBehavior() {
    return matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
  }

  function labelJumpMenus() {
    var label = document.documentElement.lang === "en" ? "Jump to a menu section" : "Vai a una sezione del menu";
    jumpMenus.forEach(function (menu) {
      menu[0].setAttribute("aria-label", label);
      menu[1].forEach(function (entry) { entry[0].textContent = entry[1].textContent; });
    });
  }
  labelJumpMenus();
  new MutationObserver(labelJumpMenus).observe(document.documentElement, { attributeFilter: ["lang"] });

  /* ---------- "back to tabs" quick-return rows ---------- */
  function scrollToTabs(group) {
    var tabs = document.querySelector('.menu-tabs[data-tabs="' + group + '"]');
    if (!tabs) return;
    var y = tabs.getBoundingClientRect().top + (window.scrollY || window.pageYOffset) - 96;
    window.scrollTo({ top: y, behavior: motionBehavior() });
  }
  document.querySelectorAll(".menu-panel").forEach(function (panel) {
    var group = panel.getAttribute("data-group");
    if (!group) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "back-to-tabs";
    btn.innerHTML = '<span class="back-to-tabs__arrow" aria-hidden="true">&#8593;</span>' +
      '<span class="i18n">Scegli un\u2019altra categoria</span>';
    btn.addEventListener("click", function () { scrollToTabs(group); });
    panel.appendChild(btn);
  });

  /* ---------- active nav link on scroll ---------- */
  var sections = ["home", "menu", "cocktail", "gallery", "contact"]
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);
  var navAnchors = links ? Array.prototype.slice.call(links.querySelectorAll("a")) : [];
  function setActiveLink() {
    var pos = (window.scrollY || window.pageYOffset) + 120;
    var current = sections[0] ? sections[0].id : "";
    sections.forEach(function (s) { if (s.offsetTop <= pos) current = s.id; });
    navAnchors.forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("href") === "#" + current);
    });
  }
  window.addEventListener("scroll", setActiveLink, { passive: true });
  setActiveLink();

  /* ---------- lightbox ---------- */
  var grid = document.getElementById("galleryGrid");
  var lb = document.getElementById("lightbox");
  var lbImg = document.getElementById("lbImg");
  var lbClose = document.getElementById("lbClose");
  var lbPrev = document.getElementById("lbPrev");
  var lbNext = document.getElementById("lbNext");
  var items = grid ? Array.prototype.slice.call(grid.querySelectorAll(".gallery-item")) : [];
  var index = 0;

  function show(i) {
    if (!items.length) return;
    index = (i + items.length) % items.length;
    var item = items[index];
    var src = item.getAttribute("data-full");
    var img = item.querySelector("img");
    lbImg.setAttribute("src", src);
    lbImg.setAttribute("alt", img ? img.getAttribute("alt") : "");
  }
  function openLb(i) { show(i); lb.classList.add("open"); lb.setAttribute("aria-hidden", "false"); }
  function closeLb() { lb.classList.remove("open"); lb.setAttribute("aria-hidden", "true"); }

  items.forEach(function (item, i) {
    item.addEventListener("click", function () { openLb(i); });
  });
  if (lbClose) lbClose.addEventListener("click", closeLb);
  if (lbPrev) lbPrev.addEventListener("click", function () { show(index - 1); });
  if (lbNext) lbNext.addEventListener("click", function () { show(index + 1); });
  if (lb) lb.addEventListener("click", function (e) { if (e.target === lb) closeLb(); });
  document.addEventListener("keydown", function (e) {
    if (!lb || !lb.classList.contains("open")) return;
    if (e.key === "Escape") closeLb();
    else if (e.key === "ArrowLeft") show(index - 1);
    else if (e.key === "ArrowRight") show(index + 1);
  });
})();
