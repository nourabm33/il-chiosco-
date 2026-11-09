/* Normalize an imported model into the staging folder. Inspect it before promotion. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { clearNodeTransform, dedup, flatten, metalRough, prune, simplify, tangents, unweld, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptSimplifier } from "meshoptimizer";
import { generateTangents } from "mikktspace";
import { Euler, Quaternion } from "three";
import sharp from "sharp";

const [input, name, widthM, pitch = "0", yaw = "0"] = process.argv.slice(2);
if (!input || !name || !/^[a-z0-9-]+$/.test(name) || !Number.isFinite(Number(widthM)) || Number(widthM) <= 0 ||
    ![pitch, yaw].every((angle) => Number.isFinite(Number(angle)))) {
  throw new Error("Usage: node tools/models/prepare-glb.mjs source.glb staging-name width-meters [pitch-degrees] [yaw-degrees]");
}

await Promise.all([MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const document = await io.read(path.resolve(input));
const root = document.getRoot();
const scene = root.getDefaultScene() || root.listScenes()[0];
if (!scene) throw new Error("No scene");
root.setDefaultScene(scene);
for (const other of root.listScenes()) if (other !== scene) other.dispose();
for (const camera of root.listCameras()) camera.dispose();
for (const animation of root.listAnimations()) animation.dispose();
await document.transform(metalRough());
for (const extension of root.listExtensionsUsed()) {
  if (extension.extensionName !== "KHR_texture_transform") extension.dispose();
}

let triangles = 0;
let needsTangents = false;
for (const mesh of root.listMeshes()) {
  for (const part of mesh.listPrimitives()) {
    if (part.getMode() !== 4) throw new Error("Only triangle meshes are supported");
    if (part.getAttribute("COLOR_0") && !part.getMaterial()?.getBaseColorTexture()) {
      throw new Error("Bake vertex colors to a texture before preparation");
    }
    part.setAttribute("COLOR_0", null);
    triangles += (part.getIndices()?.getCount() ?? part.getAttribute("POSITION").getCount()) / 3;
    needsTangents ||= Boolean(part.getMaterial()?.getNormalTexture() && !part.getAttribute("TANGENT"));
  }
}
if (!triangles) throw new Error("No renderable triangles");
if (triangles > 65_000) {
  await document.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 55_000 / triangles, error: .03 }));
}
if (needsTangents) await document.transform(unweld(), tangents({ generateTangents }), weld());
await document.transform(prune(), dedup());

for (const texture of root.listTextures()) {
  const pipeline = sharp(texture.getImage()).resize(1536, 1536, { fit: "inside", withoutEnlargement: true });
  const { isOpaque } = await pipeline.clone().stats();
  const bytes = isOpaque
    ? await pipeline.jpeg({ quality: 89, mozjpeg: true, chromaSubsampling: "4:4:4" }).toBuffer()
    : await pipeline.png({ compressionLevel: 9 }).toBuffer();
  texture.setImage(bytes).setMimeType(isOpaque ? "image/jpeg" : "image/png");
}

const group = document.createNode("Grounded product");
for (const child of scene.listChildren()) {
  scene.removeChild(child);
  group.addChild(child);
}
scene.addChild(group);
const deg = Math.PI / 180;
group.setRotation(new Quaternion().setFromEuler(new Euler(Number(pitch) * deg, Number(yaw) * deg, 0, "YXZ")).toArray());
const { min, max } = getBounds(scene);
const span = max[0] - min[0];
if (!Number.isFinite(span) || span <= 0) throw new Error("Invalid model bounds");
const scale = Number(widthM) / span;
group.setScale([scale, scale, scale]);
group.setTranslation([-(min[0] + max[0]) * scale / 2, -min[1] * scale, -(min[2] + max[2]) * scale / 2]);

// Bake the final coordinates so native viewers can use a tight ground-aligned bound.
await document.transform(flatten());
for (const node of scene.listChildren()) {
  const mesh = node.getMesh();
  if (mesh && mesh.listParents().filter((parent) => parent.propertyType === "Node").length > 1) {
    node.setMesh(mesh.clone());
  }
  clearNodeTransform(node);
}
await document.transform(prune());

const directory = fileURLToPath(new URL("./output/staged/", import.meta.url));
await fs.mkdir(directory, { recursive: true });
const dest = path.join(directory, name + ".glb");
await io.write(dest, document);
const bounds = getBounds(scene);
console.log(JSON.stringify({
  file: dest,
  dimensionsM: bounds.max.map((value, axis) => Number((value - bounds.min[axis]).toFixed(5))),
  bytes: (await fs.stat(dest)).size,
}));
