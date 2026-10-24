import { config } from "../config.js";
import { SimulationPosAdapter } from "./simulation-adapter.js";
import { HttpPosAdapter } from "./http-adapter.js";

const registry = {
  simulation: SimulationPosAdapter,
  // pre-queue name of the simulation driver, kept so old .env files still work
  noop: SimulationPosAdapter,
  http: HttpPosAdapter,
};

let instance = null;

/** Register a vendor-specific adapter (used by tests and future POS drivers). */
export function registerPosAdapter(name, AdapterClass) {
  registry[name] = AdapterClass;
  instance = null;
}

export function getPosAdapter() {
  if (!instance) {
    const AdapterClass = registry[config.pos.driver] ?? SimulationPosAdapter;
    instance = new AdapterClass();
  }
  return instance;
}

export function resetPosAdapter() {
  instance = null;
}
