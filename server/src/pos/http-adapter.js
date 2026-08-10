import { PosAdapter } from "./adapter.js";
import { config } from "../config.js";

/**
 * Generic HTTP adapter skeleton.
 *
 * Everything that is POS-specific is configuration, not code: base URL, auth
 * scheme, orders path. The request body below is our normalised payload — once
 * the technician sends the real contract, only `mapPayload` (and possibly the
 * auth header) needs to change, or a dedicated adapter can be dropped next to
 * this file and registered in ./index.js.
 */
export class HttpPosAdapter extends PosAdapter {
  get name() {
    return "http";
  }

  isConfigured() {
    return Boolean(config.pos.baseUrl);
  }

  authHeaders() {
    const { apiKey, authScheme } = config.pos;
    if (!apiKey) return {};
    if (authScheme === "basic") return { Authorization: `Basic ${apiKey}` };
    if (authScheme === "header") return { "X-API-Key": apiKey };
    return { Authorization: `Bearer ${apiKey}` };
  }

  /** Replace with the POS vendor's documented request body. */
  mapPayload(payload) {
    return {
      external_id: payload.orderId,
      reference: payload.orderCode,
      created_at: payload.createdAt,
      table_id: payload.table.posTableId ?? String(payload.table.number),
      currency: payload.currency,
      total: payload.totalCents / 100,
      note: payload.notes ?? undefined,
      lines: payload.items.map((item) => ({
        product_id: item.posProductId ?? undefined,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPriceCents / 100,
        total: item.lineTotalCents / 100,
        note: item.notes ?? undefined,
      })),
    };
  }

  async sendOrder(payload) {
    if (!this.isConfigured()) {
      const err = new Error("POS_BASE_URL is not configured");
      err.permanent = true;
      throw err;
    }

    const url = new URL(config.pos.ordersPath, config.pos.baseUrl).toString();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Lets the POS de-duplicate if the worker retries after a timeout.
        "Idempotency-Key": payload.orderId,
        ...this.authHeaders(),
      },
      body: JSON.stringify(this.mapPayload(payload)),
      signal: AbortSignal.timeout(config.pos.timeoutMs),
    });

    const text = await response.text();
    if (!response.ok) {
      const err = new Error(
        `POS responded ${response.status}: ${text.slice(0, 300)}`,
      );
      // 4xx (other than rate limiting) will never succeed on retry.
      err.permanent = response.status >= 400 && response.status < 500 && response.status !== 429;
      throw err;
    }

    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return { posOrderId: body?.id ?? body?.order_id ?? null };
  }
}
