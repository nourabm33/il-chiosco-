/**
 * Integration tests — require a running Postgres.
 *
 *   docker compose up -d db
 *   DATABASE_URL=postgres://postgres:postgres@localhost:5433/ilchiosco \
 *   ADMIN_TOKEN=test-token npm test
 */
import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { pool, query } from "../src/lib/db.js";
import { drainOutbox } from "../src/pos/outbox-worker.js";
import { registerPosAdapter, resetPosAdapter } from "../src/pos/index.js";
import { PosAdapter } from "../src/pos/adapter.js";
import { config } from "../src/config.js";

const app = createApp();
const admin = (req) => req.set("Authorization", `Bearer ${config.adminToken}`);

let productId;

before(async () => {
  await query("DELETE FROM orders");
  const { rows } = await query("SELECT id FROM products WHERE is_available LIMIT 1");
  assert.ok(rows[0], "seed the database first: npm run migrate && npm run seed");
  productId = rows[0].id;
});

after(async () => {
  await pool.end();
});

test("GET /api/menu returns products from the database", async () => {
  const res = await request(app).get("/api/menu").expect(200);
  assert.ok(res.body.count > 0);
  assert.ok(res.body.categories[0].items[0].priceCents > 0);
});

test("GET /api/tables/:number validates the table", async () => {
  await request(app).get("/api/tables/1").expect(200);
  await request(app).get("/api/tables/999").expect(404);
});

test("POST /api/orders prices the order server-side and queues it for the POS", async () => {
  const res = await request(app)
    .post("/api/orders")
    .send({ tableNumber: 7, items: [{ productId, quantity: 2 }], notes: "senza ghiaccio" })
    .expect(201);

  assert.equal(res.body.tableNumber, 7);
  assert.equal(res.body.status, "received");
  assert.equal(res.body.posStatus, "pending");
  assert.equal(res.body.items[0].quantity, 2);
  assert.equal(res.body.totalCents, res.body.items[0].lineTotalCents);
  assert.match(res.body.orderCode, /^IC-\d{4}-\d{4}$/);

  const outbox = await query("SELECT status FROM pos_outbox WHERE order_id = $1", [res.body.id]);
  assert.equal(outbox.rows[0].status, "pending");
});

test("POST /api/orders rejects invalid payloads and unknown tables", async () => {
  await request(app).post("/api/orders").send({ tableNumber: 1, items: [] }).expect(400);
  await request(app)
    .post("/api/orders")
    .send({ tableNumber: 999, items: [{ productId, quantity: 1 }] })
    .expect(404);
});

test("the same Idempotency-Key never creates two orders", async () => {
  const send = () =>
    request(app)
      .post("/api/orders")
      .set("Idempotency-Key", "test-key-1")
      .send({ tableNumber: 3, items: [{ productId, quantity: 1 }] });

  const first = await send();
  const second = await send();
  assert.equal(first.body.id, second.body.id);
});

test("admin API requires the staff token", async () => {
  await request(app).get("/api/admin/orders").expect(401);
  await admin(request(app).get("/api/admin/orders")).expect(200);
});

test("admin can advance an order and see table occupancy", async () => {
  const created = await request(app)
    .post("/api/orders")
    .send({ tableNumber: 12, items: [{ productId, quantity: 1 }] })
    .expect(201);

  const updated = await admin(
    request(app).patch(`/api/admin/orders/${created.body.id}/status`).send({ status: "in_progress" }),
  ).expect(200);
  assert.equal(updated.body.status, "in_progress");

  const tables = await admin(request(app).get("/api/admin/tables")).expect(200);
  const table12 = tables.body.tables.find((t) => t.tableNumber === 12);
  assert.equal(table12.occupied, true);
  assert.ok(table12.orderUrl.endsWith("/order?table=12"));
});

test("admin QR endpoint returns a PNG", async () => {
  const res = await admin(request(app).get("/api/admin/tables/5/qr.png")).expect(200);
  assert.equal(res.headers["content-type"], "image/png");
  assert.ok(res.body.length > 100);
});

test("outbox worker retries a failing POS and gives up on permanent errors", async () => {
  class FlakyAdapter extends PosAdapter {
    get name() {
      return "flaky";
    }
    async sendOrder() {
      const err = new Error("POS rejected the order");
      err.permanent = true;
      throw err;
    }
  }
  registerPosAdapter("flaky", FlakyAdapter);
  const previousDriver = config.pos.driver;
  config.pos.driver = "flaky";
  resetPosAdapter();

  const created = await request(app)
    .post("/api/orders")
    .send({ tableNumber: 9, items: [{ productId, quantity: 1 }] })
    .expect(201);

  await drainOutbox();
  const failed = await query("SELECT pos_status FROM orders WHERE id = $1", [created.body.id]);
  assert.equal(failed.rows[0].pos_status, "failed");

  class OkAdapter extends PosAdapter {
    get name() {
      return "ok";
    }
    async sendOrder() {
      return { posOrderId: "pos-123" };
    }
  }
  registerPosAdapter("ok", OkAdapter);
  config.pos.driver = "ok";
  resetPosAdapter();

  await admin(request(app).post(`/api/admin/pos/orders/${created.body.id}/retry`)).expect(200);
  const sent = await query("SELECT pos_status, pos_order_id FROM orders WHERE id = $1", [
    created.body.id,
  ]);
  assert.equal(sent.rows[0].pos_status, "sent");
  assert.equal(sent.rows[0].pos_order_id, "pos-123");

  config.pos.driver = previousDriver;
  resetPosAdapter();
});
