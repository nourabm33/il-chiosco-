/* Product media for the homepage and QR table menu. */
(function () {
  "use strict";

  var MODEL_VIEWER = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";
  var LOAD_LIMIT_MS = 18000;
  var MEDIA = window.IL_CHIOSCO_MEDIA || {};
  var DEFAULT_ORBIT = "25deg 64deg auto";
  var CUBE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3 6.6 3.7L12 11.7 5.4 8 12 4.3ZM5 9.7l6 3.4v6.6l-6-3.4V9.7Zm8 10v-6.6l6-3.4v6.6l-6 3.4Z"/></svg>';
  var TEXT = {
    it: {
      photo: "Foto", model: "3D", close: "Chiudi", exitAR: "Esci dalla realtà aumentata",
      previewAR: "Vedi in AR", reset: "Ripristina vista", previous: "Prodotto precedente", next: "Prodotto successivo",
      representativePhoto: "Immagine rappresentativa.", illustration: "Illustrazione indicativa.", artwork: "Illustrazione", ingredients: "Ingredienti",
      hint: "Trascina per ruotare · pizzica o scorri per ingrandire",
      loading: "Caricamento del modello 3D",
      failed: "Il modello 3D non si è caricato. Puoi continuare a vedere la foto.",
      noPhoto: "Foto non disponibile.",
      unavailable: "La realtà aumentata non è disponibile su questo dispositivo o browser. Puoi esplorare il modello in 3D.",
      arFailed: "Impossibile aprire la realtà aumentata. Puoi continuare a esplorare il modello in 3D.",
      arGuide: "Muovi lentamente il telefono per inquadrare il tavolo. Tocca il tavolo per posizionare il prodotto.",
      tracking: "Inquadra una zona ben illuminata del tavolo e muovi lentamente il telefono.",
      representative: "Modello rappresentativo. Aspetto e dimensioni della porzione possono variare.",
    },
    en: {
      photo: "Photo", model: "3D", close: "Close", exitAR: "Exit augmented reality",
      previewAR: "View in AR", reset: "Reset view", previous: "Previous product", next: "Next product",
      representativePhoto: "Representative image.", illustration: "Illustration.", artwork: "Illustration", ingredients: "Ingredients",
      hint: "Drag to rotate · pinch or scroll to zoom",
      loading: "Loading the 3D model",
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
  function displayMedia(slug) {
    var media = mediaFor(slug);
    // The inventory flags known mismatches and images with unverified usage rights.
    return ["mismatch", "unverified"].includes(media?.photoAuthenticity) ? null : media;
  }
  function modelFor(slug) {
    var model = mediaFor(slug)?.model;
    return model?.status === "ready" && model.glb ? model : null;
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
          var definition = customElements.get("model-viewer");
          if (definition && "modelCacheSize" in definition) definition.modelCacheSize = 2;
          finish(definition ? null : new Error("Viewer did not register"));
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
      '    <div class="xr-stage__missing" hidden><span aria-hidden="true"></span><p></p></div>' +
      '    <div class="xr-stage__model"></div>' +
      '    <p class="xr-stage__hint" hidden></p>' +
      '    <button class="xr-reset" type="button" hidden><span aria-hidden="true">↺</span></button>' +
      '    <div class="xr-progress" role="status" hidden><span></span><progress max="1" value="0" aria-hidden="true"></progress></div>' +
      '    <div class="xr-switch" role="group" hidden>' +
      '      <button type="button" data-mode="photo"></button>' +
      '      <button type="button" data-mode="model"></button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="xr-info">' +
      '    <span class="xr-info__kicker"></span>' +
      '    <h2 class="xr-info__name" id="xrTitle" aria-live="polite"></h2>' +
      '    <p class="xr-info__desc"></p>' +
      '    <span class="xr-info__price"></span>' +
      '    <span class="xr-info__tag" hidden></span>' +
      '    <p class="xr-info__ingredients" hidden></p>' +
      '    <button class="btn btn--gold xr-ar" type="button" hidden>' + CUBE + '<span></span></button>' +
      '    <div class="xr-browse" hidden>' +
      '      <button type="button" data-step="-1">‹</button>' +
      '      <span class="xr-browse__position" aria-live="polite"></span>' +
      '      <button type="button" data-step="1">›</button>' +
      '    </div>' +
      '    <p class="xr-info__phone" role="status" hidden></p>' +
      '    <p class="xr-info__note" role="status"></p>' +
      '    <a class="xr-info__credit" target="_blank" rel="noopener" hidden></a>' +
      '  </div>' +
      '</article>';
    document.body.appendChild(modal);
    ["photo", "missing", "model", "hint", "kicker", "name", "desc", "price", "tag", "ingredients", "phone", "note", "credit"].forEach(function (key) {
      els[key] = modal.querySelector(".xr-stage__" + key + ", .xr-info__" + key);
    });
    els.ar = modal.querySelector(".xr-ar");
    els.close = modal.querySelector(".xr-card__close");
    els.switcher = modal.querySelector(".xr-switch");
    els.photoButton = modal.querySelector('[data-mode="photo"]');
    els.modelButton = modal.querySelector('[data-mode="model"]');
    els.progress = modal.querySelector(".xr-progress");
    els.reset = modal.querySelector(".xr-reset");
    els.browse = modal.querySelector(".xr-browse");
    els.reset.addEventListener("click", function () {
      var viewer = current?.viewer;
      if (!viewer || !current.loaded) return;
      viewer.cameraOrbit = current.model.cameraOrbit || DEFAULT_ORBIT;
      viewer.fieldOfView = current.initialFov + "deg";
      viewer.jumpCameraToGoal();
    });

    modal.addEventListener("click", function (event) {
      if (event.target.closest("[data-close]")) close();
      var button = event.target.closest("button[data-mode]");
      if (button) setMode(button.dataset.mode);
      var step = event.target.closest("button[data-step]");
      if (step && current?.siblings && !arIsPresenting()) {
        var siblings = current.siblings;
        var index = (siblings.index + Number(step.dataset.step) + siblings.cards.length) % siblings.cards.length;
        show(itemFromCard(siblings.cards[index]), { cards: siblings.cards, index: index });
        if (document.activeElement === document.body) els.close.focus();
      }
    });
    modal.addEventListener("cancel", function (event) {
      event.preventDefault();
      close();
    });
    els.photo.addEventListener("error", function () {
      els.photo.hidden = true;
      els.photoButton.hidden = true;
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
    els.reset.hidden = mode !== "model" || !current.loaded;
    var mediaNote = mode === "model" && current.loaded
      ? current.model?.authenticity === "representative" && t("representative")
      : current.photoNote && !els.photo.hidden && t(current.photoNote);
    els.note.textContent = [mediaNote, current.failed && t("failed")].filter(Boolean).join(" ");
    els.credit.hidden = mode !== "model" || !current.loaded || !current.model?.credit;
    updateAR(current);
    if (mode === "model" && !current.started) {
      current.started = true;
      modal.dataset.state = "loading";
      startModel(current, els.name.textContent);
    }
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
        alt: name + " 3D",
        ar: "",
        "ar-modes": session.model.usdz ? "webxr scene-viewer quick-look" : "webxr scene-viewer",
        "ar-scale": "fixed",
        "ar-placement": "floor",
        "camera-controls": "",
        "disable-pan": "",
        "interaction-prompt": "none",
        loading: "eager",
        "camera-orbit": session.model.cameraOrbit || DEFAULT_ORBIT,
        "max-camera-orbit": "auto 86deg auto",
        "shadow-intensity": "0.85",
        "shadow-softness": "0.95",
        "environment-image": "neutral",
        exposure: "1.05",
        "touch-action": "none",
      };
      for (var attribute in attributes) viewer.setAttribute(attribute, attributes[attribute]);
      if (session.model.usdz) viewer.setAttribute("ios-src", session.model.usdz);

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
        session.initialFov = viewer.getFieldOfView();
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

  function show(item, siblings) {
    if (!modal) build();
    if (modal.dataset.closing || arIsPresenting()) return;
    if (modal.open) releaseCurrent();
    else lastFocus = siblings.cards[siblings.index];
    var media = displayMedia(item.slug);
    var photo = media?.photo;
    var model = modelFor(item.slug);
    var session = {
      model: model,
      photoNote: { representative: "representativePhoto", "generated-representative": "illustration" }[media?.photoAuthenticity],
      siblings: siblings,
    };
    current = session;

    els.kicker.textContent = item.kicker || "";
    els.kicker.hidden = !item.kicker;
    els.name.textContent = item.name || "";
    els.desc.textContent = item.desc || "";
    els.desc.hidden = !item.desc;
    els.price.textContent = item.price;
    els.tag.textContent = item.tag;
    els.tag.hidden = !item.tag;
    els.ingredients.textContent = item.ingredients ? t("ingredients") + " · " + item.ingredients : "";
    els.ingredients.hidden = !item.ingredients;
    els.close.setAttribute("aria-label", t("close"));
    els.hint.textContent = t("hint");
    els.ar.querySelector("span").textContent = t("previewAR");
    els.reset.setAttribute("aria-label", t("reset"));
    els.reset.title = t("reset");
    els.browse.hidden = !siblings || siblings.cards.length < 2;
    if (siblings) {
      els.browse.firstElementChild.setAttribute("aria-label", t("previous"));
      els.browse.lastElementChild.setAttribute("aria-label", t("next"));
      els.browse.querySelector(".xr-browse__position").textContent = (siblings.index + 1) + " / " + siblings.cards.length;
    }
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
    els.missing.querySelector("p").textContent = t("noPhoto");
    els.missing.querySelector("span").replaceChildren(item.art.cloneNode(true));
    els.missing.hidden = !!photo;
    els.progress.querySelector("span").textContent = t("loading");
    els.progress.querySelector("progress").value = 0;
    modal.dataset.state = "photo";
    setMode("photo");
    if (!modal.open) modal.showModal();
    modal.querySelector(".xr-info").scrollTop = 0;
    document.documentElement.classList.add("xr-lock");
  }

  function arIsPresenting() {
    var status = current?.viewer?.getAttribute("ar-status");
    return status === "session-started" || status === "object-placed";
  }

  function releaseCurrent() {
    clearTimeout(current?.timeout);
    clearInterval(current?.capabilityCheck);
    current = null;
    els.model.replaceChildren();
  }

  function close() {
    if (!modal?.open || modal.dataset.closing || arIsPresenting()) return;
    function finish() {
      releaseCurrent();
      modal.close();
      delete modal.dataset.closing;
      document.documentElement.classList.remove("xr-lock");
      lastFocus?.focus({ preventScroll: true });
    }
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches && modal.animate) {
      modal.dataset.closing = "true";
      modal.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 155, easing: "ease-in" }).finished.then(finish, finish);
    } else {
      finish();
    }
  }

  function thumb(slug, art) {
    var media = displayMedia(slug);
    var photo = media?.thumbnail || media?.photo;
    var illustrative = media?.photoAuthenticity === "generated-representative";
    return '<span class="xr-thumb">' +
      '<span class="xr-thumb__art" aria-hidden="true">' + art + '</span>' +
      (photo ? '<img src="' + esc(photo) + '" alt="" width="192" height="192" loading="lazy" decoding="async" />' : "") +
      (illustrative ? '<span class="xr-thumb__note">' + t("artwork") + '</span>' : "") +
      (modelFor(slug) ? '<span class="xr-thumb__badge">' + CUBE + '3D</span>' : "") + "</span>";
  }

  function itemFromCard(card) {
    var text = function (className) { return card.querySelector(className)?.textContent || ""; };
    return {
      slug: card.dataset.slug,
      kicker: card.dataset.kicker,
      tag: card.dataset.tag,
      ingredients: card.dataset.ingredients,
      name: text(".catalogue-card__name"),
      desc: text(".catalogue-card__description"),
      price: text(".catalogue-card__price"),
      art: card.querySelector(".xr-thumb__art svg"),
    };
  }

  function open(card) {
    var cards = Array.from(card.closest(".catalogue-grid").querySelectorAll(".catalogue-card"));
    show(itemFromCard(card), { cards: cards, index: cards.indexOf(card) });
  }

  window.IlChioscoViewer = { open: open, thumb: thumb };
})();
