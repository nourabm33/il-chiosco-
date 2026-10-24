/**
 * Checks that every table QR target is live before printing or deploying:
 *   PUBLIC_BASE_URL=https://nourabm33.github.io/il-chiosco- npm run qr:check
 * Each <PUBLIC_BASE_URL>/order?table=<n> (n = 1..TABLE_COUNT) must answer 200
 * with the browse-only table menu.
 */
import process from "node:process";
import { config } from "../src/config.js";

const base = config.publicBaseUrl.replace(/\/$/, "");
const marker = "rivolgiti al cameriere";
const failures = [];

for (let table = 1; table <= config.tableCount; table += 1) {
  const url = `${base}/order?table=${table}`;
  try {
    const res = await fetch(url, { redirect: "follow" });
    const body = await res.text();
    if (!res.ok || !body.includes(marker)) failures.push(`${url} → ${res.status}`);
  } catch (err) {
    failures.push(`${url} → ${err.message}`);
  }
}

if (failures.length) {
  console.error(`${failures.length} QR target(s) not OK:\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`All ${config.tableCount} QR targets OK (${base}/order?table=1..${config.tableCount})`);
