import { query, withTransaction } from "../lib/db.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { publish } from "../lib/events.js";
import { config } from "../config.js";

export const OPEN_STATUSES = ["received", "in_progress", "served"];
export const ORDER_STATUSES = [...OPEN_STATUSES, "paid", "cancelled"];
export const STAGES = ["draft", "queued", "releasing", "sent", "simulated", "failed", "cancelled"];
const RELEASED_STAGES = ["sent", "simulated"];

// Service lifecycle, only once the order has left the queue.
const SERVICE_TRANSITIONS = {
  received: ["in_progress", "served", "cancelled"],
  in_progress: ["served", "cancelled"],
  served: ["paid"],
  paid: [],
  cancelled: [],
};

const STAGE_LABELS = {
  draft: "in inserimento",
  queued: "in coda",
  releasing: "in invio",
  sent: "inviato alla cassa",
  simulated: "simulato",
  failed: "invio fallito",
  cancelled: "annullato",
};

async function nextOrderCode(client) {
  const { rows } = await client.query("SELECT nextval('order_code_seq') AS n");
  const n = Number(rows[0].n);
  const day = new Date().toISOString().slice(5, 10).replace("-", "");
  return `IC-${day}-${String(n).padStart(4, "0")}`;
}

export async function recordEvent(client, orderId, kind, fromValue, toValue, actorId, detail) {
  await client.query(
    `INSERT INTO order_events (order_id, kind, from_value, to_value, actor_id, detail)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [orderId, kind, fromValue ?? null, toValue ?? null, actorId ?? null, detail ?? null],
  );
}

/** Prices are always re-read from the database, never trusted from the client. */
async function priceLines(client, items) {
  if (items.length > config.maxOrderItems) throw badRequest("Too many items");
  const productIds = items.map((item) => item.productId);
  const products = await client.query(
    "SELECT id, name, price_cents, is_available FROM products WHERE id = ANY($1::uuid[])",
    [productIds],
  );
  const byId = new Map(products.rows.map((row) => [row.id, row]));

  const missing = productIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw badRequest("Some products no longer exist", { productIds: missing });
  }
  const unavailable = products.rows.filter((row) => !row.is_available);
  if (unavailable.length > 0) {
    throw conflict(`Not available right now: ${unavailable.map((row) => row.name).join(", ")}`);
  }

  const lines = items.map((item) => {
    const product = byId.get(item.productId);
    return {
      product_id: product.id,
      name: product.name,
      unit_price: product.price_cents,
      quantity: item.quantity,
      notes: item.notes ?? null,
      line_total: product.price_cents * item.quantity,
    };
  });
  return { lines, totalCents: lines.reduce((sum, line) => sum + line.line_total, 0) };
}

async function writeLines(client, orderId, lines) {
  await client.query("DELETE FROM order_items WHERE order_id = $1", [orderId]);
  if (lines.length === 0) return;
  await client.query(
    `INSERT INTO order_items
       (order_id, product_id, name_snapshot, unit_price_cents, quantity, notes, line_total_cents)
     SELECT $1, x.product_id, x.name, x.unit_price, x.quantity, x.notes, x.line_total
       FROM jsonb_to_recordset($2::jsonb)
            AS x(product_id uuid, name text, unit_price int, quantity int, notes text, line_total int)`,
    [orderId, JSON.stringify(lines)],
  );
}

async function findExisting({ idempotencyKey, externalRef }) {
  const { rows } = await query(
    `SELECT id FROM orders
      WHERE ($1::text IS NOT NULL AND idempotency_key = $1)
         OR ($2::text IS NOT NULL AND external_ref = $2)
      LIMIT 1`,
    [idempotencyKey ?? null, externalRef ?? null],
  );
  return rows[0]?.id ?? null;
}

/**
 * Opens an order for a table (yellow). Re-sending the same Idempotency-Key or
 * external reference returns the existing order instead of creating another.
 */
export async function createDraftOrder({
  tableNumber,
  items = [],
  notes,
  actor,
  idempotencyKey,
  externalRef,
  source = "staff",
}) {
  const existing = await findExisting({ idempotencyKey, externalRef });
  if (existing) return getOrder(existing);

  let orderId;
  try {
    orderId = await withTransaction(async (client) => {
      const table = await client.query(
        "SELECT table_number FROM restaurant_tables WHERE table_number = $1 AND is_active",
        [tableNumber],
      );
      if (table.rowCount === 0) throw notFound(`Table ${tableNumber} does not exist`);

      const { lines, totalCents } = await priceLines(client, items);
      const orderCode = await nextOrderCode(client);
      const inserted = await client.query(
        `INSERT INTO orders (order_code, table_number, notes, total_cents, idempotency_key,
                             external_ref, source, created_by, stage)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
         RETURNING id`,
        [
          orderCode,
          tableNumber,
          notes ?? null,
          totalCents,
          idempotencyKey ?? null,
          externalRef ?? null,
          source,
          actor?.id ?? null,
        ],
      );
      const id = inserted.rows[0].id;
      await writeLines(client, id, lines);
      await recordEvent(client, id, "stage", null, "draft", actor?.id);
      return id;
    });
  } catch (err) {
    // Two devices raced with the same key: the other one won, return its order.
    if (err.code === "23505") {
      const raced = await findExisting({ idempotencyKey, externalRef });
      if (raced) return getOrder(raced);
    }
    throw err;
  }

  await publish("order", { orderId, tableNumber });
  return getOrder(orderId);
}

/** Runs `fn` with the order row locked, so concurrent devices are serialised. */
async function withLockedOrder(orderId, fn) {
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      "SELECT id, table_number, stage, status FROM orders WHERE id = $1 FOR UPDATE",
      [orderId],
    );
    if (rows.length === 0) throw notFound("Order not found");
    await fn(client, rows[0]);
    return rows[0];
  });
  await publish("order", { orderId, tableNumber: result.table_number });
  return getOrder(orderId);
}

function requireStage(order, allowed, action) {
  if (!allowed.includes(order.stage)) {
    throw conflict(`Cannot ${action}: the order is ${STAGE_LABELS[order.stage]}`);
  }
}

export function updateDraftOrder(orderId, { items, notes }, actor) {
  return withLockedOrder(orderId, async (client, order) => {
    requireStage(order, ["draft"], "edit it");
    const { lines, totalCents } = await priceLines(client, items);
    await writeLines(client, orderId, lines);
    await client.query(
      "UPDATE orders SET total_cents = $2, notes = $3, updated_at = now() WHERE id = $1",
      [orderId, totalCents, notes ?? null],
    );
    await recordEvent(client, orderId, "edit", null, null, actor?.id, `${lines.length} lines`);
  });
}

/** Waiter presses Confirm: the order joins the shared FIFO queue (orange). */
export function confirmOrder(orderId, actor) {
  return withLockedOrder(orderId, async (client, order) => {
    requireStage(order, ["draft"], "confirm it");
    const { rowCount } = await client.query(
      "SELECT 1 FROM order_items WHERE order_id = $1 LIMIT 1",
      [orderId],
    );
    if (rowCount === 0) throw badRequest("Add at least one product before confirming");
    await client.query(
      `UPDATE orders
          SET stage = 'queued', queue_seq = nextval('order_queue_seq'), queued_at = now(),
              confirmed_by = $2, release_error = NULL, updated_at = now()
        WHERE id = $1`,
      [orderId, actor?.id ?? null],
    );
    await recordEvent(client, orderId, "stage", "draft", "queued", actor?.id);
  });
}

/** Takes a queued order back for editing; it loses its queue position. */
export function reopenOrder(orderId, actor) {
  return withLockedOrder(orderId, async (client, order) => {
    requireStage(order, ["queued"], "reopen it");
    await client.query(
      `UPDATE orders SET stage = 'draft', queue_seq = NULL, queued_at = NULL, updated_at = now()
        WHERE id = $1`,
      [orderId],
    );
    await recordEvent(client, orderId, "stage", "queued", "draft", actor?.id);
  });
}

export function cancelOrder(orderId, actor) {
  return withLockedOrder(orderId, async (client, order) => {
    requireStage(order, ["draft", "queued"], "cancel it");
    await client.query(
      `UPDATE orders SET stage = 'cancelled', status = 'cancelled', queue_seq = NULL,
                         updated_at = now()
        WHERE id = $1`,
      [orderId],
    );
    await recordEvent(client, orderId, "stage", order.stage, "cancelled", actor?.id);
  });
}

/** Service lifecycle (in preparazione → servito → pagato) after release. */
export function updateServiceStatus(orderId, status, actor) {
  if (!ORDER_STATUSES.includes(status)) throw badRequest("Unknown status");
  return withLockedOrder(orderId, async (client, order) => {
    requireStage(order, RELEASED_STAGES, "change its service status");
    if (!SERVICE_TRANSITIONS[order.status]?.includes(status)) {
      throw conflict(`Cannot go from ${order.status} to ${status}`);
    }
    await client.query("UPDATE orders SET status = $2, updated_at = now() WHERE id = $1", [
      orderId,
      status,
    ]);
    await recordEvent(client, orderId, "status", order.status, status, actor?.id);
  });
}

const ORDER_SELECT = `
  SELECT o.id, o.order_code, o.table_number, o.status, o.stage, o.source, o.external_ref,
         o.notes, o.total_cents, o.currency, o.pos_status, o.pos_order_id, o.release_error,
         o.queue_seq, o.queued_at, o.released_at, o.delivered_at, o.created_at, o.updated_at,
         cb.display_name AS created_by_name, fb.display_name AS confirmed_by_name,
         CASE WHEN o.stage = 'queued' THEN
           (SELECT COUNT(*) FROM orders q WHERE q.stage = 'queued' AND q.queue_seq <= o.queue_seq)
         END AS queue_position,
         COALESCE(
           json_agg(
             json_build_object(
               'productId', i.product_id,
               'name', i.name_snapshot,
               'quantity', i.quantity,
               'unitPriceCents', i.unit_price_cents,
               'lineTotalCents', i.line_total_cents,
               'notes', i.notes
             ) ORDER BY i.name_snapshot
           ) FILTER (WHERE i.id IS NOT NULL), '[]'
         ) AS items
    FROM orders o
    LEFT JOIN order_items i ON i.order_id = o.id
    LEFT JOIN staff_users cb ON cb.id = o.created_by
    LEFT JOIN staff_users fb ON fb.id = o.confirmed_by`;

export async function getOrder(orderId) {
  const { rows } = await query(
    `${ORDER_SELECT} WHERE o.id = $1 GROUP BY o.id, cb.display_name, fb.display_name`,
    [orderId],
  );
  if (rows.length === 0) throw notFound("Order not found");
  return serializeOrder(rows[0]);
}

const OPEN_CLAUSE = `(o.stage IN ('draft', 'queued', 'releasing', 'failed')
  OR (o.stage IN ('sent', 'simulated') AND o.status IN ('received', 'in_progress', 'served')))`;

export async function listOrders({ status, stage, tableNumber, since, limit = 100, orderBy }) {
  const clauses = [];
  const params = [];
  if (status === "open") {
    clauses.push(OPEN_CLAUSE);
  } else if (status) {
    params.push(status);
    clauses.push(`o.status = $${params.length}`);
  }
  if (stage) {
    params.push(Array.isArray(stage) ? stage : [stage]);
    clauses.push(`o.stage = ANY($${params.length})`);
  }
  if (tableNumber) {
    params.push(tableNumber);
    clauses.push(`o.table_number = $${params.length}`);
  }
  if (since) {
    params.push(since);
    clauses.push(`o.created_at >= $${params.length}`);
  }
  params.push(Math.min(limit, 500));

  const { rows } = await query(
    `${ORDER_SELECT}
      ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
      GROUP BY o.id, cb.display_name, fb.display_name
      ORDER BY ${orderBy ?? "o.created_at DESC"}
      LIMIT $${params.length}`,
    params,
  );
  return rows.map(serializeOrder);
}

/**
 * Table board. A table's colour comes from its open orders, so one table can
 * have an order already sent and another one being entered at the same time.
 */
export async function listTablesWithOrders() {
  const { rows } = await query(
    `SELECT t.table_number, t.label, t.is_active, t.pos_table_id,
            COUNT(o.id)::int AS open_orders,
            COALESCE(SUM(o.total_cents), 0)::int AS open_total_cents,
            MAX(o.created_at) AS last_order_at,
            COUNT(*) FILTER (WHERE o.stage = 'draft')::int AS drafts,
            COUNT(*) FILTER (WHERE o.stage IN ('queued', 'releasing'))::int AS queued,
            COUNT(*) FILTER (WHERE o.stage = 'failed')::int AS failed,
            COUNT(*) FILTER (WHERE o.stage = 'sent')::int AS sent,
            COUNT(*) FILTER (WHERE o.stage = 'simulated')::int AS simulated
       FROM restaurant_tables t
       LEFT JOIN orders o ON o.table_number = t.table_number AND ${OPEN_CLAUSE}
      GROUP BY t.table_number
      ORDER BY t.table_number`,
  );
  return rows.map((row) => {
    let color = "free";
    if (row.drafts > 0) color = "yellow";
    else if (row.queued > 0) color = "orange";
    else if (row.failed > 0) color = "red";
    else if (row.sent > 0) color = "green";
    else if (row.simulated > 0) color = "simulated";
    return {
      tableNumber: row.table_number,
      label: row.label,
      isActive: row.is_active,
      posTableId: row.pos_table_id,
      openOrders: row.open_orders,
      openTotalCents: row.open_total_cents,
      lastOrderAt: row.last_order_at,
      occupied: row.open_orders > 0,
      color,
      counts: {
        draft: row.drafts,
        queued: row.queued,
        failed: row.failed,
        sent: row.sent,
        simulated: row.simulated,
      },
    };
  });
}

export function buildPosPayload(order, table, posProductIds) {
  return {
    orderId: order.id,
    orderCode: order.orderCode,
    createdAt: order.createdAt,
    notes: order.notes,
    currency: order.currency,
    totalCents: order.totalCents,
    table: { number: order.tableNumber, posTableId: table?.pos_table_id ?? null },
    items: order.items.map((item) => ({
      ...item,
      posProductId: posProductIds.get(item.productId) ?? null,
    })),
  };
}

export async function loadPosContext(order) {
  const [tableResult, productResult] = await Promise.all([
    query("SELECT pos_table_id FROM restaurant_tables WHERE table_number = $1", [
      order.tableNumber,
    ]),
    query("SELECT id, pos_product_id FROM products WHERE id = ANY($1::uuid[])", [
      order.items.map((item) => item.productId).filter(Boolean),
    ]),
  ]);
  const posProductIds = new Map(
    productResult.rows.map((row) => [row.id, row.pos_product_id]),
  );
  return buildPosPayload(order, tableResult.rows[0], posProductIds);
}

function serializeOrder(row) {
  return {
    id: row.id,
    orderCode: row.order_code,
    tableNumber: row.table_number,
    status: row.status,
    stage: row.stage,
    source: row.source,
    externalRef: row.external_ref,
    notes: row.notes,
    totalCents: row.total_cents,
    currency: row.currency,
    posStatus: row.pos_status,
    posOrderId: row.pos_order_id,
    releaseError: row.release_error,
    queuePosition: row.queue_position == null ? null : Number(row.queue_position),
    queuedAt: row.queued_at,
    releasedAt: row.released_at,
    deliveredAt: row.delivered_at,
    createdBy: row.created_by_name,
    confirmedBy: row.confirmed_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: row.items,
  };
}
