# Cassa in Cloud / Comandi — integration findings

Il Chiosco's waiters use **Comandi – Cassa in Cloud** (TeamSystem / Twinlogix) on Android and iPhone.
The till is Cassa in Cloud on an iPad. This document records what the official software and API can
do for pacing cocktail orders, checked on 2026-10-24.
"Not documented" means not found in the official sources below, not proven impossible.

Nothing here is connected to the real till. The queue in this repo runs with `POS_DRIVER=simulation`
(see [DEPLOY.md](DEPLOY.md)).

## Official sources

- API guide: https://api-doc.cassanova.com/ (full text: https://api-doc.cassanova.com/en/llms-full.md)
- OpenAPI spec: https://api-new.cassaincloud-prod.it/v3/api-docs ("CIC Public API backend v1.0.0") and
  [Swagger UI](https://api-new.cassaincloud-prod.it/swagger-ui/index.html)
- Help centre (Italian):
  - [API](https://cassaincloud.zendesk.com/hc/it/articles/13265013971101) — API access requires an
    Enterprise plan
  - [Webhooks](https://cassaincloud.zendesk.com/hc/it/articles/13263957698717)
  - [Postazioni di stampa: Centri di produzione comande](https://cassaincloud.zendesk.com/hc/it/articles/13287502835613)
  - [Gestione Messagistica](https://cassaincloud.zendesk.com/hc/it/articles/13259039031453)
  - [Portale – Ordini](https://cassaincloud.zendesk.com/hc/it/articles/39041941147037)
  - [Impostazioni Ordini (takeaway/delivery/canali esterni)](https://cassaincloud.zendesk.com/hc/it/articles/13494134849309)
  - [Reports Ristorazione: Real-time](https://cassaincloud.zendesk.com/hc/it/articles/13260801551517)
  - [Link APK Android](https://cassaincloud.zendesk.com/hc/it/articles/13492387188893)
- Comandi listings: [Google Play](https://play.google.com/store/apps/details?id=com.twinlogix.comandi),
  [App Store](https://apps.apple.com/it/app/comandi-cassa-in-cloud/id1060044144)
- The help centre links a dedicated "Cassa in Cloud – Kitchen Monitor" article
  (`/hc/it/articles/13287580534941`). It is not public (HTTP 403), so the Kitchen Monitor details below
  come only from the production-centre and messaging articles.

## API and Comandi: what can and cannot be done

| Question | Finding |
| --- | --- |
| Can an external app create a table order? | **Yes.** `POST /documents/orders/batch` with `isExternalOrder: true`, `deliveryMode: "TABLE"`, `idTable` (from `GET /risto/tables`), `externalId`. It is forced to `UNCONFIRMED` / `REQUESTED`, so the café must accept it. It also needs "Ordini da canali esterni" configured with table delivery enabled, and only works inside the configured hours. |
| Does that order print its comanda at the bar? Does it join the table's bill in Comandi? | **Not documented.** The API has no endpoints for comande, production centres, printers or the Kitchen Monitor. |
| Can Comandi hold an order, or send Confirm through our queue? | **No documented option.** Confirm goes straight to the production centres configured on the till. There is no external destination and no hold/release API. |
| Can the API control when comande are released? | **No.** The API covers products/catalogue, customers, fidelity, stock, reports, sales documents (read; create orders only) and **read-only** rooms/tables. Webhooks (`BILL`, `RECEIPT`, `ORDER`, …, CREATE/UPDATE/DELETE) arrive after the fact; the bill event is described as "Conto chiuso". |
| Plan | API keys only with **Risto Enterprise** / Retail Enterprise (portal: Impostazioni Account → API). The café's plan is unknown. |
| Vendor connector for Comandi + iPad | None documented. The official order channels (Mobile Commerce, Web Menù / Self Order / Totem, Deliveroo, Glovo, Just Eat) are customer-side "external orders" that the café accepts. |
| Limits | 360 calls / 10 min per endpoint and API key, 100 KB JSON body, at most 500 webhooks; a webhook is suspended after a final delivery failure. |

## Proposed small test: cocktails routed to a Kitchen Monitor

Setup on the iPad till: Impostazioni → Comande → a new print station "Bar cocktail".
Select a Kitchen Monitor, set the cocktail categories to **Produzione**, and leave all other categories
on their current printers. Comandi and the waiters' workflow stay the same.

| Question | What the software does | Manual | Needs the technician |
| --- | --- | --- | --- |
| Are cocktail tickets held from printing but visible on the monitor? | **Yes (documented).** With a Kitchen Monitor on a print station, orders "are not printed when they arrive, because they go straight to the Kitchen Monitor". Printing happens when the course or single dish is fulfilled ("evadere") on the monitor. | — | Whether a printer is needed at all, and whether printing on fulfilment can be turned off |
| Can the bartender decide when each ticket is fulfilled? | **Yes.** Fulfilment is per course ("Evadi portata") or per single dish. "Evadi portata" can also call the waiter with a notification (Gestione Messagistica). | The bartender taps each ticket | Display order (oldest first?), wait timers, and whether a ticket can be put on hold or reordered |
| Does it reduce the workload, or do all orders still arrive at once? | **It does not slow the flow.** Every cocktail confirmed in Comandi appears on the monitor immediately. No pacing or delay is documented. It turns paper tickets into an ordered on-screen list that the bartender works through, which helps organisation but not peak volume. | Pacing is still the bartender's judgement | Whether the monitor shows waiting times or a FIFO order that makes pacing easier |
| Can cocktails and espresso be handled separately? | **Yes (documented).** Each print station has its own categories and/or individual products, and can apply to one room or all rooms. A category can be in Produzione at only one active station at a time. Cocktails → Kitchen Monitor; espresso/caffetteria → the current bar printer (or its own station). A "Riepilogo" or "Globale" copy can show the other station's items for coordination. | — | Whether one till can drive two Kitchen Monitors, if ever needed |
| Can TeamSystem release automatically every 3–4 minutes? | **Not documented** in the app, the help centre or the API. | — | **Yes, ask directly** |

Other points:
- In the help centre, choosing a Kitchen Monitor for a print station is "available only on the iOS
  version" of the till. The café's till is an iPad, so this fits. A Kitchen Monitor APK for Android also
  exists, so ask which device the monitor itself can run on.
- Whether the Kitchen Monitor needs its own licence or module, and its cost, is not documented.

## Options, simplest first

1. **Kitchen Monitor for cocktails (recommended first test).**
   - No second app, no API, no Enterprise needed (unless the monitor needs its own licence), and nothing
     is sent twice.
   - The release is manual: the bartender works the list at their own pace.
2. **Our queue → API (cocktails only).** Only if TeamSystem confirms the gaps above. It needs
   Enterprise, waiters would have to enter cocktails outside Comandi, and every order needs a manual
   accept on the iPad. Not planned.
3. **A TeamSystem-supported automatic release**, if TeamSystem offers one (question 6 below).

## Questions for the TeamSystem technician

1. Which licence is the café on (Risto Pro / Risto Enterprise)? Does the Kitchen Monitor need an extra
   licence or module, and on which devices does it run (iPad, Android tablet)?
2. With cocktails routed to a Kitchen Monitor, does anything print on arrival? Can printing on
   fulfilment be switched off?
3. In what order does the Kitchen Monitor show tickets? Does it show how long each one has been waiting?
   Can a ticket be put on hold or moved?
4. Can the bartender fulfil a single item (one cocktail) rather than the whole ticket, and does the
   waiter get notified?
5. Can cocktails go to the Kitchen Monitor while espresso keeps printing on the current bar printer?
6. Is there any supported way to release comande automatically at a fixed interval (e.g. every 3–4 min),
   in Comandi, the Kitchen Monitor or a partner integration?
7. If our system created table orders through `POST /documents/orders/batch` (`deliveryMode=TABLE`),
   would accepting them on the iPad print or show the comanda at the right production centre? Would they
   join the table's open bill in Comandi? Can they be accepted automatically?
8. Is there a test/staging account we can use without touching the live till?
