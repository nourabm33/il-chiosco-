import { clearInterval, setInterval } from "node:timers";
import { Router } from "express";
import { z } from "zod";
import { subscribe } from "../lib/events.js";
import { asyncRoute, requireStaff } from "../middleware/index.js";
import {
  cancelOrder,
  confirmOrder,
  createDraftOrder,
  getOrder,
  listOrders,
  listTablesWithOrders,
  ORDER_STATUSES,
  reopenOrder,
  STAGES,
  updateDraftOrder,
  updateServiceStatus,
} from "../services/orders.js";
import { getQueueState, tick } from "../services/queue.js";
import { itemsSchema, orderId, parse } from "./schemas.js";

/**
 * Order intake for waiters (any signed-in staff member). This is the
 * integration point for the existing waiter app or a connector next to it:
 * open (draft, yellow) → confirm (queued, orange) → released by the queue.
 */
export const staffRouter = Router();

staffRouter.use(requireStaff());

const createSchema = z.object({
  tableNumber: z.number().int().positive(),
  notes: z.string().trim().max(500).optional(),
  items: itemsSchema.default([]),
  // id of the order in the external waiter app; re-sending it is a no-op
  externalRef: z.string().trim().min(1).max(100).optional(),
  // create and confirm in one call (for connectors that only see Confirm)
  confirm: z.boolean().optional(),
});

const editSchema = z.object({
  notes: z.string().trim().max(500).optional(),
  items: itemsSchema,
});

const listSchema = z.object({
  scope: z.enum(["open", "all"]).default("open"),
  stage: z.enum(STAGES).optional(),
  table: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

staffRouter.get(
  "/orders",
  asyncRoute(async (req, res) => {
    const q = parse(listSchema, req.query);
    const orders = await listOrders({
      status: q.scope === "open" ? "open" : undefined,
      stage: q.stage,
      tableNumber: q.table,
      limit: q.limit,
    });
    res.json({ orders });
  }),
);

staffRouter.get(
  "/orders/:id",
  asyncRoute(async (req, res) => res.json(await getOrder(orderId(req)))),
);

staffRouter.post(
  "/orders",
  asyncRoute(async (req, res) => {
    const body = parse(createSchema, req.body, "Invalid order");
    let order = await createDraftOrder({
      ...body,
      actor: req.staff,
      idempotencyKey: req.get("idempotency-key") ?? undefined,
      source: body.externalRef ? "integration" : "staff",
    });
    if (body.confirm && order.stage === "draft") {
      try {
        await confirmOrder(order.id, req.staff);
      } catch (err) {
        // a concurrent retry of the same request confirmed it first
        if (err.status !== 409) throw err;
      }
      await tick();
      order = await getOrder(order.id);
    }
    res.status(201).json(order);
  }),
);

staffRouter.put(
  "/orders/:id",
  asyncRoute(async (req, res) => {
    const body = parse(editSchema, req.body, "Invalid order");
    res.json(await updateDraftOrder(orderId(req), body, req.staff));
  }),
);

staffRouter.post(
  "/orders/:id/confirm",
  asyncRoute(async (req, res) => {
    const id = orderId(req);
    await confirmOrder(id, req.staff);
    // In Normal mode this releases straight away.
    await tick();
    res.json(await getOrder(id));
  }),
);

staffRouter.post(
  "/orders/:id/reopen",
  asyncRoute(async (req, res) => res.json(await reopenOrder(orderId(req), req.staff))),
);

staffRouter.post(
  "/orders/:id/cancel",
  asyncRoute(async (req, res) => res.json(await cancelOrder(orderId(req), req.staff))),
);

const statusSchema = z.object({ status: z.enum(ORDER_STATUSES) });

staffRouter.patch(
  "/orders/:id/status",
  asyncRoute(async (req, res) => {
    const { status } = parse(statusSchema, req.body, "Invalid status");
    res.json(await updateServiceStatus(orderId(req), status, req.staff));
  }),
);

staffRouter.get(
  "/tables",
  asyncRoute(async (_req, res) => res.json({ tables: await listTablesWithOrders() })),
);

staffRouter.get(
  "/queue",
  asyncRoute(async (_req, res) => res.json(await getQueueState())),
);

/**
 * Server-Sent Events: every change on any device or server instance is pushed
 * here, so screens refresh without relying on the café Wi-Fi or a local timer.
 */
staffRouter.get(
  "/events",
  asyncRoute(async (req, res) => {
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    const write = (chunk) => {
      res.write(chunk);
      res.flush?.();
    };
    const unsubscribe = await subscribe((event) => write(`data: ${JSON.stringify(event)}\n\n`));
    write(`retry: 3000\ndata: ${JSON.stringify({ type: "hello" })}\n\n`);
    const heartbeat = setInterval(() => write(": ping\n\n"), 25_000);
    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }),
);
