import { seededRandom } from "../utils/seed.js";

export function createSyntheticData({ warehouses = 50, customers = 50, seed = 20261021 } = {}) {
  const random = seededRandom(seed);
  const fixedCost = [], capacity = [], maxCustomers = [];
  for (let w = 0; w < warehouses; w++) {
    fixedCost.push(5000 + Math.floor(random() * 5000));
    capacity.push(5000 + Math.floor(random() * 5000));
    maxCustomers.push(5 + Math.floor(random() * 16));
  }
  const demand = Array.from({ length: customers }, () => 100 + Math.floor(random() * 4901));
  const transportCost = demand.map(() => Array.from({ length: warehouses }, () => 1 + Math.floor(random() * 100)));
  return { warehouses, customers, fixedCost, capacity, maxCustomers, demand, transportCost, source: "synthetic", seed };
}
