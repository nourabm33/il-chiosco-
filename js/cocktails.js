/* Cocktail catalogue source for the menu importer and media manifest. */
var DATA = {
  signatures: [
    { n: "Good Vibes", p: "10€", d: "Fresco, colorato, irresistibile.", c: ["#ff9a6b", "#ff5e62"], photo: "assets/img/cocktails/sig1.webp" },
    { n: "The Change", p: "12€", d: "Una sorpresa: lasciati guidare dal bartender.", c: ["#a878dd", "#5b6bd6"], t: "?", photo: "assets/img/cocktails/sig2.webp" },
    { n: "American Love", p: "10€", d: "Un americano in Ancona.", c: ["#e0564a", "#a81e18"], photo: "assets/img/cocktails/sig3.webp" },
    { n: "Zafferoni", p: "12€", d: "Per chi chiede qualcosa di leggero.", c: ["#fff3b0", "#ffd24a"], photo: "assets/img/cocktails/sig4.webp" },
    { n: "Fig Storm", p: "12€", d: "Brividi, massimo piacere.", c: ["#f6c66a", "#e9a23a"], photo: "assets/img/cocktails/sig5.webp" },
    { n: "Negroni's Wife", p: "10€", d: "Bello come un fiore, mi fai impazzire.", c: ["#6f8bff", "#3f54c8"], photo: "assets/img/cocktails/sig6.webp" },
    { n: "Daiquiri Frozen", p: "10€", d: "A mio padre.", c: ["#e06a86", "#b22f57"], photo: "assets/img/cocktails/sig7.webp" },
    { n: "Queen G", p: "10€", d: "Antipatico.", c: ["#ffb43d", "#e07a16"], photo: "assets/img/cocktails/sig8.webp" },
    { n: "Sun Kissed", p: "8€", d: "Dolce, ma non troppo.", c: ["#ff9ec4", "#ff5fa2"], t: "Analcolico", photo: "assets/img/cocktails/sig9.webp" },
    { n: "Purple Mirage", p: "8€", d: "Più secco del primo.", c: ["#c79ad8", "#9a5fc0"], t: "Analcolico", photo: "assets/img/cocktails/sig10.webp" }
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
