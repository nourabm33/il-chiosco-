import { pool, query } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { config } from "../config.js";
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

async function markSent(outboxId, orderId, posOrderId, skipped) {
  await query(
    "UPDATE pos_outbox SET status = 'sent', last_error = NULL, updated_at = now() WHERE id = $1",
    [outboxId],
  );
  await query(
    "UPDATE orders SET pos_status = $2, pos_order_id = $3, updated_at = now() WHERE id = $1",
    [orderId, skipped ? "skipped" : "sent", posOrderId ?? null],
  );
}

async function markFailed(row, err) {
  const giveUp = err.permanent === true || row.attempts >= config.pos.maxAttempts;
  const delay = Math.min(BACKOFF_BASE_SECONDS * 2 ** (row.attempts - 1), 900);
  await query(
    `UPDATE pos_outbox
        SET status = $2,
            last_error = $3,
            next_attempt_at = now() + ($4 || ' seconds')::interval,
            updated_at = now()
      WHERE id = $1`,
    [row.id, giveUp ? "failed" : "pending", String(err.message).slice(0, 500), delay],
  );
  if (giveUp) {
    await query("UPDATE orders SET pos_status = 'failed', updated_at = now() WHERE id = $1", [
      row.order_id,
    ]);
  }
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
      await markSent(row.id, row.order_id, result?.posOrderId, result?.skipped === true);
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

/** Re-queues an order whose POS delivery previously gave up. */
export async function retryOrder(orderId) {
  const { rowCount } = await query(
    `UPDATE pos_outbox
        SET status = 'pending', attempts = 0, next_attempt_at = now(), updated_at = now()
      WHERE order_id = $1`,
    [orderId],
  );
  if (rowCount > 0) {
    await query("UPDATE orders SET pos_status = 'pending' WHERE id = $1", [orderId]);
  }
  return rowCount > 0;
}
