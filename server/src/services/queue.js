import { query, withTransaction } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { publish } from "../lib/events.js";
import { config } from "../config.js";
import { getPosAdapter } from "../pos/index.js";
import { drainOutbox } from "../pos/outbox-worker.js";
import { listOrders, recordEvent } from "./orders.js";

export const QUEUE_MODES = ["normal", "busy", "pause"];

async function readSettings() {
  const { rows } = await query(
    `SELECT s.mode, s.busy_interval_seconds, s.last_release_at, s.updated_at,
            u.display_name AS updated_by, now() AS server_time
       FROM queue_settings s LEFT JOIN staff_users u ON u.id = s.updated_by
      WHERE s.id`,
  );
  return rows[0];
}

/** Everything the dashboard needs, computed from the database (the source of truth). */
export async function getQueueState() {
  const [settings, queued, recent, counts] = await Promise.all([
    readSettings(),
    listOrders({ stage: "queued", orderBy: "o.queue_seq ASC", limit: 200 }),
    listOrders({
      stage: ["releasing", "sent", "simulated", "failed"],
      orderBy: "o.released_at DESC NULLS LAST",
      limit: 20,
    }),
    query(
      `SELECT COUNT(*) FILTER (WHERE stage = 'queued')::int AS waiting,
              COUNT(*) FILTER (WHERE stage = 'releasing')::int AS releasing,
              COUNT(*) FILTER (WHERE stage = 'failed')::int AS failed
         FROM orders`,
    ),
  ]);

  let nextReleaseAt = null;
  if (settings.mode === "busy" && counts.rows[0].waiting > 0) {
    const last = settings.last_release_at ? new Date(settings.last_release_at).getTime() : 0;
    nextReleaseAt = new Date(
      Math.max(last + settings.busy_interval_seconds * 1000, new Date(settings.server_time).getTime()),
    );
  }

  const adapter = getPosAdapter();
  return {
    mode: settings.mode,
    busyIntervalSeconds: settings.busy_interval_seconds,
    lastReleaseAt: settings.last_release_at,
    nextReleaseAt,
    updatedAt: settings.updated_at,
    updatedBy: settings.updated_by,
    serverTime: settings.server_time,
    ...counts.rows[0],
    pos: {
      driver: adapter.name,
      simulated: adapter.name === "simulation",
      configured: adapter.isConfigured(),
    },
    queued,
    recent,
  };
}

export async function updateQueueSettings({ mode, busyIntervalSeconds }, actor) {
  await query(
    `UPDATE queue_settings
        SET mode = COALESCE($1, mode),
            busy_interval_seconds = COALESCE($2, busy_interval_seconds),
            updated_at = now(), updated_by = $3
      WHERE id`,
    [mode ?? null, busyIntervalSeconds ?? null, actor?.id ?? null],
  );
  await publish("queue");
  await tick();
  return getQueueState();
}

/**
 * Moves the head of the queue to the POS outbox. The settings row lock
 * serialises every release across devices and server instances, and the
 * `stage = 'queued'` check means an order can only ever be released once.
 * `force` (manager's "release next now") ignores Busy/Pause timing.
 */
export async function releaseNext({ force = false, actor } = {}) {
  const released = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT mode, busy_interval_seconds, last_release_at, now() AS now
         FROM queue_settings WHERE id FOR UPDATE`,
    );
    const settings = rows[0];
    if (!force) {
      if (settings.mode === "pause") return null;
      if (settings.mode === "busy" && settings.last_release_at) {
        const elapsed = settings.now - settings.last_release_at;
        if (elapsed < settings.busy_interval_seconds * 1000) return null;
      }
    }

    const next = await client.query(
      `SELECT id, table_number FROM orders
        WHERE stage = 'queued' ORDER BY queue_seq LIMIT 1 FOR UPDATE`,
    );
    const order = next.rows[0];
    if (!order) return null;

    await client.query(
      `UPDATE orders SET stage = 'releasing', pos_status = 'pending', released_at = now(),
                         updated_at = now()
        WHERE id = $1`,
      [order.id],
    );
    await client.query(
      "INSERT INTO pos_outbox (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING",
      [order.id],
    );
    await client.query("UPDATE queue_settings SET last_release_at = now() WHERE id");
    await recordEvent(
      client,
      order.id,
      "stage",
      "queued",
      "releasing",
      actor?.id,
      force ? "manual release" : `auto (${settings.mode})`,
    );
    return order;
  });

  if (released) {
    await publish("order", { orderId: released.id, tableNumber: released.table_number });
  }
  return released?.id ?? null;
}

/** Releases whatever the current mode allows right now, then delivers it. */
export async function tick() {
  let count = 0;
  // Normal mode drains the queue; Busy releases at most one per interval.
  for (;;) {
    const id = await releaseNext();
    if (!id) break;
    count += 1;
  }
  if (count > 0) await drainOutbox(count);
  return count;
}

export function startQueueScheduler() {
  if (!config.queue.schedulerEnabled) return () => {};
  let stopped = false;
  let timer = null;
  const loop = async () => {
    if (stopped) return;
    try {
      await tick();
    } catch (err) {
      logger.error({ err }, "queue tick failed");
    }
    if (!stopped) timer = setTimeout(loop, config.queue.tickMs);
  };
  timer = setTimeout(loop, config.queue.tickMs);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
