import { perturbState } from "../attacks/state-perturbation.js";
import { inspectState } from "../defenses/input-sanitizer.js";
import { detectAnomaly, fitAnomalyDetector, classificationMetrics } from "../defenses/anomaly-detector.js";
import { chooseGuardedAction } from "../defenses/safety-guardrails.js";
import { greedyFeasiblePolicy } from "./baseline.js";

function stateDrivenPolicy(env, state) {
  const mask = env.getActionMask();
  const start = env.data.warehouses * 2;
  let best = -1;
  let bestScore = Infinity;
  mask.forEach((allowed, warehouse) => {
    if (!allowed) return;
    const quantity = Math.min(env.data.demand[env.currentCustomer] - env.served[env.currentCustomer], env.data.capacity[warehouse] - env.usedCapacity[warehouse]);
    const opening = env.open[warehouse] ? 0 : env.data.fixedCost[warehouse];
    const score = opening + quantity * (state[start + warehouse] * 100);
    if (score < bestScore) { bestScore = score; best = warehouse; }
  });
  return best;
}

function collectValidationStates(envFactory, count = 10) {
  const states = [];
  for (let i = 0; i < count; i += 1) {
    const env = envFactory();
    states.push(env.reset());
  }
  return states;
}

export function evaluateDefenseConfigurations(envFactory, {
  episodes = 5,
  seed = 20261021,
  epsilon = 0.1,
  costThreshold = Infinity
} = {}) {
  const validationStates = collectValidationStates(envFactory);
  const detector = fitAnomalyDetector(validationStates);
  const configurations = ["baseline_clean", "under_attack", "input_sanitization", "adversarial_training", "safety_guardrails", "combined_defense"];
  const rows = [];
  for (const configuration of configurations) {
    for (let episode = 0; episode < episodes; episode += 1) {
      const env = envFactory();
      let state = env.reset();
      let steps = 0;
      let detections = 0;
      let blocked = 0;
      let attackSteps = 0;
      const decisions = [];
      while (!env.done && steps < env.data.customers * env.data.warehouses) {
        const inferenceStart = performance.now();
        const attacked = configuration !== "baseline_clean";
        const attackResult = attacked
          ? perturbState(state, { warehouses: env.data.warehouses, customers: env.data.customers, epsilon, seed: seed + episode + steps, transportCost: true, capacity: true, openStatus: true, remainingDemand: true })
          : { adversarialState: state, changedDimensions: 0 };
        const received = attackResult.adversarialState;
        const anomaly = detectAnomaly(received, detector);
        const structural = inspectState(received, { warehouses: env.data.warehouses, customers: env.data.customers, distribution: detector.distribution });
        const sanitized = configuration === "input_sanitization" || configuration === "combined_defense";
        const acceptedState = sanitized && !structural.accepted ? state : received;
        if (anomaly.detected) detections += 1;
        if (attacked) attackSteps += 1;
        let proposed = configuration === "baseline_clean" ? greedyFeasiblePolicy({ env }) : stateDrivenPolicy(env, acceptedState);
        let finalAction = proposed;
        if (configuration === "safety_guardrails" || configuration === "combined_defense") {
          const decision = chooseGuardedAction(env, proposed, { costThreshold });
          finalAction = decision.finalAction;
          if (decision.blocked) blocked += 1;
          decisions.push(decision);
        }
        state = env.step(finalAction).state;
        const inferenceOverheadMs = performance.now() - inferenceStart;
        if (!Number.isFinite(inferenceOverheadMs)) throw new Error("Unable to measure inference overhead");
        decisions.push({ inferenceOverheadMs });
        steps += 1;
      }
      if (!env.done) throw new Error("Defense evaluation exceeded episode step limit");
      const summary = env.summary();
      rows.push({
        configuration, episode, seed, attack_epsilon: attackedEpsilon(configuration, epsilon),
        status: configuration === "adversarial_training" ? "proxy_not_trained" : "measured",
        detection_rate: attackSteps ? detections / attackSteps : 0,
        invalid_action_rate: steps ? summary.invalidActions / steps : 0,
        attack_success: attackedEpsilon(configuration, epsilon) > 0 && summary.totalCost > 0,
        blocked_actions: blocked,
        inference_overhead_ms: decisions.reduce((sum, decision) => sum + (decision.inferenceOverheadMs || 0), 0) / Math.max(1, steps),
        decisions,
        ...summary
      });
    }
  }
  const cleanCosts = Object.fromEntries(rows.filter((row) => row.configuration === "baseline_clean").map((row) => [row.episode, row.totalCost]));
  rows.forEach((row) => {
    row.attack_success = row.configuration !== "baseline_clean" && row.totalCost > cleanCosts[row.episode];
  });
  return { rows, detector, anomalyMetrics: { note: "No ground-truth attack labels in cap111.txt; precision/recall/FPR require labeled validation attacks.", metrics: classificationMetrics(Array(episodes).fill(false), Array(episodes).fill(false)) } };
}

function attackedEpsilon(configuration, epsilon) {
  return configuration === "baseline_clean" ? 0 : epsilon;
}
