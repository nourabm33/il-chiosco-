/* ============================================================
   Il Chiosco — animated cocktail cards
   Each drink is rendered as a card with a custom illustrated,
   animated glass (color-matched to the drink). Swap the SVG for
   a real photo later by giving an item a `photo` property.
   ============================================================ */
(function () {
  "use strict";

  var STROKE = "#e4d6b3";

  /* ---------- glass illustrations ---------- */
  function bubbles(points) {
    return points.map(function (p, i) {
      return '<circle class="bubble" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (p[2] || 1.7) +
        '" style="animation-delay:' + (i * 0.6) + 's"/>';
    }).join("");
  }

  function glass(type, gid, col, garnish) {
    var g =
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + col[0] + '"/>' +
      '<stop offset="1" stop-color="' + col[1] + '"/></linearGradient></defs>';

    var liquid = 'fill="url(#' + gid + ')"';
    var line = 'fill="none" stroke="' + STROKE + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
    var gar = garnish ? '<circle cx="0" cy="0" r="0"/>' : "";
    var art = "";

    switch (type) {
      case "coupe":
        art =
          '<path d="M31,41 Q60,78 89,41 Z" ' + liquid + '/>' +
          bubbles([[52, 52], [66, 49], [60, 58]]) +
          '<path d="M24,40 Q60,86 96,40" ' + line + '/>' +
          '<ellipse cx="60" cy="40" rx="36" ry="7" ' + line + '/>' +
          '<path d="M60,74 L60,110" ' + line + '/>' +
          '<ellipse cx="60" cy="113" rx="16" ry="4" ' + line + '/>';
        if (garnish) gar = '<circle cx="85" cy="36" r="5.5" fill="' + garnish + '"/>';
        break;
      case "wine":
        art =
          '<path d="M34,40 Q38,77 60,80 Q82,77 86,40 Z" ' + liquid + '/>' +
          bubbles([[52, 56], [66, 52], [60, 64]]) +
          '<path d="M30,36 Q34,84 60,86 Q86,84 90,36" ' + line + '/>' +
          '<ellipse cx="60" cy="36" rx="30" ry="6" ' + line + '/>' +
          '<path d="M60,86 L60,116" ' + line + '/>' +
          '<ellipse cx="60" cy="119" rx="16" ry="4" ' + line + '/>';
        if (garnish) gar = '<circle cx="82" cy="40" r="6" fill="' + garnish + '"/>';
        break;
      case "highball":
        art =
          '<path d="M47,58 L73,58 L70,123 Q70,126 67,126 L53,126 Q50,126 50,123 Z" ' + liquid + '/>' +
          bubbles([[55, 110], [66, 98], [60, 84], [57, 72]]) +
          '<path d="M44,24 L76,24 L72,124 Q72,128 68,128 L52,128 Q48,128 48,124 Z" ' + line + '/>' +
          '<rect x="53" y="62" width="11" height="11" rx="2.5" transform="rotate(12 58 67)" ' + line + '/>';
        if (garnish) gar = '<circle cx="71" cy="27" r="5.5" fill="' + garnish + '"/>';
        break;
      case "rocks":
        art =
          '<path d="M45,72 L75,72 L73,103 Q73,106 70,106 L50,106 Q47,106 47,103 Z" ' + liquid + '/>' +
          bubbles([[55, 96], [66, 90]]) +
          '<path d="M40,54 L80,54 L77,104 Q77,108 73,108 L47,108 Q43,108 43,104 Z" ' + line + '/>' +
          '<rect x="52" y="74" width="13" height="13" rx="3" transform="rotate(14 58 80)" ' + line + '/>';
        if (garnish) gar = '<circle cx="73" cy="57" r="5.5" fill="' + garnish + '"/>';
        break;
      case "balloon":
        art =
          '<path d="M33,50 Q60,70 87,50 Q88,80 60,85 Q32,80 33,50 Z" ' + liquid + '/>' +
          bubbles([[50, 66], [70, 64], [60, 74]]) +
          '<path d="M30,46 Q30,16 60,16 Q90,16 90,46 Q90,82 60,87 Q30,82 30,46 Z" ' + line + '/>' +
          '<path d="M60,87 L60,116" ' + line + '/>' +
          '<ellipse cx="60" cy="119" rx="18" ry="4" ' + line + '/>';
        if (garnish) gar = '<circle cx="44" cy="40" r="4.5" fill="' + garnish + '"/><circle cx="74" cy="36" r="3.5" fill="' + garnish + '"/>';
        break;
      case "pint":
        art =
          '<path d="M44,46 L76,46 L81,116 L39,116 Z" ' + liquid + '/>' +
          bubbles([[52, 104], [64, 92], [58, 78], [68, 66]]) +
          '<path d="M40,30 Q45,18 53,25 Q60,15 67,24 Q75,17 80,30 L79,42 L41,42 Z" fill="#fdf6e6"/>' +
          '<path d="M42,28 L78,28 L84,118 L36,118 Z" ' + line + '/>';
        break;
      default:
        art = "";
    }
    return '<svg class="glass-svg" viewBox="0 0 120 140" role="img" aria-hidden="true">' +
      g + '<g class="glass-sway">' + art + gar + '</g></svg>';
  }

  /* ---------- data ---------- */
  var DATA = {
    signatures: [
      { n: "Signature 1", p: "10€", d: "Fresco, colorato, irresistibile.", c: ["#ff9a6b", "#ff5e62"], photo: "assets/img/cocktails/sig1.webp" },
      { n: "Signature 2", p: "12€", d: "Una sorpresa: lasciati guidare dal bartender.", c: ["#a878dd", "#5b6bd6"], t: "?", photo: "assets/img/cocktails/sig2.webp" },
      { n: "Signature 3", p: "10€", d: "Un americano in Ancona.", c: ["#e0564a", "#a81e18"], photo: "assets/img/cocktails/sig3.webp" },
      { n: "Signature 4", p: "12€", d: "Per chi chiede qualcosa di leggero.", c: ["#fff3b0", "#ffd24a"], photo: "assets/img/cocktails/sig4.webp" },
      { n: "Signature 5", p: "12€", d: "Brividi, massimo piacere.", c: ["#f6c66a", "#e9a23a"], photo: "assets/img/cocktails/sig5.webp" },
      { n: "Signature 6", p: "10€", d: "Bello come un fiore, mi fai impazzire.", c: ["#6f8bff", "#3f54c8"], photo: "assets/img/cocktails/sig6.webp" },
      { n: "Signature 7", p: "10€", d: "A mio padre.", c: ["#e06a86", "#b22f57"], photo: "assets/img/cocktails/sig7.webp" },
      { n: "Signature 8", p: "10€", d: "Antipatico.", c: ["#ffb43d", "#e07a16"], photo: "assets/img/cocktails/sig8.webp" },
      { n: "Signature 9", p: "8€", d: "Dolce, ma non troppo.", c: ["#ff9ec4", "#ff5fa2"], t: "Analcolico", photo: "assets/img/cocktails/sig9.webp" },
      { n: "Signature 10", p: "8€", d: "Più secco del primo.", c: ["#c79ad8", "#9a5fc0"], t: "Analcolico", photo: "assets/img/cocktails/sig10.webp" }
    ],
    classici: [
      { n: "Spritz", p: "7€", d: "Aperol · Campari · Select · Hugo.", cover: "assets/img/classici/spritz.webp", c: ["#ff9a3d", "#ff6a00"] },
      { n: "Americano", p: "7€", d: "Bitter, vermouth rosso e soda.", cover: "assets/img/classici/americano.webp", c: ["#e0564a", "#a81e18"] },
      { n: "Negroni", p: "7€", d: "Gin, bitter e vermouth rosso.", cover: "assets/img/classici/negroni.webp", c: ["#c0392b", "#7a1f15"] },
      { n: "Margarita", p: "8€", d: "Tequila, triple sec e lime.", cover: "assets/img/classici/margarita.webp", c: ["#eaf6c8", "#cfe89a"] },
      { n: "Mojito", p: "8€", d: "Rum, lime, menta e zucchero.", cover: "assets/img/classici/mojito.webp", c: ["#d8f3c4", "#a9e08a"] },
      { n: "Mojito Fidel", p: "8€", d: "La nostra versione del classico cubano.", cover: "assets/img/classici/mojito-fidel.webp", c: ["#c9eebb", "#8fcf6e"] },
      { n: "Tommy's Mezcal", p: "10€", d: "Mezcal, lime e agave.", cover: "assets/img/classici/tommys.webp", c: ["#f3e9c8", "#dcc98e"] },
      { n: "Paloma", p: "9€", d: "Tequila e pompelmo.", cover: "assets/img/classici/paloma.webp", c: ["#ff9fb0", "#ff6f87"] },
      { n: "Gin Tonic", p: "7€", d: "Gin e acqua tonica.", cover: "assets/img/classici/gintonic.webp", c: ["#dff3ff", "#a9d8f0"] },
      { n: "Vodka Tonic", p: "7€", d: "Vodka e acqua tonica.", cover: "assets/img/classici/vodkatonic.webp", c: ["#eaf6ff", "#cfeaf7"] },
      { n: "Cuba Libre", p: "7€", d: "Rum, cola e lime.", cover: "assets/img/classici/cubalibre.webp", c: ["#7a4a2b", "#3e2412"] },
      { n: "Campari Shakerato", p: "7€", d: "Campari shakerato, servito fresco.", cover: "assets/img/classici/campari.webp", c: ["#e23b4e", "#a01828"] },
      { n: "Piña Colada", p: "9€", d: "Rum, cocco e ananas.", cover: "assets/img/classici/pinacolada.webp", c: ["#fff7e6", "#ffe9bf"] }
    ],
    gin: [
      { n: "Ngricca · House Gin", p: "9€", d: "Distillato a mano nelle Marche: corbezzolo del Conero, liquirizia e note erbacee della macchia mediterranea.", cover: "assets/img/gins/giolugin.webp", c: ["#ff9ec4", "#e2557f"], t: "Best in Ancona" },
      { n: "Windspiel Premium Dry", p: "18€", d: "Germania · Elegante · Lavanda, limone, cannella.", cover: "assets/img/gins/giolugin.webp", c: ["#dcd2f0", "#b9a7e0"] },
      { n: "Electric Spirit Co.", p: "16€", d: "Scozia · Deciso · Pepe di Sichuan.", cover: "assets/img/gins/achroous.webp", c: ["#eef0d8", "#cfd49a"] },
      { n: "Martin Miller's Original", p: "10€", d: "Inghilterra · London Dry · Buccia d'arancia.", cover: "assets/img/gins/martinmiller.webp", c: ["#e8f4ff", "#bfe0f5"] },
      { n: "Westbourne Strength", p: "16€", d: "Inghilterra · Intenso e agrumato · Noce moscata.", cover: "assets/img/gins/westbourne.webp", c: ["#fdeecb", "#e7c98c"] },
      { n: "44°N Gin", p: "20€", d: "Costa Azzurra · Floreale intenso · Miele, spezie.", cover: "assets/img/gins/44n.webp", c: ["#fff0c2", "#f0cf7a"] },
      { n: "Gin Mare", p: "10€", d: "Spagna · Mediterraneo · Oliva, rosmarino, basilico.", cover: "assets/img/gins/ginmare.webp", c: ["#e9f3d6", "#bcd79a"] },
      { n: "Gin Hendrick's", p: "9€", d: "Scozia · Floreale delicato · Cetriolo, rosa, ginepro.", cover: "assets/img/gins/hendricks.webp", c: ["#e6f6ef", "#bfe6d4"] },
      { n: "Gin Malfy Rosa", p: "9€", d: "Italia · Fresco · Pompelmo rosa, fragola, agrumi.", cover: "assets/img/gins/malfy.webp", c: ["#ffd0d8", "#ff8aa0"] }
    ],
    birre: [
      { n: "Forst VIP Pils — spina", p: "3€ / 5€", d: "Pils · 5.0% · Fresca e leggera, aroma raffinato.", cover: "assets/img/beers/forst.webp", c: ["#ffe9a8", "#f5c543"] },
      { n: "Forst 1857 — 33cl", p: "4€", d: "Premium Export Lager · 4.8% · Malto chiaro, miele d'acacia.", cover: "assets/img/beers/forst.webp", c: ["#ffe09a", "#eab137"] },
      { n: "Forst 0.0", p: "3,5€", d: "Analcolica · Oro al World Beer Awards · Fresca e bilanciata.", cover: "assets/img/beers/forst.webp", c: ["#fff0c8", "#f3d684"], t: "Analcolica" },
      { n: "Weihenstephan Helles — 50cl", p: "5€", d: "Helles · 5.1% · Speziata, delicata e beverina.", cover: "assets/img/beers/weihenstephan.webp", c: ["#ffe6a0", "#f3c54a"] },
      { n: "Weihenstephan Weissbier — 50cl", p: "7€", d: "Frumento · 5.4% · Banana e garofano, speziata.", cover: "assets/img/beers/weihenstephan.webp", c: ["#ffdf9e", "#e9b85a"] },
      { n: "Hobgoblin IPA — 50cl", p: "7€", d: "English IPA · 5.3% · Floreale, frutta tropicale, agrumi.", cover: "assets/img/beers/hobgoblin.webp", c: ["#e89a4a", "#c25a1f"] }
    ]
  };

  /* ---------- render ---------- */
  function card(item, key, i) {
    var gid = "lg-" + key + "-" + i;
    var media, cls;
    if (item.cover) {
      media = '<img class="beer-photo" src="' + item.cover + '" alt="' + item.n + '" loading="lazy" />';
      cls = " has-cover";
    } else if (item.photo) {
      media = '<img class="cocktail-photo" src="' + item.photo + '" alt="Cocktail ' + item.n + '" loading="lazy" />';
      cls = " has-photo";
    } else {
      media = glass(item.g, gid, item.c, item.r);
      cls = "";
    }
    var tag = item.t ? '<span class="tag">' + item.t + "</span>" : "";
    return '' +
      '<article class="cocktail-card' + cls + ' reveal" style="transition-delay:' + (i % 4) * 0.08 + 's">' +
      '  <div class="cocktail-card__media" style="--c1:' + item.c[0] + ';--c2:' + item.c[1] + '">' + media + '</div>' +
      '  <div class="cocktail-card__body">' +
      '    <div class="cocktail-card__top"><h4 class="cocktail-card__name">' + item.n + tag + '</h4>' +
      '    <span class="cocktail-card__price">' + item.p + "</span></div>" +
      '    <p class="cocktail-card__desc">' + item.d + "</p>" +
      "  </div>" +
      "</article>";
  }

  Object.keys(DATA).forEach(function (key) {
    var host = document.getElementById("cg-" + key);
    if (!host) return;
    host.innerHTML = DATA[key].map(function (item, i) { return card(item, key, i); }).join("");
  });
})();
