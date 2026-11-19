export function calculateReward({ quantity, transportCost, fixedCost, penalty = 1000, unserved = 0 }) {
  return -(quantity * transportCost + fixedCost + unserved * penalty);
}
