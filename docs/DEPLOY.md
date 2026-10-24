# Deployment — Il Chiosco staff backend

The public website stays on **GitHub Pages**. Only the staff backend
(`server/`: order intake, queue, staff logins, POS adapter) needs hosting.
Nothing here is deployed yet; everything was developed and tested locally.

## What the backend needs

| Need | Why |
| --- | --- |
| Node.js ≥ 20, one always-on process | the queue scheduler releases orders in Busy mode and must not sleep |
| PostgreSQL ≥ 14 | source of truth for orders, queue, sessions; `LISTEN/NOTIFY` pushes live updates to every device |
| HTTPS | staff passwords and session tokens travel over it |
| Long-lived HTTP responses | live updates use Server-Sent Events (`/api/staff/events`) |
| Daily database backups | orders and the audit trail (`order_events`) |

Expected load is tiny (one café, a handful of devices): the smallest paid
instance and database of any provider is enough.

## Recommended setup

**Render** — one *Web Service* (Node, `rootDir: server`) + one
*Render Postgres* database, Frankfurt region.

- Web service on the **Starter** plan (always on). Free instances sleep after
  15 min idle, which would stop the queue timer — don't use them in production.
- Postgres **Basic** plan (includes backups). Neon or Supabase Postgres also
  work: only `DATABASE_URL` changes.
- Build `npm ci`, pre-deploy `npm run migrate`, start `npm start`,
  health check `/readyz`.

Railway or Fly.io are equivalent alternatives. A small VPS (e.g. Hetzner)
running `docker compose` is the cheapest option, but you then own TLS,
updates and backups.

If the till turns out to be **local-network only**, the POS connector part
may instead have to run on a PC in the café (see
[POS-INTEGRATION.md](POS-INTEGRATION.md)); the cloud backend still hosts the
queue and dashboard.

No account or API token is needed until you pick a provider.

## Environment variables

Set these in the provider's dashboard — never commit values.
`server/.env.example` lists them with comments.

| Variable | Example / default | Secret |
| --- | --- | --- |
| `NODE_ENV` | `production` | |
| `PORT` | set by the host | |
| `DATABASE_URL` | from the database provider | **yes** |
| `DATABASE_POOL_MAX` | `20` | |
| `PUBLIC_BASE_URL` | `https://nourabm33.github.io/il-chiosco-` (QR codes encode `<this>/order?table=N`) | |
| `CORS_ORIGINS` | `https://nourabm33.github.io` | |
| `TRUST_PROXY` | `1` behind the host's proxy | |
| `STAFF_SESSION_HOURS` | `12` | |
| `TABLE_COUNT` | `40` | |
| `QUEUE_SCHEDULER_ENABLED` | `true` | |
| `QUEUE_TICK_MS` | `2000` | |
| `POS_DRIVER` | `simulation` until the till is integrated | |
| `POS_SIMULATION_FAILURE_RATE` | `0` (test only) | |
| `POS_BASE_URL`, `POS_AUTH_SCHEME`, `POS_ORDERS_PATH`, `POS_TIMEOUT_MS` | from the till technician | |
| `POS_API_KEY` | from the till technician | **yes** |
| `POS_WORKER_ENABLED`, `POS_WORKER_INTERVAL_MS`, `POS_MAX_ATTEMPTS` | `true`, `5000`, `10` | |

Staff passwords are not environment variables: each person gets their own
login, stored hashed (scrypt) in the database.

## First deploy

```bash
# on the host (or locally with the production DATABASE_URL)
cd server
npm ci
npm run migrate
npm run seed
STAFF_PASSWORD='…' npm run staff:add -- --username giulia --name "Giulia" --role manager
STAFF_PASSWORD='…' npm run staff:add -- --username marco  --name "Marco"  --role waiter
```

Then point the static site at the backend: set the backend URL in
`js/config.js` (`window.IL_CHIOSCO_API = "https://<backend>"`). The staff
dashboard is also served by the backend itself at `https://<backend>/admin`.

## Local development

```bash
docker compose up -d db
cd server && npm install
export DATABASE_URL=postgres://postgres:postgres@localhost:5433/ilchiosco
npm run migrate && npm run seed
STAFF_PASSWORD='local-pass-123' npm run staff:add -- --username giulia --role manager
npm start                      # http://localhost:3000/admin
npm run demo:orders -- 5       # put 5 confirmed test orders in the queue
npm test && npm run lint
```

## What still depends on others

- **Existing waiter app** — today it sends orders straight to the till over the
  café Wi-Fi, so the queue cannot hold them yet. The backend exposes a generic
  intake API (below) that the app, or a connector next to it, can call once we
  know how it talks to the till.
- **Till / POS** — `POS_DRIVER=simulation` until the technician provides the
  protocol. Simulated releases are always labelled "Simulato · non inviato
  alla cassa", never "Inviato alla cassa".

The waiters' app is **Comandi – Cassa in Cloud**. What its API and Kitchen Monitor can and cannot do,
with sources and technician questions: [CASSA-IN-CLOUD.md](CASSA-IN-CLOUD.md).

### Questions for the waiter-app / till technician

1. Name and maker of the waiter app and of the till (photo of the app's
   "about" screen and the till model is enough).
2. Waiter devices: Android or iPhone?
3. Does the app talk to the till directly, or through a PC/server in the café?
4. What happens on **Confirm**: ticket printed at the bar, shown on a screen,
   or only registered on the till?
5. Is there an API, export, webhook, or a "hold / park order" function?
   Can the app's destination address be changed?
6. Is the till cloud-based or local-network only?
7. API documentation and test credentials, if available.

### Intake API (for the waiter app or a connector)

All calls need `Authorization: Bearer <session token>` from
`POST /api/auth/login`.

| Call | Effect |
| --- | --- |
| `POST /api/staff/orders` `{tableNumber, items, notes?, externalRef?, confirm?}` | open an order (yellow). `externalRef` = the order id in the waiter app; re-sending it never creates a duplicate. `confirm: true` opens and confirms in one call |
| `PUT /api/staff/orders/:id` `{items, notes?}` | edit while yellow |
| `POST /api/staff/orders/:id/confirm` | join the queue (orange) |
| `POST /api/staff/orders/:id/reopen` / `cancel` | take back for editing / cancel (only before release) |
| `PATCH /api/staff/orders/:id/status` | service status after release (in preparazione → servito → pagato) |
| `GET /api/staff/queue`, `/tables`, `/orders` | current state |
| `GET /api/staff/events` | live change stream (SSE) |
| `PUT /api/admin/queue/settings` `{mode, busyIntervalSeconds}` | manager: Normal / Busy / Pause, Busy interval |
| `POST /api/admin/queue/release-next` | manager: release the next order now |
| `POST /api/admin/orders/:id/retry` | manager: retry a failed delivery |

## Test checklist (before going live)

- [ ] Two waiters on two phones confirm orders at the same moment → both appear
      once, in confirmation order, on every dashboard within a second or two.
- [ ] The same order sent twice (double tap / retry with the same
      `externalRef`) → only one order.
- [ ] Busy mode at 4 min → one order released every 4 min; "prossimo rilascio"
      countdown matches on all devices.
- [ ] Pause → nothing released; "Rilascia il prossimo ora" releases exactly one;
      Normal → the rest go out in order.
- [ ] Two managers press "Rilascia il prossimo ora" together → two different
      orders released, never the same one twice.
- [ ] Failed release (`POS_SIMULATION_FAILURE_RATE=1`) → order shows "Invio
      fallito"; "Riprova invio" sends it once.
- [ ] Reload the dashboard / restart the backend → queue, positions, mode and
      countdown are unchanged.
- [ ] Waiter login cannot change the mode or release orders; wrong password and
      expired session are rejected; `/api/staff/*` without login → 401.
- [ ] Customer page `/order?table=N` shows the menu only and "Per ordinare,
      rivolgiti al cameriere."; `POST /api/orders` returns 410.
- [ ] With `POS_DRIVER=simulation`, nothing anywhere says "Inviato alla cassa".
- [ ] The existing waiter app and till still work exactly as before.
