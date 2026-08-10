import "dotenv/config";

function int(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  env: process.env.NODE_ENV ?? "development",
  port: int(process.env.PORT, 3000),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:3000",
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@localhost:5432/ilchiosco",
  databasePoolMax: int(process.env.DATABASE_POOL_MAX, 20),
  adminToken: process.env.ADMIN_TOKEN ?? "",
  tableCount: int(process.env.TABLE_COUNT, 40),
  maxOrderItems: int(process.env.MAX_ORDER_ITEMS, 50),
  trustProxy: process.env.TRUST_PROXY ?? "loopback",
  pos: {
    // "noop"  — store orders only (default until the POS docs arrive)
    // "http"  — generic HTTP adapter, configured with the values below
    driver: process.env.POS_DRIVER ?? "noop",
    baseUrl: process.env.POS_BASE_URL ?? "",
    apiKey: process.env.POS_API_KEY ?? "",
    authScheme: process.env.POS_AUTH_SCHEME ?? "bearer",
    ordersPath: process.env.POS_ORDERS_PATH ?? "/orders",
    timeoutMs: int(process.env.POS_TIMEOUT_MS, 8000),
    workerEnabled: process.env.POS_WORKER_ENABLED !== "false",
    workerIntervalMs: int(process.env.POS_WORKER_INTERVAL_MS, 5000),
    maxAttempts: int(process.env.POS_MAX_ATTEMPTS, 10),
  },
};
