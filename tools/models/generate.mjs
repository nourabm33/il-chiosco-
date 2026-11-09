/* Rebuilds the legacy comparison assets in tools/models/output/legacy.
   This directory is never used by the production manifest. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";
import { reseed } from "./lib.mjs";
import { ITEMS } from "./items.mjs";

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((buf) => { this.result = buf; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((buf) => { this.result = `data:application/octet-stream;base64,${Buffer.from(buf).toString("base64")}`; this.onloadend?.(); }); }
};

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const outDir = path.join(root, "tools/models/output/legacy");
fs.mkdirSync(outDir, { recursive: true });
const products = JSON.parse(fs.readFileSync(path.join(root, "server/data/products.json"), "utf8"));
const only = process.argv.slice(2);

const missing = products.filter((p) => !ITEMS[p.slug]).map((p) => p.slug);
if (missing.length) { console.error("No model for:", missing.join(", ")); process.exit(1); }

let total = 0;
for (const { slug } of products) {
  if (only.length && !only.includes(slug)) continue;
  reseed(slug);
  const scene = new THREE.Scene();
  scene.add(ITEMS[slug]());
  scene.updateMatrixWorld(true);
  const glb = Buffer.from(await new GLTFExporter().parseAsync(scene, { binary: true }));
  const usdz = Buffer.from(await new USDZExporter().parseAsync(scene));
  fs.writeFileSync(path.join(outDir, `${slug}.glb`), glb);
  fs.writeFileSync(path.join(outDir, `${slug}.usdz`), usdz);
  total += glb.length + usdz.length;
}
console.log(`Wrote comparison models to tools/models/output/legacy (${(total / 1e6).toFixed(1)} MB)`);
