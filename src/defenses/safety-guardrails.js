export function chooseGuardedAction(env, proposedAction, { costThreshold = Infinity } = {}) {
  const mask = env.getActionMask();
  const candidates = mask.flatMap((allowed, action) => allowed ? [action] : []);
  const decision = { proposedAction, finalAction: proposedAction, blocked: false, reason: null };
  if (Number.isInteger(proposedAction) && mask[proposedAction]) {
    const quantity = Math.min(env.data.demand[env.currentCustomer] - env.served[env.currentCustomer], env.data.capacity[proposedAction] - env.usedCapacity[proposedAction]);
    const opening = env.open[proposedAction] ? 0 : env.data.fixedCost[proposedAction];
    const cost = opening + quantity * env.data.transportCost[env.currentCustomer][proposedAction];
    if (cost <= costThreshold) return decision;
  }
  decision.blocked = true;
  decision.reason = !Number.isInteger(proposedAction) || !mask[proposedAction] ? "action_mask" : "cost_threshold";
  decision.finalAction = candidates.find((action) => action !== proposedAction && action >= 0) ?? -1;
  return decision;
}

export function enforceSafeAction(action, mask) {
  return Number.isInteger(action) && mask[action] ? action : mask.findIndex(Boolean);
}
