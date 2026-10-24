/**
 * Creates or updates a staff login. The password is read from STAFF_PASSWORD
 * so it never ends up in shell history or the repository:
 *
 *   STAFF_PASSWORD='…' npm run staff:add -- --username giulia --name "Giulia" --role manager
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import { upsertStaffUser } from "../src/lib/auth.js";
import { pool } from "../src/lib/db.js";

const { values } = parseArgs({
  options: {
    username: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "waiter" },
  },
});

const password = process.env.STAFF_PASSWORD ?? "";
const fail = (message) => {
  console.error(message);
  process.exit(1);
};
if (!values.username || !/^[a-z0-9._-]{3,40}$/i.test(values.username)) {
  fail("--username is required (3–40 letters, digits, . _ -)");
}
if (!["waiter", "manager"].includes(values.role)) fail("--role must be waiter or manager");
if (password.length < 10) fail("Set STAFF_PASSWORD (at least 10 characters)");

const user = await upsertStaffUser({
  username: values.username,
  displayName: values.name ?? values.username,
  role: values.role,
  password,
});
console.log(`saved ${user.role} "${user.username}" (${user.displayName})`);
await pool.end();
