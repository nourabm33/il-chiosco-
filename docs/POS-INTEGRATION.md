# POS / cassa integration

Orders are stored in Postgres first and pushed to the POS afterwards by a
background worker reading the `pos_outbox` table. A POS outage therefore never
breaks ordering: deliveries are retried with exponential backoff and can be
re-sent by hand from the staff dashboard.

```
customer → POST /api/orders → orders + order_items + pos_outbox (one transaction)
                                        ↓
                          outbox worker → PosAdapter.sendOrder() → cassa
```

## What we still need from the POS technician

Nothing about the POS API has been invented; the HTTP adapter is a skeleton
driven by configuration. To finish the integration we need:

1. **Base URL** of the POS API (test and production).
2. **Authentication**: scheme (bearer token / basic / custom header), the
   credentials, and how they are rotated.
3. **Create-order endpoint**: path, HTTP method, full request body schema and
   the success/error responses.
4. **Table identifiers**: how tables 1–40 are identified in the POS
   (they go into `restaurant_tables.pos_table_id`).
5. **Product identifiers**: the POS id for each product
   (they go into `products.pos_product_id`).
6. **Idempotency / duplicate handling**: does the POS accept an idempotency key
   so a retry after a timeout does not create a second ticket?
7. Optional: order status callbacks (webhook) and payment confirmation.

## Wiring a real POS

The adapter contract is `server/src/pos/adapter.js`:

```js
class PosAdapter {
  get name() {}
  isConfigured() {}
  async sendOrder(payload) {} // → { posOrderId } | throws (err.permanent = no retry)
}
```

Payload passed to every adapter:

```json
{
  "orderId": "uuid", "orderCode": "IC-0810-0007", "createdAt": "…",
  "notes": "senza ghiaccio", "currency": "EUR", "totalCents": 1800,
  "table": { "number": 7, "posTableId": null },
  "items": [{ "productId": "uuid", "posProductId": null, "name": "Spritz",
              "quantity": 2, "unitPriceCents": 700, "lineTotalCents": 1400,
              "notes": null }]
}
```

Two options once the docs arrive:

* **Config only** — if the POS accepts a JSON body close to
  `HttpPosAdapter.mapPayload`, set `POS_DRIVER=http`, `POS_BASE_URL`,
  `POS_API_KEY`, `POS_AUTH_SCHEME`, `POS_ORDERS_PATH` and adjust `mapPayload`.
* **Dedicated adapter** — add `server/src/pos/<vendor>-adapter.js` implementing
  the contract and register it in `server/src/pos/index.js`; select it with
  `POS_DRIVER=<vendor>`.

Then load the id mappings:

```sql
UPDATE restaurant_tables SET pos_table_id = '...' WHERE table_number = 1;
UPDATE products SET pos_product_id = '...' WHERE slug = 'cocktail-spritz';
```

Until then `POS_DRIVER=simulation` (the old name `noop` still works): orders
released by the queue are marked `simulated` — shown as "Simulato · non inviato
alla cassa" — and nothing is sent. Only an order the real adapter accepted is
ever shown as "Inviato alla cassa".

Orders reach the outbox only when the queue releases them (see
[DEPLOY.md](DEPLOY.md)); each order has at most one outbox row, so it can be
delivered once. A retry is only possible after delivery has definitively
failed. If the POS may have accepted an order but timed out, the adapter should
send the `orderId` as an idempotency key so the till can ignore the repeat.

## Operations

* `GET /api/admin/pos/status` — driver, whether it is configured, outbox counts.
* `POST /api/admin/orders/:id/retry` — re-send a failed delivery
  (manager only; also the "Riprova invio" button on the dashboard).
* Failed deliveries show as "Invio fallito" with the error on the order.
