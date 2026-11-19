export function summarize(rows) {
  const costs = rows.map((r) => r.totalCost), mean = costs.reduce((a, b) => a + b, 0) / Math.max(1, costs.length);
  const std = Math.sqrt(costs.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, costs.length));
  return { mean, std, count: costs.length };
}
