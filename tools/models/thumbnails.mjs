import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../..", import.meta.url));
const resolve = (file) => path.join(root, file);
const scope = { window: {} };
vm.runInNewContext(await fs.readFile(resolve("js/menu-media.js"), "utf8"), scope);

const entries = Object.values(scope.window.IL_CHIOSCO_MEDIA);
const photos = new Map(entries.filter(({ photo, thumbnail }) => photo !== thumbnail).map(({ photo, thumbnail }) => [thumbnail, photo]));
for (const [thumbnail, photo] of photos) {
  if (process.argv.includes("--check")) {
    const { width, height, format } = await sharp(resolve(thumbnail)).metadata();
    if (width > 384 || height > 384 || format !== "webp") throw new Error(`Invalid thumbnail: ${thumbnail}`);
    continue;
  }
  await fs.mkdir(path.dirname(resolve(thumbnail)), { recursive: true });
  await sharp(resolve(photo))
    .resize({ width: 384, height: 384, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(resolve(thumbnail));
}
console.log(`${photos.size} unique optimized thumbnails across ${entries.length} products`);
