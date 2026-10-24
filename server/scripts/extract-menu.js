/**
 * One-off importer: turns the menu that lives in the static pages
 * (index.html + js/cocktails.js) into server/data/products.json, which `npm
 * run seed` loads into the products table. Re-run it whenever the printed menu
 * on the site changes, then re-seed.
 *
 *   node scripts/extract-menu.js
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const outFile = path.join(root, "server/data/products.json");

const decode = (value) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, "")
    .trim();

const slugify = (value) =>
  decode(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** "1,5€" -> 150 ; "3€" -> 300 */
const toCents = (value) => {
  const match = decode(value).match(/(\d+)(?:[.,](\d{1,2}))?/);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "0").padEnd(2, "0"));
};

const products = [];
const seen = new Set();
let order = 0;

function push({ name, description, category, subcategory, price }) {
  const cents = toCents(price);
  if (cents === null) return;
  let slug = slugify(`${category}-${name}`);
  while (seen.has(slug)) slug = `${slug}-x`;
  seen.add(slug);
  products.push({
    slug,
    name: decode(name),
    description: description ? decode(description) : null,
    category,
    subcategory: subcategory ? decode(subcategory) : null,
    priceCents: cents,
    sortOrder: (order += 1),
  });
}

/* ---------- food menu, from index.html ---------- */
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const panelRe =
  /<div class="menu-panel[^"]*" id="panel-(alba|mezzogiorno|bibite)"[\s\S]*?(?=<div class="menu-panel|<\/section>)/g;

for (const panel of html.matchAll(panelRe)) {
  const category = panel[1];
  const catRe = /<div class="menu-cat__head"><h3>([\s\S]*?)<\/h3>[\s\S]*?(?=<div class="menu-cat |$)/g;
  for (const cat of panel[0].matchAll(catRe)) {
    const subcategory = decode(cat[1]);
    const itemRe =
      /<span class="menu-item__name">([\s\S]*?)<\/span>[\s\S]*?<span class="menu-item__price">([\s\S]*?)<\/span>\s*<\/div>(?:\s*<p class="menu-item__desc">([\s\S]*?)<\/p>)?/g;
    for (const item of cat[0].matchAll(itemRe)) {
      push({
        name: item[1],
        price: item[2],
        description: item[3],
        category,
        subcategory,
      });
    }
  }
}

/* ---------- drinks, from js/cocktails.js ---------- */
const drinksSource = fs.readFileSync(path.join(root, "js/cocktails.js"), "utf8");
const dataBlock = drinksSource.slice(
  drinksSource.indexOf("var DATA = {"),
  drinksSource.indexOf("/* ---------- render ---------- */"),
);
const labels = {
  signatures: "Signatures",
  classici: "I Classici",
  gin: "I Gin",
  birre: "Le Birre",
};

let group = null;
for (const line of dataBlock.split("\n")) {
  const groupStart = line.match(/^\s*(signatures|classici|gin|birre):\s*\[/);
  if (groupStart) {
    group = groupStart[1];
    continue;
  }
  if (!group) continue;

  const name = line.match(/\bn:\s*"([^"]*)"/)?.[1];
  const price = line.match(/\bp:\s*"([^"]*)"/)?.[1];
  const description = line.match(/\bd:\s*"([^"]*)"/)?.[1];
  if (!name || !price) continue;

  // A couple of beers are priced "small / large" — store them as two products.
  const parts = price.split("/").map((part) => part.trim());
  if (parts.length === 2) {
    const sizes = ["piccola", "grande"];
    parts.forEach((part, i) => {
      push({
        name: `${name} · ${sizes[i]}`,
        price: part,
        description,
        category: "cocktail",
        subcategory: labels[group],
      });
    });
  } else {
    push({ name, price, description, category: "cocktail", subcategory: labels[group] });
  }
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(products, null, 2)}\n`);
console.log(`wrote ${products.length} products to ${path.relative(root, outFile)}`);
