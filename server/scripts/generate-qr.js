/**
 * Regenerates the printable table QR codes.
 *
 *   PUBLIC_BASE_URL=https://ilchiosco.it node scripts/generate-qr.js
 *
 * Writes assets/qr/table_<n>.png for tables 1..TABLE_COUNT, each encoding
 * <PUBLIC_BASE_URL>/order?table=<n>.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { config } from "../src/config.js";

const outDir = path.resolve(
  fileURLToPath(new URL("../../assets/qr", import.meta.url)),
);
fs.mkdirSync(outDir, { recursive: true });

if (config.publicBaseUrl.includes("localhost")) {
  console.warn(
    "PUBLIC_BASE_URL is still localhost — set it to the real domain before printing.",
  );
}

for (let table = 1; table <= config.tableCount; table += 1) {
  const url = `${config.publicBaseUrl.replace(/\/$/, "")}/order?table=${table}`;
  await QRCode.toFile(path.join(outDir, `table_${table}.png`), url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 800,
  });
}

console.log(`wrote ${config.tableCount} QR codes to ${outDir} (${config.publicBaseUrl})`);
