/* ============================================================
   Il Chiosco — table ordering (customer side)
   Flow: QR (?table=N) or camera scan → menu from the API → cart
         → order → live status.
   ============================================================ */
(function () {
  "use strict";

  var API = "/api";
  var state = { table: null, menu: [], cart: {}, order: null, poll: null };

  var el = function (id) { return document.getElementById(id); };
  var money = function (cents) {
    return (cents / 100).toFixed(2).replace(".", ",") + " €";
  };

  function show(screenId) {
    ["screenScan", "screenMenu", "screenReview", "screenDone"].forEach(function (id) {
      el(id).hidden = id !== screenId;
    });
    window.scrollTo(0, 0);
  }

  function fail(node, message) {
    node.textContent = message;
    node.hidden = !message;
  }

  function api(path, options) {
    return fetch(API + path, options).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error((body.error && body.error.message) || "Errore di rete");
        return body;
      });
    });
  }

  /* ---------------- table detection ---------------- */
  function tableFromUrl() {
    var value = new URLSearchParams(window.location.search).get("table");
    var number = parseInt(value, 10);
    return Number.isInteger(number) && number > 0 ? number : null;
  }

  /** Accepts both a bare number and a full /order?table=N URL from the QR. */
  function tableFromScan(text) {
    if (!text) return null;
    var direct = text.match(/[?&]table=(\d+)/);
    if (direct) return parseInt(direct[1], 10);
    if (/^\d{1,3}$/.test(text.trim())) return parseInt(text.trim(), 10);
    return null;
  }

  function useTable(number) {
    return api("/tables/" + number).then(function (table) {
      state.table = table.tableNumber;
      var badge = el("tableBadge");
      badge.textContent = "Tavolo " + table.tableNumber;
      badge.hidden = false;
      stopScanner();
      return loadMenu();
    });
  }

  /* ---------------- camera scanning ---------------- */
  var scan = { stream: null, raf: null, detector: null };

  function stopScanner() {
    if (scan.raf) cancelAnimationFrame(scan.raf);
    scan.raf = null;
    if (scan.stream) scan.stream.getTracks().forEach(function (t) { t.stop(); });
    scan.stream = null;
    el("scanner").hidden = true;
  }

  function startScanner() {
    fail(el("scanError"), "");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      fail(el("scanError"), "La fotocamera non è disponibile su questo dispositivo. Inserisci il numero del tavolo qui sotto.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } } })
      .then(function (stream) {
        scan.stream = stream;
        var video = el("scanVideo");
        video.srcObject = stream;
        el("scanner").hidden = false;
        el("startScanBtn").textContent = "Inquadra il QR…";
        return video.play();
      })
      .then(function () {
        if (window.BarcodeDetector) {
          scan.detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        }
        tick();
      })
      .catch(function () {
        fail(el("scanError"), "Permesso fotocamera negato. Puoi inserire il numero del tavolo qui sotto.");
        stopScanner();
      });
  }

  function handleScanText(text) {
    var number = tableFromScan(text);
    if (!number) return false;
    useTable(number).catch(function (err) { fail(el("scanError"), err.message); });
    return true;
  }

  function tick() {
    var video = el("scanVideo");
    if (!scan.stream || video.readyState !== video.HAVE_ENOUGH_DATA) {
      scan.raf = requestAnimationFrame(tick);
      return;
    }
    if (scan.detector) {
      scan.detector
        .detect(video)
        .then(function (codes) {
          if (!(codes.length && handleScanText(codes[0].rawValue))) {
            scan.raf = requestAnimationFrame(tick);
          }
        })
        .catch(function () {
          scan.detector = null;
          scan.raf = requestAnimationFrame(tick);
        });
      return;
    }
    // jsQR fallback for browsers without BarcodeDetector (notably iOS Safari).
    var canvas = el("scanCanvas");
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    var image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var found = window.jsQR ? window.jsQR(image.data, image.width, image.height) : null;
    if (!(found && handleScanText(found.data))) scan.raf = requestAnimationFrame(tick);
  }

  /* ---------------- menu ---------------- */
  function loadMenu() {
    show("screenMenu");
    return api("/menu").then(function (data) {
      state.menu = data.categories;
      renderTabs();
      renderMenu();
    });
  }

  var CATEGORY_LABELS = {
    bevande: "Bevande",
    dolce: "Dolce",
    salato: "Salato",
    cocktail: "Cocktail & Drinks",
  };

  function categories() {
    var list = [];
    state.menu.forEach(function (group) {
      if (list.indexOf(group.category) === -1) list.push(group.category);
    });
    return list;
  }

  var activeCategory = null;

  function renderTabs() {
    var list = categories();
    activeCategory = activeCategory || list[0];
    el("categoryTabs").innerHTML = list
      .map(function (category) {
        return (
          '<button class="menu-tab' + (category === activeCategory ? " active" : "") +
          '" data-category="' + category + '">' +
          (CATEGORY_LABELS[category] || category) + "</button>"
        );
      })
      .join("");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function renderMenu() {
    var html = state.menu
      .filter(function (group) { return group.category === activeCategory; })
      .map(function (group) {
        return (
          '<div class="menu-group">' +
          "<h3>" + escapeHtml(group.subcategory || CATEGORY_LABELS[group.category]) + "</h3>" +
          group.items.map(itemRow).join("") +
          "</div>"
        );
      })
      .join("");
    el("menuList").innerHTML = html || "<p class=\"order-lead\">Nessun prodotto disponibile.</p>";
  }

  function itemRow(item) {
    var quantity = state.cart[item.id] ? state.cart[item.id].quantity : 0;
    return (
      '<div class="order-item" data-id="' + item.id + '">' +
      '  <div class="order-item__info">' +
      '    <span class="order-item__name">' + escapeHtml(item.name) + "</span>" +
      (item.description ? '<span class="order-item__desc">' + escapeHtml(item.description) + "</span>" : "") +
      '    <span class="order-item__price">' + money(item.priceCents) + "</span>" +
      "  </div>" +
      '  <div class="qty">' +
      '    <button type="button" class="qty__btn" data-act="dec" aria-label="Rimuovi">−</button>' +
      '    <span class="qty__value">' + quantity + "</span>" +
      '    <button type="button" class="qty__btn" data-act="inc" aria-label="Aggiungi">+</button>' +
      "  </div>" +
      "</div>"
    );
  }

  /* ---------------- cart ---------------- */
  function findProduct(id) {
    for (var i = 0; i < state.menu.length; i += 1) {
      var items = state.menu[i].items;
      for (var j = 0; j < items.length; j += 1) {
        if (items[j].id === id) return items[j];
      }
    }
    return null;
  }

  function changeQty(id, delta) {
    var product = findProduct(id);
    if (!product) return;
    var entry = state.cart[id] || { product: product, quantity: 0 };
    entry.quantity = Math.max(0, Math.min(99, entry.quantity + delta));
    if (entry.quantity === 0) delete state.cart[id];
    else state.cart[id] = entry;
    renderMenu();
    renderCartBar();
  }

  function cartLines() {
    return Object.keys(state.cart).map(function (id) { return state.cart[id]; });
  }

  function cartTotal() {
    return cartLines().reduce(function (sum, line) {
      return sum + line.product.priceCents * line.quantity;
    }, 0);
  }

  function renderCartBar() {
    var lines = cartLines();
    var count = lines.reduce(function (sum, line) { return sum + line.quantity; }, 0);
    el("cartBar").hidden = count === 0;
    el("cartCount").textContent = count;
    el("cartTotal").textContent = money(cartTotal());
  }

  function renderReview() {
    el("reviewItems").innerHTML = cartLines()
      .map(function (line) {
        return (
          '<div class="review-row"><span>' + line.quantity + "× " +
          escapeHtml(line.product.name) + "</span><strong>" +
          money(line.product.priceCents * line.quantity) + "</strong></div>"
        );
      })
      .join("");
    el("reviewTotal").textContent = money(cartTotal());
  }

  /* ---------------- submit + status ---------------- */
  var STATUS_LABELS = {
    received: "Ricevuto",
    in_progress: "In preparazione",
    served: "Servito",
    paid: "Pagato",
    cancelled: "Annullato",
  };

  function submitOrder() {
    var button = el("submitBtn");
    button.disabled = true;
    fail(el("submitError"), "");

    var body = {
      tableNumber: state.table,
      notes: el("orderNotes").value.trim() || undefined,
      items: cartLines().map(function (line) {
        return { productId: line.product.id, quantity: line.quantity };
      }),
    };

    api("/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Protects against double-taps and flaky mobile connections.
        "Idempotency-Key": idempotencyKey(),
      },
      body: JSON.stringify(body),
    })
      .then(function (order) {
        state.order = order;
        state.cart = {};
        renderCartBar();
        renderDone(order);
        show("screenDone");
        startPolling(order.id);
      })
      .catch(function (err) { fail(el("submitError"), err.message); })
      .finally(function () { button.disabled = false; });
  }

  var currentKey = null;
  function idempotencyKey() {
    if (!currentKey) {
      currentKey =
        (window.crypto && window.crypto.randomUUID && window.crypto.randomUUID()) ||
        String(Date.now()) + Math.random().toString(16).slice(2);
    }
    return currentKey;
  }

  function renderDone(order) {
    el("doneCode").textContent = order.orderCode;
    el("doneTable").textContent = order.tableNumber;
    el("doneStatus").textContent = STATUS_LABELS[order.status] || order.status;
    el("doneTotal").textContent = money(order.totalCents);
    el("doneItems").innerHTML = order.items
      .map(function (item) {
        return (
          '<div class="review-row"><span>' + item.quantity + "× " +
          escapeHtml(item.name) + "</span><strong>" + money(item.lineTotalCents) + "</strong></div>"
        );
      })
      .join("");
  }

  function startPolling(orderId) {
    if (state.poll) clearInterval(state.poll);
    state.poll = setInterval(function () {
      if (document.hidden) return;
      api("/orders/" + orderId)
        .then(function (order) {
          el("doneStatus").textContent = STATUS_LABELS[order.status] || order.status;
          if (order.status === "paid" || order.status === "cancelled") {
            clearInterval(state.poll);
            state.poll = null;
          }
        })
        .catch(function () {});
    }, 15000);
  }

  /* ---------------- wiring ---------------- */
  el("startScanBtn").addEventListener("click", startScanner);
  el("manualBtn").addEventListener("click", function () {
    var number = parseInt(el("manualTable").value, 10);
    if (!Number.isInteger(number) || number <= 0) {
      fail(el("scanError"), "Inserisci un numero di tavolo valido.");
      return;
    }
    useTable(number).catch(function (err) { fail(el("scanError"), err.message); });
  });

  el("categoryTabs").addEventListener("click", function (event) {
    var tab = event.target.closest("[data-category]");
    if (!tab) return;
    activeCategory = tab.dataset.category;
    renderTabs();
    renderMenu();
  });

  el("menuList").addEventListener("click", function (event) {
    var button = event.target.closest(".qty__btn");
    if (!button) return;
    var row = button.closest(".order-item");
    changeQty(row.dataset.id, button.dataset.act === "inc" ? 1 : -1);
  });

  el("reviewBtn").addEventListener("click", function () {
    renderReview();
    show("screenReview");
  });
  el("cartToggle").addEventListener("click", function () {
    renderReview();
    show("screenReview");
  });
  el("backToMenu").addEventListener("click", function () { show("screenMenu"); });
  el("submitBtn").addEventListener("click", submitOrder);
  el("newOrderBtn").addEventListener("click", function () {
    currentKey = null;
    el("orderNotes").value = "";
    if (state.poll) clearInterval(state.poll);
    show("screenMenu");
    renderMenu();
  });

  var fromUrl = tableFromUrl();
  if (fromUrl) {
    useTable(fromUrl).catch(function (err) {
      show("screenScan");
      fail(el("scanError"), err.message);
    });
  } else {
    show("screenScan");
  }
})();
