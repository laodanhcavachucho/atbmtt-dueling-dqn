import { seededRandom } from "../utils/seed.js";

function runEpisode(envFactory, policy, episode) {
  const env = envFactory();
  let state = env.reset();
  let steps = 0;
  while (!env.done && steps < env.data.customers * env.data.warehouses) {
    const action = policy({ env, state });
    state = env.step(action).state;
    steps += 1;
  }
  if (!env.done) throw new Error("Policy failed to terminate within the episode limit");
  return { episode, ...env.summary() };
}

export function randomFeasiblePolicy({ env }, random) {
  const feasible = env.getActionMask().flatMap((allowed, action) => allowed ? [action] : []);
  return feasible.length ? feasible[Math.floor(random() * feasible.length)] : -1;
}

export function greedyFeasiblePolicy({ env }) {
  const customer = env.currentCustomer;
  const remaining = env.data.demand[customer] - env.served[customer];
  const mask = env.getActionMask();
  let best = -1;
  let bestCost = Infinity;
  mask.forEach((allowed, warehouse) => {
    if (!allowed) return;
    const quantity = Math.min(remaining, env.data.capacity[warehouse] - env.usedCapacity[warehouse]);
    const opening = env.open[warehouse] ? 0 : env.data.fixedCost[warehouse];
    const incremental = opening + quantity * env.data.transportCost[customer][warehouse];
    const average = incremental / Math.max(1, quantity);
    if (average < bestCost) {
      bestCost = average;
      best = warehouse;
    }
  });
  return best;
}

export function evaluateRandom(envFactory, { episodes = 5, seed = 20261021 } = {}) {
  const random = seededRandom(seed);
  return Array.from({ length: episodes }, (_, episode) =>
    { const row = runEpisode(envFactory, ({ env }) => randomFeasiblePolicy({ env }, random), episode); return { mode: "random", seed, ...row }; });
}

export function evaluateGreedy(envFactory, { episodes = 5, seed = 20261021 } = {}) {
  return Array.from({ length: episodes }, (_, episode) =>
    { const row = runEpisode(envFactory, greedyFeasiblePolicy, episode); return { mode: "greedy", seed, ...row }; });
}
