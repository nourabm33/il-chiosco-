import { Router } from "express";
import { query } from "../lib/db.js";
import { asyncRoute } from "../middleware/index.js";
import { badRequest, gone, notFound } from "../lib/errors.js";

export const publicRouter = Router();

let menuCache = { at: 0, payload: null };
const MENU_TTL_MS = 30_000;

publicRouter.get(
  "/menu",
  asyncRoute(async (_req, res) => {
    if (menuCache.payload && Date.now() - menuCache.at < MENU_TTL_MS) {
      return res.json(menuCache.payload);
    }
    const { rows } = await query(
      `SELECT id, slug, name, description, category, subcategory,
              price_cents, currency, sort_order
         FROM products
        WHERE is_available
        ORDER BY sort_order, name`,
    );
    const categories = [];
    const index = new Map();
    for (const row of rows) {
      const key = `${row.category}|${row.subcategory ?? ""}`;
      if (!index.has(key)) {
        const group = {
          category: row.category,
          subcategory: row.subcategory,
          items: [],
        };
        index.set(key, group);
        categories.push(group);
      }
      index.get(key).items.push({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        priceCents: row.price_cents,
        currency: row.currency,
      });
    }
    const payload = { categories, count: rows.length };
    menuCache = { at: Date.now(), payload };
    return res.json(payload);
  }),
);

publicRouter.get(
  "/tables/:number",
  asyncRoute(async (req, res) => {
    const number = Number.parseInt(req.params.number, 10);
    if (!Number.isInteger(number) || number <= 0) throw badRequest("Invalid table number");
    const { rows } = await query(
      "SELECT table_number, label FROM restaurant_tables WHERE table_number = $1 AND is_active",
      [number],
    );
    if (rows.length === 0) throw notFound(`Table ${number} does not exist`);
    return res.json({ tableNumber: rows[0].table_number, label: rows[0].label });
  }),
);

// Customers browse the menu only; orders are taken by the waiter.
publicRouter.post("/orders", (_req, _res, next) =>
  next(gone("Per ordinare, rivolgiti al cameriere. / To place an order, please speak to your waiter.")),
);
