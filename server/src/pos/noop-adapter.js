import { PosAdapter } from "./adapter.js";
import { logger } from "../lib/logger.js";

/**
 * Default adapter used until the POS technician provides the real API
 * documentation. Orders are stored and marked `skipped` for POS delivery, so
 * nothing is lost and no API details are invented.
 */
export class NoopPosAdapter extends PosAdapter {
  get name() {
    return "noop";
  }

  async sendOrder(payload) {
    logger.info(
      { orderCode: payload.orderCode, table: payload.table.number },
      "POS driver is 'noop' — order stored, not forwarded",
    );
    return { posOrderId: null, skipped: true };
  }
}
