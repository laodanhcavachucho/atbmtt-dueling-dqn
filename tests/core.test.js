import test from "node:test";
import assert from "node:assert/strict";
import { parseCapFile } from "../src/data/parser.js";
import { WarehouseEnv } from "../src/environment/warehouse-env.js";
import { maskedArgmax } from "../src/environment/action-mask.js";
import { ReplayBuffer } from "../src/agent/replay-buffer.js";
import { sanitizeState } from "../src/defenses/input-sanitizer.js";
import { fgsmPerturb, finiteDifferenceGradient } from "../src/attacks/fgsm-attack.js";
import { perturbState } from "../src/attacks/state-perturbation.js";
import { inspectState, fitStateDistribution } from "../src/defenses/input-sanitizer.js";
import { fitAnomalyDetector, detectAnomaly } from "../src/defenses/anomaly-detector.js";
import { chooseGuardedAction } from "../src/defenses/safety-guardrails.js";

const text = `1 1\n10 5 1\n3\n2`;
test("parser validates compact dataset", () => assert.deepEqual(parseCapFile(text).demand, [3]));
test("environment opens once and respects capacity", () => {
  const e = new WarehouseEnv({ warehouses: 1, customers: 1, fixedCost: [5], capacity: [10], maxCustomers: [1], demand: [3], transportCost: [[2]] });
  e.reset(); e.step(0); assert.equal(e.summary().fixedCost, 5); assert.equal(e.summary().totalCost, 11);
});
test("state and mask stay synchronized across a split allocation", () => {
  const e = new WarehouseEnv({ warehouses: 2, customers: 1, fixedCost: [5, 7], capacity: [2, 5], maxCustomers: [1, 1], demand: [4], transportCost: [[2, 3]] });
  const initial = e.reset();
  assert.equal(initial.length, 2 + 2 + 2 + 1);
  assert.deepEqual(e.getActionMask(), [true, true]);
  const first = e.step(0);
  assert.equal(first.reward, -(5 + 4));
  assert.equal(e.served[0], 2);
  assert.deepEqual(e.getActionMask(), [false, true]);
  const second = e.step(1);
  assert.equal(second.done, true);
  assert.equal(e.summary().totalCost, 5 + 7 + 2 * 2 + 2 * 3);
  assert.equal(first.reward + second.reward, -e.summary().totalCost);
});
test("no feasible action terminates and records unmet demand", () => {
  const e = new WarehouseEnv({ warehouses: 1, customers: 1, fixedCost: [5], capacity: [1], maxCustomers: [1], demand: [3], transportCost: [[2]] }, { penalty: 10 });
  e.reset();
  e.step(0);
  assert.equal(e.done, true);
  assert.equal(e.summary().unservedDemand, 2);
  assert.equal(e.summary().unservedPenalty, 20);
});
test("mask ignores invalid action", () => assert.equal(maskedArgmax([1, 99], [true, false]), 0));
test("replay buffer is bounded", () => { const b = new ReplayBuffer(1); b.add(1); b.add(2); assert.deepEqual(b.sample(2), [2]); });
test("sanitizer rejects malformed inputs", () => {
  assert.throws(() => sanitizeState([Infinity], {}), /nan_or_infinity/);
});
test("FGSM epsilon zero and finite differences are deterministic", () => {
  const state = [0.2, 0.8, 0.4];
  assert.deepEqual(fgsmPerturb(state, [1, -1, 0], 0), state);
  assert.deepEqual(fgsmPerturb(state, [1, -1, 1], 1), [1, 0, 1]);
  const gradient = finiteDifferenceGradient((x) => x[0] ** 2 + 3 * x[1], state);
  assert.ok(Math.abs(gradient[0] - 0.4) < 1e-4);
  assert.ok(Math.abs(gradient[1] - 3) < 1e-4);
});
test("rule perturbation is bounded and reproducible", () => {
  const state = Array(3 * 2 + 1).fill(0.5);
  const options = { warehouses: 2, customers: 1, epsilon: 0.2, seed: 9, capacity: true, openStatus: true, transportCost: true, remainingDemand: true };
  const first = perturbState(state, options);
  const second = perturbState(state, options);
  assert.deepEqual(first, second);
  assert.ok(first.adversarialState.every((value) => value >= 0 && value <= 1));
});
test("sanitizer distinguishes structural and anomalous states", () => {
  const distribution = fitStateDistribution([[0.5], [0.51]]);
  assert.equal(inspectState([], { warehouses: 0, customers: 0 }).category, "structural");
  const valid = inspectState([0.5], { warehouses: 0, customers: 0, distribution });
  assert.equal(valid.accepted, true);
  assert.equal(inspectState([2], { warehouses: 0, customers: 0 }).category, "anomalous");
});
test("anomaly threshold is fit from clean validation states", () => {
  const detector = fitAnomalyDetector([[0.1, 0.1], [0.1, 0.1], [0.1, 0.1]]);
  assert.equal(detectAnomaly([0.1, 0.1], detector).detected, false);
});
test("guardrail falls back to a feasible action", () => {
  const e = new WarehouseEnv({ warehouses: 2, customers: 1, fixedCost: [5, 5], capacity: [1, 2], maxCustomers: [1, 1], demand: [1], transportCost: [[1, 1]] });
  e.reset();
  const decision = chooseGuardedAction(e, 99);
  assert.equal(decision.finalAction, 0);
  assert.equal(decision.blocked, true);
});
