import { seededRandom } from "../utils/seed.js";

export const STATE_GROUPS = Object.freeze({
  capacity: "capacity",
  openStatus: "openStatus",
  transportCost: "transportCost",
  remainingDemand: "remainingDemand"
});

export function perturbState(state, {
  warehouses,
  customers,
  epsilon = 0.1,
  seed = 20261021,
  capacity = false,
  openStatus = false,
  transportCost = false,
  remainingDemand = false
} = {}) {
  if (!Number.isInteger(warehouses) || !Number.isInteger(customers) || warehouses < 1 || customers < 1) {
    throw new Error("warehouses and customers are required");
  }
  if (!Number.isFinite(epsilon) || epsilon < 0 || epsilon > 1) throw new Error("epsilon must be between 0 and 1");
  const expectedWithTransport = warehouses * 3 + 1;
  if (state.length !== expectedWithTransport) throw new Error(`Expected state length ${expectedWithTransport}`);
  const random = seededRandom(seed);
  const output = [...state];
  const changed = [];
  const groups = [
    [capacity, 0, warehouses],
    [openStatus, warehouses, warehouses * 2],
    [transportCost, warehouses * 2, warehouses * 3],
    [remainingDemand, warehouses * 3, warehouses * 3 + 1]
  ];
  for (const [enabled, start, end] of groups) {
    if (!enabled) continue;
    for (let i = start; i < end; i += 1) {
      const direction = random() < 0.5 ? -1 : 1;
      const next = Math.min(1, Math.max(0, output[i] + direction * epsilon));
      if (next !== output[i]) changed.push(i);
      output[i] = next;
    }
  }
  return { cleanState: [...state], adversarialState: output, changedDimensions: changed.length, changedIndices: changed };
}
