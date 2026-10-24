import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { pool } from "./lib/db.js";
import { publicRouter } from "./routes/public.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { staffRouter } from "./routes/staff.js";
import { cors, errorHandler } from "./middleware/index.js";

const siteRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

export function createApp() {
  const app = express();

  app.set("trust proxy", config.trustProxy);
  app.disable("x-powered-by");
  app.use(
    helmet({
      // The marketing site relies on inline styles/scripts and third-party
      // fonts/maps; a CSP belongs at the CDN/proxy layer for this project.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  // SSE responses flush themselves; everything else is compressed.
  app.use(compression());
  app.use(express.json({ limit: "64kb" }));
  if (config.env !== "test") app.use(pinoHttp({ logger }));

  app.get("/healthz", (_req, res) => res.json({ ok: true }));
  app.get("/readyz", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
  );
  app.use("/api", cors);
  app.use("/api/auth", authRouter);
  app.use("/api/staff", staffRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api", publicRouter);

  // Pretty URLs for the table menu and staff pages; the QR codes point at /order?table=N.
  app.get("/order", (_req, res) => res.sendFile(path.join(siteRoot, "order.html")));
  app.get("/admin", (_req, res) => res.sendFile(path.join(siteRoot, "admin.html")));

  app.use(
    express.static(siteRoot, {
      extensions: ["html"],
      maxAge: config.env === "production" ? "1h" : 0,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
      },
    }),
  );

  app.use(errorHandler);
  return app;
}
