export function buildState(env) {
  const customer = Math.min(env.currentCustomer, env.data.customers - 1);
  const costs = env.data.transportCost[customer];
  const maxCost = Math.max(1, ...costs);
  return [...env.data.capacity.map((x, w) => (x - env.usedCapacity[w]) / Math.max(1, x)), ...env.open.map(Number),
    ...costs.map((x) => x / maxCost),
    Math.max(0, env.data.demand[customer] - env.served[customer]) / Math.max(1, env.data.demand[customer])];
}
