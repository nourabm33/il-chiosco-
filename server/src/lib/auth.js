import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import { promisify } from "node:util";
import { query } from "./db.js";
import { config } from "../config.js";

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, saltB64, keyB64] = String(stored).split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// Spent on unknown usernames too, so response time does not reveal which exist.
const DUMMY_HASH = await hashPassword(crypto.randomBytes(16).toString("hex"));

export async function login(username, password) {
  const { rows } = await query(
    `SELECT id, username, display_name, role, password_hash
       FROM staff_users WHERE username = $1 AND is_active`,
    [String(username).trim().toLowerCase()],
  );
  const user = rows[0];
  const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) return null;

  const token = crypto.randomBytes(32).toString("base64url");
  await query(
    `INSERT INTO staff_sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + ($3 || ' hours')::interval)`,
    [hashToken(token), user.id, config.sessionHours],
  );
  await query("DELETE FROM staff_sessions WHERE expires_at < now()");
  return { token, user: serializeUser(user) };
}

export async function userForToken(token) {
  if (!token) return null;
  const { rows } = await query(
    `UPDATE staff_sessions s SET last_seen_at = now()
       FROM staff_users u
      WHERE s.token_hash = $1 AND s.expires_at > now()
        AND u.id = s.user_id AND u.is_active
     RETURNING u.id, u.username, u.display_name, u.role`,
    [hashToken(token)],
  );
  return rows[0] ? serializeUser(rows[0]) : null;
}

export async function logout(token) {
  await query("DELETE FROM staff_sessions WHERE token_hash = $1", [hashToken(token)]);
}

export async function upsertStaffUser({ username, displayName, role, password }) {
  const { rows } = await query(
    `INSERT INTO staff_users (username, display_name, role, password_hash)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (username) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            role = EXCLUDED.role,
            password_hash = EXCLUDED.password_hash,
            is_active = true,
            updated_at = now()
     RETURNING id, username, display_name, role`,
    [username.trim().toLowerCase(), displayName, role, await hashPassword(password)],
  );
  // A password change signs the user out everywhere.
  await query("DELETE FROM staff_sessions WHERE user_id = $1", [rows[0].id]);
  return serializeUser(rows[0]);
}

function serializeUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
  };
}
