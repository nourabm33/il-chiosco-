import { config } from "../config.js";
import { forbidden, unauthorized } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { userForToken } from "../lib/auth.js";

export function bearerToken(req) {
  const header = req.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

/** Requires a signed-in staff member; `roles` restricts who may continue. */
export function requireStaff(...roles) {
  return (req, _res, next) => {
    userForToken(bearerToken(req))
      .then((user) => {
        if (!user) return next(unauthorized("Sign in again"));
        if (roles.length > 0 && !roles.includes(user.role)) {
          return next(forbidden("Only a manager can do this"));
        }
        req.staff = user;
        return next();
      })
      .catch(next);
  };
}

export function cors(req, res, next) {
  const origin = req.get("origin");
  if (origin && config.corsOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key");
    res.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.set("Access-Control-Max-Age", "600");
  }
  res.vary("Origin");
  if (req.method === "OPTIONS") return res.sendStatus(204);
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
