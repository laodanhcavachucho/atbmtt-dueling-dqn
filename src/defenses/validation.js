export function fitCostThreshold(costs, quantile = 0.95) {
  if (!costs.length) throw new Error("Clean validation costs are required");
  const sorted = [...costs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * quantile))];
}
