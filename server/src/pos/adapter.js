/**
 * POS adapter contract.
 *
 * Every adapter receives the same normalised order payload and returns
 * `{ posOrderId }` on success. Throwing marks the delivery as failed; set
 * `err.permanent = true` to stop the outbox worker from retrying (e.g. the POS
 * rejected the payload) instead of it being a transient outage.
 *
 * Payload shape (see buildPosPayload in ../services/orders.js):
 * {
 *   orderId, orderCode, createdAt, notes, currency, totalCents,
 *   table: { number, posTableId },
 *   items: [{ productId, posProductId, name, quantity, unitPriceCents,
 *             lineTotalCents, notes }]
 * }
 */
export class PosAdapter {
  get name() {
    return "abstract";
  }

  // eslint-disable-next-line no-unused-vars
  async sendOrder(payload) {
    throw new Error("not implemented");
  }

  /** Whether the adapter is configured well enough to be used. */
  isConfigured() {
    return true;
  }
}
