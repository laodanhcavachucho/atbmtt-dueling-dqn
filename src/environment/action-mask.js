export function getActionMask(env) {
  const c = env.currentCustomer;
  if (c >= env.data.customers) return Array(env.data.warehouses).fill(false);
  const remaining = env.data.demand[c] - env.served[c];
  return env.data.capacity.map((_, w) =>
    remaining > 0 && env.data.capacity[w] - env.usedCapacity[w] > 0 &&
    env.usedCustomers[w] < env.data.maxCustomers[w] &&
    Number.isFinite(env.data.transportCost[c][w]) && env.data.transportCost[c][w] >= 0);
}

export function maskedArgmax(values, mask) {
  let best = -1, bestValue = -Infinity;
  values.forEach((value, i) => { if (mask[i] && Number.isFinite(value) && value > bestValue) { best = i; bestValue = value; } });
  return best;
}
