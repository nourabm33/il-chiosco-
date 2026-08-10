import { config } from "../config.js";
import { NoopPosAdapter } from "./noop-adapter.js";
import { HttpPosAdapter } from "./http-adapter.js";

const registry = {
  noop: NoopPosAdapter,
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
    const AdapterClass = registry[config.pos.driver] ?? NoopPosAdapter;
    instance = new AdapterClass();
  }
  return instance;
}

export function resetPosAdapter() {
  instance = null;
}
