import * as tf from "@tensorflow/tfjs-node";
import { maskedArgmax } from "../environment/action-mask.js";
import { computeFgsmAttack } from "../attacks/fgsm-attack.js";
import { perturbState } from "../attacks/state-perturbation.js";

export async function evaluateAttack(envFactory, model, {
  episodes = 5,
  seed = 20261021,
  epsilon = 0,
  attackType = "state-perturbation",
  scenarios = { capacity: true, openStatus: true, transportCost: true, remainingDemand: true }
} = {}) {
  const rows = [];
  for (let episode = 0; episode < episodes; episode += 1) {
    const env = envFactory();
    let state = env.reset();
    let changedDimensions = 0;
    let steps = 0;
    const stateTrace = [];
    while (!env.done && steps < env.data.customers * env.data.warehouses) {
      const mask = env.getActionMask();
      let adversarialState = state;
      if (attackType === "fgsm") {
        const result = await computeFgsmAttack(model, state, mask, { epsilon });
        adversarialState = result.adversarialState;
        changedDimensions += adversarialState.reduce((count, value, index) => count + (value !== state[index] ? 1 : 0), 0);
      } else {
        const result = perturbState(state, { warehouses: env.data.warehouses, customers: env.data.customers, epsilon, seed: seed + episode + steps, ...scenarios });
        adversarialState = result.adversarialState;
        changedDimensions += result.changedDimensions;
      }
      stateTrace.push({ cleanState: [...state], adversarialState: [...adversarialState] });
      const values = tf.tidy(() => model.predict(tf.tensor2d([adversarialState])).dataSync().slice());
      const action = maskedArgmax(values, mask);
      state = env.step(action).state;
      steps += 1;
    }
    if (!env.done) throw new Error("Attack policy failed to terminate within the episode limit");
    rows.push({ episode, mode: attackType, seed, attack_epsilon: epsilon, changed_dimensions: changedDimensions, stateTrace, ...env.summary() });
  }
  return rows;
}
