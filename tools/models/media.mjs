/* Builds the browser media manifest and review inventory from the product catalog,
   photo credits, existing cocktail cards, and reviewed replacement assets. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replaceAll("\r\n", "\n");
const exists = (file) => fs.existsSync(path.join(root, file));
const products = JSON.parse(read("server/data/products.json"));
const replacements = JSON.parse(read("tools/models/replacements.json"));
const slugify = (value) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const drinks = {};
const cocktailScript = read("js/cocktails.js");
const dataSection = cocktailScript.slice(cocktailScript.indexOf("var DATA = {"), cocktailScript.indexOf("/* ---------- render ---------- */"));
for (const line of dataSection.split("\n")) {
  const name = line.match(/\bn:\s*"([^"]*)"/)?.[1];
  const photo = line.match(/\b(?:photo|cover):\s*"([^"]*)"/)?.[1];
  const price = line.match(/\bp:\s*"([^"]*)"/)?.[1] || "";
  if (!name || !photo) continue;
  const slug = slugify(`cocktail-${name}`);
  if (price.includes("/")) {
    drinks[`${slug}-piccola`] = photo;
    drinks[`${slug}-grande`] = photo;
  } else {
    drinks[slug] = photo;
  }
}

const credits = new Map();
for (const line of read("docs/PHOTO-CREDITS.md").split("\n")) {
  const match = line.match(/^\| `([^`]+)` \| (.+) \|$/);
  if (match) credits.set(match[1], match[2]);
}
const photoOverrides = JSON.parse(read("tools/models/photos.json"));

const slugs = new Set(products.map(({ slug }) => slug));
if (slugs.size !== products.length) throw new Error("Duplicate catalog slug");
for (const slug of new Set([...Object.keys(replacements), ...Object.keys(photoOverrides)])) {
  if (!slugs.has(slug)) throw new Error(`Media entry has unknown slug: ${slug}`);
}

const usedAssets = new Set();
const audit = JSON.parse(read("tools/models/asset-review.json"));
function pendingReason(product) {
  if (audit[product.slug]) return audit[product.slug];
  if (product.category === "cocktail") {
    if (/gin|birr/i.test(product.subcategory)) return "Awaiting the correct bottle or serving mesh and rights for any visible label.";
    return "Awaiting a reviewed glass, liquid and garnish assembly that matches the menu image.";
  }
  if (product.category === "bibite") return "Awaiting a reviewed drink or packaging model matching the served format and variant.";
  if (/coffee|matcha|latte|smoothie/i.test(product.subcategory)) {
    return "Awaiting a reviewed vessel, fill and surface finish for this drink variant.";
  }
  return "Awaiting a commercial-use mesh or reconstruction matching the serving and visible ingredients.";
}
const media = {};
for (const { slug } of products) {
  const own = `assets/img/items/${slug}.webp`;
  const photo = photoOverrides[slug]?.photo || (exists(own) ? own : drinks[slug]);
  if (!photo || !exists(photo)) throw new Error(`Missing photo for ${slug}`);

  const credit = credits.get(slug);
  const photoInfo = photoOverrides[slug] || {
    source: credit || "Existing cocktail-card image. Original source unverified.",
    authenticity: credit?.startsWith("Il Chiosco") ? "cafe-credited" : credit ? "representative" : "unverified",
    license: credit?.includes("Unsplash") ? "Unsplash License" : credit?.startsWith("Il Chiosco") ? "Café supplied" : "Existing photo rights unverified",
  };
  const model = replacements[slug] || { status: "pending" };
  // Keep the existing public image when its original rights are unverified.
  const photoThumbnail = photoInfo.license === "Existing photo rights unverified"
    ? photo
    : photo.replace(/^assets\/img\//, "assets/img/menu-thumbs/").replace(/\.[^.]+$/, ".webp");
  const thumbnail = model.thumbnail || photoThumbnail;
  if (model.thumbnail && (model.status !== "ready" || thumbnail !== `assets/img/menu-renders/${slug}.webp` || !exists(thumbnail))) {
    throw new Error(`Invalid model thumbnail for ${slug}`);
  }
  if (process.argv.includes("--check") && !exists(thumbnail)) throw new Error(`Missing thumbnail for ${slug}`);
  if (model.status === "ready") {
    for (const format of ["glb", "usdz"]) {
      const asset = model[format];
      if (asset !== `assets/models/realistic/${slug}.${format}` || !exists(asset) || usedAssets.has(asset)) {
        throw new Error(`Missing, shared, or invalid ${format} for ${slug}`);
      }
      usedAssets.add(asset);
    }
    if (!model.source || !model.license || !["authentic", "representative"].includes(model.authenticity) ||
        model.dimensionsM?.length !== 3 || !model.dimensionsM.every((value) => Number.isFinite(value) && value > 0)) {
      throw new Error(`Incomplete provenance or dimensions for ${slug}`);
    }
  } else if (model.status !== "pending") {
    throw new Error(`Unknown model status for ${slug}`);
  }
  media[slug] = { photo, thumbnail, photoSource: photoInfo.source, photoAuthenticity: photoInfo.authenticity, photoLicense: photoInfo.license, model };
}

const inventory = [
  "# Product media inventory",
  "",
  `Generated from the catalog by \`node tools/models/media.mjs\`. ${products.length} products · ${Object.keys(replacements).filter((slug) => replacements[slug].status === "ready").length} ready for 3D preview.`,
  "",
  "Photo origin is based on the repository credits. Café-credited photos still need product and portion confirmation for modeling. Dimensions are width × height × depth in meters. Pending products show their existing photo.",
  "",
  "| Product and slug | Image, thumbnail and source | Image authenticity and rights | Legacy model pair | Replacement source and authenticity | GLB / USDZ | Dimensions (m) | Quality and AR status |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
];

const cell = (value) => String(value).replaceAll("|", "\\|");
const sourceLink = (source) => source.startsWith("docs/") ? `../${source}` : source;
for (const product of products) {
  const { slug, name } = product;
  const entry = media[slug];
  const model = entry.model;
  const ready = model.status === "ready";
  const legacy = ["glb", "usdz"].map((format) => {
    const file = `assets/models/${slug}.${format}`;
    return exists(file) ? `[${format.toUpperCase()}](../${file})` : "Missing";
  }).join(" / ");
  const fields = [
    `${name} · \`${slug}\``,
    `[Image](../${entry.photo}) · [Thumbnail](../${entry.thumbnail}) · ${entry.photoSource}`,
    `${entry.photoAuthenticity} · ${entry.photoLicense}`,
    legacy,
    ready ? [`[${model.credit}](${sourceLink(model.source)})`, ...(model.additionalSources || []).map((item) => `[${item.credit}](${sourceLink(item.source)})`), model.license, model.authenticity].join(" · ") : pendingReason(product),
    ready ? `[GLB](../${model.glb}) / [USDZ](../${model.usdz})` : "Pending / Pending",
    ready ? `${model.dimensionsM.join(" × ")} · ${model.dimensionBasis}` : "Awaiting measurement",
    ready ? [model.appearance, model.arValidation].filter(Boolean).join(" ") : "Photo only · AR pending",
  ];
  inventory.push(`| ${fields.map(cell).join(" | ")} |`);
}

const outputs = {
  "js/menu-media.js": `/* Generated by tools/models/media.mjs. Edit sources, then regenerate. */\nwindow.IL_CHIOSCO_MEDIA = ${JSON.stringify(media, null, 2)};\n`,
  "docs/MENU-MEDIA-INVENTORY.md": inventory.join("\n") + "\n",
};
for (const [file, content] of Object.entries(outputs)) {
  if (process.argv.includes("--check")) {
    if (read(file).replaceAll("\r\n", "\n") !== content) throw new Error(`${file} is out of date`);
  } else {
    fs.writeFileSync(path.join(root, file), content);
  }
}
console.log(`Checked media for ${products.length} products`);
