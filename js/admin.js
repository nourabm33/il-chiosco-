/* ============================================================
   Il Chiosco — staff dashboard: live orders, table occupancy,
   printable QR codes.
   ============================================================ */
(function () {
  "use strict";

  var API = "/api/admin";
  var TOKEN_KEY = "ilChioscoStaffToken";
  var token = window.localStorage.getItem(TOKEN_KEY) || "";
  var timer = null;
  var view = "orders";

  var el = function (id) { return document.getElementById(id); };
  var money = function (cents) { return (cents / 100).toFixed(2).replace(".", ",") + " €"; };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function api(path, options) {
    var opts = options || {};
    opts.headers = Object.assign({ Authorization: "Bearer " + token }, opts.headers || {});
    return fetch(API + path, opts).then(function (res) {
      if (res.status === 401) {
        logout();
        throw new Error("Token non valido");
      }
      if (opts.raw) return res.blob();
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error((body.error && body.error.message) || "Errore");
        return body;
      });
    });
  }

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
  var POS_PILL = { sent: "pill--ok", failed: "pill--bad", pending: "pill--warn", skipped: "" };

  /* ---------------- orders ---------------- */
  function renderOrders(orders) {
    if (orders.length === 0) {
      el("ordersList").innerHTML = "<p class=\"order-lead\">Nessun ordine.</p>";
      return;
    }
    el("ordersList").innerHTML = orders.map(orderCard).join("");
  }

  function orderCard(order) {
    var time = new Date(order.createdAt).toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
    var lines = order.items
      .map(function (item) {
        return (
          "<div><span>" + item.quantity + "× " + escapeHtml(item.name) +
          (item.notes ? " <em>(" + escapeHtml(item.notes) + ")</em>" : "") +
          "</span><span>" + money(item.lineTotalCents) + "</span></div>"
        );
      })
      .join("");
    var actions = (NEXT_STATUS[order.status] || [])
      .map(function (status) {
        return (
          '<button data-order="' + order.id + '" data-status="' + status + '">' +
          STATUS_LABELS[status] + "</button>"
        );
      })
      .join("");
    if (order.posStatus === "failed") {
      actions += '<button data-retry="' + order.id + '">Reinvia a cassa</button>';
    }

    return (
      '<article class="order-card" data-status="' + order.status + '">' +
      '  <div class="order-card__head">' +
      '    <span class="order-card__table">Tavolo ' + order.tableNumber + "</span>" +
      '    <span class="order-card__code">' + escapeHtml(order.orderCode) + "</span>" +
      "  </div>" +
      '  <div class="order-card__meta">' +
      '    <span class="pill">' + STATUS_LABELS[order.status] + "</span>" +
      '    <span class="pill ' + (POS_PILL[order.posStatus] || "") + '">Cassa: ' + order.posStatus + "</span>" +
      "    <span>" + time + "</span>" +
      "  </div>" +
      '  <div class="order-card__lines">' + lines + "</div>" +
      (order.notes ? '<div class="order-card__note">' + escapeHtml(order.notes) + "</div>" : "") +
      '  <div class="order-card__head"><span>Totale</span><strong>' + money(order.totalCents) + "</strong></div>" +
      '  <div class="order-card__actions">' + actions + "</div>" +
      "</article>"
    );
  }

  /* ---------------- tables ---------------- */
  function renderTables(tables) {
    el("tablesGrid").innerHTML = tables
      .map(function (table) {
        return (
          '<div class="table-card' + (table.occupied ? " table-card--occupied" : "") + '">' +
          '  <div class="table-card__num">' + table.tableNumber + "</div>" +
          '  <div class="table-card__meta">' +
          (table.occupied
            ? table.openOrders + " ordini · " + money(table.openTotalCents)
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
          '<div class="qr-card"><img alt="QR tavolo ' + table.tableNumber +
          '" data-qr="' + table.tableNumber + '" />' +
          "<div>Tavolo " + table.tableNumber + "</div>" +
          '<a href="' + escapeHtml(table.orderUrl) + '" target="_blank" rel="noopener">apri link</a></div>'
        );
      })
      .join("");
    // The QR endpoint is token-protected, so images are fetched, not <img src>'d.
    el("qrGrid")
      .querySelectorAll("img[data-qr]")
      .forEach(function (img) {
        api("/tables/" + img.dataset.qr + "/qr.png", { raw: true })
          .then(function (blob) { img.src = URL.createObjectURL(blob); })
          .catch(function () {});
      });
  }

  /* ---------------- refresh loop ---------------- */
  function refresh() {
    var status = el("onlyOpen").checked ? "open" : "";
    var requests = [api("/orders" + (status ? "?status=open" : "")), api("/tables"), api("/pos/status")];
    return Promise.all(requests)
      .then(function (results) {
        renderOrders(results[0].orders);
        renderTables(results[1].tables);
        if (view === "qr") renderQr(results[1].tables);
        el("posStatus").textContent =
          "Cassa: " + results[2].driver + (results[2].configured ? "" : " (non configurata)");
        el("refreshedAt").textContent =
          "Aggiornato " + new Date().toLocaleTimeString("it-IT");
      })
      .catch(function () {});
  }

  function startLoop() {
    refresh();
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      if (!document.hidden) refresh();
    }, 10000);
  }

  /* ---------------- auth ---------------- */
  function login() {
    token = el("tokenInput").value.trim();
    if (!token) return;
    api("/tables")
      .then(function () {
        window.localStorage.setItem(TOKEN_KEY, token);
        showDashboard();
      })
      .catch(function (err) {
        el("loginError").textContent = err.message;
        el("loginError").hidden = false;
      });
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    token = "";
    if (timer) clearInterval(timer);
    el("dashboard").hidden = true;
    el("logoutBtn").hidden = true;
    el("loginScreen").hidden = false;
  }

  function showDashboard() {
    el("loginScreen").hidden = true;
    el("dashboard").hidden = false;
    el("logoutBtn").hidden = false;
    startLoop();
  }

  /* ---------------- wiring ---------------- */
  el("loginBtn").addEventListener("click", login);
  el("tokenInput").addEventListener("keydown", function (event) {
    if (event.key === "Enter") login();
  });
  el("logoutBtn").addEventListener("click", logout);
  el("onlyOpen").addEventListener("change", refresh);

  document.querySelector(".admin-tabs").addEventListener("click", function (event) {
    var tab = event.target.closest("[data-view]");
    if (!tab) return;
    view = tab.dataset.view;
    document.querySelectorAll(".admin-tabs .menu-tab").forEach(function (node) {
      node.classList.toggle("active", node === tab);
    });
    el("viewOrders").hidden = view !== "orders";
    el("viewTables").hidden = view !== "tables";
    el("viewQr").hidden = view !== "qr";
    refresh();
  });

  el("ordersList").addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button) return;
    button.disabled = true;
    var request = button.dataset.retry
      ? api("/pos/orders/" + button.dataset.retry + "/retry", { method: "POST" })
      : api("/orders/" + button.dataset.order + "/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: button.dataset.status }),
        });
    request.then(refresh).catch(function () { button.disabled = false; });
  });

  if (token) showDashboard();
})();
