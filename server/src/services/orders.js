import { query, withTransaction } from "../lib/db.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { config } from "../config.js";

export const OPEN_STATUSES = ["received", "in_progress", "served"];
export const ORDER_STATUSES = [...OPEN_STATUSES, "paid", "cancelled"];

async function nextOrderCode(client) {
  const { rows } = await client.query("SELECT nextval('order_code_seq') AS n");
  const n = Number(rows[0].n);
  const day = new Date().toISOString().slice(5, 10).replace("-", "");
  return `IC-${day}-${String(n).padStart(4, "0")}`;
}

/**
 * Creates an order atomically: prices are re-read from the database inside the
 * transaction (never trusted from the client), and the POS delivery is queued
 * in the same transaction via the outbox table.
 */
export async function createOrder({ tableNumber, items, notes, idempotencyKey }) {
  if (idempotencyKey) {
    const existing = await query(
      "SELECT id FROM orders WHERE idempotency_key = $1",
      [idempotencyKey],
    );
    if (existing.rowCount > 0) return getOrder(existing.rows[0].id);
  }

  const orderId = await withTransaction(async (client) => {
    const table = await client.query(
      "SELECT table_number FROM restaurant_tables WHERE table_number = $1 AND is_active",
      [tableNumber],
    );
    if (table.rowCount === 0) throw notFound(`Table ${tableNumber} does not exist`);

    const productIds = items.map((item) => item.productId);
    const products = await client.query(
      `SELECT id, name, price_cents, currency, is_available
         FROM products
        WHERE id = ANY($1::uuid[])`,
      [productIds],
    );
    const byId = new Map(products.rows.map((row) => [row.id, row]));

    const missing = productIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw badRequest("Some products no longer exist", { productIds: missing });
    }
    const unavailable = products.rows.filter((row) => !row.is_available);
    if (unavailable.length > 0) {
      throw conflict(
        `Not available right now: ${unavailable.map((row) => row.name).join(", ")}`,
      );
    }

    const lines = items.map((item) => {
      const product = byId.get(item.productId);
      return {
        productId: product.id,
        name: product.name,
        unitPriceCents: product.price_cents,
        quantity: item.quantity,
        notes: item.notes ?? null,
        lineTotalCents: product.price_cents * item.quantity,
      };
    });
    const totalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);

    const orderCode = await nextOrderCode(client);
    const inserted = await client.query(
      `INSERT INTO orders (order_code, table_number, notes, total_cents, idempotency_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [orderCode, tableNumber, notes ?? null, totalCents, idempotencyKey ?? null],
    );
    const id = inserted.rows[0].id;

    await client.query(
      `INSERT INTO order_items
         (order_id, product_id, name_snapshot, unit_price_cents, quantity, notes, line_total_cents)
       SELECT $1, x.product_id, x.name, x.unit_price, x.quantity, x.notes, x.line_total
         FROM jsonb_to_recordset($2::jsonb)
              AS x(product_id uuid, name text, unit_price int, quantity int, notes text, line_total int)`,
      [
        id,
        JSON.stringify(
          lines.map((line) => ({
            product_id: line.productId,
            name: line.name,
            unit_price: line.unitPriceCents,
            quantity: line.quantity,
            notes: line.notes,
            line_total: line.lineTotalCents,
          })),
        ),
      ],
    );

    await client.query("INSERT INTO pos_outbox (order_id) VALUES ($1)", [id]);
    return id;
  });

  return getOrder(orderId);
}

export async function getOrder(orderId) {
  const { rows } = await query(
    `SELECT o.id, o.order_code, o.table_number, o.status, o.notes,
            o.total_cents, o.currency, o.pos_status, o.pos_order_id,
            o.created_at, o.updated_at,
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
      WHERE o.id = $1
      GROUP BY o.id`,
    [orderId],
  );
  if (rows.length === 0) throw notFound("Order not found");
  return serializeOrder(rows[0]);
}

export async function listOrders({ status, tableNumber, since, limit = 100 }) {
  const clauses = [];
  const params = [];
  if (status === "open") {
    params.push(OPEN_STATUSES);
    clauses.push(`o.status = ANY($${params.length})`);
  } else if (status) {
    params.push(status);
    clauses.push(`o.status = $${params.length}`);
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
    `SELECT o.id, o.order_code, o.table_number, o.status, o.notes,
            o.total_cents, o.currency, o.pos_status, o.pos_order_id,
            o.created_at, o.updated_at,
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
      ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT $${params.length}`,
    params,
  );
  return rows.map(serializeOrder);
}

export async function updateOrderStatus(orderId, status) {
  if (!ORDER_STATUSES.includes(status)) throw badRequest("Unknown status");
  const { rowCount } = await query(
    "UPDATE orders SET status = $2, updated_at = now() WHERE id = $1",
    [orderId, status],
  );
  if (rowCount === 0) throw notFound("Order not found");
  return getOrder(orderId);
}

/** Table board for the admin dashboard: occupancy + open order summary. */
export async function listTablesWithOrders() {
  const { rows } = await query(
    `SELECT t.table_number, t.label, t.is_active, t.pos_table_id,
            COUNT(o.id)::int AS open_orders,
            COALESCE(SUM(o.total_cents), 0)::int AS open_total_cents,
            MAX(o.created_at) AS last_order_at
       FROM restaurant_tables t
       LEFT JOIN orders o
              ON o.table_number = t.table_number
             AND o.status = ANY($1)
      GROUP BY t.table_number
      ORDER BY t.table_number`,
    [OPEN_STATUSES],
  );
  return rows.map((row) => ({
    tableNumber: row.table_number,
    label: row.label,
    isActive: row.is_active,
    posTableId: row.pos_table_id,
    openOrders: row.open_orders,
    openTotalCents: row.open_total_cents,
    lastOrderAt: row.last_order_at,
    occupied: row.open_orders > 0,
  }));
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

export function maxOrderItems() {
  return config.maxOrderItems;
}

function serializeOrder(row) {
  return {
    id: row.id,
    orderCode: row.order_code,
    tableNumber: row.table_number,
    status: row.status,
    notes: row.notes,
    totalCents: row.total_cents,
    currency: row.currency,
    posStatus: row.pos_status,
    posOrderId: row.pos_order_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: row.items,
  };
}
