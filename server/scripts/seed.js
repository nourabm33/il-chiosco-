/**
 * Idempotent seed: upserts the 40 tables and every product from
 * data/products.json. Safe to re-run after a menu change.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/lib/db.js";
import { config } from "../src/config.js";

const productsFile = path.resolve(
  fileURLToPath(new URL("../data/products.json", import.meta.url)),
);
const products = JSON.parse(fs.readFileSync(productsFile, "utf8"));

const client = await pool.connect();
try {
  await client.query("BEGIN");

  await client.query(
    `INSERT INTO restaurant_tables (table_number, label)
     SELECT n, 'Tavolo ' || n FROM generate_series(1, $1) AS n
     ON CONFLICT (table_number) DO NOTHING`,
    [config.tableCount],
  );

  await client.query(
    `INSERT INTO products (slug, name, description, category, subcategory, price_cents, sort_order)
     SELECT x.slug, x.name, x.description, x.category, x.subcategory, x.price_cents, x.sort_order
       FROM jsonb_to_recordset($1::jsonb)
            AS x(slug text, name text, description text, category text,
                 subcategory text, price_cents int, sort_order int)
     ON CONFLICT (slug) DO UPDATE
        SET name = EXCLUDED.name,
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            subcategory = EXCLUDED.subcategory,
            price_cents = EXCLUDED.price_cents,
            sort_order = EXCLUDED.sort_order,
            is_available = true,
            updated_at = now()`,
    [
      JSON.stringify(
        products.map((product) => ({
          slug: product.slug,
          name: product.name,
          description: product.description,
          category: product.category,
          subcategory: product.subcategory,
          price_cents: product.priceCents,
          sort_order: product.sortOrder,
        })),
      ),
    ],
  );

  // Products dropped from the printed menu stay in the table (past orders
  // reference them) but are hidden from the ordering page.
  await client.query(
    `UPDATE products SET is_available = false, updated_at = now()
      WHERE is_available AND NOT (slug = ANY($1::text[]))`,
    [products.map((product) => product.slug)],
  );

  await client.query("COMMIT");
  console.log(`seeded ${config.tableCount} tables and ${products.length} products`);
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  client.release();
  await pool.end();
}
