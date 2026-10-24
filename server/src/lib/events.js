import pg from "pg";
import { config } from "../config.js";
import { query } from "./db.js";
import { logger } from "./logger.js";

/**
 * Change notifications for staff screens. Every mutation publishes through
 * Postgres NOTIFY, so all backend instances (and therefore all devices) see
 * every change regardless of which instance handled it.
 */
const CHANNEL = "ilchiosco_events";
const subscribers = new Set();
let listener = null;
let connecting = null;

export async function publish(type, data = {}) {
  await query("SELECT pg_notify($1, $2)", [CHANNEL, JSON.stringify({ type, ...data })]);
}

async function ensureListener() {
  if (listener) return;
  if (connecting) return connecting;
  connecting = (async () => {
    const client = new pg.Client({ connectionString: config.databaseUrl });
    client.on("notification", (message) => {
      let event;
      try {
        event = JSON.parse(message.payload);
      } catch {
        return;
      }
      for (const fn of subscribers) fn(event);
    });
    client.on("error", (err) => {
      logger.error({ err }, "event listener lost its connection");
      listener = null;
      client.end().catch(() => {});
      if (subscribers.size > 0) setTimeout(() => ensureListener().catch(() => {}), 2000);
    });
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    listener = client;
  })();
  try {
    await connecting;
  } finally {
    connecting = null;
  }
}

export async function subscribe(fn) {
  subscribers.add(fn);
  await ensureListener();
  return () => subscribers.delete(fn);
}

export async function stopEvents() {
  subscribers.clear();
  const client = listener;
  listener = null;
  if (client) await client.end().catch(() => {});
}
