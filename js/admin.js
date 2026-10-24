/* ============================================================
   Il Chiosco — staff dashboard: order queue, orders, tables,
   printable QR codes. The backend is the source of truth; the
   page refreshes on live server events (with a polling fallback).
   ============================================================ */
(function () {
  "use strict";

  var BASE = (window.IL_CHIOSCO_API || "") + "/api";
  var SESSION_KEY = "ilChioscoStaffSession";
  var session = readSession();
  var view = "queue";
  var queue = null;
  var clockOffset = 0;
  var pollTimer = null;
  var clockTimer = null;
  var stream = null;
  var refreshPending = null;

  var el = function (id) { return document.getElementById(id); };
  var money = function (cents) { return (cents / 100).toFixed(2).replace(".", ",") + " €"; };
  var isManager = function () { return session && session.user.role === "manager"; };
  var now = function () { return Date.now() + clockOffset; };

  function readSession() {
    try { return JSON.parse(window.localStorage.getItem(SESSION_KEY)) || null; } catch (e) { return null; }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function clock(iso) {
    return iso ? new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "—";
  }

  function duration(ms) {
    var total = Math.max(0, Math.round(ms / 1000));
    var minutes = Math.floor(total / 60);
    var seconds = total % 60;
    return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
  }

  function api(path, options) {
    var opts = options || {};
    opts.headers = Object.assign(
      { Authorization: "Bearer " + (session ? session.token : "") },
      opts.body ? { "Content-Type": "application/json" } : {},
      opts.headers || {},
    );
    return fetch(BASE + path, opts).then(function (res) {
      if (res.status === 401 && path !== "/auth/login") {
        logout(true);
        throw new Error("Sessione scaduta, accedi di nuovo");
      }
      if (opts.raw) return res.blob();
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error((body.error && body.error.message) || "Errore");
        return body;
      });
    });
  }

  /* ---------------- labels ---------------- */
  var STAGES = {
    draft: { label: "In inserimento", pill: "pill--yellow" },
    queued: { label: "In coda", pill: "pill--orange" },
    releasing: { label: "In rilascio…", pill: "pill--orange" },
    sent: { label: "Inviato alla cassa", pill: "pill--green" },
    simulated: { label: "Simulato · non inviato alla cassa", pill: "pill--sim" },
    failed: { label: "Invio fallito", pill: "pill--bad" },
    cancelled: { label: "Annullato", pill: "" },
  };
  var STATUS_LABELS = {
    received: "Ricevuto",
    in_progress: "In preparazione",
    served: "Servito",
    paid: "Pagato",
    cancelled: "Annullato",
  };
  var NEXT_STATUS = {
    received: ["in_progress", "cancelled"],
    in_progress: ["served", "cancelled"],
    served: ["paid"],
    paid: [],
    cancelled: [],
  };
  var MODES = {
    normal: { label: "Normale", help: "Normale: gli ordini confermati passano subito alla cassa." },
    busy: { label: "Busy", help: "Busy: un ordine alla volta, ogni intervallo impostato, in ordine di arrivo." },
    pause: { label: "Pausa", help: "Pausa: nessun ordine viene rilasciato finché non si riprende (salvo rilascio manuale)." },
  };

  function stagePill(order) {
    var stage = STAGES[order.stage] || { label: order.stage, pill: "" };
    return '<span class="pill ' + stage.pill + '">' + stage.label + "</span>";
  }

  function itemsText(order) {
    return order.items
      .map(function (item) { return item.quantity + "× " + escapeHtml(item.name); })
      .join(", ");
  }

  /* ---------------- queue ---------------- */
  function renderQueue(state) {
    queue = state;
    clockOffset = new Date(state.serverTime).getTime() - Date.now();
    el("simBanner").hidden = !state.pos.simulated;
    el("statWaiting").textContent = state.waiting;
    el("statMode").textContent = MODES[state.mode].label;
    el("modeHelp").textContent = MODES[state.mode].help;
    document.querySelectorAll(".mode-switch [data-mode]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.mode === state.mode);
    });
    if (document.activeElement !== el("intervalInput")) {
      el("intervalInput").value = state.busyIntervalSeconds / 60;
    }

    el("queueList").innerHTML = state.queued.length
      ? state.queued.map(queueRow).join("")
      : '<p class="order-lead">Nessun ordine in attesa.</p>';
    el("recentList").innerHTML = state.recent.length
      ? state.recent.map(recentRow).join("")
      : '<p class="order-lead">Ancora nessun ordine rilasciato.</p>';
    tickClock();
  }

  function queueRow(order) {
    return (
      '<article class="queue-row queue-row--queued">' +
      '  <span class="queue-row__pos">' + order.queuePosition + "</span>" +
      '  <div class="queue-row__body">' +
      '    <div class="queue-row__head"><strong>Tavolo ' + order.tableNumber + "</strong>" +
      '      <span class="order-card__code">' + escapeHtml(order.orderCode) + "</span>" +
      (order.confirmedBy ? '<span class="order-card__code">· ' + escapeHtml(order.confirmedBy) + "</span>" : "") +
      "    </div>" +
      '    <div class="queue-row__items">' + itemsText(order) + "</div>" +
      (order.notes ? '<div class="order-card__note">' + escapeHtml(order.notes) + "</div>" : "") +
      "  </div>" +
      '  <div class="queue-row__time">' +
      "    <span>Confermato " + clock(order.queuedAt) + "</span>" +
      '    <span>In coda da <strong data-since="' + order.queuedAt + '"></strong></span>' +
      "  </div>" +
      "</article>"
    );
  }

  function recentRow(order) {
    var retry =
      order.stage === "failed" && isManager()
        ? '<button class="btn btn--outline btn--sm" data-retry="' + order.id + '">Riprova invio</button>'
        : "";
    return (
      '<article class="queue-row queue-row--' + order.stage + '">' +
      '  <div class="queue-row__body">' +
      '    <div class="queue-row__head"><strong>Tavolo ' + order.tableNumber + "</strong>" +
      '      <span class="order-card__code">' + escapeHtml(order.orderCode) + "</span>" + stagePill(order) +
      "    </div>" +
      '    <div class="queue-row__items">' + itemsText(order) + "</div>" +
      (order.releaseError ? '<div class="queue-row__error">' + escapeHtml(order.releaseError) + "</div>" : "") +
      "  </div>" +
      '  <div class="queue-row__time"><span>Rilasciato ' + clock(order.releasedAt) + "</span>" + retry + "</div>" +
      "</article>"
    );
  }

  function tickClock() {
    document.querySelectorAll("[data-since]").forEach(function (node) {
      node.textContent = duration(now() - new Date(node.dataset.since).getTime());
    });
    if (!queue) return;
    var next = "—";
    if (queue.mode === "pause" && queue.waiting > 0) next = "in pausa";
    else if (queue.mode === "busy" && queue.nextReleaseAt) {
      var left = new Date(queue.nextReleaseAt).getTime() - now();
      next = left > 0 ? duration(left) : "ora";
    } else if (queue.waiting > 0) next = "ora";
    el("statNext").textContent = next;
  }

  function feedback(message, kind) {
    var node = el("queueFeedback");
    node.textContent = message;
    node.className = "queue-feedback" + (kind ? " queue-feedback--" + kind : "");
    node.hidden = !message;
  }

  function releaseFeedback(order) {
    if (order.stage === "sent") return feedback("Ordine " + order.orderCode + " (tavolo " + order.tableNumber + ") inviato alla cassa.", "ok");
    if (order.stage === "simulated") return feedback("Ordine " + order.orderCode + " (tavolo " + order.tableNumber + ") rilasciato in simulazione: non inviato alla cassa.", "sim");
    if (order.stage === "failed") return feedback("Invio dell'ordine " + order.orderCode + " fallito: " + (order.releaseError || ""), "bad");
    return feedback("Ordine " + order.orderCode + " in rilascio…", "");
  }

  function setMode(body) {
    feedback("", "");
    return api("/admin/queue/settings", { method: "PUT", body: JSON.stringify(body) })
      .then(function (state) {
        renderQueue(state);
        feedback("Impostazioni salvate: " + MODES[state.mode].label +
          (state.mode === "busy" ? ", un ordine ogni " + state.busyIntervalSeconds / 60 + " min" : "") + ".", "ok");
      })
      .catch(function (err) { feedback(err.message, "bad"); });
  }

  /* ---------------- orders ---------------- */
  function renderOrders(orders) {
    el("ordersList").innerHTML = orders.length
      ? orders.map(orderCard).join("")
      : '<p class="order-lead">Nessun ordine.</p>';
  }

  function orderCard(order) {
    var lines = order.items
      .map(function (item) {
        return (
          "<div><span>" + item.quantity + "× " + escapeHtml(item.name) +
          (item.notes ? " <em>(" + escapeHtml(item.notes) + ")</em>" : "") +
          "</span><span>" + money(item.lineTotalCents) + "</span></div>"
        );
      })
      .join("");
    var released = order.stage === "sent" || order.stage === "simulated";
    var actions = (released ? NEXT_STATUS[order.status] || [] : [])
      .map(function (status) {
        return '<button data-order="' + order.id + '" data-status="' + status + '">' + STATUS_LABELS[status] + "</button>";
      })
      .join("");
    if (order.stage === "failed" && isManager()) {
      actions += '<button data-retry="' + order.id + '">Riprova invio alla cassa</button>';
    }

    return (
      '<article class="order-card" data-stage="' + order.stage + '" data-status="' + order.status + '">' +
      '  <div class="order-card__head">' +
      '    <span class="order-card__table">Tavolo ' + order.tableNumber + "</span>" +
      '    <span class="order-card__code">' + escapeHtml(order.orderCode) + "</span>" +
      "  </div>" +
      '  <div class="order-card__meta">' + stagePill(order) +
      (released ? '<span class="pill">' + STATUS_LABELS[order.status] + "</span>" : "") +
      (order.queuePosition ? '<span class="pill pill--orange">#' + order.queuePosition + " in coda</span>" : "") +
      "    <span>" + clock(order.createdAt) + "</span>" +
      (order.createdBy ? "<span>" + escapeHtml(order.createdBy) + "</span>" : "") +
      "  </div>" +
      '  <div class="order-card__lines">' + (lines || "<em>Nessun prodotto</em>") + "</div>" +
      (order.notes ? '<div class="order-card__note">' + escapeHtml(order.notes) + "</div>" : "") +
      (order.releaseError ? '<div class="queue-row__error">' + escapeHtml(order.releaseError) + "</div>" : "") +
      '  <div class="order-card__head"><span>Totale</span><strong>' + money(order.totalCents) + "</strong></div>" +
      (actions ? '  <div class="order-card__actions">' + actions + "</div>" : "") +
      "</article>"
    );
  }

  /* ---------------- tables ---------------- */
  var TABLE_TEXT = {
    yellow: "In inserimento",
    orange: "In coda",
    green: "Inviato alla cassa",
    simulated: "Simulato",
    red: "Invio fallito",
  };

  function renderTables(tables) {
    el("tablesGrid").innerHTML = tables
      .map(function (table) {
        return (
          '<div class="table-card table-card--' + table.color + '">' +
          '  <div class="table-card__num">' + table.tableNumber + "</div>" +
          '  <div class="table-card__meta">' +
          (table.occupied
            ? TABLE_TEXT[table.color] + "<br>" + table.openOrders + " ordini · " + money(table.openTotalCents)
            : "Libero") +
          "  </div>" +
          "</div>"
        );
      })
      .join("");
  }

  var qrRendered = false;
  function renderQr(tables) {
    if (qrRendered) return;
    qrRendered = true;
    el("qrBase").textContent = tables.length ? tables[0].orderUrl.replace(/\/order.*$/, "") : "";
    el("qrGrid").innerHTML = tables
      .map(function (table) {
        return (
          '<div class="qr-card"><img alt="QR tavolo ' + table.tableNumber + '" data-qr="' + table.tableNumber + '" />' +
          "<div>Tavolo " + table.tableNumber + "</div>" +
          '<a href="' + escapeHtml(table.orderUrl) + '" target="_blank" rel="noopener">apri link</a></div>'
        );
      })
      .join("");
    // The QR endpoint needs a login, so images are fetched rather than <img src>'d.
    el("qrGrid").querySelectorAll("img[data-qr]").forEach(function (img) {
      api("/admin/tables/" + img.dataset.qr + "/qr.png", { raw: true })
        .then(function (blob) { img.src = URL.createObjectURL(blob); })
        .catch(function () {});
    });
  }

  /* ---------------- refresh + live updates ---------------- */
  function refresh() {
    if (!session) return Promise.resolve();
    var jobs = [api("/staff/queue").then(renderQueue)];
    if (view === "orders") {
      jobs.push(api("/staff/orders?scope=" + (el("onlyOpen").checked ? "open" : "all"))
        .then(function (data) { renderOrders(data.orders); }));
    }
    if (view === "tables") {
      jobs.push(api("/staff/tables").then(function (data) { renderTables(data.tables); }));
    }
    if (view === "qr") {
      jobs.push(api("/admin/tables").then(function (data) { renderQr(data.tables); }));
    }
    return Promise.all(jobs)
      .then(function () {
        el("refreshedAt").textContent = "Aggiornato " + new Date().toLocaleTimeString("it-IT");
      })
      .catch(function () {});
  }

  function scheduleRefresh() {
    if (refreshPending) return;
    refreshPending = setTimeout(function () {
      refreshPending = null;
      refresh();
    }, 250);
  }

  function setLive(ok) {
    var node = el("liveStatus");
    node.hidden = false;
    node.textContent = ok ? "● Live" : "● Riconnessione…";
    node.classList.toggle("admin-live--off", !ok);
  }

  /** SSE over fetch, because EventSource cannot send the Authorization header. */
  function connectStream() {
    if (!session || !window.ReadableStream) return;
    var controller = new AbortController();
    stream = controller;
    fetch(BASE + "/staff/events", {
      headers: { Authorization: "Bearer " + session.token },
      signal: controller.signal,
    })
      .then(function (res) {
        if (res.status === 401) return logout(true);
        if (!res.ok || !res.body) throw new Error("stream");
        setLive(true);
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = "";
        function read() {
          return reader.read().then(function (chunk) {
            if (chunk.done) throw new Error("closed");
            buffer += decoder.decode(chunk.value, { stream: true });
            var parts = buffer.split("\n\n");
            buffer = parts.pop();
            if (parts.some(function (part) { return /^data:/m.test(part); })) scheduleRefresh();
            return read();
          });
        }
        return read();
      })
      .catch(function () {
        if (stream !== controller) return;
        setLive(false);
        setTimeout(function () { if (stream === controller) connectStream(); }, 3000);
      });
  }

  function start() {
    refresh();
    connectStream();
    // Fallback in case the live stream is blocked by a proxy.
    pollTimer = setInterval(function () { if (!document.hidden) refresh(); }, 20000);
    clockTimer = setInterval(tickClock, 1000);
  }

  function stop() {
    if (stream) stream.abort();
    stream = null;
    clearInterval(pollTimer);
    clearInterval(clockTimer);
  }

  /* ---------------- auth ---------------- */
  function login(event) {
    event.preventDefault();
    el("loginError").hidden = true;
    el("loginBtn").disabled = true;
    api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: el("usernameInput").value, password: el("passwordInput").value }),
    })
      .then(function (result) {
        session = { token: result.token, user: result.user };
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        el("passwordInput").value = "";
        showDashboard();
      })
      .catch(function (err) {
        el("loginError").textContent = err.message;
        el("loginError").hidden = false;
      })
      .finally(function () { el("loginBtn").disabled = false; });
  }

  function logout(expired) {
    if (!expired && session) api("/auth/logout", { method: "POST" }).catch(function () {});
    window.localStorage.removeItem(SESSION_KEY);
    session = null;
    stop();
    el("dashboard").hidden = true;
    el("logoutBtn").hidden = true;
    el("liveStatus").hidden = true;
    el("userName").textContent = "";
    el("loginScreen").hidden = false;
    if (expired === true) {
      el("loginError").textContent = "Sessione scaduta, accedi di nuovo.";
      el("loginError").hidden = false;
    }
  }

  function showDashboard() {
    var manager = isManager();
    el("loginScreen").hidden = true;
    el("dashboard").hidden = false;
    el("logoutBtn").hidden = false;
    el("userName").textContent = session.user.displayName + (manager ? " · responsabile" : " · cameriere");
    el("queueControls").hidden = !manager;
    el("queueReadonly").hidden = manager;
    document.querySelectorAll("[data-manager]").forEach(function (node) { node.hidden = !manager; });
    start();
  }

  /* ---------------- wiring ---------------- */
  el("loginForm").addEventListener("submit", login);
  el("logoutBtn").addEventListener("click", function () { logout(false); });
  el("onlyOpen").addEventListener("change", refresh);

  document.querySelector(".admin-tabs").addEventListener("click", function (event) {
    var tab = event.target.closest("[data-view]");
    if (!tab) return;
    view = tab.dataset.view;
    document.querySelectorAll(".admin-tabs .menu-tab").forEach(function (node) {
      node.classList.toggle("active", node === tab);
    });
    ["queue", "orders", "tables", "qr"].forEach(function (name) {
      el("view" + name.charAt(0).toUpperCase() + name.slice(1)).hidden = view !== name;
    });
    refresh();
  });

  document.querySelector(".mode-switch").addEventListener("click", function (event) {
    var button = event.target.closest("[data-mode]");
    if (button) setMode({ mode: button.dataset.mode });
  });

  el("intervalSave").addEventListener("click", function () {
    var minutes = parseFloat(String(el("intervalInput").value).replace(",", "."));
    if (!(minutes >= 0.5 && minutes <= 30)) return feedback("Intervallo tra 0,5 e 30 minuti.", "bad");
    setMode({ busyIntervalSeconds: Math.round(minutes * 60) });
  });

  el("releaseNextBtn").addEventListener("click", function () {
    var button = el("releaseNextBtn");
    button.disabled = true;
    feedback("", "");
    api("/admin/queue/release-next", { method: "POST" })
      .then(function (result) {
        renderQueue(result.queue);
        releaseFeedback(result.order);
      })
      .catch(function (err) { feedback(err.message, "bad"); })
      .finally(function () { button.disabled = false; });
  });

  function handleAction(event) {
    var button = event.target.closest("button[data-retry], button[data-status]");
    if (!button) return;
    button.disabled = true;
    var request = button.dataset.retry
      ? api("/admin/orders/" + button.dataset.retry + "/retry", { method: "POST" }).then(releaseFeedback)
      : api("/staff/orders/" + button.dataset.order + "/status", {
          method: "PATCH",
          body: JSON.stringify({ status: button.dataset.status }),
        });
    request.then(refresh).catch(function (err) {
      feedback(err.message, "bad");
      button.disabled = false;
    });
  }
  el("ordersList").addEventListener("click", handleAction);
  el("recentList").addEventListener("click", handleAction);

  if (session) showDashboard();
})();
