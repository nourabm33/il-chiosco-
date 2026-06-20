# Il Chiosco | Taste &amp; Beyond

Modern, elegant, fully responsive one-page website for **Il Chiosco — Taste &amp; Beyond**, a bar &amp; caffè in Piazza Cavour, Ancona (Italy).

Built with plain HTML, CSS and JavaScript — no build step, no dependencies. Just open `index.html` (or serve the folder) in a browser.

## Run locally

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Structure

```
index.html        # all sections (hero, intro, food menu, cocktail menu, gallery, contact, footer)
css/styles.css    # design system + responsive layout
js/main.js        # nav, scroll reveal, menu tabs, gallery lightbox, parallax
assets/img/       # photography (counter, exterior, crowd)
```

## Sections

- **Home / Hero** — full-screen bar image, title, subtitle and two CTAs (Food / Cocktail menu).
- **Menu Il Chiosco** — tabbed *Bevande · Dolce · Salato*, extracted from the food PDF.
- **Cocktail Menu** — tabbed *Signatures · Classici · Gin · Birre*, extracted from the cocktail PDF.
- **Gallery** — lightbox gallery of the provided photos.
- **Contact** — address, click-to-call, opening hours, embedded Google Map, Get Directions.

## Content source

Menu items, descriptions and prices were extracted from the two supplied PDFs
(food menu &amp; cocktail list). Photography is from the supplied images, with the
social-media overlay icons cropped out.

## Contact

- **Address:** Piazza Camillo Benso di Cavour, 60121 Ancona (AN), Italy
- **Phone:** +39 392 117 5714
- **Hours:** 07:30 – 00:00, every day
