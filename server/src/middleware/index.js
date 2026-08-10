import { config } from "../config.js";
import { unauthorized } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export function requireAdmin(req, _res, next) {
  if (!config.adminToken) {
    return next(
      unauthorized("ADMIN_TOKEN is not set on the server — admin API disabled"),
    );
  }
  const header = req.get("authorization") ?? "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : (req.get("x-admin-token") ?? "");
  if (token !== config.adminToken) return next(unauthorized());
  return next();
}

export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

// Express identifies error handlers by arity — the 4th argument must stay.
export function errorHandler(err, req, res, _next) {
  const status = err.status ?? 500;
  if (status >= 500) logger.error({ err, path: req.path }, "request failed");
  res.status(status).json({
    error: {
      code: err.code ?? "internal_error",
      message: status >= 500 ? "Something went wrong" : err.message,
      details: err.details,
    },
  });
}
