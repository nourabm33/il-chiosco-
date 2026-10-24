import { pool, query } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { config } from "../config.js";
import { publish } from "../lib/events.js";
import { getPosAdapter } from "./index.js";
import { getOrder, loadPosContext } from "../services/orders.js";

const BACKOFF_BASE_SECONDS = 5;

/**
 * Claims one due outbox row with SKIP LOCKED, so several app instances can run
 * the worker concurrently without ever sending the same order twice.
 */
async function claimNext(client) {
  const { rows } = await client.query(
    `UPDATE pos_outbox
        SET attempts = attempts + 1, updated_at = now()
      WHERE id = (
        SELECT id FROM pos_outbox
         WHERE status = 'pending' AND next_attempt_at <= now()
         ORDER BY next_attempt_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1
      )
      RETURNING id, order_id, attempts`,
  );
  return rows[0] ?? null;
}

async function markSent(outboxId, orderId, posOrderId, simulated) {
  await query(
    "UPDATE pos_outbox SET status = 'sent', last_error = NULL, updated_at = now() WHERE id = $1",
    [outboxId],
  );
  const stage = simulated ? "simulated" : "sent";
  const { rows } = await query(
    `UPDATE orders
        SET pos_status = $2, pos_order_id = $3, stage = $4, delivered_at = now(),
            release_error = NULL, updated_at = now()
      WHERE id = $1
    RETURNING table_number`,
    [orderId, simulated ? "skipped" : "sent", posOrderId ?? null, stage],
  );
  await query(
    `INSERT INTO order_events (order_id, kind, from_value, to_value, detail)
     VALUES ($1, 'stage', 'releasing', $2, $3)`,
    [orderId, stage, simulated ? "POS simulation — not sent to the till" : null],
  );
  await publish("order", { orderId, tableNumber: rows[0]?.table_number });
}

async function markFailed(row, err) {
  const giveUp = err.permanent === true || row.attempts >= config.pos.maxAttempts;
  const delay = Math.min(BACKOFF_BASE_SECONDS * 2 ** (row.attempts - 1), 900);
  const message = String(err.message).slice(0, 500);
  await query(
    `UPDATE pos_outbox
        SET status = $2,
            last_error = $3,
            next_attempt_at = now() + ($4 || ' seconds')::interval,
            updated_at = now()
      WHERE id = $1`,
    [row.id, giveUp ? "failed" : "pending", message, delay],
  );
  // While retrying the order stays "releasing" with the last error visible.
  const { rows } = await query(
    `UPDATE orders
        SET release_error = $2,
            pos_status = CASE WHEN $3 THEN 'failed' ELSE pos_status END,
            stage = CASE WHEN $3 THEN 'failed' ELSE stage END,
            updated_at = now()
      WHERE id = $1
    RETURNING table_number`,
    [row.order_id, message, giveUp],
  );
  if (giveUp) {
    await query(
      `INSERT INTO order_events (order_id, kind, from_value, to_value, detail)
       VALUES ($1, 'stage', 'releasing', 'failed', $2)`,
      [row.order_id, message],
    );
  }
  await publish("order", { orderId: row.order_id, tableNumber: rows[0]?.table_number });
  logger.warn(
    { outboxId: row.id, attempts: row.attempts, giveUp, err: err.message },
    "POS delivery failed",
  );
}

/** Processes due outbox rows; returns how many were handled. */
export async function drainOutbox(max = 25) {
  const adapter = getPosAdapter();
  let processed = 0;

  for (let i = 0; i < max; i += 1) {
    const client = await pool.connect();
    let row;
    try {
      await client.query("BEGIN");
      row = await claimNext(client);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      logger.error({ err }, "outbox claim failed");
      client.release();
      break;
    } finally {
      client.release();
    }
    if (!row) break;

    try {
      const order = await getOrder(row.order_id);
      const payload = await loadPosContext(order);
      const result = await adapter.sendOrder(payload);
      await markSent(
        row.id,
        row.order_id,
        result?.posOrderId,
        result?.simulated === true || result?.skipped === true,
      );
    } catch (err) {
      await markFailed(row, err);
    }
    processed += 1;
  }

  return processed;
}

export function startOutboxWorker() {
  if (!config.pos.workerEnabled) return () => {};
  let stopped = false;
  let timer = null;

  const tick = async () => {
    if (stopped) return;
    try {
      await drainOutbox();
    } catch (err) {
      logger.error({ err }, "outbox worker tick failed");
    }
    if (!stopped) timer = setTimeout(tick, config.pos.workerIntervalMs);
  };

  timer = setTimeout(tick, config.pos.workerIntervalMs);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

/**
 * Re-sends an order whose POS delivery gave up. Only a `failed` order can be
 * retried, so an order the POS accepted is never sent again.
 */
export async function retryOrder(orderId, actorId) {
  const { rows } = await query(
    `UPDATE orders SET stage = 'releasing', pos_status = 'pending', release_error = NULL,
                       updated_at = now()
      WHERE id = $1 AND stage = 'failed'
    RETURNING table_number`,
    [orderId],
  );
  if (rows.length === 0) return false;
  await query(
    `INSERT INTO pos_outbox (order_id) VALUES ($1)
     ON CONFLICT (order_id) DO UPDATE
        SET status = 'pending', attempts = 0, next_attempt_at = now(), last_error = NULL,
            updated_at = now()`,
    [orderId],
  );
  await query(
    `INSERT INTO order_events (order_id, kind, from_value, to_value, actor_id, detail)
     VALUES ($1, 'stage', 'failed', 'releasing', $2, 'manual retry')`,
    [orderId, actorId ?? null],
  );
  await publish("order", { orderId, tableNumber: rows[0].table_number });
  return true;
}
