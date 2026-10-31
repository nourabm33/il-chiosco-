/* ============================================================
   Il Chiosco — photo + 3D / AR viewer for every menu item.
   Uses Google <model-viewer> (loaded on first open):
   WebXR / Scene Viewer on Android, Quick Look on iPhone.
   Models: assets/models/<slug>.glb (+ .usdz for iOS).
   ============================================================ */
(function () {
  "use strict";

  var MODEL_VIEWER = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";
  var MEDIA = window.IL_CHIOSCO_MEDIA || {};
  var TEXT = {
    it: {
      photo: "Foto", model: "3D", ar: "Vedi sul tuo tavolo", hint: "Trascina per ruotare · pizzica per lo zoom",
      close: "Chiudi", phoneOnly: "Apri il menu dal telefono per vederlo in AR sul tuo tavolo.",
      open: "Vedi foto e 3D", badge: "3D · AR", note: "Modello 3D illustrativo",
    },
    en: {
      photo: "Photo", model: "3D", ar: "View on your table", hint: "Drag to rotate · pinch to zoom",
      close: "Close", phoneOnly: "Open the menu on your phone to see it in AR on your table.",
      open: "See photo and 3D", badge: "3D · AR", note: "Illustrative 3D model",
    },
  };

  function lang() { return document.documentElement.lang === "en" ? "en" : "it"; }
  function t(key) { return TEXT[lang()][key]; }
  function photoFor(slug) { return MEDIA[slug] || null; }
  function modelFor(slug) { return { glb: "assets/models/" + slug + ".glb", usdz: "assets/models/" + slug + ".usdz" }; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var loader = null;
  function loadModelViewer() {
    if (window.customElements && window.customElements.get("model-viewer")) return Promise.resolve();
    if (!loader) {
      loader = new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.type = "module";
        s.src = MODEL_VIEWER;
        s.onload = function () { resolve(); };
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    return loader;
  }

  var modal, els = {}, lastFocus = null;

  function build() {
    modal = document.createElement("div");
    modal.className = "xr-modal";
    modal.hidden = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "xrTitle");
    modal.innerHTML =
      '<div class="xr-modal__backdrop" data-close></div>' +
      '<article class="xr-card">' +
      '  <button class="xr-card__close" type="button" data-close><span aria-hidden="true">×</span></button>' +
      '  <div class="xr-stage">' +
      '    <img class="xr-stage__photo" alt="" />' +
      '    <div class="xr-stage__model"></div>' +
      '    <div class="xr-switch" role="tablist">' +
      '      <button type="button" role="tab" data-mode="model"></button>' +
      '      <button type="button" role="tab" data-mode="photo"></button>' +
      "    </div>" +
      '    <p class="xr-stage__hint"></p>' +
      "  </div>" +
      '  <div class="xr-info">' +
      '    <span class="xr-info__kicker"></span>' +
      '    <h3 class="xr-info__name" id="xrTitle"></h3>' +
      '    <p class="xr-info__desc"></p>' +
      '    <span class="xr-info__price"></span>' +
      '    <button class="btn btn--gold xr-ar" type="button" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3 6.6 3.7L12 11.7 5.4 8 12 4.3ZM5 9.7l6 3.4v6.6l-6-3.4V9.7Zm8 10v-6.6l6-3.4v6.6l-6 3.4Z"/></svg><span></span></button>' +
      '    <p class="xr-info__phone" hidden></p>' +
      '    <p class="xr-info__note"></p>' +
      "  </div>" +
      "</article>";
    document.body.appendChild(modal);
    ["photo", "model", "kicker", "name", "desc", "price", "phone", "note"].forEach(function (k) {
      els[k] = modal.querySelector(".xr-stage__" + k + ", .xr-info__" + k);
    });
    els.card = modal.querySelector(".xr-card");
    els.hint = modal.querySelector(".xr-stage__hint");
    els.ar = modal.querySelector(".xr-ar");
    els.close = modal.querySelector(".xr-card__close");
    els.tabs = modal.querySelectorAll(".xr-switch button");

    modal.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) close();
      var tab = e.target.closest("[data-mode]");
      if (tab) setMode(tab.getAttribute("data-mode"));
    });
    els.ar.addEventListener("click", function () {
      var mv = els.model.querySelector("model-viewer");
      if (mv && mv.activateAR) mv.activateAR();
    });
    document.addEventListener("keydown", function (e) {
      if (!modal.hidden && e.key === "Escape") close();
    });
  }

  function setMode(mode) {
    modal.setAttribute("data-mode", mode);
    els.tabs.forEach(function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-mode") === mode)); });
  }

  function open(item) {
    if (!modal) build();
    lastFocus = document.activeElement;
    var photo = item.photo || photoFor(item.slug);
    var model = modelFor(item.slug);

    els.kicker.textContent = item.kicker || "";
    els.name.textContent = item.name || "";
    els.desc.textContent = item.desc || "";
    els.desc.hidden = !item.desc;
    els.price.textContent = item.price || "";
    els.close.setAttribute("aria-label", t("close"));
    els.hint.textContent = t("hint");
    els.note.textContent = t("note");
    els.ar.querySelector("span").textContent = t("ar");
    els.ar.hidden = true;
    els.phone.hidden = true;
    els.phone.textContent = t("phoneOnly");
    els.tabs[0].textContent = t("model");
    els.tabs[1].textContent = t("photo");
    els.tabs[1].hidden = !photo;
    els.photo.src = photo || "";
    els.photo.alt = item.name || "";
    els.photo.hidden = !photo;

    els.model.innerHTML =
      '<model-viewer src="' + esc(model.glb) + '" ios-src="' + esc(model.usdz) + '"' +
      (photo ? ' poster="' + esc(photo) + '"' : "") +
      ' alt="' + esc(item.name) + ' 3D" ar ar-modes="webxr scene-viewer quick-look" ar-scale="auto" ar-placement="floor"' +
      ' camera-controls auto-rotate auto-rotate-delay="600" rotation-per-second="18deg" interaction-prompt="none"' +
      ' camera-orbit="25deg 68deg auto" min-camera-orbit="auto 10deg auto" max-camera-orbit="auto 95deg auto"' +
      ' shadow-intensity="1.1" shadow-softness="0.9" exposure="1.05" environment-image="neutral" touch-action="pan-y">' +
      '<button slot="ar-button" hidden></button></model-viewer>';
    setMode("model");

    modal.hidden = false;
    document.documentElement.classList.add("xr-lock");
    requestAnimationFrame(function () { modal.classList.add("is-open"); });
    els.close.focus({ preventScroll: true });

    loadModelViewer().then(function () {
      var mv = els.model.querySelector("model-viewer");
      if (!mv) return;
      var check = function () {
        var can = !!mv.canActivateAR;
        els.ar.hidden = !can;
        els.phone.hidden = can;
      };
      mv.addEventListener("load", check, { once: true });
      setTimeout(check, 1500);
    }).catch(function () {
      setMode("photo");
    });
  }

  function close() {
    if (!modal || modal.hidden) return;
    modal.classList.remove("is-open");
    document.documentElement.classList.remove("xr-lock");
    setTimeout(function () {
      modal.hidden = true;
      els.model.innerHTML = "";
    }, 260);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  var CUBE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3 6.6 3.7L12 11.7 5.4 8 12 4.3ZM5 9.7l6 3.4v6.6l-6-3.4V9.7Zm8 10v-6.6l6-3.4v6.6l-6 3.4Z"/></svg>';

  /** Thumbnail with the 3D badge, shared by the site menu and the table menu. */
  function thumb(slug, alt) {
    var photo = photoFor(slug);
    return '<span class="xr-thumb">' +
      (photo ? '<img src="' + esc(photo) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async" />' : "") +
      '<span class="xr-thumb__badge">' + CUBE + "3D</span></span>";
  }

  /* --- main site: static menu items carrying data-slug --- */
  function enhanceStaticMenu() {
    document.querySelectorAll(".menu-item[data-slug]").forEach(function (item) {
      if (item.classList.contains("has-media")) return;
      var slug = item.getAttribute("data-slug");
      var body = document.createElement("div");
      body.className = "menu-item__body";
      while (item.firstChild) body.appendChild(item.firstChild);
      var name = body.querySelector(".menu-item__name");
      item.insertAdjacentHTML("afterbegin", thumb(slug, name ? name.textContent : ""));
      item.appendChild(body);
      item.classList.add("has-media");
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
    });
  }

  function itemFromStatic(el) {
    var q = function (sel) { var n = el.querySelector(sel); return n ? n.textContent.trim() : ""; };
    var cat = el.closest(".menu-cat");
    var head = cat && cat.querySelector(".menu-cat__head h3");
    return { slug: el.getAttribute("data-slug"), name: q(".menu-item__name"), desc: q(".menu-item__desc"), price: q(".menu-item__price"), kicker: head ? head.textContent.trim() : "" };
  }

  function bindOpeners() {
    function handler(e) {
      var el = e.target.closest("[data-slug].has-media, .cocktail-card[data-slug], .order-item[data-slug]");
      if (!el) return;
      if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (el.classList.contains("menu-item")) return open(itemFromStatic(el));
      var q = function (sel) { var n = el.querySelector(sel); return n ? n.textContent.trim() : ""; };
      if (el.classList.contains("cocktail-card")) {
        var tag = el.querySelector(".cocktail-card__name .tag");
        var name = q(".cocktail-card__name");
        if (tag) name = name.replace(tag.textContent, "").trim();
        var img = el.querySelector(".cocktail-card__media img");
        return open({ slug: el.getAttribute("data-slug"), name: name, desc: q(".cocktail-card__desc"), price: q(".cocktail-card__price"), kicker: el.getAttribute("data-kicker") || "", photo: img ? img.getAttribute("src") : null });
      }
      return open({ slug: el.getAttribute("data-slug"), name: q(".order-item__name"), desc: q(".order-item__desc"), price: q(".order-item__price"), kicker: el.getAttribute("data-kicker") || "" });
    }
    document.addEventListener("click", handler);
    document.addEventListener("keydown", handler);
  }

  window.IlChioscoViewer = { open: open, thumb: thumb, photo: photoFor, model: modelFor, text: t, cube: CUBE };
  enhanceStaticMenu();
  bindOpeners();
})();
