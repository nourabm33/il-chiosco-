import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config.js";
import { login, logout } from "../lib/auth.js";
import { unauthorized } from "../lib/errors.js";
import { asyncRoute, bearerToken, requireStaff } from "../middleware/index.js";
import { parse } from "./schemas.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: { code: "rate_limited", message: "Too many attempts, try again later" } },
});

const loginSchema = z.object({
  username: z.string().trim().min(1).max(40),
  password: z.string().min(1).max(200),
});

authRouter.post(
  "/login",
  loginLimiter,
  asyncRoute(async (req, res) => {
    const { username, password } = parse(loginSchema, req.body);
    const session = await login(username, password);
    if (!session) throw unauthorized("Wrong username or password");
    res.json({ ...session, expiresInHours: config.sessionHours });
  }),
);

authRouter.post(
  "/logout",
  requireStaff(),
  asyncRoute(async (req, res) => {
    await logout(bearerToken(req));
    res.json({ ok: true });
  }),
);

authRouter.get("/me", requireStaff(), (req, res) => res.json({ user: req.staff }));
