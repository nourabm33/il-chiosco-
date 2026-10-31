# Il Chiosco | Taste &amp; Beyond

Modern, elegant, fully responsive one-page website for **Il Chiosco — Taste &amp; Beyond**, a bar &amp; caffè in Piazza Cavour, Ancona (Italy).

The marketing site is plain HTML, CSS and JavaScript — no build step. A small
Node + PostgreSQL backend under `server/` adds the staff order queue in front of
the till (and also serves the static pages).

## Run locally

Marketing site only:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

Full site + staff backend (see [docs/DEPLOY.md](docs/DEPLOY.md)):

```bash
docker compose up -d db
cd server
npm install
cp .env.example .env      # set PUBLIC_BASE_URL
export DATABASE_URL=postgres://postgres:postgres@localhost:5433/ilchiosco
npm run migrate && npm run seed
STAFF_PASSWORD='…' npm run staff:add -- --username giulia --role manager
npm start                 # http://localhost:3000
```

- `/` — the website
- `/order?table=7` — table menu for table 7 (what the QR codes point to), browse only
- `/admin` — staff dashboard: order queue, orders, tables, QR codes (personal staff login)

## Structure

```
index.html        # all sections (hero, intro, food menu, cocktail menu, gallery, contact, footer)
order.html        # table menu for customers (browse only — orders go through the waiter)
admin.html        # staff dashboard (queue, orders, table colours, QR codes)
css/styles.css    # design system + responsive layout
js/main.js        # nav, scroll reveal, menu tabs, gallery lightbox, parallax
js/config.js      # backend address for the static copy (empty = same origin)
js/order.js       # table menu (API, with the static product list as fallback)
js/admin.js       # dashboard: queue controls, live updates
server/           # Express API, Postgres schema, queue, POS integration layer
docs/             # DEPLOY.md (hosting, env vars, test checklist), POS-INTEGRATION.md, CASSA-IN-CLOUD.md
assets/img/       # photography (counter, exterior, crowd, menu banners, cocktails)
```

## Sections

- **Home / Hero** — full-screen bar image, title, subtitle and three CTAs (Food menu / Cocktail menu / Menu al tavolo).
- **Menu Il Chiosco** — tabbed *Alba · Mezzogiorno · Soft drink & Drink*, each opening with a photo banner, extracted from the food PDFs.
- **Cocktail Menu** — tabbed *Signatures · Classici · Gin · Birre*, extracted from the cocktail PDF.
- **Gallery** — lightbox gallery of the provided photos.
- **Contact** — address, click-to-call, opening hours, embedded Google Map, Get Directions.

## Table menu and order queue

Every table has a QR code encoding `<PUBLIC_BASE_URL>/order?table=<n>`. It opens
the menu (prices included) with the message *"Per ordinare, rivolgiti al
cameriere."* — customers cannot place orders themselves.

Waiters take the order. In the backend an order is **yellow** while being
entered, **orange** once confirmed and waiting in the shared first-in-first-out
queue, and **green** once actually sent to the till. A manager switches the
queue between **Normale** (straight through), **Busy** (one order every few
minutes, 4 by default) and **Pausa**, and can release the next order early.

The waiters' existing app is separate and still sends orders straight to the
till; connecting it to the queue depends on the details listed in
[docs/DEPLOY.md](docs/DEPLOY.md#questions-for-the-waiter-app--till-technician).

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

Products no longer in the menu are marked `is_available = false` (kept for past
orders) and disappear from the ordering page.

### POS / cassa

Orders are queued for the cash register through a modular adapter layer; see
[docs/POS-INTEGRATION.md](docs/POS-INTEGRATION.md) for the contract and the list
of details still needed from the POS technician. Until they arrive the driver is
`simulation`: released orders are marked "Simulato · non inviato alla cassa" and
nothing is sent to the till.

## Photos and 3D / AR menu

Every menu item (food, drinks, cocktails, gin and beers) has a photo and a 3D model. Tapping an item on the site menu or the table menu (`order.html`) opens a viewer with the photo, a 3D model you can rotate, and an "AR" button on phones that places the item on the table (Scene Viewer on Android, Quick Look on iPhone, via Google `<model-viewer>`).

- Photos: `assets/img/items/<product-slug>.webp` (credits in `docs/PHOTO-CREDITS.md`); cocktail photos stay in `js/cocktails.js`.
- Models: `assets/models/<product-slug>.glb` + `.usdz`, generated procedurally by `tools/models` (`cd tools/models && npm ci && npm run build`), one per product in `server/data/products.json`.
- After adding or renaming a product, rebuild the models and run `node tools/models/media.mjs` to refresh `js/menu-media.js`.

## Content source

Menu items, descriptions and prices were extracted from the two supplied PDFs
(food menu &amp; cocktail list). Photography is from the supplied images, with the
social-media overlay icons cropped out; the menu banners in `assets/img/menu/`
(`alba`, `mezzogiorno`, `drink`) are Unsplash photos.

## Contact

- **Address:** Piazza Camillo Benso di Cavour, 60121 Ancona (AN), Italy
- **Phone:** +39 392 117 5714
- **Hours:** 07:30 – 00:00, every day
