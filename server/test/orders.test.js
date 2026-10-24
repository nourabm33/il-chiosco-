/**
 * Integration tests — require a running Postgres.
 *
 *   docker compose up -d db
 *   export DATABASE_URL=postgres://postgres:postgres@localhost:5433/ilchiosco
 *   npm run migrate && npm run seed && npm test
 */
import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { pool, query } from "../src/lib/db.js";
import { upsertStaffUser } from "../src/lib/auth.js";
import { stopEvents } from "../src/lib/events.js";
import { drainOutbox } from "../src/pos/outbox-worker.js";
import { registerPosAdapter, resetPosAdapter } from "../src/pos/index.js";
import { PosAdapter } from "../src/pos/adapter.js";
import { config } from "../src/config.js";
import { releaseNext, tick } from "../src/services/queue.js";

const app = createApp();
const PASSWORD = "test-password-123";
let waiterToken;
let managerToken;
let productIds;

const as = (token) => ({
  get: (url) => request(app).get(url).set("Authorization", `Bearer ${token}`),
  post: (url, body) =>
    request(app).post(url).set("Authorization", `Bearer ${token}`).send(body ?? {}),
  put: (url, body) => request(app).put(url).set("Authorization", `Bearer ${token}`).send(body),
  patch: (url, body) =>
    request(app).patch(url).set("Authorization", `Bearer ${token}`).send(body),
});
const waiter = () => as(waiterToken);
const manager = () => as(managerToken);

const setMode = (mode, busyIntervalSeconds) =>
  manager().put("/api/admin/queue/settings", { mode, busyIntervalSeconds }).expect(200);

async function confirmedOrder(tableNumber, quantity = 1) {
  const draft = await waiter()
    .post("/api/staff/orders", { tableNumber, items: [{ productId: productIds[0], quantity }] })
    .expect(201);
  const confirmed = await waiter().post(`/api/staff/orders/${draft.body.id}/confirm`).expect(200);
  return confirmed.body;
}

async function clearOrders() {
  await query("DELETE FROM orders");
  await query("UPDATE queue_settings SET last_release_at = NULL");
}

function useAdapter(name, sendOrder) {
  class TestAdapter extends PosAdapter {
    get name() {
      return name;
    }
    async sendOrder(payload) {
      return sendOrder(payload);
    }
  }
  registerPosAdapter(name, TestAdapter);
  config.pos.driver = name;
  resetPosAdapter();
}

function useSimulation() {
  config.pos.driver = "simulation";
  resetPosAdapter();
}

before(async () => {
  await clearOrders();
  const { rows } = await query("SELECT id FROM products WHERE is_available LIMIT 3");
  assert.equal(rows.length, 3, "seed the database first: npm run migrate && npm run seed");
  productIds = rows.map((row) => row.id);

  await query("DELETE FROM staff_users WHERE username LIKE 'test-%'");
  await upsertStaffUser({ username: "test-waiter", displayName: "Test Waiter", role: "waiter", password: PASSWORD });
  await upsertStaffUser({ username: "test-manager", displayName: "Test Manager", role: "manager", password: PASSWORD });
  const login = (username) =>
    request(app).post("/api/auth/login").send({ username, password: PASSWORD }).expect(200);
  waiterToken = (await login("test-waiter")).body.token;
  managerToken = (await login("test-manager")).body.token;
  useSimulation();
});

after(async () => {
  await clearOrders();
  await query("UPDATE queue_settings SET mode = 'normal', updated_by = NULL");
  await query("DELETE FROM staff_users WHERE username LIKE 'test-%'");
  await stopEvents();
  await pool.end();
});

test("the public menu and table lookup still work", async () => {
  const res = await request(app).get("/api/menu").expect(200);
  assert.ok(res.body.count > 0);
  assert.ok(res.body.categories[0].items[0].priceCents > 0);
  await request(app).get("/api/tables/1").expect(200);
  await request(app).get("/api/tables/999").expect(404);
});

test("customers can no longer submit orders", async () => {
  const res = await request(app)
    .post("/api/orders")
    .send({ tableNumber: 1, items: [{ productId: productIds[0], quantity: 1 }] })
    .expect(410);
  assert.match(res.body.error.message, /cameriere/);
  const { rows } = await query("SELECT COUNT(*)::int AS n FROM orders");
  assert.equal(rows[0].n, 0);
});

test("staff APIs require a login and managers-only controls reject waiters", async () => {
  await request(app).get("/api/staff/orders").expect(401);
  await request(app).get("/api/staff/orders").set("Authorization", "Bearer nope").expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ username: "test-waiter", password: "wrong-password" })
    .expect(401);

  await waiter().get("/api/staff/queue").expect(200);
  await waiter().get("/api/admin/orders").expect(403);
  await waiter().put("/api/admin/queue/settings", { mode: "pause" }).expect(403);
  await waiter().post("/api/admin/queue/release-next").expect(403);

  const me = await waiter().get("/api/auth/me").expect(200);
  assert.equal(me.body.user.role, "waiter");
});

test("logging out invalidates the session", async () => {
  const { body } = await request(app)
    .post("/api/auth/login")
    .send({ username: "test-waiter", password: PASSWORD })
    .expect(200);
  await as(body.token).post("/api/auth/logout").expect(200);
  await as(body.token).get("/api/auth/me").expect(401);
});

test("a waiter opens (yellow), edits and confirms an order; Normal mode releases it at once", async () => {
  await clearOrders();
  await setMode("normal");

  const draft = await waiter()
    .post("/api/staff/orders", { tableNumber: 4, items: [] })
    .expect(201);
  assert.equal(draft.body.stage, "draft");
  assert.equal(draft.body.createdBy, "Test Waiter");

  let tables = await waiter().get("/api/staff/tables").expect(200);
  assert.equal(tables.body.tables.find((t) => t.tableNumber === 4).color, "yellow");

  // nothing to confirm yet
  await waiter().post(`/api/staff/orders/${draft.body.id}/confirm`).expect(400);

  const edited = await waiter()
    .put(`/api/staff/orders/${draft.body.id}`, {
      items: [{ productId: productIds[0], quantity: 2 }],
      notes: "senza ghiaccio",
    })
    .expect(200);
  assert.equal(edited.body.items[0].quantity, 2);
  assert.equal(edited.body.totalCents, edited.body.items[0].lineTotalCents);

  const confirmed = await waiter().post(`/api/staff/orders/${draft.body.id}/confirm`).expect(200);
  // POS_DRIVER=simulation: released, but never reported as sent to the till
  assert.equal(confirmed.body.stage, "simulated");
  assert.equal(confirmed.body.posStatus, "skipped");
  assert.notEqual(confirmed.body.stage, "sent");

  tables = await waiter().get("/api/staff/tables").expect(200);
  assert.equal(tables.body.tables.find((t) => t.tableNumber === 4).color, "simulated");

  // released orders cannot be edited or confirmed again
  await waiter()
    .put(`/api/staff/orders/${draft.body.id}`, { items: [{ productId: productIds[1], quantity: 1 }] })
    .expect(409);
  await waiter().post(`/api/staff/orders/${draft.body.id}/confirm`).expect(409);
});

test("Pause holds a FIFO queue; the manager releases the oldest order early", async () => {
  await clearOrders();
  await setMode("pause");

  const a = await confirmedOrder(1);
  const b = await confirmedOrder(2);
  const c = await confirmedOrder(3);
  assert.deepEqual([a.stage, b.stage, c.stage], ["queued", "queued", "queued"]);

  let queue = await waiter().get("/api/staff/queue").expect(200);
  assert.equal(queue.body.mode, "pause");
  assert.equal(queue.body.waiting, 3);
  assert.deepEqual(queue.body.queued.map((o) => o.id), [a.id, b.id, c.id]);
  assert.deepEqual(queue.body.queued.map((o) => o.queuePosition), [1, 2, 3]);
  assert.equal(queue.body.pos.simulated, true);

  const tables = await waiter().get("/api/staff/tables").expect(200);
  assert.equal(tables.body.tables.find((t) => t.tableNumber === 1).color, "orange");

  assert.equal(await tick(), 0, "paused queue must not release");

  const released = await manager().post("/api/admin/queue/release-next").expect(200);
  assert.equal(released.body.order.id, a.id);
  assert.equal(released.body.order.stage, "simulated");
  assert.equal(released.body.queue.waiting, 2);
  assert.equal(released.body.queue.queued[0].queuePosition, 1);

  // Resume (Normal) drains the rest in order
  queue = await setMode("normal");
  assert.equal(queue.body.waiting, 0);
  const { rows } = await query(
    "SELECT id FROM orders WHERE stage = 'simulated' ORDER BY released_at, queue_seq",
  );
  assert.deepEqual(rows.map((r) => r.id), [a.id, b.id, c.id]);
});

test("a queued order can be reopened for editing or cancelled", async () => {
  await clearOrders();
  await setMode("pause");
  const a = await confirmedOrder(5);
  const b = await confirmedOrder(6);

  const reopened = await waiter().post(`/api/staff/orders/${a.id}/reopen`).expect(200);
  assert.equal(reopened.body.stage, "draft");
  assert.equal(reopened.body.queuePosition, null);
  const cancelled = await waiter().post(`/api/staff/orders/${b.id}/cancel`).expect(200);
  assert.equal(cancelled.body.stage, "cancelled");
  await waiter().post(`/api/staff/orders/${b.id}/reopen`).expect(409);

  const queue = await waiter().get("/api/staff/queue").expect(200);
  assert.equal(queue.body.waiting, 0);
});

test("Busy mode releases one order per interval, timed by the database clock", async () => {
  await clearOrders();
  await setMode("pause", 60);
  await confirmedOrder(7);
  await confirmedOrder(8);

  const state = await setMode("busy");
  assert.equal(state.body.busyIntervalSeconds, 60);
  assert.equal(state.body.waiting, 1, "the first order goes out immediately");
  assert.ok(state.body.nextReleaseAt);

  assert.equal(await tick(), 0, "interval not elapsed yet");

  await query("UPDATE queue_settings SET last_release_at = now() - interval '61 seconds'");
  assert.equal(await tick(), 1);
  const queue = await waiter().get("/api/staff/queue").expect(200);
  assert.equal(queue.body.waiting, 0);
  assert.equal(queue.body.nextReleaseAt, null);
});

test("concurrent releases from many devices never release an order twice", async () => {
  await clearOrders();
  await setMode("pause");
  const ids = [];
  for (const table of [10, 11, 12]) ids.push((await confirmedOrder(table)).id);

  const results = await Promise.all(
    Array.from({ length: 12 }, () => releaseNext({ force: true })),
  );
  const released = results.filter(Boolean);
  assert.equal(released.length, 3);
  assert.deepEqual([...new Set(released)].sort(), [...ids].sort());

  const outbox = await query("SELECT order_id FROM pos_outbox WHERE order_id = ANY($1)", [ids]);
  assert.equal(outbox.rowCount, 3);
  await drainOutbox();
});

test("the same external reference or Idempotency-Key never creates two orders", async () => {
  await clearOrders();
  await setMode("pause");
  const body = {
    tableNumber: 14,
    externalRef: "waiter-app-123",
    items: [{ productId: productIds[0], quantity: 1 }],
    confirm: true,
  };
  const results = await Promise.all([1, 2, 3].map(() => waiter().post("/api/staff/orders", body)));
  assert.deepEqual(results.map((r) => r.status), [201, 201, 201]);
  assert.equal(new Set(results.map((r) => r.body.id)).size, 1);
  assert.equal(results[0].body.source, "integration");

  const send = () =>
    waiter()
      .post("/api/staff/orders", { tableNumber: 15, items: [] })
      .set("Idempotency-Key", "tablet-key-1");
  assert.equal((await send()).body.id, (await send()).body.id);

  const queue = await waiter().get("/api/staff/queue").expect(200);
  assert.equal(queue.body.waiting, 1);
});

test("a failed POS release is shown as failed and can be retried exactly once", async () => {
  await clearOrders();
  await setMode("pause");
  const order = await confirmedOrder(9);

  useAdapter("flaky", () => {
    const err = new Error("POS rejected the order");
    err.permanent = true;
    throw err;
  });
  const failed = await manager().post("/api/admin/queue/release-next").expect(200);
  assert.equal(failed.body.order.stage, "failed");
  assert.match(failed.body.order.releaseError, /rejected/);
  assert.equal(failed.body.queue.failed, 1);

  let sends = 0;
  useAdapter("ok", () => {
    sends += 1;
    return { posOrderId: "pos-123" };
  });
  const retried = await manager().post(`/api/admin/orders/${order.id}/retry`).expect(200);
  assert.equal(retried.body.stage, "sent");
  assert.equal(retried.body.posOrderId, "pos-123");
  await manager().post(`/api/admin/orders/${order.id}/retry`).expect(409);
  await drainOutbox();
  assert.equal(sends, 1);

  const events = await query(
    "SELECT to_value FROM order_events WHERE order_id = $1 AND kind = 'stage' ORDER BY id",
    [order.id],
  );
  assert.deepEqual(
    events.rows.map((r) => r.to_value),
    ["draft", "queued", "releasing", "failed", "releasing", "sent"],
  );
  useSimulation();
});

test("service status transitions are validated on the server", async () => {
  await clearOrders();
  await setMode("normal");
  const order = await confirmedOrder(16);
  const path = `/api/staff/orders/${order.id}/status`;

  await waiter().patch(path, { status: "paid" }).expect(409);
  await waiter().patch(path, { status: "in_progress" }).expect(200);
  await waiter().patch(path, { status: "received" }).expect(409);
  await waiter().patch(path, { status: "served" }).expect(200);
  const paid = await waiter().patch(path, { status: "paid" }).expect(200);
  assert.equal(paid.body.status, "paid");

  await setMode("pause");
  const queued = await confirmedOrder(17);
  await waiter()
    .patch(`/api/staff/orders/${queued.id}/status`, { status: "in_progress" })
    .expect(409);
  await waiter().get("/api/staff/orders/not-a-uuid").expect(400);
});

test("staff screens receive live change events", async () => {
  await clearOrders();
  await setMode("pause");
  const server = app.listen(0);
  const { port } = server.address();
  const controller = new AbortController();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/staff/events`, {
      headers: { Authorization: `Bearer ${waiterToken}` },
      signal: controller.signal,
    });
    assert.equal(res.status, 200);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const waitFor = async (pattern) => {
      while (!pattern.test(buffer)) {
        const { value, done } = await reader.read();
        if (done) throw new Error("stream closed");
        buffer += decoder.decode(value);
      }
    };
    await waitFor(/"hello"/);
    const order = await confirmedOrder(18);
    await waitFor(new RegExp(order.id));
  } finally {
    controller.abort();
    server.close();
  }

  await request(app).get("/api/staff/events").expect(401);
});

test("CORS only allows the configured origins", async () => {
  config.corsOrigins.push("https://nourabm33.github.io");
  const allowed = await request(app)
    .options("/api/auth/login")
    .set("Origin", "https://nourabm33.github.io")
    .expect(204);
  assert.equal(allowed.headers["access-control-allow-origin"], "https://nourabm33.github.io");
  const denied = await request(app).options("/api/auth/login").set("Origin", "https://evil.example");
  assert.equal(denied.headers["access-control-allow-origin"], undefined);
  config.corsOrigins.pop();
});

test("manager table board keeps QR links", async () => {
  const tables = await manager().get("/api/admin/tables").expect(200);
  assert.ok(tables.body.tables[0].orderUrl.endsWith("/order?table=1"));
  const res = await manager().get("/api/admin/tables/5/qr.png").expect(200);
  assert.equal(res.headers["content-type"], "image/png");
});
