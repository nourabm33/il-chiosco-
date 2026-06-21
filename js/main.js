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
    var tabs = wrap.querySelectorAll(".menu-tab");
    var panels = document.querySelectorAll('.menu-panel[data-group="' + group + '"]');
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var id = tab.getAttribute("data-tab");
        tabs.forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        panels.forEach(function (p) {
          var on = p.id === "panel-" + id;
          p.classList.toggle("active", on);
        });
        // re-trigger reveals inside newly shown panel
        var active = document.getElementById("panel-" + id);
        if (active) {
          active.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
        }
      });
    });
  }
  setupTabs("food");
  setupTabs("drink");

  /* ---------- "back to tabs" quick-return rows ---------- */
  function scrollToTabs(group) {
    var tabs = document.querySelector('.menu-tabs[data-tabs="' + group + '"]');
    if (!tabs) return;
    var y = tabs.getBoundingClientRect().top + (window.scrollY || window.pageYOffset) - 96;
    window.scrollTo({ top: y, behavior: "smooth" });
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
