import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO, getBounds } from "@gltf-transform/core";
import validator from "gltf-validator";

const root = fileURLToPath(new URL("../..", import.meta.url));
const read = (file) => fs.readFile(path.join(root, file));
const replacements = JSON.parse(await read("tools/models/replacements.json"));
const io = new NodeIO();
const toleranceM = 0.0005;

for (const [slug, model] of Object.entries(replacements)) {
  if (model.status !== "ready") continue;
  const bytes = await read(model.glb);
  const report = await validator.validateBytes(bytes, { uri: model.glb });
  assert.equal(report.issues.numErrors, 0, JSON.stringify(report.issues.messages, null, 2));
  assert.equal(report.issues.numWarnings, 0, JSON.stringify(report.issues.messages, null, 2));
  assert.equal(report.info.resources.every(({ storage }) => ["glb", "buffer-view"].includes(storage)), true, `${slug}: external resource`);
  assert.ok(bytes.length <= 5_000_000, `${slug}: GLB exceeds 5 MB`);
  assert.ok(report.info.totalTriangleCount <= 100_000, `${slug}: triangle budget exceeded`);

  assert.ok(report.info.materialCount <= 10 && report.info.maxUVs <= 1, `${slug}: Scene Viewer material or UV budget exceeded`);
  assert.ok(report.info.resources.every(({ image }) => !image || Math.max(image.width, image.height) <= 2048), `${slug}: texture exceeds 2K`);

  const document = await io.readBinary(bytes);
  const { min, max } = getBounds(document.getRoot().getDefaultScene());
  for (const [axis, dimension] of model.dimensionsM.entries()) {
    assert.ok(Math.abs(max[axis] - min[axis] - dimension) < toleranceM, `${slug}: axis ${axis} size mismatch`);
  }
  assert.ok(Math.abs(min[1]) < toleranceM, `${slug}: model does not rest on Y=0`);
  for (const axis of [0, 2]) {
    assert.ok(Math.abs((min[axis] + max[axis]) / 2) < toleranceM, `${slug}: model is not centered`);
  }
  console.log(`${slug}: GLB valid, ${report.info.totalTriangleCount} triangles, ${bytes.length} bytes, bounds match manifest`);
}
