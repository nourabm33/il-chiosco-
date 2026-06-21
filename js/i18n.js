/* ============================================================
   Il Chiosco | Taste & Beyond — IT / EN language toggle
   Translations are applied in place: every targeted element keeps
   its Italian source as the default and switches to English on demand.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- plain-text translations (leaf elements) ---------- */
  var TXT = {
    // nav / cta
    "Prenota un tavolo": "Book a table",

    // intro
    "La nostra filosofia": "Our philosophy",
    "Qui non serviamo solo caffè: serviamo pause, incontri, musica e socialità. Ma soprattutto costruiamo qualcosa insieme ad altri, collaborando con chi — come noi — crede nella qualità vera: ingredienti puliti, lavorazioni artigianali e rispetto del territorio.":
      "Here we don\u2019t just serve coffee: we serve breaks, encounters, music and connection. Above all, we build something together with others, partnering with those who \u2014 like us \u2014 believe in true quality: clean ingredients, artisanal craft and respect for the local area.",
    "Ogni preparazione è espressa, ci sarà un po' di attesa, perché ogni caffè e ogni proposta food meritano cura. Il Chiosco è la nostra idea di accoglienza: un posto dove riconoscersi.":
      "Everything is made to order, so there may be a short wait, because every coffee and every dish deserves care. Il Chiosco is our idea of hospitality: a place to feel at home.",
    "È il tempo che ti prendi e quello che condividi.": "It\u2019s the time you take and the time you share.",
    "Ogni giorno": "Every day",
    "Miscela Club Kavè": "Club Kavè blend",
    "Artigianale": "Artisanal",
    "Forni & bakery chef": "Bakeries & pastry chefs",

    // menu head
    "Bevande, Dolce & Salato": "Drinks, Sweet & Savory",
    "La nostra selezione è variegata e limitata: guarda la vetrina o chiedi allo staff per le disponibilità del giorno.":
      "Our selection is varied and limited: check the display or ask our staff for today\u2019s availability.",

    // food tabs
    "Bevande": "Drinks",
    "Dolce": "Sweet",
    "Salato": "Savory",

    // bevande
    "Caffè": "Coffee",
    "Per il nostro espresso usiamo la miscela Club Kavè · latte vegetale +0,3€ · deca +0,2€ · extra shot caffè +1,3€":
      "For our espresso we use the Club Kavè blend \u00b7 plant-based milk +0.3\u20ac \u00b7 decaf +0.2\u20ac \u00b7 extra coffee shot +1.3\u20ac",
    "Espresso singolo": "Single espresso",
    "Espresso doppio": "Double espresso",
    "Latte macchiato": "Latte macchiato",
    "Ginseng / Orzo": "Ginseng / Barley",
    "Caffè shakerato": "Shaken iced coffee",
    "La nostra selezione Iced & Specialty": "Our Iced & Specialty selection",
    "Altre bevande": "Other drinks",
    "Frullato del giorno": "Smoothie of the day",
    "Bevanda fermentata a base di tè.": "Fermented tea-based drink.",
    "Bibite Galvanina Bio": "Galvanina Organic sodas",
    "Aranciata · Limonata · Cedrata · Chinotto · Tonica · Ginger.":
      "Orange \u00b7 Lemon \u00b7 Citron \u00b7 Chinotto \u00b7 Tonic \u00b7 Ginger.",
    "Succo di frutta Looza": "Looza fruit juice",
    "Ace · Albicocca · Pesca · Pera · Ananas.": "ACE \u00b7 Apricot \u00b7 Peach \u00b7 Pear \u00b7 Pineapple.",
    "Spremuta": "Fresh-squeezed juice",
    "Bibite in vetro": "Bottled sodas",
    "Tutte le nostre bevande sono disponibili take away.": "All our drinks are available to take away.",

    // dolce
    "I nostri best seller": "Our best sellers",
    "Croissant moderno, tondo, ripieno di crema e ricoperto da ganache e frutta fresca.":
      "A modern round croissant filled with cream and topped with ganache and fresh fruit.",
    "Girella alla cannella, un dolce lievitato morbido dal profumo irresistibile. Servito con panna.":
      "A soft cinnamon swirl with an irresistible aroma. Served with cream.",
    "da 3,5 a 5€": "from 3.5 to 5\u20ac",
    "I biscotti più famosi del web: grandi e morbidi. Classici o decorati con frosting di creme e frutta fresca.":
      "The most famous cookies on the web: big and soft. Plain or topped with cream frosting and fresh fruit.",
    "Sfoglie & Brioches": "Pastries & Brioches",
    "Croissant lievito madre vuoto": "Sourdough croissant, plain",
    "Croissant vegano vuoto o farcito": "Vegan croissant, plain or filled",
    "Croissant cereali miele o lampone": "Multigrain croissant, honey or raspberry",
    "Croissant crema o cioccolato": "Croissant, custard or chocolate",
    "Croissant pistacchio o mandorla": "Croissant, pistachio or almond",
    "Pain au raisins (girella)": "Pain au raisins (swirl)",
    "Muffin cioccolato / yogurt e mirtilli": "Muffin, chocolate / yogurt & blueberry",
    "Brunch dolce": "Sweet brunch",
    "Prodotti dal nostro banco — secondo disponibilità.": "From our counter \u2014 subject to availability.",
    "Pancake sciroppo d'acero": "Pancakes with maple syrup",
    "Pancake frutta di stagione e yogurt": "Pancakes with seasonal fruit and yogurt",
    "Yogurt, frutta fresca & granola": "Yogurt, fresh fruit & granola",
    "Frutta fresca di stagione e granola croccante.": "Fresh seasonal fruit and crunchy granola.",
    "Frutta fresca, semi, frutta secca e miele.": "Fresh fruit, seeds, nuts and honey.",
    "Pane, burro & marmellata": "Bread, butter & jam",
    "Pane con farine \"Paolo Mariani\".": "Bread made with \u201cPaolo Mariani\u201d flours.",
    "Collaboriamo con forni e bakery chef per ampliare la selezione — chiedi allo staff la collab del mese.":
      "We partner with bakeries and pastry chefs to expand our selection \u2014 ask our staff about this month\u2019s collab.",

    // salato
    "Sfoglie & Brioches salate": "Savory pastries & brioches",
    "Opzioni gluten free disponibili.": "Gluten-free options available.",
    "Croissant ai cereali farcito": "Filled multigrain croissant",
    "Mini panino croccante farcito": "Mini filled crusty roll",
    "Toast prosciutto cotto & formaggio": "Ham & cheese toastie",
    "Prosciutto cotto \"Salumeria Offagna\" e formaggio filante.": "\u201cSalumeria Offagna\u201d cooked ham and melted cheese.",
    "Triangolo spinaci e pomodorini": "Spinach & cherry tomato pastry",
    "Club sandwich del chiosco": "The Chiosco club sandwich",
    "Pane tostato ai cereali, tacchino, bacon, lattuga, pomodoro, formaggio filante, accompagnato da patate al forno.":
      "Toasted multigrain bread, turkey, bacon, lettuce, tomato, melted cheese, served with baked potatoes.",
    "Uova allevate a terra, cottura a scelta, pane farine \"Paolo Mariani\", burro e marmellata, spremuta d'arancia, espresso o americano.":
      "Free-range eggs cooked your way, \u201cPaolo Mariani\u201d bread, butter and jam, fresh orange juice, espresso or americano.",
    "Bagel farcito del giorno": "Filled bagel of the day",
    "Morbido e goloso panino a forma di ciambella con farcitura salata.": "A soft, indulgent ring-shaped bun with a savory filling.",
    "Super focacciona Vegetariana": "Super focaccia, Vegetarian",
    "Doppia focaccia 72h di lievitazione, verdure grigliate e formaggio dolce filante. Versione vegana con hummus di ceci.":
      "72-hour proofed double focaccia, grilled vegetables and mild melted cheese. Vegan version with chickpea hummus.",
    "Super focacciona Estiva": "Super focaccia, Summer",
    "Doppia focaccia 72h, pomodoro, mozzarella, basilico e pesto.": "72-hour double focaccia, tomato, mozzarella, basil and pesto.",
    "Super focacciona Cotto": "Super focaccia, Ham",
    "Doppia focaccia 72h, prosciutto cotto affumicato \"Salumificio Offagna\", carciofini, basilico, edamer e salsa tartara.":
      "72-hour double focaccia, smoked cooked ham \u201cSalumificio Offagna\u201d, baby artichokes, basil, edam and tartare sauce.",
    "Lasagna del chiosco": "The Chiosco lasagna",
    "Lasagna home made classica rossa al ragù.": "Classic homemade lasagna with red rag\u00f9.",
    "Pasta fresca del giorno": "Fresh pasta of the day",
    "Chiedi al personale.": "Ask our staff.",
    "Prosciutto e bruschette": "Cured ham & bruschetta",
    "Prosciutto crudo \"Salumificio Offagna\" e bruschette con verdure.": "\u201cSalumificio Offagna\u201d cured ham and bruschetta with vegetables.",
    "I prezzi indicati includono il servizio al tavolo. Ogni preparazione è espressa.":
      "Listed prices include table service. Everything is made to order.",

    // cocktail head
    "See it, pick it, taste it, repeat. La proposta di Davide tra signature d'autore, grandi classici, gin selezionati e birre artigianali.":
      "See it, pick it, taste it, repeat. Davide\u2019s selection of signature creations, great classics, curated gins and craft beers.",
    "Classici": "Classics",
    "Birre": "Beers",
    "La proposta di Davide — cocktail d'autore, creati al bancone.": "Davide\u2019s selection \u2014 signature cocktails, created at the bar.",
    "I Classici": "The Classics",
    "I Gin": "The Gins",
    "Il nostro gin è distillato da Ngricca, laboratorio artigianale marchigiano.":
      "Our house gin is distilled by Ngricca, an artisanal workshop from the Marche region.",
    "Le Birre": "The Beers",

    // bartender
    "Un cocktail non è solo un drink. È un ricordo che inizia dal primo sorso. Dopo oltre 20 anni dietro al bancone, il mio obiettivo è sempre lo stesso: creare esperienze che lascino il segno.":
      "A cocktail isn\u2019t just a drink. It\u2019s a memory that begins with the first sip. After more than 20 years behind the bar, my goal is always the same: to create experiences that leave a mark.",

    // cocktail card tags
    "Analcolico": "Non-alcoholic",
    "Analcolica": "Alcohol-free",

    // signatures descriptions
    "Fresco, colorato, irresistibile.": "Fresh, colorful, irresistible.",
    "Una sorpresa: lasciati guidare dal bartender.": "A surprise: let the bartender guide you.",
    "Un americano in Ancona.": "An Americano in Ancona.",
    "Per chi chiede qualcosa di leggero.": "For those who want something light.",
    "Brividi, massimo piacere.": "Thrills, pure pleasure.",
    "Bello come un fiore, mi fai impazzire.": "Beautiful as a flower, you drive me wild.",
    "A mio padre.": "To my father.",
    "Antipatico.": "Unfriendly.",
    "Dolce, ma non troppo.": "Sweet, but not too much.",
    "Più secco del primo.": "Drier than the first.",

    // classici descriptions
    "Bitter, vermouth rosso e soda.": "Bitter, red vermouth and soda.",
    "Gin, bitter e vermouth rosso.": "Gin, bitter and red vermouth.",
    "Tequila, triple sec e lime.": "Tequila, triple sec and lime.",
    "Rum, lime, menta e zucchero.": "Rum, lime, mint and sugar.",
    "La nostra versione del classico cubano.": "Our take on the Cuban classic.",
    "Mezcal, lime e agave.": "Mezcal, lime and agave.",
    "Tequila e pompelmo.": "Tequila and grapefruit.",
    "Gin e acqua tonica.": "Gin and tonic water.",
    "Vodka e acqua tonica.": "Vodka and tonic water.",
    "Rum, cola e lime.": "Rum, cola and lime.",
    "Campari shakerato, servito fresco.": "Shaken Campari, served chilled.",
    "Rum, cocco e ananas.": "Rum, coconut and pineapple.",

    // gin descriptions
    "Distillato a mano nelle Marche: corbezzolo del Conero, liquirizia e note erbacee della macchia mediterranea.":
      "Hand-distilled in the Marche: Conero strawberry tree, licorice and herbaceous Mediterranean-scrub notes.",
    "Germania · Elegante · Lavanda, limone, cannella.": "Germany \u00b7 Elegant \u00b7 Lavender, lemon, cinnamon.",
    "Scozia · Deciso · Pepe di Sichuan.": "Scotland \u00b7 Bold \u00b7 Sichuan pepper.",
    "Inghilterra · London Dry · Buccia d'arancia.": "England \u00b7 London Dry \u00b7 Orange peel.",
    "Inghilterra · Intenso e agrumato · Noce moscata.": "England \u00b7 Intense & citrusy \u00b7 Nutmeg.",
    "Costa Azzurra · Floreale intenso · Miele, spezie.": "French Riviera \u00b7 Intensely floral \u00b7 Honey, spices.",
    "Spagna · Mediterraneo · Oliva, rosmarino, basilico.": "Spain \u00b7 Mediterranean \u00b7 Olive, rosemary, basil.",
    "Scozia · Floreale delicato · Cetriolo, rosa, ginepro.": "Scotland \u00b7 Delicately floral \u00b7 Cucumber, rose, juniper.",
    "Italia · Fresco · Pompelmo rosa, fragola, agrumi.": "Italy \u00b7 Fresh \u00b7 Pink grapefruit, strawberry, citrus.",

    // birre descriptions
    "Pils · 5.0% · Fresca e leggera, aroma raffinato.": "Pils \u00b7 5.0% \u00b7 Fresh and light, refined aroma.",
    "Premium Export Lager · 4.8% · Malto chiaro, miele d'acacia.": "Premium Export Lager \u00b7 4.8% \u00b7 Pale malt, acacia honey.",
    "Analcolica · Oro al World Beer Awards · Fresca e bilanciata.": "Alcohol-free \u00b7 Gold at the World Beer Awards \u00b7 Fresh and balanced.",
    "Helles · 5.1% · Speziata, delicata e beverina.": "Helles \u00b7 5.1% \u00b7 Spiced, delicate and easy-drinking.",
    "Frumento · 5.4% · Banana e garofano, speziata.": "Wheat \u00b7 5.4% \u00b7 Banana and clove, spiced.",
    "English IPA · 5.3% · Floreale, frutta tropicale, agrumi.": "English IPA \u00b7 5.3% \u00b7 Floral, tropical fruit, citrus.",

    // gallery
    "Sei al Chiosco": "You\u2019re at Il Chiosco",
    "L'atmosfera, gli spazi e i momenti che ci rendono un punto d'incontro nel cuore di Ancona.":
      "The atmosphere, the spaces and the moments that make us a meeting point in the heart of Ancona.",
    "Lo storico chiosco": "The historic kiosk",

    // contact
    "Vieni a trovarci": "Come visit us",
    "Nel cuore di Ancona, in Piazza Cavour. Aperti tutti i giorni, dalla colazione fino a tarda sera.":
      "In the heart of Ancona, in Piazza Cavour. Open every day, from breakfast until late evening.",
    "Indirizzo": "Address",
    "Telefono": "Phone",
    "Orari": "Hours",
    "07:30 – 00:00 · Tutti i giorni": "07:30 \u2013 00:00 \u00b7 Every day",
    "Chiama ora": "Call now",

    // footer
    "Taste, Drinks & Great Moments. Caffetteria specialty, brunch e cocktail d'autore nel cuore di Ancona.":
      "Taste, Drinks & Great Moments. Specialty coffee, brunch and signature cocktails in the heart of Ancona.",
    "Contatti": "Contacts",
    "07:30 – 00:00 · Ogni giorno": "07:30 \u2013 00:00 \u00b7 Every day",
    "Esplora": "Explore",
    "Tutti i diritti riservati.": "All rights reserved.",
    "Piazza Cavour · Ancona, Italia": "Piazza Cavour \u00b7 Ancona, Italy",

    // back-to-tabs row
    "Scegli un\u2019altra categoria": "Choose another category"
  };

  /* ---------- innerHTML translations (elements with markup) ---------- */
  var HTML = {
    "Non serviamo solo caffè.<br>Serviamo momenti.": "We don\u2019t just serve coffee.<br>We serve moments.",
    "Piazza Camillo Benso di Cavour<br>60121 Ancona (AN), Italia": "Piazza Camillo Benso di Cavour<br>60121 Ancona (AN), Italy",
    "07:30 \u2013 00:00 \u00b7 Tutti i giorni": "07:30 \u2013 00:00 \u00b7 Every day"
  };

  var TXT_SELECTOR = [
    ".nav__cta .btn",
    ".eyebrow", ".section-title", ".section-head p",
    ".intro__body p", ".stat strong", ".stat span", ".badge span",
    ".menu-tab",
    ".menu-cat__head h3", ".menu-cat__note",
    ".menu-item__name", ".menu-item__price", ".menu-item__desc",
    ".menu-foot p", ".menu-showcase figcaption",
    ".cocktail-card__desc", ".cocktail-card__name .tag",
    ".bartender__quote",
    ".info-row h4", ".contact__actions .btn",
    ".footer__brand p", ".footer__col h4",
    ".cap",
    ".i18n"
  ].join(",");

  var HTML_SELECTOR = ".intro__body h2, .info-row p";

  function norm(s) {
    return s.replace(/\s+/g, " ").trim();
  }
  function normHtml(s) {
    return s.replace(/<br\s*\/?>/gi, "<br>").replace(/\s+/g, " ").trim();
  }

  function applyText(lang) {
    document.querySelectorAll(TXT_SELECTOR).forEach(function (el) {
      if (el.getAttribute("data-it") === null) el.setAttribute("data-it", norm(el.textContent));
      var src = el.getAttribute("data-it");
      if (lang === "en") {
        var t = TXT[src];
        if (t) el.textContent = t;
      } else {
        el.textContent = src;
      }
    });
  }

  function applyHtml(lang) {
    document.querySelectorAll(HTML_SELECTOR).forEach(function (el) {
      if (el.getAttribute("data-it-html") === null) el.setAttribute("data-it-html", el.innerHTML);
      var src = el.getAttribute("data-it-html");
      if (lang === "en") {
        var t = HTML[normHtml(src)];
        if (t) el.innerHTML = t;
      } else {
        el.innerHTML = src;
      }
    });
  }

  var btn = document.getElementById("langToggle");

  function setLang(lang) {
    document.documentElement.lang = lang;
    applyText(lang);
    applyHtml(lang);
    if (btn) {
      btn.textContent = lang === "it" ? "EN" : "IT";
      btn.setAttribute("aria-label", lang === "it" ? "Switch to English" : "Passa all\u2019italiano");
    }
    try { localStorage.setItem("ic-lang", lang); } catch (e) {}
  }

  var saved = "it";
  try { saved = localStorage.getItem("ic-lang") || "it"; } catch (e) {}
  setLang(saved);

  if (btn) {
    btn.addEventListener("click", function () {
      setLang(document.documentElement.lang === "it" ? "en" : "it");
    });
  }
})();
