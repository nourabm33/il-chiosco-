/**
 * Local testing only: fills the queue with confirmed orders on random tables,
 * as if waiters had pressed Confirm.  npm run demo:orders -- 5
 */
import "dotenv/config";
import { config } from "../src/config.js";
import { pool, query } from "../src/lib/db.js";
import { stopEvents } from "../src/lib/events.js";
import { confirmOrder, createDraftOrder } from "../src/services/orders.js";

if (config.env === "production") {
  console.error("demo:orders is disabled in production");
  process.exit(1);
}

const count = Number.parseInt(process.argv[2] ?? "3", 10);
const { rows: products } = await query(
  "SELECT id FROM products WHERE is_available ORDER BY random() LIMIT 40",
);
const { rows: tables } = await query(
  "SELECT table_number FROM restaurant_tables WHERE is_active ORDER BY random() LIMIT $1",
  [count],
);
const pick = () => products[Math.floor(Math.random() * products.length)].id;

for (const table of tables) {
  const items = [...new Set([pick(), pick(), pick()])].map((productId) => ({
    productId,
    quantity: 1 + Math.floor(Math.random() * 2),
  }));
  const order = await createDraftOrder({ tableNumber: table.table_number, items });
  await confirmOrder(order.id);
  console.log(`queued ${order.orderCode} for table ${table.table_number}`);
}
await stopEvents();
await pool.end();
