import { PosAdapter } from "./adapter.js";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";

/**
 * Default adapter until the POS technician provides the real integration.
 * Nothing leaves the server: releases are recorded as `simulated`, which the
 * dashboard labels "Simulato — non inviato alla cassa", never as sent.
 */
export class SimulationPosAdapter extends PosAdapter {
  get name() {
    return "simulation";
  }

  async sendOrder(payload) {
    if (Math.random() < config.pos.simulationFailureRate) {
      const err = new Error("Simulated POS failure (POS_SIMULATION_FAILURE_RATE)");
      err.permanent = true;
      throw err;
    }
    logger.info(
      { orderCode: payload.orderCode, table: payload.table.number },
      "POS simulation — order released, not forwarded to the till",
    );
    return { posOrderId: null, simulated: true };
  }
}
