/* Product media for the homepage and QR table menu. */
(function () {
  "use strict";

  var MODEL_VIEWER = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";
  var LOAD_LIMIT_MS = 18000;
  var MEDIA = window.IL_CHIOSCO_MEDIA || {};
  var CUBE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3 6.6 3.7L12 11.7 5.4 8 12 4.3ZM5 9.7l6 3.4v6.6l-6-3.4V9.7Zm8 10v-6.6l6-3.4v6.6l-6 3.4Z"/></svg>';
  var TEXT = {
    it: {
      photo: "Foto", model: "3D", ar: "Vedi sul tuo tavolo", close: "Chiudi", exitAR: "Esci dalla realtà aumentata",
      hint: "Trascina per ruotare · pizzica o scorri per ingrandire",
      loading: "Caricamento del modello 3D", pending: "Modello 3D in preparazione",
      failed: "Il modello 3D non si è caricato. Puoi continuare a vedere la foto.",
      noPhoto: "Foto non disponibile.",
      unavailable: "La realtà aumentata non è disponibile su questo dispositivo o browser. Puoi esplorare il modello in 3D.",
      arFailed: "Impossibile aprire la realtà aumentata. Puoi continuare a esplorare il modello in 3D.",
      arGuide: "Muovi lentamente il telefono per inquadrare il tavolo. Tocca il tavolo per posizionare il prodotto.",
      tracking: "Inquadra una zona ben illuminata del tavolo e muovi lentamente il telefono.",
      representative: "Modello rappresentativo. Aspetto e dimensioni della porzione possono variare.",
    },
    en: {
      photo: "Photo", model: "3D", ar: "View on your table", close: "Close", exitAR: "Exit augmented reality",
      hint: "Drag to rotate · pinch or scroll to zoom",
      loading: "Loading the 3D model", pending: "3D model in preparation",
      failed: "The 3D model could not load. You can still view the photo.",
      noPhoto: "Photo unavailable.",
      unavailable: "Augmented reality is unavailable on this device or browser. You can still explore the 3D model.",
      arFailed: "Augmented reality could not open. You can keep exploring the 3D model.",
      arGuide: "Move your phone slowly over the table. Tap the table to place the item.",
      tracking: "Point your phone at a well-lit part of the table and move slowly.",
      representative: "Representative model. The actual serving may look different or vary in size.",
    },
  };

  function t(key) { return TEXT[document.documentElement.lang === "en" ? "en" : "it"][key]; }
  function mediaFor(slug) { return Object.hasOwn(MEDIA, slug) ? MEDIA[slug] : null; }
  function photoFor(slug) { return mediaFor(slug)?.photo || null; }
  function modelFor(slug) {
    var model = mediaFor(slug)?.model;
    return model?.status === "ready" ? model : null;
  }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  var loader;
  function loadModelViewer() {
    if (customElements.get("model-viewer")) return Promise.resolve();
    if (!loader) {
      loader = new Promise(function (resolve, reject) {
        var script = document.createElement("script");
        script.type = "module";
        script.src = MODEL_VIEWER;
        function finish(error) {
          clearTimeout(timeout);
          if (error) {
            script.remove();
            reject(error);
          } else {
            resolve();
          }
        }
        var timeout = setTimeout(function () { finish(new Error("Viewer script timed out")); }, LOAD_LIMIT_MS);
        script.onload = function () {
          finish(customElements.get("model-viewer") ? null : new Error("Viewer did not register"));
        };
        script.onerror = function () { finish(new Error("Viewer script failed")); };
        document.head.appendChild(script);
      }).catch(function (error) {
        loader = null;
        throw error;
      });
    }
    return loader;
  }

  var modal, els = {}, current, lastFocus;

  function build() {
    modal = document.createElement("dialog");
    modal.className = "xr-modal";
    modal.setAttribute("aria-labelledby", "xrTitle");
    modal.innerHTML =
      '<div class="xr-modal__backdrop" data-close></div>' +
      '<article class="xr-card">' +
      '  <button class="xr-card__close" type="button" data-close autofocus><span aria-hidden="true">×</span></button>' +
      '  <div class="xr-stage">' +
      '    <img class="xr-stage__photo" alt="" />' +
      '    <p class="xr-stage__missing" hidden></p>' +
      '    <div class="xr-stage__model"></div>' +
      '    <p class="xr-stage__hint" hidden></p>' +
      '    <div class="xr-progress" role="status" hidden><span></span><progress max="1" value="0" aria-hidden="true"></progress></div>' +
      '    <div class="xr-switch" role="group" hidden>' +
      '      <button type="button" data-mode="photo"></button>' +
      '      <button type="button" data-mode="model"></button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="xr-info">' +
      '    <span class="xr-info__kicker"></span>' +
      '    <h3 class="xr-info__name" id="xrTitle"></h3>' +
      '    <p class="xr-info__desc"></p>' +
      '    <span class="xr-info__price"></span>' +
      '    <button class="btn btn--gold xr-ar" type="button" hidden>' + CUBE + '<span></span></button>' +
      '    <p class="xr-info__phone" role="status" hidden></p>' +
      '    <p class="xr-info__note" role="status"></p>' +
      '    <a class="xr-info__credit" target="_blank" rel="noopener" hidden></a>' +
      '  </div>' +
      '</article>';
    document.body.appendChild(modal);
    ["photo", "missing", "model", "hint", "kicker", "name", "desc", "price", "phone", "note", "credit"].forEach(function (key) {
      els[key] = modal.querySelector(".xr-stage__" + key + ", .xr-info__" + key);
    });
    els.ar = modal.querySelector(".xr-ar");
    els.close = modal.querySelector(".xr-card__close");
    els.switcher = modal.querySelector(".xr-switch");
    els.photoButton = modal.querySelector('[data-mode="photo"]');
    els.modelButton = modal.querySelector('[data-mode="model"]');
    els.progress = modal.querySelector(".xr-progress");

    modal.addEventListener("click", function (event) {
      if (event.target.closest("[data-close]")) close();
      var button = event.target.closest("button[data-mode]");
      if (button) setMode(button.dataset.mode);
    });
    modal.addEventListener("cancel", function (event) {
      event.preventDefault();
      close();
    });
    els.photo.addEventListener("error", function () {
      els.photo.hidden = true;
      els.missing.hidden = false;
    });
    els.ar.addEventListener("click", function () {
      var session = current;
      if (!session?.viewer?.canActivateAR || !session.loaded) return;
      // Keep the native handoff inside the user's tap gesture.
      session.viewer.activateAR().catch(function () { arFailed(session); });
    });
  }

  function setMode(mode) {
    if (!current || (mode === "model" && !current.model)) return;
    modal.dataset.mode = mode;
    els.photoButton.setAttribute("aria-pressed", String(mode === "photo"));
    els.modelButton.setAttribute("aria-pressed", String(mode === "model"));
    els.model.inert = mode === "photo";
    els.progress.hidden = mode !== "model" || current.loaded;
    els.hint.hidden = mode !== "model" || !current.loaded;
    els.note.textContent = current.failed ? t("failed") :
      current.model?.authenticity === "representative" ? t("representative") :
      current.pending ? t("pending") : "";
    els.credit.hidden = mode !== "model" || !current.loaded || !current.model?.credit;
    updateAR(current);
  }

  function updateAR(session) {
    if (current !== session) return;
    var modelVisible = session.loaded && modal.dataset.mode === "model";
    var canActivate = modelVisible && session.viewer.canActivateAR && !session.arFailed;
    els.ar.hidden = !canActivate;
    els.phone.hidden = !modelVisible || (!canActivate && !session.checkedAR && !session.arFailed);
    els.phone.textContent = !modelVisible ? "" : session.arFailed ? t("arFailed") :
      canActivate ? t("arGuide") : session.checkedAR ? t("unavailable") : "";
  }

  function arFailed(session) {
    session.arFailed = true;
    updateAR(session);
  }

  function failModel(session) {
    if (current !== session || session.failed) return;
    clearTimeout(session.timeout);
    clearInterval(session.capabilityCheck);
    session.model = null;
    session.failed = true;
    session.loaded = false;
    els.model.replaceChildren();
    els.switcher.hidden = true;
    if (els.switcher.contains(document.activeElement) || document.activeElement === els.ar) els.close.focus();
    setMode("photo");
  }

  function startModel(session, name) {
    session.timeout = setTimeout(function () { failModel(session); }, LOAD_LIMIT_MS);
    loadModelViewer().then(function () {
      if (current !== session || session.failed) return;
      var viewer = document.createElement("model-viewer");
      session.viewer = viewer;
      var attributes = {
        src: session.model.glb,
        "ios-src": session.model.usdz,
        alt: name + " 3D",
        ar: "",
        "ar-modes": "webxr scene-viewer quick-look",
        "ar-scale": "fixed",
        "ar-placement": "floor",
        "camera-controls": "",
        "disable-pan": "",
        "interaction-prompt": "none",
        loading: "eager",
        "camera-orbit": session.model.cameraOrbit || "25deg 64deg auto",
        "max-camera-orbit": "auto 86deg auto",
        "shadow-intensity": "0.85",
        "shadow-softness": "0.95",
        "environment-image": "neutral",
        exposure: "1.05",
        "touch-action": "none",
      };
      for (var attribute in attributes) viewer.setAttribute(attribute, attributes[attribute]);

      var nativeButton = document.createElement("button");
      nativeButton.slot = "ar-button";
      nativeButton.hidden = true;
      var exit = document.createElement("button");
      exit.slot = "exit-webxr-ar-button";
      exit.className = "xr-card__close";
      exit.type = "button";
      exit.addEventListener("beforexrselect", function (event) { event.preventDefault(); });
      exit.textContent = "×";
      exit.setAttribute("aria-label", t("exitAR"));
      var guidance = document.createElement("p");
      guidance.className = "xr-placement";
      guidance.textContent = t("arGuide");
      viewer.append(nativeButton, exit, guidance);

      viewer.addEventListener("progress", function (event) {
        if (current !== session || session.loaded) return;
        var progress = event.detail.totalProgress;
        els.progress.querySelector("progress").value = progress;
        els.progress.querySelector("span").textContent = t("loading") + " · " + Math.round(progress * 100) + "%";
      });
      viewer.addEventListener("load", function () {
        if (current !== session || session.failed) return;
        clearTimeout(session.timeout);
        session.loaded = true;
        modal.dataset.state = "ready";
        setMode(modal.dataset.mode);
        // WebXR detection resolves asynchronously and has no public ready event.
        var attempts = 0;
        session.capabilityCheck = setInterval(function () {
          if (viewer.canActivateAR || ++attempts >= 12) {
            clearInterval(session.capabilityCheck);
            session.checkedAR = true;
            updateAR(session);
          }
        }, 250);
      }, { once: true });
      viewer.addEventListener("error", function () { failModel(session); });
      viewer.addEventListener("ar-status", function (event) {
        if (event.detail.status === "failed") arFailed(session);
        else updateAR(session);
      });
      viewer.addEventListener("ar-tracking", function (event) {
        guidance.textContent = t(event.detail.status === "not-tracking" ? "tracking" : "arGuide");
      });
      els.model.appendChild(viewer);
    }).catch(function () { failModel(session); });
  }

  function open(item) {
    if (!modal) build();
    if (modal.open) close();
    if (modal.open) return;
    lastFocus = document.activeElement;
    var photo = photoFor(item.slug) || item.photo;
    var model = modelFor(item.slug);
    var session = { model: model, pending: mediaFor(item.slug)?.model?.status === "pending" };
    current = session;

    els.kicker.textContent = item.kicker || "";
    els.kicker.hidden = !item.kicker;
    els.name.textContent = item.name || "";
    els.desc.textContent = item.desc || "";
    els.desc.hidden = !item.desc;
    els.price.textContent = item.price || "";
    els.close.setAttribute("aria-label", t("close"));
    els.hint.textContent = t("hint");
    els.ar.querySelector("span").textContent = t("ar");
    els.photoButton.textContent = t("photo");
    els.modelButton.textContent = t("model");
    els.switcher.hidden = !model;
    els.credit.textContent = model?.credit || "";
    if (model?.source) els.credit.href = model.source;
    else els.credit.removeAttribute("href");
    els.photoButton.hidden = !photo;
    els.photo.alt = item.name || "";
    els.photo.hidden = !photo;
    if (photo) els.photo.src = photo;
    else els.photo.removeAttribute("src");
    els.missing.textContent = t("noPhoto");
    els.missing.hidden = !!photo;
    els.progress.querySelector("span").textContent = t("loading");
    els.progress.querySelector("progress").value = 0;
    modal.dataset.state = model ? "loading" : "photo";
    setMode(model ? "model" : "photo");
    modal.showModal();
    document.documentElement.classList.add("xr-lock");
    if (model) startModel(session, item.name || "");
  }

  function close() {
    if (!modal?.open) return;
    var arStatus = current.viewer?.getAttribute("ar-status");
    if (arStatus === "session-started" || arStatus === "object-placed") return;
    clearTimeout(current.timeout);
    clearInterval(current.capabilityCheck);
    current = null;
    els.model.replaceChildren();
    modal.close();
    document.documentElement.classList.remove("xr-lock");
    lastFocus?.focus({ preventScroll: true });
  }

  function thumb(slug, alt) {
    var photo = photoFor(slug);
    return '<span class="xr-thumb">' +
      (photo ? '<img src="' + esc(photo) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async" />' : "") +
      (modelFor(slug) ? '<span class="xr-thumb__badge">' + CUBE + '3D</span>' : "") + "</span>";
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

  window.IlChioscoViewer = { open: open, thumb: thumb, photo: photoFor, model: modelFor, cube: CUBE };
  enhanceStaticMenu();
  bindOpeners();
})();
