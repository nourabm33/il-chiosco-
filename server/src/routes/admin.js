import { Router } from "express";
import QRCode from "qrcode";
import { z } from "zod";
import { config } from "../config.js";
import { query } from "../lib/db.js";
import { asyncRoute, requireStaff } from "../middleware/index.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { getOrder, listOrders, listTablesWithOrders, STAGES } from "../services/orders.js";
import { getQueueState, QUEUE_MODES, releaseNext, updateQueueSettings } from "../services/queue.js";
import { drainOutbox, retryOrder } from "../pos/outbox-worker.js";
import { getPosAdapter } from "../pos/index.js";
import { orderId, parse } from "./schemas.js";

/** Manager-only controls: queue mode, early release, retries, tables, QR codes. */
export const adminRouter = Router();

adminRouter.use(requireStaff("manager"));

const listSchema = z.object({
  status: z.string().optional(),
  stage: z.enum(STAGES).optional(),
  table: z.coerce.number().int().positive().optional(),
  since: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

adminRouter.get(
  "/orders",
  asyncRoute(async (req, res) => {
    const q = parse(listSchema, req.query);
    const orders = await listOrders({
      status: q.status,
      stage: q.stage,
      tableNumber: q.table,
      since: q.since,
      limit: q.limit,
    });
    res.json({ orders });
  }),
);

const settingsSchema = z
  .object({
    mode: z.enum(QUEUE_MODES).optional(),
    busyIntervalSeconds: z.number().int().min(30).max(1800).optional(),
  })
  .refine((value) => value.mode || value.busyIntervalSeconds, "Nothing to update");

adminRouter.put(
  "/queue/settings",
  asyncRoute(async (req, res) => {
    const body = parse(settingsSchema, req.body, "Invalid queue settings");
    res.json(await updateQueueSettings(body, req.staff));
  }),
);

adminRouter.post(
  "/queue/release-next",
  asyncRoute(async (req, res) => {
    const id = await releaseNext({ force: true, actor: req.staff });
    if (!id) throw conflict("The queue is empty");
    await drainOutbox(1);
    res.json({ order: await getOrder(id), queue: await getQueueState() });
  }),
);

adminRouter.post(
  "/orders/:id/retry",
  asyncRoute(async (req, res) => {
    const id = orderId(req);
    const requeued = await retryOrder(id, req.staff.id);
    if (!requeued) throw conflict("Only an order whose delivery failed can be retried");
    await drainOutbox(1);
    res.json(await getOrder(id));
  }),
);

adminRouter.get(
  "/tables",
  asyncRoute(async (_req, res) => {
    const tables = await listTablesWithOrders();
    res.json({
      tables: tables.map((table) => ({
        ...table,
        orderUrl: `${config.publicBaseUrl}/order?table=${table.tableNumber}`,
        qrUrl: `/api/admin/tables/${table.tableNumber}/qr.png`,
      })),
    });
  }),
);

adminRouter.get(
  "/tables/:number/qr.png",
  asyncRoute(async (req, res) => {
    const number = Number.parseInt(req.params.number, 10);
    if (!Number.isInteger(number) || number <= 0) throw badRequest("Invalid table number");
    const { rowCount } = await query(
      "SELECT 1 FROM restaurant_tables WHERE table_number = $1",
      [number],
    );
    if (rowCount === 0) throw notFound(`Table ${number} does not exist`);

    const png = await QRCode.toBuffer(
      `${config.publicBaseUrl}/order?table=${number}`,
      { errorCorrectionLevel: "M", margin: 2, width: 600 },
    );
    res.type("png").set("Cache-Control", "private, max-age=3600").send(png);
  }),
);

adminRouter.get(
  "/pos/status",
  asyncRoute(async (_req, res) => {
    const { rows } = await query(
      `SELECT status, COUNT(*)::int AS count FROM pos_outbox GROUP BY status`,
    );
    const adapter = getPosAdapter();
    res.json({
      driver: adapter.name,
      simulated: adapter.name === "simulation",
      configured: adapter.isConfigured(),
      outbox: Object.fromEntries(rows.map((row) => [row.status, row.count])),
    });
  }),
);
