/* Vessels, garnishes and foods used by generate.mjs. */
import * as THREE from "three";
import { M, mat, mesh, lathe, vessel, fill, dome, sphere, box, cyl, roundedBox, slab, tube, group, at, rand } from "./lib.mjs";

/* ---------------- vessels ---------------- */
function handle(r, y0, y1, material, thick = 0.0045) {
  const mid = (y0 + y1) / 2, reach = (y1 - y0) * 0.55;
  return tube([[r - 0.002, y1, 0], [r + reach * 0.8, y1 - 0.002, 0], [r + reach, mid, 0], [r + reach * 0.8, y0 + 0.002, 0], [r - 0.002, y0, 0]], thick, "#ffffff", {}, false)
    .copy(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(r - 0.002, y1, 0), new THREE.Vector3(r + reach * 0.8, y1 - 0.002, 0), new THREE.Vector3(r + reach, mid, 0),
      new THREE.Vector3(r + reach * 0.8, y0 + 0.002, 0), new THREE.Vector3(r - 0.002, y0, 0)]), 32, thick, 10), material));
}

export function saucer(r = 0.068, material = M.ceramic()) {
  return mesh(lathe([[0, 0], [r * 0.6, 0], [r * 0.62, 0.003], [r, 0.011], [r - 0.002, 0.013], [r * 0.6, 0.006], [0, 0.006]]), material);
}

export const PROFILES = {
  espresso: [[0.02, 0], [0.026, 0.008], [0.032, 0.035], [0.034, 0.055]],
  cappuccino: [[0.026, 0], [0.04, 0.016], [0.047, 0.06], [0.049, 0.072]],
  mug: [[0.036, 0], [0.038, 0.04], [0.041, 0.085], [0.042, 0.09]],
  tall: [[0.029, 0], [0.033, 0.07], [0.036, 0.145]],
  tumbler: [[0.032, 0], [0.036, 0.05], [0.04, 0.105]],
  highball: [[0.03, 0], [0.031, 0.08], [0.032, 0.15]],
  rocks: [[0.038, 0], [0.04, 0.05], [0.042, 0.09]],
  coupe: [[0.038, 0], [0.038, 0.003], [0.005, 0.008], [0.004, 0.095], [0.02, 0.102], [0.045, 0.118], [0.055, 0.135], [0.056, 0.14]],
  martini: [[0.04, 0], [0.04, 0.003], [0.005, 0.008], [0.004, 0.105], [0.06, 0.165]],
  wine: [[0.036, 0], [0.036, 0.003], [0.005, 0.008], [0.004, 0.09], [0.03, 0.108], [0.043, 0.145], [0.036, 0.205]],
  balloon: [[0.04, 0], [0.04, 0.003], [0.005, 0.008], [0.004, 0.085], [0.035, 0.1], [0.052, 0.135], [0.05, 0.175], [0.045, 0.2]],
  pint: [[0.03, 0], [0.033, 0.06], [0.043, 0.15]],
  stange: [[0.026, 0], [0.026, 0.01], [0.03, 0.2]],
  weizen: [[0.03, 0], [0.026, 0.06], [0.034, 0.17], [0.036, 0.22], [0.032, 0.25]],
  sundae: [[0.03, 0], [0.03, 0.003], [0.008, 0.012], [0.008, 0.03], [0.04, 0.06], [0.045, 0.13]],
};
const STEMMED = { coupe: 0.098, martini: 0.108, wine: 0.093, balloon: 0.088, sundae: 0.033 };

export function glass(kind, { material, t, withHandle = false, onSaucer = false } = {}) {
  const outer = PROFILES[kind];
  const ceramic = kind === "espresso" || kind === "cappuccino";
  const base = STEMMED[kind] ?? (kind === "rocks" ? 0.016 : ceramic ? 0.006 : 0.008);
  const v = vessel(outer, { material: material || (ceramic ? M.ceramic() : M.glass()), t: t || (ceramic ? 0.0035 : 0.0022), base });
  if (withHandle || ceramic) {
    const [y0, y1] = ceramic ? [v.top * 0.3, v.top * 0.85] : [v.top * 0.2, v.top * 0.8];
    v.group.add(handle(outer[outer.length - 1][0] - 0.002, y0, y1, material || (ceramic ? M.ceramic() : M.glass()), ceramic ? 0.004 : 0.005));
  }
  if (onSaucer) {
    const s = saucer(kind === "espresso" ? 0.055 : 0.074, M.ceramic());
    v.group.position.y = 0.006;
    v.group = group(s, v.group);
  }
  return v;
}

/** Glass + liquid layers given as fractions of the cavity height. */
export function drink(kind, layers, opts = {}) {
  const v = glass(kind, opts);
  const inner = v.group.children.find((c) => c.isGroup) || v.group;
  const h = v.top - v.base;
  const lvl = (f) => v.base + h * f;
  const target = opts.onSaucer ? v.group.children[1] : v.group;
  const fv = { ...v, group: target };
  fill(fv, layers.map(([a, b, c, o, r]) => [lvl(a), lvl(b), c, o, r]));
  v.lvl = lvl;
  v.lift = opts.onSaucer ? 0.006 : 0;
  v.surface = (f) => [v.innerR(lvl(f)), lvl(f) + v.lift];
  void inner;
  return v;
}

/* ---------------- garnishes ---------------- */
export function foam(v, f, color = "#f3e7d3", h = 0.008) {
  const [r, y] = v.surface(f);
  return at(dome(r, h, color, { rough: 0.9 }), [0, y - 0.001, 0]);
}
export function dust(v, f, color, h = 0.0095) {
  const [r, y] = v.surface(f);
  return at(dome(r * 0.82, h, color, { rough: 1 }), [0, y, 0]);
}
export function art(v, f, color = "#fbf6ec") {
  const [r, y] = v.surface(f);
  return group(
    at(dome(r * 0.45, 0.009, color, { rough: 0.8 }), [0, y, r * 0.15], [0, 0, 0], [1, 1, 1.25]),
    at(dome(r * 0.25, 0.0095, "#c89b6d", { rough: 0.8 }), [0, y, r * 0.05]),
  );
}
export function ice(v, from, to, n = 5, size = 0.02) {
  const g = group();
  for (let i = 0; i < n; i++) {
    const f = from + ((to - from) * i) / Math.max(n - 1, 1);
    const [r, y] = v.surface(f);
    const a = rand(0, Math.PI * 2), d = Math.max(r - size * 0.75, 0) * rand(0.2, 0.9);
    g.add(roundedBox(size, size, size, size * 0.2, "#eef8ff", { rough: 0.08, opacity: 0.5 }, { p: [Math.cos(a) * d, y - size / 2, Math.sin(a) * d], r: [rand(0, 1), rand(0, 3), rand(0, 1)] }));
  }
  return g;
}
export function wheel(color, r = 0.022, place = {}) {
  return group(
    cyl(r, r, 0.004, color, { rough: 0.5 }, { r: [Math.PI / 2, 0, 0] }),
    cyl(r * 0.82, r * 0.82, 0.0046, "#fff6d6", { rough: 0.6, opacity: 0.9 }, { r: [Math.PI / 2, 0, 0] }),
  ).translateX(0).add(new THREE.Group()) && at(group(
    cyl(r, r, 0.004, color, { rough: 0.5 }, { r: [Math.PI / 2, 0, 0] }),
    cyl(r * 0.84, r * 0.84, 0.0048, shade(color), { rough: 0.6 }, { r: [Math.PI / 2, 0, 0] }),
  ), place.p, place.r);
}
function shade(c) { return "#" + new THREE.Color(c).lerp(new THREE.Color("#fff7d0"), 0.45).getHexString(); }
export function rimWheel(v, color, r = 0.022) {
  const R = v.outer[v.outer.length - 1][0];
  return wheel(color, r * 0.85, { p: [R - 0.002, v.top + v.lift - r * 0.15, 0], r: [0, 0.5, 0] });
}
export function straw(v, color = "#2d2d2d", lean = 0.25) {
  const len = v.top - v.base + 0.06;
  return cyl(0.003, 0.003, len, color, { rough: 0.4 }, { p: [0.01, v.base + v.lift + len / 2, 0], r: [0, 0, -lean] });
}
export function mint(p = [0, 0, 0]) {
  return group([0, 1, 2, 3].map((i) => sphere(0.009, "#3d8b37", { rough: 0.6 }, {
    p: [p[0] + Math.cos(i * 1.7) * 0.007, p[1] + 0.004 + i * 0.002, p[2] + Math.sin(i * 1.7) * 0.007], s: [1, 0.25, 0.55], r: [0.3, i * 1.7, 0.4],
  })));
}
export function cherry(p) {
  return group(sphere(0.008, "#7d0a1c", { rough: 0.2 }, { p }), cyl(0.0008, 0.0008, 0.025, "#5b3a1a", {}, { p: [p[0] + 0.003, p[1] + 0.012, p[2]], r: [0, 0, -0.3] }));
}
export function berry(color, r, p) { return sphere(r, color, { rough: 0.35 }, { p }); }
export function strawberry(p, s = 1) {
  return group(
    mesh(new THREE.ConeGeometry(0.009 * s, 0.022 * s, 16), mat("#d8243a", { rough: 0.35 }), { p: [p[0], p[1] + 0.011 * s, p[2]], r: [Math.PI, 0, 0] }),
    sphere(0.009 * s, "#d8243a", { rough: 0.35 }, { p: [p[0], p[1] + 0.02 * s, p[2]], s: [1, 0.6, 1] }),
    cyl(0.008 * s, 0.002 * s, 0.003 * s, "#3e8a2e", {}, { p: [p[0], p[1] + 0.025 * s, p[2]] }),
  );
}
export function starAnise(p) {
  return group([0, 1, 2, 3, 4, 5, 6, 7].map((i) => sphere(0.005, "#5a2e16", { rough: 0.8 }, {
    p: [p[0] + Math.cos(i * 0.785) * 0.006, p[1], p[2] + Math.sin(i * 0.785) * 0.006], s: [1.4, 0.5, 0.6], r: [0, -i * 0.785, 0],
  })));
}
export function whipped(r, y, color = "#fffaf0") {
  return group([0, 1, 2, 3].map((i) => mesh(new THREE.TorusGeometry(r * (1 - i * 0.22), r * 0.28 * (1 - i * 0.15), 12, 32), mat(color, { rough: 0.9 }), {
    p: [0, y + r * 0.25 + i * r * 0.32, 0], r: [Math.PI / 2, 0, i * 0.5],
  })), sphere(r * 0.25, color, { rough: 0.9 }, { p: [0, y + r * 1.35, 0] }));
}
export function sprinkles(r, y, colors, n = 24, size = 0.0025) {
  return group(Array.from({ length: n }, () => {
    const a = rand(0, Math.PI * 2), d = Math.sqrt(rand()) * r;
    return box(size, size * 0.7, size * 2.2, colors[Math.floor(rand(0, colors.length))], { rough: 0.7 }, { p: [Math.cos(a) * d, y, Math.sin(a) * d], r: [0, rand(0, 3), 0] });
  }));
}

/* ---------------- bottles, cans, cartons ---------------- */
export function bottle({ h = 0.2, r = 0.031, glassColor = "#8bc9a8", liquid = "#e8a23a", label = "#ffffff", label2, cap = "#c9a24b", neck = 0.011, opacity = 0.55 } = {}) {
  const prof = [[r * 0.9, 0], [r, 0.006], [r, h * 0.55], [r * 0.95, h * 0.62], [neck * 1.25, h * 0.82], [neck, h * 0.9], [neck, h * 0.98], [neck * 1.15, h * 0.985], [neck * 1.15, h]];
  const g = group(mesh(lathe(prof), mat(glassColor, { rough: 0.08, opacity })));
  const liq = prof.slice(0, 5).map(([rr, y]) => [rr - 0.002, Math.min(y, h * 0.78)]);
  g.add(mesh(lathe([[0, 0.003], ...liq.slice(1), [0, h * 0.78]]), mat(liquid, { rough: 0.2, opacity: 0.92 })));
  g.add(cyl(r + 0.0006, r + 0.0006, h * 0.26, label, { rough: 0.55 }, { p: [0, h * 0.3, 0] }, 48));
  if (label2) g.add(cyl(r + 0.0009, r + 0.0009, h * 0.07, label2, { rough: 0.5 }, { p: [0, h * 0.3, 0] }, 48));
  g.add(cyl(neck * 1.2, neck * 1.2, 0.012, cap, { rough: 0.3, metal: 0.7 }, { p: [0, h + 0.004, 0] }));
  return g;
}
export function can({ h = 0.115, r = 0.029, color = "#c8102e", band = "#ffffff" } = {}) {
  return group(
    mesh(lathe([[0, 0], [r * 0.85, 0], [r, 0.008], [r, h - 0.01], [r * 0.85, h], [r * 0.8, h + 0.002], [0, h + 0.002]]), mat("#c9ccd1", { rough: 0.25, metal: 0.9 })),
    cyl(r + 0.0005, r + 0.0005, h - 0.025, color, { rough: 0.35, metal: 0.3 }, { p: [0, h / 2, 0] }, 48),
    cyl(r + 0.0008, r + 0.0008, 0.012, band, { rough: 0.4 }, { p: [0, h * 0.55, 0] }, 48),
  );
}
export function carton({ w = 0.06, h = 0.16, d = 0.06, color = "#2f6fb5", band = "#ffffff", cap = "#ffffff" } = {}) {
  const gable = slab([[-w / 2, 0], [w / 2, 0], [0, 0.03]], d, color, { rough: 0.7 }, {}, 0.0005);
  gable.rotation.set(0, 0, 0);
  const roof = new THREE.Group(); roof.add(gable); gable.rotation.x = Math.PI / 2; gable.position.set(0, 0, -d / 2);
  return group(
    roundedBox(w, h, d, 0.004, color, { rough: 0.7 }),
    box(w + 0.001, h * 0.3, d + 0.001, band, { rough: 0.7 }, { p: [0, h * 0.45, 0] }),
    at(roof, [0, h, 0]),
    cyl(0.009, 0.009, 0.012, cap, { rough: 0.4 }, { p: [w * 0.18, h + 0.012, 0] }),
  );
}

/* ---------------- plates & bowls ---------------- */
export function plate(r = 0.11) {
  return mesh(lathe([[0, 0], [r * 0.82, 0], [r * 0.9, 0.009], [r, 0.015], [r - 0.002, 0.017], [r * 0.86, 0.006], [0, 0.004]], 64), M.steel());
}
export const PLATE_Y = 0.0045;
export function bowl(r = 0.075, h = 0.06, material = M.ceramic()) {
  return vessel([[r * 0.45, 0], [r * 0.5, 0.004], [r * 0.85, h * 0.45], [r, h]], { material, t: 0.004, base: 0.008 });
}

/* ---------------- bakery ---------------- */
export function croissant(color = "#c9822f", { size = 1, topping, filling } = {}) {
  const g = group();
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;
    const a = t * 2.3;
    const fat = Math.cos(t * Math.PI) * 0.75 + 0.3;
    const R = 0.055 * size;
    g.add(sphere(0.024 * size * fat, i % 2 ? color : shadeDark(color), { rough: 0.55 }, {
      p: [Math.sin(a) * R, 0.02 * size * fat, (Math.cos(a) - 0.6) * R], s: [0.9, 0.78, 1.25], r: [0, a, 0],
    }));
  }
  if (filling) for (const [c, dy] of filling) g.add(at(group(...Array.from({ length: 5 }, (_, i) => {
    const t = i / 4 - 0.5, a = t * 1.6;
    return box(0.03 * size, 0.004, 0.02 * size, c, { rough: 0.6 }, { p: [Math.sin(a) * 0.055 * size * 1.05, 0.019 * size + dy, (Math.cos(a) - 0.6) * 0.055 * size + 0.008], r: [0, a, 0] });
  })), [0, 0, 0]));
  if (topping) g.add(topping(size));
  return g;
}
function shadeDark(c) { return "#" + new THREE.Color(c).multiplyScalar(0.82).getHexString(); }
export const drizzle = (color) => (size) => group([-0.03, -0.01, 0.01, 0.03].map((x) => tube([[x * size, 0.044 * size, -0.03], [x * size + 0.008, 0.047 * size, 0], [x * size, 0.044 * size, 0.03]], 0.0022, color, { rough: 0.3 })));
export const crumbs = (color, n = 40) => (size) => group(Array.from({ length: n }, () => {
  const t = rand(-0.4, 0.4), a = t * 2.3;
  return box(0.004, 0.003, 0.004, color, { rough: 0.8 }, { p: [Math.sin(a) * 0.055 * size + rand(-0.006, 0.006), 0.04 * size + rand(-0.002, 0.004), (Math.cos(a) - 0.6) * 0.055 * size + rand(-0.008, 0.008)], r: [rand(0, 3), rand(0, 3), 0] });
}));
export function painAuChocolat() {
  return group(
    roundedBox(0.1, 0.035, 0.065, 0.02, "#c47a2c", { rough: 0.55 }),
    ...[-0.025, 0.025].map((x) => box(0.012, 0.006, 0.066, "#3b1f12", { rough: 0.6 }, { p: [x, 0.016, 0] })),
    ...[-0.04, -0.013, 0.013, 0.04].map((x) => box(0.003, 0.0015, 0.064, "#9c5a1e", { rough: 0.6 }, { p: [x, 0.035, 0] })),
  );
}
export function muffin(top = "#6b3b1f", dots = "#2a1a55") {
  const g = group(
    mesh(lathe([[0, 0], [0.026, 0], [0.034, 0.04], [0, 0.04]]), mat("#e7d8bf", { rough: 0.9 })),
    at(dome(0.04, 0.032, top, { rough: 0.85 }), [0, 0.038, 0]),
  );
  for (let i = 0; i < 14; i++) {
    const a = rand(0, 6.28), d = rand(0, 0.032), y = 0.038 + 0.032 * Math.sqrt(Math.max(1 - (d / 0.04) ** 2, 0));
    g.add(sphere(0.004, dots, { rough: 0.4 }, { p: [Math.cos(a) * d, y, Math.sin(a) * d] }));
  }
  return g;
}
export function cookie({ r = 0.05, color = "#c98a4b", chips = "#3b2012", top } = {}) {
  const g = group(mesh(lathe([[0, 0], [r * 0.95, 0], [r, 0.006], [r * 0.92, 0.014], [0, 0.017]]), mat(color, { rough: 0.85 })));
  for (let i = 0; i < 16; i++) {
    const a = rand(0, 6.28), d = rand(0, r * 0.85);
    g.add(sphere(0.004, chips, { rough: 0.5 }, { p: [Math.cos(a) * d, 0.015, Math.sin(a) * d], s: [1, 0.6, 1] }));
  }
  if (top) g.add(top);
  return g;
}
export function cinnamonRoll() {
  const pts = [];
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2 * 2.6;
    const r = 0.006 + (i / 120) * 0.04;
    pts.push([Math.cos(a) * r, 0.022, Math.sin(a) * r]);
  }
  const roll = tube(pts, 0.011, "#c98c4f", { rough: 0.7 });
  roll.scale.set(1, 1.6, 1);
  roll.position.y = -0.013;
  return group(roll, at(dome(0.048, 0.008, "#b07a45", { rough: 0.5 }), [0, 0.034, 0]));
}
export function nyRoll(cream = "#f2e3c6", glaze = "#6b3b1f") {
  const g = group(mesh(lathe([[0, 0], [0.042, 0], [0.046, 0.01], [0.046, 0.04], [0.043, 0.048], [0, 0.048]]), mat("#c47a2c", { rough: 0.55 })));
  for (let i = 0; i < 5; i++) g.add(cyl(0.0465, 0.0465, 0.0018, "#9c5a1e", { rough: 0.6 }, { p: [0, 0.008 + i * 0.008, 0] }, 48));
  g.add(at(dome(0.04, 0.008, glaze, { rough: 0.25 }), [0, 0.047, 0]));
  g.add(at(dome(0.015, 0.012, cream, { rough: 0.8 }), [0, 0.054, 0]));
  return g;
}
export function pieSlice() {
  const R = 0.1, a = 0.75, n = 10;
  const pts = [[0, 0]];
  for (let i = 0; i <= n; i++) { const t = -a / 2 + (a * i) / n; pts.push([Math.sin(t) * R, Math.cos(t) * R]); }
  const g = group(
    slab(pts, 0.008, "#b8742c", { rough: 0.6 }),
    at(slab(pts.map(([x, z]) => [x * 0.96, z * 0.96]), 0.026, "#e3b25e", { rough: 0.7 }), [0, 0.008, 0]),
  );
  for (let i = 0; i < 18; i++) {
    const t = rand(-a / 2 + 0.05, a / 2 - 0.05), d = rand(0.02, R * 0.9);
    g.add(sphere(0.008, i % 3 ? "#c98336" : "#a8601f", { rough: 0.5 }, { p: [Math.sin(t) * d, 0.035, Math.cos(t) * d], s: [1.3, 0.6, 1] }));
  }
  g.add(at(whipped(0.012, 0, "#fffaf0"), [0.03, 0, 0.0], [0, 0, 0], 1));
  return at(group(g), [0, 0, -0.045]);
}
export function bun(color = "#d9a35a", filling = [["#f2b6b0", 0.006], ["#f6d36b", 0.004]], s = 1) {
  const g = group(at(dome(0.038, 0.014, "#e8c48b", { rough: 0.8 }), [0, 0, 0], [Math.PI, 0, 0], [s, 1, s]));
  g.children[0].position.y = 0.014;
  let y = 0.014;
  for (const [c, h] of filling) { g.add(cyl(0.039 * s, 0.039 * s, h, c, { rough: 0.6 }, { p: [0, y + h / 2, 0] }, 24)); y += h; }
  g.add(at(dome(0.038 * s, 0.024, color, { rough: 0.55 }), [0, y, 0]));
  return g;
}

/* ---------------- kitchen ---------------- */
export function triangleSandwich(layers, { size = 0.09, bread = "#d6a466", crust = "#a8703a" } = {}) {
  const tri = [[-size / 2, -size / 2], [size / 2, -size / 2], [-size / 2, size / 2]];
  const g = group();
  let y = 0;
  const stack = [[bread, 0.012], ...layers, [bread, 0.012]];
  for (const [c, h, opts] of stack) {
    const isBread = c === bread;
    g.add(at(slab(tri.map(([x, z]) => (isBread ? [x, z] : [x * 1.04, z * 1.04])), h, isBread ? crust : c, { rough: 0.7, ...(opts || {}) }, {}, isBread ? 0.003 : 0.001), [0, y, 0]));
    y += h;
  }
  return g;
}
export function wrappedFocaccia(fill) {
  const g = group();
  for (const [x, rz] of [[-0.03, 0.18], [0.03, -0.18]]) {
    const half = group(
      roundedBox(0.05, 0.075, 0.075, 0.012, "#e3bf86", { rough: 0.8 }),
      ...fill.map(([c, y, h]) => box(0.052, h, 0.072, c, { rough: 0.6 }, { p: [0, y, 0] })),
      box(0.056, 0.05, 0.08, "#f5f1e6", { rough: 0.9 }, { p: [0, 0.025, 0] }),
      box(0.057, 0.006, 0.081, "#2f5a3a", { rough: 0.8 }, { p: [0, 0.035, 0] }),
    );
    g.add(at(half, [x, 0, 0], [0, 0, rz]));
  }
  return g;
}
export function pancakes(n = 4, { syrup = "#8a4b12", fruit } = {}) {
  const g = group();
  for (let i = 0; i < n; i++) g.add(at(mesh(lathe([[0, 0], [0.056, 0], [0.06, 0.006], [0.056, 0.012], [0, 0.012]]), mat(i % 2 ? "#d79a52" : "#e0a95f", { rough: 0.75 })), [rand(-0.003, 0.003), i * 0.0118, rand(-0.003, 0.003)]));
  const top = n * 0.0118;
  if (syrup) {
    g.add(at(dome(0.05, 0.004, syrup, { rough: 0.1, opacity: 0.85 }), [0, top, 0]));
    for (let i = 0; i < 5; i++) { const a = i * 1.3; g.add(cyl(0.004, 0.003, top * 0.7, syrup, { rough: 0.1, opacity: 0.85 }, { p: [Math.cos(a) * 0.058, top * 0.6, Math.sin(a) * 0.058] })); }
  }
  if (fruit) g.add(at(fruit, [0, top + 0.004, 0]));
  return g;
}
export function fruitMix(r = 0.04, n = 10, kinds = ["blue", "straw", "banana"]) {
  const g = group();
  for (let i = 0; i < n; i++) {
    const a = rand(0, 6.28), d = Math.sqrt(rand()) * r, p = [Math.cos(a) * d, 0.004, Math.sin(a) * d];
    const k = kinds[i % kinds.length];
    if (k === "blue") g.add(berry("#2b2d6b", 0.006, p));
    else if (k === "rasp") g.add(berry("#b3123a", 0.007, p));
    else if (k === "straw") g.add(strawberry([p[0], p[1] - 0.004, p[2]], 0.8));
    else if (k === "banana") g.add(cyl(0.011, 0.011, 0.005, "#f4e3a1", { rough: 0.6 }, { p, r: [rand(-0.3, 0.3), 0, rand(-0.3, 0.3)] }));
    else if (k === "kiwi") g.add(cyl(0.012, 0.012, 0.005, "#7fb53a", { rough: 0.5 }, { p, r: [rand(-0.3, 0.3), 0, 0] }));
  }
  return g;
}
export function granola(r, y, n = 30) {
  return group(Array.from({ length: n }, () => {
    const a = rand(0, 6.28), d = Math.sqrt(rand()) * r;
    return box(0.008, 0.005, 0.006, rand() > 0.5 ? "#b27a3c" : "#8f5a28", { rough: 0.9 }, { p: [Math.cos(a) * d, y, Math.sin(a) * d], r: [0, rand(0, 3), 0] });
  }));
}
export function toastSlice(color = "#b98448", { w = 0.1, d = 0.075, h = 0.016 } = {}) {
  return roundedBox(w, h, d, 0.02, color, { rough: 0.85 });
}
export function friedEgg(s = 1) {
  const pts = [];
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const r = 0.04 * s * (0.85 + 0.15 * Math.sin(i * 2.3)); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return group(slab(pts, 0.005, "#fbfaf4", { rough: 0.4 }, {}, 0.002), sphere(0.016 * s, "#f5a516", { rough: 0.2 }, { p: [0.004, 0.005, 0], s: [1, 0.55, 1] }));
}
export function bacon(n = 3) {
  const g = group();
  for (let k = 0; k < n; k++) {
    const pts = [];
    for (let i = 0; i <= 12; i++) pts.push([-0.06 + i * 0.01, 0.006 + Math.sin(i * 1.1 + k) * 0.004, k * 0.022 - 0.022]);
    const strip = tube(pts, 0.006, "#9c3b26", { rough: 0.6 });
    strip.scale.set(1, 0.45, 1.6);
    g.add(strip);
  }
  return g;
}
export function salmon(n = 3) {
  return group(Array.from({ length: n }, (_, i) => {
    const t = new THREE.TorusGeometry(0.025, 0.007, 8, 24, Math.PI * 1.2);
    return mesh(t, mat("#f08a5d", { rough: 0.45 }), { p: [(i - 1) * 0.03, 0.012, rand(-0.01, 0.01)], r: [0.2, i, 0], s: [1, 0.5, 1.8] });
  }));
}
export function avocadoHalf(s = 1) {
  const h = 0.02 * s;
  return group(
    at(dome(0.03 * s, h, "#33491a", { rough: 0.75 }), [0, h, 0], [Math.PI, 0, 0], [1, 1, 1.35]),
    at(dome(0.028 * s, 0.002, "#c9d86b", { rough: 0.5 }), [0, h, 0], [0, 0, 0], [1, 1, 1.35]),
    at(dome(0.017 * s, 0.0025, "#e6e88f", { rough: 0.5 }), [0, h + 0.0005, 0], [0, 0, 0], [1, 1, 1.3]),
    sphere(0.011 * s, "#6b3e1e", { rough: 0.4 }, { p: [0, h + 0.002, 0.004 * s], s: [1, 0.6, 1.1] }),
  );
}
export function v60() {
  const server = drink("mug", [[0, 0.35, "#3b1c0c", 0.9]], { t: 0.002 });
  const cone = vessel([[0.018, 0], [0.024, 0.004], [0.058, 0.07], [0.06, 0.072]], { material: M.ceramic(), t: 0.003, base: 0.006 });
  return group(server.group, at(cyl(0.05, 0.05, 0.004, "#f7f5f0", { rough: 0.35 }, {}), [0, 0.092, 0]), at(cone.group, [0, 0.094, 0]), at(dome(0.045, 0.01, "#5a3a22", { rough: 0.9 }), [0, 0.14, 0]));
}
export { fill };
