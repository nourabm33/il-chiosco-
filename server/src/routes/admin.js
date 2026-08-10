import { Router } from "express";
import QRCode from "qrcode";
import { z } from "zod";
import { config } from "../config.js";
import { query } from "../lib/db.js";
import { asyncRoute, requireAdmin } from "../middleware/index.js";
import { badRequest, notFound } from "../lib/errors.js";
import {
  listOrders,
  listTablesWithOrders,
  updateOrderStatus,
  ORDER_STATUSES,
} from "../services/orders.js";
import { drainOutbox, retryOrder } from "../pos/outbox-worker.js";
import { getPosAdapter } from "../pos/index.js";

export const adminRouter = Router();

adminRouter.use(requireAdmin);

adminRouter.get(
  "/orders",
  asyncRoute(async (req, res) => {
    const { status, table, since, limit } = req.query;
    const orders = await listOrders({
      status: typeof status === "string" ? status : undefined,
      tableNumber: table ? Number.parseInt(String(table), 10) : undefined,
      since: typeof since === "string" ? since : undefined,
      limit: limit ? Number.parseInt(String(limit), 10) : 100,
    });
    res.json({ orders });
  }),
);

const statusSchema = z.object({ status: z.enum(ORDER_STATUSES) });

adminRouter.patch(
  "/orders/:id/status",
  asyncRoute(async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Invalid status", parsed.error.flatten());
    res.json(await updateOrderStatus(req.params.id, parsed.data.status));
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
    res.type("png").set("Cache-Control", "public, max-age=3600").send(png);
  }),
);

adminRouter.get(
  "/pos/status",
  asyncRoute(async (_req, res) => {
    const { rows } = await query(
      `SELECT status, COUNT(*)::int AS count FROM pos_outbox GROUP BY status`,
    );
    res.json({
      driver: getPosAdapter().name,
      configured: getPosAdapter().isConfigured(),
      outbox: Object.fromEntries(rows.map((row) => [row.status, row.count])),
    });
  }),
);

adminRouter.post(
  "/pos/orders/:id/retry",
  asyncRoute(async (req, res) => {
    const requeued = await retryOrder(req.params.id);
    if (!requeued) throw notFound("No POS delivery found for this order");
    await drainOutbox(1);
    res.json({ ok: true });
  }),
);
