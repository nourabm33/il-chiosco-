/* Building blocks for the procedural menu models. Units are metres, origin at
   the bottom centre of the model, +Y up, so AR places items at real size. */
import * as THREE from "three";

export const V2 = (r, y) => new THREE.Vector2(Math.max(r, 0), y);

let seed = 1;
export function reseed(text) {
  seed = 2166136261;
  for (const ch of text) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
}
export function rand(min = 0, max = 1) {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return min + (((t ^ (t >>> 14)) >>> 0) / 4294967296) * (max - min);
}

const cache = new Map();
export function mat(color, { rough = 0.6, metal = 0, opacity = 1, name } = {}) {
  const key = [color, rough, metal, opacity].join("|");
  if (!cache.has(key)) {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: rough,
      metalness: metal,
      transparent: opacity < 1,
      opacity,
    });
    m.name = name || `m${cache.size}`;
    cache.set(key, m);
  }
  return cache.get(key);
}

export const M = {
  glass: () => mat("#f4fbff", { rough: 0.05, opacity: 0.22, name: "glass" }),
  ceramic: () => mat("#f7f5f0", { rough: 0.35, name: "ceramic" }),
  steel: () => mat("#c9ccd1", { rough: 0.28, metal: 0.95, name: "steel" }),
  ice: () => mat("#eaf6ff", { rough: 0.1, opacity: 0.45, name: "ice" }),
};

export function mesh(geo, material, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...p);
  m.rotation.set(...r);
  m.scale.set(...s);
  return m;
}

export const lathe = (pts, seg = 32) =>
  new THREE.LatheGeometry(pts.map(([r, y]) => V2(r, y)), seg);

export function radiusAt(profile, y) {
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1];
    const [r1, y1] = profile[i];
    if (y >= y0 && y <= y1 && y1 > y0) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
  }
  return profile[profile.length - 1][0];
}

/**
 * A lathed vessel (glass, cup, bowl). `outer` lists [radius, y] from the foot
 * to the rim; the cavity starts at `base`. Returns the mesh plus helpers to
 * fill it with liquid layers.
 */
export function vessel(outer, { t = 0.0022, base = 0.004, material = M.glass(), seg = 40 } = {}) {
  const top = outer[outer.length - 1][1];
  const cavity = outer.filter(([, y]) => y >= base);
  const inner = [[0, base], [radiusAt(outer, base) - t, base], ...cavity.map(([r, y]) => [r - t, y])];
  const pts = [[0, 0], ...outer, ...inner.reverse()];
  const group = new THREE.Group();
  group.add(mesh(lathe(pts, seg), material));
  const innerR = (y) => Math.max(radiusAt(outer, Math.max(y, base)) - t - 0.0007, 0.001);
  return { group, top, base, innerR, outer };
}

/** Liquid bands inside a vessel: [[fromY, toY, color, opacity?], ...]. */
export function fill(v, layers, { seg = 32 } = {}) {
  const g = new THREE.Group();
  for (const [y0, y1, color, opacity = 1, rough = 0.25] of layers) {
    const steps = 6;
    const pts = [[0, y0]];
    for (let i = 0; i <= steps; i++) {
      const y = y0 + ((y1 - y0) * i) / steps;
      pts.push([v.innerR(y), y]);
    }
    pts.push([0, y1]);
    g.add(mesh(lathe(pts, seg), mat(color, { rough, opacity })));
  }
  v.group.add(g);
  return g;
}

/** Slightly domed disc (foam, cream, glaze). */
export function dome(r, h, color, opts = {}) {
  const pts = [[0, 0], [r, 0]];
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push([r * Math.cos(a), h * Math.sin(a)]);
  }
  return mesh(lathe(pts, 40), mat(color, opts));
}

export const sphere = (r, color, opts = {}, place = {}) =>
  mesh(new THREE.SphereGeometry(r, 14, 10), mat(color, opts), place);
export const box = (w, h, d, color, opts = {}, place = {}) =>
  mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts), place);
export const cyl = (r0, r1, h, color, opts = {}, place = {}, seg = 32) =>
  mesh(new THREE.CylinderGeometry(r1, r0, h, seg), mat(color, opts), place);

export function roundedBox(w, h, d, radius, color, opts = {}, place = {}) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -d / 2, rr = Math.min(radius, w / 2, d / 2);
  shape.moveTo(x + rr, y);
  shape.lineTo(x + w - rr, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + rr);
  shape.lineTo(x + w, y + d - rr);
  shape.quadraticCurveTo(x + w, y + d, x + w - rr, y + d);
  shape.lineTo(x + rr, y + d);
  shape.quadraticCurveTo(x, y + d, x, y + d - rr);
  shape.lineTo(x, y + rr);
  shape.quadraticCurveTo(x, y, x + rr, y);
  const bevel = Math.min(h * 0.3, rr * 0.8);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(h - 2 * bevel, 0.0005), bevelEnabled: true, bevelThickness: bevel,
    bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 8,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  return mesh(geo, mat(color, opts), place);
}

/** Extruded 2D outline (points in the XZ plane), lying flat, thickness h. */
export function slab(points, h, color, opts = {}, place = {}, bevel = 0.002) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(h - 2 * bevel, 0.0005), bevelEnabled: bevel > 0, bevelThickness: bevel,
    bevelSize: bevel, bevelSegments: 2, curveSegments: 10,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  return mesh(geo, mat(color, opts), place);
}

export function tube(points, radius, color, opts = {}, closed = false, place = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed);
  return mesh(new THREE.TubeGeometry(curve, Math.min(Math.max(points.length * 4, 16), 160), radius, 8, closed), mat(color, opts), place);
}

export function group(...children) {
  const g = new THREE.Group();
  for (const c of children.flat()) if (c) g.add(c);
  return g;
}

export function at(obj, p = [0, 0, 0], r = [0, 0, 0], s = 1) {
  obj.position.set(...p);
  obj.rotation.set(...r);
  if (Array.isArray(s)) obj.scale.set(...s);
  else obj.scale.setScalar(s);
  return obj;
}
