# Il Chiosco | Taste &amp; Beyond

Modern, elegant, fully responsive one-page website for **Il Chiosco — Taste &amp; Beyond**, a bar &amp; caffè in Piazza Cavour, Ancona (Italy).

The marketing site is plain HTML, CSS and JavaScript — no build step. The table
ordering section adds a small Node + PostgreSQL backend under `server/`, which
also serves the static pages.

## Run locally

Marketing site only:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

Full site + table ordering:

```bash
docker compose up -d db
cd server
npm install
cp .env.example .env      # set ADMIN_TOKEN and PUBLIC_BASE_URL
export DATABASE_URL=postgres://postgres:postgres@localhost:5433/ilchiosco
npm run migrate && npm run seed
npm start                 # http://localhost:3000
```

- `/` — the website
- `/order?table=7` — ordering page for table 7 (what the QR codes point to)
- `/admin` — staff dashboard (needs `ADMIN_TOKEN`)

## Structure

```
index.html        # all sections (hero, intro, food menu, cocktail menu, gallery, contact, footer)
order.html        # customer ordering page (QR / camera scan → menu → cart → status)
admin.html        # staff dashboard (orders, table occupancy, QR codes)
css/styles.css    # design system + responsive layout
js/main.js        # nav, scroll reveal, menu tabs, gallery lightbox, parallax
js/order.js       # ordering flow, camera QR scanning
js/admin.js       # dashboard polling and order status actions
server/           # Express API, Postgres schema, POS integration layer
assets/img/       # photography (counter, exterior, crowd)
```

## Sections

- **Home / Hero** — full-screen bar image, title, subtitle and two CTAs (Food / Cocktail menu).
- **Menu Il Chiosco** — tabbed *Bevande · Dolce · Salato*, extracted from the food PDF.
- **Cocktail Menu** — tabbed *Signatures · Classici · Gin · Birre*, extracted from the cocktail PDF.
- **Gallery** — lightbox gallery of the provided photos.
- **Contact** — address, click-to-call, opening hours, embedded Google Map, Get Directions.

## Table ordering

Every table has a QR code encoding `<PUBLIC_BASE_URL>/order?table=<n>`. Scanning
it opens the ordering page with the table already known; opening `/order`
manually asks for camera permission and scans the table QR instead (with a
manual table-number fallback).

Orders carry order id/code, table, products, quantities, notes, total, timestamp
and status; the menu is served from the `products` table, and prices are always
re-read from the database when an order is placed.

### Regenerating the QR codes

```bash
cd server
PUBLIC_BASE_URL=https://the-real-domain.it npm run qr   # → assets/qr/table_<n>.png
```

The same QR codes are also viewable and printable from the staff dashboard.

### Updating the menu in the database

```bash
cd server
node scripts/extract-menu.js   # index.html + js/cocktails.js → data/products.json
npm run seed                   # upsert into the products table
```

### POS / cassa

Orders are queued for the cash register through a modular adapter layer; see
[docs/POS-INTEGRATION.md](docs/POS-INTEGRATION.md) for the contract and the list
of details still needed from the POS technician. Until they arrive the driver is
`noop`: orders are stored and shown on the dashboard, nothing is invented.

## Content source

Menu items, descriptions and prices were extracted from the two supplied PDFs
(food menu &amp; cocktail list). Photography is from the supplied images, with the
social-media overlay icons cropped out.

## Contact

- **Address:** Piazza Camillo Benso di Cavour, 60121 Ancona (AN), Italy
- **Phone:** +39 392 117 5714
- **Hours:** 07:30 – 00:00, every day
