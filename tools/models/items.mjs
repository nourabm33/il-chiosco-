/* slug -> model builder for every product in server/data/products.json. */
import { group, at, dome, cyl, sphere, box } from "./lib.mjs";
import * as P from "./parts.mjs";

const onPlate = (...food) => group(P.plate(), at(group(...food), [0, P.PLATE_Y, 0]));
const CLUB = [["#7fbf4a", 0.004], ["#e05a3a", 0.005], ["#f2d0c0", 0.008], ["#d8b16a", 0.01], ["#9c3b26", 0.005]];
const CREMA = "#c9955a", COFFEE = "#3b1c0c", MILK = "#f4ecdf";

function cup(kind, layers, extras = (v) => []) {
  const v = P.drink(kind, layers, { onSaucer: true });
  return group(v.group, ...extras(v));
}
function glassDrink(kind, layers, extras = (v) => [], opts = {}) {
  const v = P.drink(kind, layers, opts);
  return group(v.group, ...extras(v));
}
const latteGlass = (cols, top = "#f6efe3", extras = () => []) =>
  glassDrink("mug", cols, (v) => [P.foam(v, 0.92, top), ...extras(v)], { withHandle: true, onSaucer: true });
const iced = (cols, extras = () => []) => glassDrink("tall", cols, (v) => [P.ice(v, 0.35, 0.85, 5), P.straw(v), ...extras(v)]);
const spritz = (color, wheelColor = "#f28c28") =>
  glassDrink("balloon", [[0, 0.62, color, 0.85]], (v) => [P.ice(v, 0.25, 0.6, 4, 0.022), P.rimWheel(v, wheelColor, 0.024), P.straw(v, "#1f1f1f", 0.35)]);
const rocks = (color, garnish) => glassDrink("rocks", [[0, 0.7, color, 0.88]], (v) => [P.ice(v, 0.3, 0.65, 2, 0.032), garnish(v)]);
const highball = (color, wheelColor = "#9acd32") => glassDrink("highball", [[0, 0.85, color, 0.45]], (v) => [P.ice(v, 0.2, 0.8, 6, 0.024), P.rimWheel(v, wheelColor, 0.02), P.straw(v, "#111", 0.2)]);
const ginTonic = (tint, garnish = "#9acd32") => glassDrink("balloon", [[0, 0.7, tint, 0.35]], (v) => [P.ice(v, 0.2, 0.65, 5, 0.024), P.rimWheel(v, garnish, 0.022)]);
const orangePeel = (v) => P.rimWheel(v, "#f28c28", 0.02);
const lime = (v) => P.rimWheel(v, "#7fbf3a", 0.02);
const coupe = (c, g) => glassDrink("coupe", [[0, 0.75, c, 0.9]], (v) => (g ? [g(v)] : []));
const martini = (c, g) => glassDrink("martini", [[0, 0.8, c, 0.9]], (v) => (g ? [g(v)] : []));
const cherryOn = (v) => P.cherry([0, v.top - 0.01, 0]);
const beer = (kind, color = "#f2b632") => glassDrink(kind, [[0, 0.82, color, 0.8], [0.82, 0.97, "#fffaf0", 1, 0.9]]);

export const ITEMS = {
  /* --- coffee --- */
  "alba-espresso": () => cup("espresso", [[0, 0.7, COFFEE]], (v) => [P.dust(v, 0.7, CREMA, 0.003)]),
  "alba-cappuccino": () => cup("cappuccino", [[0, 0.82, COFFEE]], (v) => [P.foam(v, 0.82, "#efe2cc", 0.01), P.art(v, 0.86)]),
  "alba-latte-macchiato": () => glassDrink("tall", [[0, 0.45, MILK], [0.45, 0.62, "#a46a3c", 1], [0.62, 0.88, "#f8f2e8"]], (v) => [P.foam(v, 0.88, "#fbf7f0", 0.012)], { onSaucer: true }),
  "alba-flat-white": () => cup("cappuccino", [[0, 0.85, "#6b3f22"]], (v) => [P.foam(v, 0.85, "#d8b48a", 0.005), P.art(v, 0.87, "#f3e6d2")]),
  "alba-ginseng-orzo": () => cup("espresso", [[0, 0.75, "#7a4b2a"]], (v) => [P.dust(v, 0.75, "#c79a6b", 0.003)]),
  "alba-americano": () => cup("cappuccino", [[0, 0.85, "#2a1407"]], (v) => [P.dust(v, 0.85, "#8a5a32", 0.002)]),
  "alba-caffe-shakerato": () => martini("#2a1407", (v) => P.foam(v, 0.8, "#c99a66", 0.008)),
  "alba-marocchino": () => glassDrink("tumbler", [[0, 0.3, "#4a2414"], [0.3, 0.55, COFFEE], [0.55, 0.8, "#efe2cc"]], (v) => [P.dust(v, 0.8, "#5a2e16", 0.006)], { onSaucer: true }),
  "alba-iced-americano": () => iced([[0, 0.85, "#2a1407", 0.92]]),
  "alba-iced-latte": () => iced([[0, 0.55, MILK], [0.55, 0.85, "#8a5530", 0.95]]),
  "alba-vanilla-latte": () => latteGlass([[0, 0.92, "#e9d6b8"]], "#fbf3e2"),
  "alba-caramel-latte": () => latteGlass([[0, 0.92, "#d3a26b"]], "#f6ead6", (v) => [P.dust(v, 0.92, "#b06a24", 0.012)]),
  "alba-coconut-latte": () => latteGlass([[0, 0.92, "#efe6d8"]], "#ffffff", (v) => [P.sprinkles(v.innerR(v.lvl(0.9)) * 0.8, v.lvl(0.92) + v.lift + 0.009, ["#ffffff", "#f3efe6"], 30)]),
  "alba-caffe-in-filtro-v60": () => P.v60(),
  /* --- matcha / latte --- */
  "alba-matcha-latte": () => cup("cappuccino", [[0, 0.82, "#7fa43a"]], (v) => [P.foam(v, 0.82, "#a8c46a", 0.008), P.art(v, 0.85, "#f3f1dc")]),
  "alba-matcha-strawberry-latte": () => iced([[0, 0.3, "#e0566e"], [0.3, 0.6, "#f6eee6"], [0.6, 0.85, "#7fa43a", 0.95]], (v) => [P.strawberry([0.012, v.top - 0.005, 0])]),
  "alba-matcha-ube-latte": () => iced([[0, 0.35, "#7fa43a"], [0.35, 0.6, "#f4eee8"], [0.6, 0.85, "#8e5bb5", 0.95]]),
  "alba-ube-vanilla-latte": () => latteGlass([[0, 0.92, "#a77fd0"]], "#e9dcf5"),
  "alba-strawberry-cream-latte": () => latteGlass([[0, 0.92, "#e7b8cf"]], "#f8e4ec", (v) => [P.strawberry([0, v.lvl(0.92) + v.lift + 0.006, 0], 1.1)]),
  "alba-pumpkin-spice-latte": () => latteGlass([[0, 0.92, "#c98a4b"]], "#f6e9d6", (v) => [P.whipped(0.022, v.lvl(0.92) + v.lift), P.dust(v, 0.92, "#a0602a", 0.016)]),
  "alba-anise-cardamom-latte": () => glassDrink("tumbler", [[0, 0.6, "#e7d5bd"], [0.6, 0.9, "#f8f2e8"]], (v) => [P.dust(v, 0.9, "#a87346", 0.004), P.starAnise([0, v.lvl(0.9) + 0.006, 0])]),
  "alba-chai-latte": () => latteGlass([[0, 0.92, "#c79a72"]], "#efdcc5", (v) => [P.dust(v, 0.92, "#8a5a32", 0.01), P.starAnise([0.01, v.lvl(0.92) + v.lift + 0.011, 0])]),
  "alba-apple-pie-smoothie": () => glassDrink("tumbler", [[0, 0.9, "#e9d2a8"]], (v) => [P.whipped(0.018, v.lvl(0.9)), P.straw(v, "#f2e4c8"), P.dust(v, 0.9, "#a0602a", 0.004)]),
  "alba-banana-bread-smoothie": () => glassDrink("tumbler", [[0, 0.9, "#efe0b0"]], (v) => [P.straw(v, "#f2e4c8"), at(cyl(0.012, 0.012, 0.005, "#f4e3a1"), [0.02, v.top - 0.006, 0], [1.2, 0, 0])]),
  /* --- bakery --- */
  "alba-apple-pie": () => onPlate(P.pieSlice()),
  "alba-new-york-roll": () => onPlate(P.nyRoll("#c9df9a", "#7aa24a")),
  "alba-cinnamon-roll": () => onPlate(P.cinnamonRoll(), at(P.whipped(0.012, 0), [0.05, 0, 0.02])),
  "alba-crumbl-cookies": () => onPlate(P.cookie({ top: group(at(dome(0.022, 0.012, "#4a2614", { rough: 0.3 }), [0.005, 0.016, 0]), P.sprinkles(0.02, 0.026, ["#e23b4e", "#2f9e44", "#f2c94c", "#3b82f6"], 30), P.berry("#b3123a", 0.005, [0.022, 0.02, -0.01]), P.berry("#b3123a", 0.005, [0.026, 0.02, -0.003])) })),
  "alba-croissant-lievito-madre-vuoto": () => onPlate(P.croissant()),
  "alba-croissant-vegano-vuoto": () => onPlate(P.croissant("#c38a3e")),
  "alba-croissant-vegano-albicocca": () => onPlate(P.croissant("#c38a3e", { topping: P.crumbs("#f0a030", 12) })),
  "alba-croissant-crema-o-cioccolato": () => onPlate(P.croissant("#c9822f", { topping: P.drizzle("#3b1f12") })),
  "alba-croissant-pistacchio-o-mandorla": () => onPlate(P.croissant("#c9822f", { topping: P.crumbs("#8fbf4a", 50) })),
  "alba-croissant-cereali-miele-o-lampone": () => onPlate(P.croissant("#a9692a", { topping: P.crumbs("#e8d9b0", 40) })),
  "alba-pain-au-chocolat": () => onPlate(P.painAuChocolat()),
  "alba-muffin-cioccolato-yogurt-e-mirtilli": () => onPlate(P.muffin()),
  "alba-mini-panino-farcito": () => onPlate(at(P.bun("#d49a4f", [["#9cc96b", 0.003], ["#f2b6b0", 0.006], ["#f6d36b", 0.004]], 0.85), [-0.035, 0, 0]), at(P.bun("#d49a4f", [["#f2b6b0", 0.006]], 0.85), [0.04, 0, 0.01])),
  "alba-croissant-salato-farcito": () => onPlate(P.croissant("#c9822f", { filling: [["#9cc96b", 0], ["#f2b6b0", 0.004], ["#f6d36b", 0.008]] })),
  "alba-toast-prosciutto-cotto-e-formaggio": () => onPlate(at(P.triangleSandwich([["#f6d36b", 0.004], ["#f2b6b0", 0.006]], { bread: "#d9b07a", crust: "#c48a45" }), [0, 0, 0], [0, 0.6, 0])),
  /* --- brunch --- */
  "mezzogiorno-pancake-sciroppo-d-acero": () => onPlate(P.pancakes(5)),
  "mezzogiorno-pancake-frutta-di-stagione-yogurt": () => onPlate(P.pancakes(4, { syrup: null, fruit: group(at(dome(0.03, 0.01, "#fbf8f0"), [0, 0, 0]), P.fruitMix(0.035, 10, ["straw", "blue", "banana", "kiwi"])) })),
  "mezzogiorno-yogurt-frutta-granola-home-made": () => { const b = P.bowl(); P.fill(b, [[b.base, 0.045, "#fbf8f0"]]); return group(b.group, P.granola(0.04, 0.048), at(P.fruitMix(0.04, 10, ["straw", "blue", "rasp"]), [0, 0.045, 0])); },
  "mezzogiorno-porridge-con-frutta-e-latte-di-avena": () => { const b = P.bowl(); P.fill(b, [[b.base, 0.042, "#e3d2b0"]]); return group(b.group, at(P.fruitMix(0.045, 12, ["banana", "blue", "straw", "rasp"]), [0, 0.042, 0])); },
  "mezzogiorno-avocado-toast": () => onPlate(P.toastSlice("#7a5230"), at(box(0.09, 0.006, 0.065, "#9cc254", { rough: 0.8 }), [0, 0.018, 0]), at(P.friedEgg(0.7), [0.005, 0.022, 0])),
  "mezzogiorno-pan-tomate": () => onPlate(at(P.toastSlice("#d6a466", { w: 0.13, d: 0.06 }), [0, 0, -0.02]), at(box(0.12, 0.005, 0.052, "#d8402b", { rough: 0.6 }), [0, 0.018, -0.02]), at(P.toastSlice("#d6a466", { w: 0.13, d: 0.06 }), [0, 0, 0.05]), at(box(0.12, 0.005, 0.052, "#d8402b", { rough: 0.6 }), [0, 0.018, 0.05])),
  "mezzogiorno-club-sandwich-del-chiosco": () => onPlate(
    at(P.triangleSandwich(CLUB), [-0.022, 0, -0.012], [0, 0.35, 0]),
    at(P.triangleSandwich(CLUB), [0.024, 0, 0.014], [0, Math.PI + 0.35, 0])),
  "mezzogiorno-il-chiosco-s-brunch-plate": () => onPlate(at(P.friedEgg(0.9), [-0.03, 0, -0.03]), at(P.bacon(2), [0.035, 0, -0.03], [0, 0.4, 0], 0.7), at(P.toastSlice("#b98448", { w: 0.07, d: 0.055 }), [0.03, 0, 0.045]), at(P.avocadoHalf(0.8), [-0.04, 0, 0.045])),
  "mezzogiorno-super-focacciona-vegetariana": () => onPlate(P.wrappedFocaccia([["#d8402b", 0.03, 0.008], ["#f7f1df", 0.04, 0.008], ["#6b8f3a", 0.05, 0.005]])),
  "mezzogiorno-super-focacciona": () => onPlate(P.wrappedFocaccia([["#f2b6b0", 0.03, 0.01], ["#f6d36b", 0.042, 0.006]]), P.sprinkles(0.03, 0.08, ["#f5d36b", "#e8c050"], 30, 0.008)),
  "mezzogiorno-uovo": () => onPlate(P.friedEgg()),
  "mezzogiorno-bacon": () => onPlate(P.bacon(3)),
  "mezzogiorno-salmone-affumicato": () => onPlate(P.salmon(3)),
  "mezzogiorno-avocado": () => onPlate(P.avocadoHalf()),
  /* --- soft drinks --- */
  "bibite-kombucha-laverve": () => P.bottle({ h: 0.2, glassColor: "#c99a52", liquid: "#d9a441", label: "#f4efe4", label2: "#2f5a3a", cap: "#2f2f2f" }),
  "bibite-bibite-galvanina-bio": () => P.bottle({ h: 0.19, r: 0.028, glassColor: "#e8f3ea", liquid: "#f39a2b", label: "#ffffff", label2: "#1f7a3a", cap: "#c9a24b", opacity: 0.35 }),
  "bibite-succo-di-frutta-looza": () => P.bottle({ h: 0.17, r: 0.03, glassColor: "#f4f4f4", liquid: "#f4a21c", label: "#1f5aa6", label2: "#f6c232", cap: "#1f5aa6", opacity: 0.35 }),
  "bibite-spremuta": () => glassDrink("tumbler", [[0, 0.85, "#f39a1c", 0.95]], (v) => [P.rimWheel(v, "#f28c28", 0.024), P.straw(v, "#f2f2f2")]),
  "bibite-bibite-in-vetro": () => P.bottle({ h: 0.2, r: 0.028, glassColor: "#dfeee2", liquid: "#e8d35a", label: "#ffffff", label2: "#c8102e", cap: "#c9a24b", opacity: 0.35 }),
  "bibite-coca-cola-vetro": () => P.bottle({ h: 0.2, r: 0.028, glassColor: "#c9e3d6", liquid: "#2a0f08", label: "#d4101c", label2: "#ffffff", cap: "#d4101c", opacity: 0.5 }),
  "bibite-coca-cola-zero-vetro": () => P.bottle({ h: 0.2, r: 0.028, glassColor: "#c9e3d6", liquid: "#2a0f08", label: "#151515", label2: "#d4101c", cap: "#151515", opacity: 0.5 }),
  "bibite-estathe-limone": () => P.carton({ w: 0.05, h: 0.11, d: 0.035, color: "#f4d21c", band: "#1d4fa0", cap: "#1d4fa0" }),
  "bibite-estathe-pesca": () => P.carton({ w: 0.05, h: 0.11, d: 0.035, color: "#f4a24a", band: "#1d4fa0", cap: "#1d4fa0" }),
  "bibite-acquainbrick": () => P.carton({ w: 0.06, h: 0.16, d: 0.06, color: "#f5f7fa", band: "#3f8fd6", cap: "#3f8fd6" }),
  /* --- aperitivo drinks --- */
  "bibite-aperol-spritz": () => spritz("#f26a1b"),
  "bibite-campari-spritz": () => spritz("#c8102e"),
  "bibite-select-spritz": () => spritz("#b8202f", "#7fbf3a"),
  "bibite-hugo-spritz": () => glassDrink("balloon", [[0, 0.62, "#e7f0c8", 0.6]], (v) => [P.ice(v, 0.25, 0.6, 4, 0.022), P.rimWheel(v, "#7fbf3a", 0.022), P.mint([0, v.lvl(0.62), 0])]),
  "bibite-americano": () => rocks("#b3261e", orangePeel),
  "bibite-negroni": () => rocks("#9e1b12", orangePeel),
  "bibite-gin-tonic": () => ginTonic("#e6f4ff"),
  "bibite-vodka-tonic": () => highball("#eef8ff", "#f2e25c"),
  "bibite-calice-di-vino": () => glassDrink("wine", [[0, 0.45, "#7a1027", 0.85]]),
  "bibite-birra-alla-spina": () => beer("pint"),
  /* --- cocktail signatures --- */
  "cocktail-good-vibes": () => glassDrink("tumbler", [[0, 0.5, "#ff5e62", 0.9], [0.5, 0.85, "#ff9a6b", 0.9]], (v) => [P.ice(v, 0.3, 0.8, 4), P.rimWheel(v, "#f28c28")]),
  "cocktail-the-change": () => coupe("#6b6bd6", (v) => P.foam(v, 0.75, "#efe7ff", 0.006)),
  "cocktail-american-love": () => rocks("#b81e18", orangePeel),
  "cocktail-zafferoni": () => glassDrink("highball", [[0, 0.85, "#ffd24a", 0.75]], (v) => [P.ice(v, 0.2, 0.8, 5), P.rimWheel(v, "#f2e25c", 0.02)]),
  "cocktail-fig-storm": () => coupe("#e9a23a", (v) => P.cherry([0.03, v.top + 0.002, 0])),
  "cocktail-negroni-s-wife": () => coupe("#4f63d6", (v) => P.mint([0.03, v.top, 0])),
  "cocktail-daiquiri-frozen": () => martini("#d0476e", (v) => P.foam(v, 0.8, "#e36b8d", 0.016)),
  "cocktail-queen-g": () => ginTonic("#ffb43d", "#f28c28"),
  "cocktail-sun-kissed": () => glassDrink("highball", [[0, 0.4, "#ff5fa2", 0.9], [0.4, 0.85, "#ffb3d1", 0.85]], (v) => [P.ice(v, 0.2, 0.8, 5), P.rimWheel(v, "#f28c28"), P.straw(v, "#f2f2f2")]),
  "cocktail-purple-mirage": () => coupe("#9a5fc0", (v) => P.foam(v, 0.75, "#e4d2f0", 0.005)),
  /* --- classics --- */
  "cocktail-spritz": () => spritz("#f26a1b"),
  "cocktail-americano": () => rocks("#b3261e", orangePeel),
  "cocktail-negroni": () => rocks("#9e1b12", orangePeel),
  "cocktail-margarita": () => coupe("#e4f0b0", lime),
  "cocktail-mojito": () => glassDrink("highball", [[0, 0.85, "#d8f3c4", 0.5]], (v) => [P.ice(v, 0.2, 0.8, 6, 0.022), P.mint([0, v.lvl(0.86), 0]), P.rimWheel(v, "#7fbf3a", 0.02), P.straw(v, "#111")]),
  "cocktail-mojito-fidel": () => glassDrink("highball", [[0, 0.85, "#b9e3a2", 0.55]], (v) => [P.ice(v, 0.2, 0.8, 6, 0.022), P.mint([0, v.lvl(0.86), 0]), P.straw(v, "#111")]),
  "cocktail-tommy-s-mezcal": () => rocks("#e4d59a", lime),
  "cocktail-paloma": () => highball("#ff8fa2", "#f47a7a"),
  "cocktail-gin-tonic": () => ginTonic("#e6f4ff"),
  "cocktail-vodka-tonic": () => highball("#eef8ff", "#f2e25c"),
  "cocktail-cuba-libre": () => highball("#3e2412", "#7fbf3a"),
  "cocktail-campari-shakerato": () => martini("#d0283b", (v) => P.foam(v, 0.8, "#e85a6a", 0.006)),
  "cocktail-pina-colada": () => glassDrink("sundae", [[0, 0.82, "#fff2cf"]], (v) => [P.whipped(0.016, v.lvl(0.82)), P.cherry([0, v.lvl(0.82) + 0.035, 0]), P.rimWheel(v, "#f2c94c", 0.024), P.straw(v, "#e23b4e")]),
  /* --- gin (served as gin tonic) --- */
  "cocktail-ngricca-house-gin": () => ginTonic("#ffd0e0", "#e2557f"),
  "cocktail-windspiel-premium-dry": () => ginTonic("#ece4fa", "#f2e25c"),
  "cocktail-electric-spirit-co": () => ginTonic("#f3f5df", "#7fbf3a"),
  "cocktail-martin-miller-s-original": () => ginTonic("#e8f4ff", "#f28c28"),
  "cocktail-westbourne-strength": () => ginTonic("#fdf0d4", "#f2e25c"),
  "cocktail-44-n-gin": () => ginTonic("#fff3cc", "#f2e25c"),
  "cocktail-gin-mare": () => ginTonic("#eef5de", "#7fbf3a"),
  "cocktail-gin-hendrick-s": () => ginTonic("#e6f6ef", "#6fae4f"),
  "cocktail-gin-malfy-rosa": () => ginTonic("#ffd6de", "#f47a7a"),
  /* --- beers --- */
  "cocktail-forst-vip-pils-spina-piccola": () => at(beer("pint", "#f5c543"), [0, 0, 0], [0, 0, 0], 0.85),
  "cocktail-forst-vip-pils-spina-grande": () => beer("pint", "#f5c543"),
  "cocktail-forst-1857-33cl": () => P.bottle({ h: 0.23, r: 0.031, glassColor: "#5a3a12", liquid: "#e9b137", label: "#f2ead2", label2: "#b0242c", cap: "#c9a24b", opacity: 0.8 }),
  "cocktail-forst-0-0": () => P.bottle({ h: 0.23, r: 0.031, glassColor: "#5a3a12", liquid: "#f3d684", label: "#1f4e8c", label2: "#f2ead2", cap: "#1f4e8c", opacity: 0.8 }),
  "cocktail-weihenstephan-helles-50cl": () => beer("stange", "#f3c54a"),
  "cocktail-weihenstephan-weissbier-50cl": () => beer("weizen", "#e9b85a"),
  "cocktail-hobgoblin-ipa-50cl": () => beer("pint", "#a8521c"),
};
void sphere;
