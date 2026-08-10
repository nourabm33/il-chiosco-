import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { query } from "../lib/db.js";
import { asyncRoute } from "../middleware/index.js";
import { badRequest, notFound } from "../lib/errors.js";
import { config } from "../config.js";
import { createOrder, getOrder } from "../services/orders.js";

export const publicRouter = Router();

const orderLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many orders, slow down" } },
});

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
        ORDER BY category, sort_order, name`,
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

const orderSchema = z.object({
  tableNumber: z.number().int().positive(),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
        notes: z.string().trim().max(200).optional(),
      }),
    )
    .min(1)
    .max(config.maxOrderItems),
});

publicRouter.post(
  "/orders",
  orderLimiter,
  asyncRoute(async (req, res) => {
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid order", parsed.error.flatten());
    }
    const order = await createOrder({
      ...parsed.data,
      idempotencyKey: req.get("idempotency-key") ?? undefined,
    });
    res.status(201).json(order);
  }),
);

publicRouter.get(
  "/orders/:id",
  asyncRoute(async (req, res) => {
    const order = await getOrder(req.params.id);
    // Customers only need the live status of their own order.
    res.json({
      id: order.id,
      orderCode: order.orderCode,
      tableNumber: order.tableNumber,
      status: order.status,
      totalCents: order.totalCents,
      currency: order.currency,
      createdAt: order.createdAt,
      items: order.items,
    });
  }),
);
